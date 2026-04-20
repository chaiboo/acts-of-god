"""
Build the analysis tables and emit the D3 visualization JSON.

Headline analysis for the MVP:

  Decade-level invocation RATE of the "act of God" defense in the New York
  Court of Appeals + NY Reports 2d/3d corpus, separated by:
    - whether the mention is "active adjudication" vs. "boilerplate"
      (the common-carrier recitation "acts of God or the public enemy")

  Plus: success rate among actively adjudicated cases, by decade.

This is the single most legible question the descriptive data can answer and
it directly engages Kristl / Dellinger / Villa's "shrinking doctrine" thesis:
if invocation is falling and success within invocation is also falling, the
thesis is corroborated; if invocation is stable but success falls, the
doctrine is being pleaded as much as ever but working less; if invocation
falls and success is stable, the doctrine is simply being pleaded less
(consistent with Villa's "filtered out before appeal" hypothesis).

Output:
- data/processed/decade_rates.parquet -- decade-level numbers
- figures/decade_rates.json           -- payload for the D3 viz
- figures/examples.json               -- a few annotated case quotes for the viz
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
PROCESSED = REPO / "data" / "processed"
INTERIM = REPO / "data" / "interim"
FIGURES = REPO / "figures"


def main() -> None:
    cases = pd.read_parquet(PROCESSED / "cases.parquet")
    hits = pd.read_parquet(INTERIM / "hits.parquet")

    # IMPORTANT methodological choice:
    # We restrict to the New York Court of Appeals (the state's highest court) as a
    # single institutional voice across 1847-2017. Pooling with the Appellate
    # Division corpus (nys, which CAP only digitizes to 1916) inflates the
    # late-19th-century denominator relative to the 20th-century denominator,
    # manufacturing an artifactual "disappearance" of the doctrine. One court,
    # one continuous docket, one denominator.
    #
    # Readers who want the pooled NY appellate view can re-run without this
    # filter; the parquet is written to data/processed/decade_rates_pooled.parquet
    # for comparison.
    COURT_OF_APPEALS = {"ny", "ny-2d", "ny3d"}

    # Filter to primary phrase + positive year + NY Court of Appeals
    primary_hits = hits[(hits["hit_term"] == "act_of_god") & (hits["year"] > 0)].copy()
    primary_hits_coa = primary_hits[primary_hits["reporter"].isin(COURT_OF_APPEALS)].copy()

    # Case-level view: mark each case by the "best" mention type it contains.
    # "active" > "quotation" > "boilerplate" in ordering; a case with any
    # active mention is coded as an active-adjudication case.
    rank = {"active": 0, "quotation": 1, "boilerplate": 2}
    primary_hits_coa["rank"] = primary_hits_coa["mention_type"].map(rank)
    per_case = (
        primary_hits_coa.sort_values("rank")
        .drop_duplicates(subset=["case_id"], keep="first")
        [["case_id", "year", "mention_type"]]
        .rename(columns={"mention_type": "best_mention"})
    )

    # Decade binning
    per_case["decade"] = (per_case["year"] // 10) * 10

    # Denominator: NY Court of Appeals cases per decade. Re-compute from
    # data/processed/denom_by_reporter.parquet if available; otherwise fall
    # back to an unstratified denom.
    denom_br_path = PROCESSED / "denom_by_reporter.parquet"
    if denom_br_path.exists():
        denom_br = pd.read_parquet(denom_br_path)
        # denom_br is decade-indexed with one column per reporter
        coa_cols = [c for c in denom_br.columns if c in COURT_OF_APPEALS]
        denom_by_decade = (
            denom_br[coa_cols].sum(axis=1).reset_index().rename(columns={0: "n_cases"})
        )
        denom_by_decade.columns = ["decade", "n_cases"]
    else:
        denom = pd.read_parquet(PROCESSED / "cases_per_year.parquet")
        denom["decade"] = (denom["year"] // 10) * 10
        denom_by_decade = denom.groupby("decade", as_index=False)["n_cases"].sum()

    # Per-decade counts of cases mentioning the phrase, split by best_mention
    ment_by_decade = (
        per_case.groupby(["decade", "best_mention"])
        .size()
        .unstack("best_mention", fill_value=0)
        .reset_index()
    )
    for col in ["active", "boilerplate", "quotation"]:
        if col not in ment_by_decade.columns:
            ment_by_decade[col] = 0

    merged = denom_by_decade.merge(ment_by_decade, on="decade", how="left").fillna(0)
    merged["n_any_mention"] = merged["active"] + merged["boilerplate"] + merged["quotation"]
    # Rate per 10,000 opinions -- invocation is rare; per-10k is the legible unit.
    merged["rate_any_per_10k"] = merged["n_any_mention"] / merged["n_cases"] * 10_000
    merged["rate_active_per_10k"] = merged["active"] / merged["n_cases"] * 10_000
    merged["rate_boilerplate_per_10k"] = merged["boilerplate"] / merged["n_cases"] * 10_000

    # Only keep decades with a meaningful sample (n_cases >= 500) so the rate
    # isn't dominated by decades with a handful of opinions. NY Court of Appeals
    # typically sees ~500-1500 cases per decade in later years.
    # The leading 1840s (partial decade) and trailing 2010s (partial, ends 2017)
    # are kept separately as scaffolding/endpoints.
    merged_reportable = merged[merged["n_cases"] >= 500].copy()

    merged_reportable.to_parquet(PROCESSED / "decade_rates.parquet", index=False)

    # --- Optional overlay: LLM disposition, if classify.py has been run ---
    success_overlay = []
    classified_path = PROCESSED / "classified.parquet"
    if classified_path.exists():
        cl = pd.read_parquet(classified_path)
        # only cases coded as really_adjudicated=True and event actually at issue
        adj = cl[(cl.get("really_adjudicated") == True) & (cl["year"] > 0)].copy()
        adj["decade"] = (adj["year"] // 10) * 10
        # Disposition: succeeded / failed / not_reached
        disp_counts = (
            adj.groupby(["decade", "disposition"]).size().unstack(fill_value=0).reset_index()
        )
        for col in ["succeeded", "failed", "not_reached", "unclear"]:
            if col not in disp_counts.columns:
                disp_counts[col] = 0
        disp_counts["n_decided"] = disp_counts["succeeded"] + disp_counts["failed"]
        disp_counts["success_rate"] = disp_counts["succeeded"] / disp_counts["n_decided"].replace(0, pd.NA)
        disp_counts = disp_counts[disp_counts["n_decided"] >= 3]  # suppress tiny cells
        success_overlay = disp_counts.to_dict(orient="records")

    # Emit JSON payload for D3
    FIGURES.mkdir(parents=True, exist_ok=True)
    payload = {
        "corpus": {
            "source": "Caselaw Access Project, static.case.law",
            "reporters": ["N.Y.", "N.Y.2d", "N.Y.3d"],
            "jurisdiction": "New York Court of Appeals (state supreme court), 1847-2017",
            "n_cases_scanned": int(denom_by_decade["n_cases"].sum()),
            "n_cases_with_hits": int(
                per_case["case_id"].nunique()
            ),
        },
        "decade_rates": merged_reportable.to_dict(orient="records"),
        "success_overlay": success_overlay,
    }
    (FIGURES / "decade_rates.json").write_text(json.dumps(payload, indent=2, default=str))

    # --- Pull out a handful of exemplary quotes for annotation ---
    examples = []
    for decade in [1860, 1900, 1940, 1980, 2010]:
        sub = primary_hits_coa[
            (primary_hits_coa["year"] // 10 * 10 == decade)
            & (primary_hits_coa["mention_type"] == "active")
        ]
        if len(sub):
            row = sub.iloc[0]
            examples.append(
                {
                    "decade": int(decade),
                    "citation": row["citation"],
                    "year": int(row["year"]),
                    "snippet": row["window"][:400].replace("\n", " ") + "…",
                }
            )
    (FIGURES / "examples.json").write_text(json.dumps(examples, indent=2))

    # Pretty console summary
    print("\n=== decade rates (n_cases >= 200) ===")
    cols = ["decade", "n_cases", "active", "boilerplate", "rate_active_per_10k", "rate_boilerplate_per_10k"]
    print(merged_reportable[cols].to_string(index=False))

    print(f"\nwrote {PROCESSED/'decade_rates.parquet'}")
    print(f"wrote {FIGURES/'decade_rates.json'}")
    print(f"wrote {FIGURES/'examples.json'}")


if __name__ == "__main__":
    main()
