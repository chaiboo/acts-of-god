# Audit — Acts of God project, post-Illinois addendum

Cross-referenced against `data/processed/classified.parquet` (416 rows), `data/interim/hits.parquet` (781 hits / 416 cases), `data/processed/denom_by_reporter.parquet` (273,363), and the four figure JSONs.

## 1. Number consistency

| claim | stated | parquet | verdict |
|---|---|---|---|
| opinions scanned | 273,363 | 273,363 | OK |
| "act of God" hit-cases | 299 | 299 | OK |
| classified rows | 416 | 416 | OK |
| really-adjudicated, both courts | 72 | NY 35 + IL 37 | OK |
| NY succeeded | 11/35 (31%) | 11/35 | OK |
| IL succeeded | 12/37 (32%) | 12/37 | OK |
| NY CoA denom (pre-addendum findings.md) | 102,635 | 102,635 | OK |
| NY last really-adjudicated | 1918 | 1918, *Barnet*, 222 N.Y. 195 | OK |

**Denominator discrepancy, meaningful but not load-bearing.** `figures/ny_vs_il.json` sums NY denom to 88,655, missing all 13,980 opinions in `ny3d` (entirely post-2000). Since post-2000 NY mentions = 0, no displayed rate changes. Flagged, not fixed.

**Minor Gemini inconsistency.** IL high-court has 13 rows with `disposition=succeeded`, but only 12 with `really_adjudicated=True`. The odd case is *Pratt v. Trustees of Baptist Society*, 93 Ill. 475 (1879), labeled `succeeded + !really_adjudicated` — self-inconsistent. Cosmetic.

## 2. Classification quality

Read the ±3-paragraph window and Gemini rationale for 15 stratified cases (NY/IL × three eras × really-adjudicated in {True, False, lexical-active-but-Gemini-False}).

Labels are defensible throughout. Two systematic patterns:

- **Good lifts.** Gemini promotes lexical `boilerplate` / `quotation` mentions to `really_adjudicated=True` when the court actually applies the recited rule to live facts (e.g., *Cormack v. N.Y. & Hartford R.R.*, 1909). This is strictly better than the lexical triage.
- **Rationale wording quirk** (not a labeling error). For `related_term` hits (on *vis major*, *inevitable accident*, *damnum fatale*) Gemini's rationale often says "The phrase 'act of God' does not appear in the provided text." Literally true, unhelpful as explanation. Final labels still correct in every spot-checked case — the synonym always appears as dictionary-definition or in a force-majeure clause, not as doctrine-in-application. Do not re-run.

No evidence of `not_reached` over-use. No evidence of common-carrier boilerplate being confused for active carrier adjudication.

## 3. NY-1918 cutoff claim

Checked every NY high-court case 1919–2017 (17 rows). All `really_adjudicated=False`. Read windows for five: *Aktiebolaget Malareprovinsernas Bank* (1925, vis-major in treatise quote), *Petrogradsky* (1930, Cardozo using vis-major as synonym for calamity), *Nichols v. Nichols* (1954, quoted treatise), *Davidson v. Madison Corp.* (1931, innkeeper recitation, affirms on other grounds), *Kel Kim Corp.* (1987, force-majeure clause). In none is the court adjudicating the defense; the phrase is either historical exposition or a clause to be construed as contract. Gemini's calls correct. **1918 cutoff is real.** Holds up.

## 4. Workers'-comp migration claim — LOAD-BEARING FIX

Post-1920 IL really-adjudicated (unique cases): 8.
- **Industrial Commission / workers' comp: 4.** *Abell Chevrolet* × 2 (1939), *Inland Steel* (1968), *Campbell "66" Express* (1980).
- **Not workers' comp: 4.** *Jackson v. Knapp* (1921, inheritance); *Phelps v. School District* (1922, teacher's contract); *Blue v. St. Clair Country Club* (1955, premises liability — country-club member injured by a windblown patio umbrella); *Krautsack v. Anderson* (2006, consumer-fraud travel contract).

"Almost entirely workers' compensation" is **false**: 4/4 split. The strongest defensible claim is the narrower one: **post-1930, IL really-adjudicated storm/wind tort cases** are 4/5 Industrial Commission (all except *Blue*). That is a real pattern; the broader framing was overstated.

`findings.md` listed *Blue v. St. Clair* among "Industrial Commission appeals" parenthetically — factually wrong; *Blue* is premises liability.

**Fixes applied:** Addendum section of findings.md rewritten with the correct split and a separate paragraph disentangling the non-workers'-comp cases. index.html lede, §II dek, §II caption, and §IV timeline band annotation corrected. Register preserved; only the facts were changed.

## 5. Case name accuracy

All citations in index.html verified against parquet:

