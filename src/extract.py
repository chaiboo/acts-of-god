"""
Extract "act of God" regex hits from CAP case zips.

For each case:
- run the phrase regex on the concatenated opinion text
- for each hit, extract a ±3 paragraph window
- classify the mention as `active_use` vs `boilerplate` vs `quotation` via
  lightweight lexical heuristics. (A full LLM pass would be better; this is
  the cheap-pre-filter before classification.)

Outputs:
- data/interim/hits.parquet   -- one row per regex hit (may be multiple per case)
- data/processed/cases.parquet -- one row per case containing >=1 hit, with metadata

Paragraphs are split on blank lines, which is how CAP's OCR structures opinion
text. This is imperfect for 19th-century printing conventions but good enough
for a window-extraction heuristic.
"""

from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from tqdm import tqdm

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
RAW = REPO / "data" / "raw"
INTERIM = REPO / "data" / "interim"
PROCESSED = REPO / "data" / "processed"

# Primary doctrinal phrase. The word boundary around "God" is important:
# "Godfrey v. Smith" would otherwise spuriously match.
PHRASE_RE = re.compile(r"\bact[s]?\s+of\s+God\b", re.IGNORECASE)

# Related doctrinal terms (marked separately; not pooled with "act of God").
RELATED_RE = {
    "vis_major": re.compile(r"\bvis\s+major\b", re.IGNORECASE),
    "damnum_fatale": re.compile(r"\bdamnum\s+fatale\b", re.IGNORECASE),
    "inevitable_accident": re.compile(r"\binevitable\s+accident\b", re.IGNORECASE),
}

# Common-carrier boilerplate. The phrase "acts of God or the public enemy"
# appears in contract-of-carriage cases as recitation of a standard rule
# of common law, often without the court actually adjudicating the defense.
# Flag these so downstream analysis can optionally exclude them.
BOILERPLATE_RE = re.compile(
    r"act[s]?\s+of\s+God\s*(?:,?\s*(?:the\s+)?(?:public\s+enemy|king['’]?s\s+enemies|enemies\s+of\s+the)"
    r"|\s+or\s+the\s+public\s+enemy)",
    re.IGNORECASE,
)

# Quotation / citation context: if the phrase falls inside a quoted passage
# attributed to another case, it's usually not the court applying the
# doctrine itself. Crude detector — we flag for later review, not exclusion.
QUOTE_CONTEXT_RE = re.compile(r'["“][^"”]{20,500}$')


@dataclass
class CaseMeta:
    case_id: int
    reporter: str
    volume: str
    citation: str
    court: str
    jurisdiction: str
    name_abbreviation: str
    decision_date: str
    year: int
    first_page: str
    last_page: str
    word_count: int


def iter_cases(raw_root: Path):
    """Yield (reporter, volume, case_json_dict) for every case across all zip volumes."""
    for reporter_dir in sorted(raw_root.iterdir()):
        if not reporter_dir.is_dir():
            continue
        zips = sorted(reporter_dir.glob("*.zip"))
        for zp in zips:
            volume = zp.stem
            try:
                with zipfile.ZipFile(zp) as zf:
                    for name in zf.namelist():
                        # Only per-case files; CAP zips also contain
                        # metadata/CasesMetadata.json (a list of all cases).
                        if not name.startswith("json/") or not name.endswith(".json"):
                            continue
                        with zf.open(name) as f:
                            try:
                                case = json.load(f)
                            except json.JSONDecodeError:
                                continue
                            if not isinstance(case, dict):
                                continue
                            yield reporter_dir.name, volume, case
            except zipfile.BadZipFile:
                continue


def case_text(case: dict) -> str:
    """Concatenate all opinion texts for a case. CAP casebody.opinions is a list."""
    body = case.get("casebody") or {}
    opinions = body.get("opinions") or []
    parts = []
    for op in opinions:
        t = op.get("text")
        if t:
            parts.append(t)
    return "\n\n".join(parts)


def split_paragraphs(text: str) -> list[str]:
    """Split on blank lines. CAP OCR preserves paragraph breaks as \\n\\n."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    return paras


def window_for_hit(paras: list[str], hit_para_idx: int, k: int = 3) -> str:
    """Extract ±k paragraphs around the hit paragraph."""
    lo = max(0, hit_para_idx - k)
    hi = min(len(paras), hit_para_idx + k + 1)
    return "\n\n".join(paras[lo:hi])


def extract_year(decision_date: str) -> int:
    """Pull year from 'YYYY', 'YYYY-MM', or 'YYYY-MM-DD' strings. Return 0 on failure."""
    if not decision_date:
        return 0
    m = re.match(r"(\d{4})", decision_date)
    return int(m.group(1)) if m else 0


def meta_from_case(reporter: str, volume: str, case: dict) -> CaseMeta:
    cites = case.get("citations") or []
    primary = next((c["cite"] for c in cites if c.get("type") == "official"), None)
    if primary is None:
        primary = cites[0]["cite"] if cites else ""
    court = (case.get("court") or {}).get("name") or ""
    jur = (case.get("jurisdiction") or {}).get("name") or ""
    txt = case_text(case)
    return CaseMeta(
        case_id=case.get("id", 0),
        reporter=reporter,
        volume=volume,
        citation=primary,
        court=court,
        jurisdiction=jur,
        name_abbreviation=case.get("name_abbreviation") or case.get("name") or "",
        decision_date=case.get("decision_date") or "",
        year=extract_year(case.get("decision_date") or ""),
        first_page=str(case.get("first_page") or ""),
        last_page=str(case.get("last_page") or ""),
        word_count=len(txt.split()),
    )


def find_hits(text: str) -> list[tuple[int, int, str]]:
    """Return list of (start, end, matched_text) for the phrase."""
    return [(m.start(), m.end(), m.group(0)) for m in PHRASE_RE.finditer(text)]


def paragraph_of_offset(paras: list[str], joined: str, offset: int) -> int:
    """Given a character offset into the \\n\\n-joined text, return the paragraph index."""
    running = 0
    for i, p in enumerate(paras):
        end = running + len(p)
        if running <= offset <= end:
            return i
        running = end + 2  # for "\n\n"
    return len(paras) - 1


def classify_mention(window: str, hit_text: str) -> str:
    """
    Heuristic triage:
    - 'boilerplate' if the phrase appears as part of common-carrier recitation
    - 'quotation' if the phrase appears inside a quoted block (crude)
    - 'active' otherwise. Downstream LLM pass refines this.
    """
    if BOILERPLATE_RE.search(window):
        return "boilerplate"
    # look at the immediate sentence containing the phrase
    # if more open quotes than close quotes precede it, we're inside a quotation
    idx = window.lower().find(hit_text.lower())
    if idx > 0:
        prefix = window[:idx]
        # use curly quotes and straight, common in CAP OCR
        opens = prefix.count("“") + prefix.count('"')
        closes = prefix.count("”")
        if opens % 2 == 1 or closes < (prefix.count("“")):
            return "quotation"
    return "active"


def main() -> None:
    INTERIM.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)

    cases_with_hits: list[dict] = []
    hits_rows: list[dict] = []
    cases_seen = 0
    cases_with_any_hit = 0

    for reporter, volume, case in tqdm(iter_cases(RAW), desc="cases"):
        cases_seen += 1
        txt = case_text(case)
        if not txt:
            continue
        # fast reject: phrase not present
        if not PHRASE_RE.search(txt) and not any(r.search(txt) for r in RELATED_RE.values()):
            continue

        meta = meta_from_case(reporter, volume, case)
        paras = split_paragraphs(txt)
        joined = "\n\n".join(paras)

        primary_hits = find_hits(joined)
        if primary_hits:
            cases_with_any_hit += 1
            for h_start, h_end, h_txt in primary_hits:
                p_idx = paragraph_of_offset(paras, joined, h_start)
                window = window_for_hit(paras, p_idx, k=3)
                mention_type = classify_mention(window, h_txt)
                hits_rows.append(
                    {
                        "case_id": meta.case_id,
                        "reporter": reporter,
                        "volume": volume,
                        "citation": meta.citation,
                        "year": meta.year,
                        "hit_term": "act_of_god",
                        "hit_text": h_txt,
                        "paragraph_idx": p_idx,
                        "n_paragraphs": len(paras),
                        "window": window,
                        "mention_type": mention_type,
                    }
                )

        # related terms — separate rows, flagged as such
        for term, pat in RELATED_RE.items():
            for m in pat.finditer(joined):
                p_idx = paragraph_of_offset(paras, joined, m.start())
                window = window_for_hit(paras, p_idx, k=3)
                hits_rows.append(
                    {
                        "case_id": meta.case_id,
                        "reporter": reporter,
                        "volume": volume,
                        "citation": meta.citation,
                        "year": meta.year,
                        "hit_term": term,
                        "hit_text": m.group(0),
                        "paragraph_idx": p_idx,
                        "n_paragraphs": len(paras),
                        "window": window,
                        "mention_type": "related_term",
                    }
                )

        # case-level record if any hit at all
        if primary_hits or any(pat.search(joined) for pat in RELATED_RE.values()):
            cases_with_hits.append(
                {
                    **meta.__dict__,
                    "n_act_of_god_hits": len(primary_hits),
                    "has_related_term": any(pat.search(joined) for pat in RELATED_RE.values()),
                }
            )

    # Also compute per-year case counts for a denominator (invocation RATE needs this).
    # Scan case metadata only, cheaply, in a second pass — reuse the cases we've already
    # seen by instead re-streaming; here we count during the same pass using a closure
    # would be cleaner. Do a second pass; I/O cost is modest.
    year_counts: dict[int, int] = {}
    for reporter, volume, case in tqdm(iter_cases(RAW), desc="denom"):
        y = extract_year(case.get("decision_date") or "")
        if y:
            year_counts[y] = year_counts.get(y, 0) + 1

    hits_df = pd.DataFrame(hits_rows)
    cases_df = pd.DataFrame(cases_with_hits).drop_duplicates(subset=["case_id"])
    denom_df = pd.DataFrame(
        [{"year": y, "n_cases": c} for y, c in sorted(year_counts.items())]
    )

    hits_df.to_parquet(INTERIM / "hits.parquet", index=False)
    cases_df.to_parquet(PROCESSED / "cases.parquet", index=False)
    denom_df.to_parquet(PROCESSED / "cases_per_year.parquet", index=False)

    print(
        f"\ncases scanned: {cases_seen:,}\n"
        f"cases with >=1 'act of god' hit: {cases_with_any_hit:,}\n"
        f"total hits: {len(hits_df):,}\n"
        f"wrote: {INTERIM/'hits.parquet'}\n"
        f"wrote: {PROCESSED/'cases.parquet'}\n"
        f"wrote: {PROCESSED/'cases_per_year.parquet'}"
    )


if __name__ == "__main__":
    main()