- *Zaldin v. Concord Hotel*, 48 N.Y.2d 107 (1979) — exists, `really_adjudicated=False` (only in pre-addendum findings.md footnote).
- *Barnet v. N.Y. Central & Hudson River R.R.*, 222 N.Y. 195 (1918) — exists, `succeeded`. OK.
- *Abell Chevrolet Co. v. Industrial Commission*, 370 Ill. 460 & 371 Ill. 76 (both 1939) — two distinct opinions, both `succeeded`. "Pair" language accurate.
- *Blue v. St. Clair Country Club*, 7 Ill. 2d 359 (1955) — exists, `failed`. NOT Industrial Commission (see §4).
- *Inland Steel Co. v. Industrial Commission*, 41 Ill. 2d 70 (1968) — `failed`. OK.
- *Campbell "66" Express, Inc. v. Industrial Commission*, 83 Ill. 2d 353 (1980) — `failed`. OK.
- *Krautsack v. Anderson*, 223 Ill. 2d 541 (2006) — `succeeded`. OK.

## 6. Figures vs data

Each JSON cross-checked against the parquet.

- `ny_vs_il.json` — NY really-adjudicated = 35, IL = 37. Disposition totals match. Denom issue in §1.
- `domain_by_decade.json` — 49 rows, sums NY 35 + IL 37. State × decade × domain matches exactly. No off-by-one, no missing domain.
- `disposition_by_decade.json` — uses all mentions (not just really-adjudicated), highest-court only. Totals match.
- `case_timeline.json` — 72 cases (NY 35 + IL 37). Citations match the really-adjudicated high-court subset exactly. Dispositions: 48 failed / 23 succeeded / 1 not_reached.

No figure fundamentally misrepresents the data. No rebuilds.

## 7. Pipeline reproducibility

`src/extract.py` regenerates `hits.parquet` correctly. `src/classify.py` regenerates `classified.parquet` correctly. **But the cross-state analysis is not reproducible from `src/`**: `state_decade_rates.parquet`, `denom_by_reporter.parquet`, and the four cross-state figure JSONs are not written by any tracked script. `src/analyze.py` still only produces the legacy NY-only `decade_rates.{parquet,json}` and its docstring still claims it is the headline analysis. A missing `src/analyze_cross_state.py` would close this. Meaningful; not fixed here. README.md is also out of date — describes only the MVP NY-only corpus.

## 8. Honest limitations

Three items not currently named:

1. **`nys` (West's N.Y. Supplement) is in the corpus denominator (273,363) but excluded from every figure.** The colophon lists `N.Y.S.` alongside the Court of Appeals reporters; a reader could reasonably conclude Appellate Division is part of the analysis. It isn't. The analytic denominator in the figures is 149,842 (high court only), not 273,363. 145 rows in `classified.parquet` are `nys` cases — present in the classified universe but filtered out of every figure via `is_highest_court=True`.
2. **Illinois Appellate Court (`ill-app`) not in corpus.** findings.md notes this briefly. Most of the 20th-century IL workers'-comp act-of-God docket almost certainly sits in the intermediate court; including it would either reinforce the migration claim or puncture it.
3. **Small-N the whole way down.** The workers'-comp-migration claim rests on three unique Industrial Commission cases across forty-one years (Abell 1939, Inland Steel 1968, Campbell 1980). "Stable across six decades" elides this.

## Severity / fix summary

| item | severity | fixed? |
|---|---|---|
| findings.md miscategorizes *Blue v. St. Clair* as Industrial Commission; "almost entirely workers' comp" overstated | load-bearing | yes |
| index.html lede overstates workers'-comp claim | load-bearing | yes |
| index.html §II dek "tort cases are all Industrial Commission appeals" | load-bearing | yes |
| index.html §II caption same overstatement | load-bearing | yes |
| index.html §IV "WORKERS' COMP ERA · 1939–2006" (includes contract case *Krautsack*) | load-bearing | yes → "IL LONG TAIL · 1939–2006 · MOSTLY WORKERS' COMP" |
| `ny_vs_il.json` excludes `ny3d` denom | meaningful | no (no displayed rate changes) |
| Cross-state JSONs not produced by any tracked script | meaningful | no |
| README.md out of date | meaningful | no |
| Gemini `succeeded + !really_adjudicated` on *Pratt* | cosmetic | no |
| Gemini rationale says "phrase does not appear" on `related_term` hits | cosmetic | no |
| `nys` role in the analytic corpus undocumented | meaningful | no (is limitation, not error) |

---

## What I would still worry about

The workers'-comp migration claim really rests on three Industrial Commission opinions (Abell, Inland Steel, Campbell) across forty-one years — *Blue* and *Krautsack* don't fit, and the 1921–22 *Jackson* / *Phelps* pair is transitional residue; three points is suggestive, not established, and the Illinois Appellate Court (`ill-app`) docket — not in this corpus — would either multiply the pattern into something real or dilute it into noise. The NY-1918 cutoff holds *at the Court of Appeals*, but `nys` (Appellate Division) is in the denominator-side corpus without being part of any figure, so "273,363 opinions surveyed" implies a larger analytic base than the figures actually use; this should be stated as an explicit scope decision. Every adjudication label rests on Gemini reading a ±3-paragraph window rather than the full opinion — adequate in every case I spot-checked, but I would want a hand-coded 50-case validation set stratified on `really_adjudicated` before a peer reviewer asked for one.
