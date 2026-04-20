# Acts of God — MVP

A minimum-viable empirical cut at the *act of God* defense in U.S. appellate opinions, built from Caselaw Access Project bulk data.

This is a one-session MVP, not the full project described in `acts-of-god-notes.md`. It demonstrates the method end-to-end: download → regex extract → paragraph windows → LLM triage → one decade-level analysis → one bespoke D3 figure → one short findings writeup.

## What's in the corpus

One jurisdiction — **New York** — four reporters from the Caselaw Access Project:

| slug      | reporter                          | years covered (CAP digitized range) |
|-----------|-----------------------------------|-------------------------------------|
| `ny`      | New York Reports (N.Y.)           | 1847–2017 via 309 volumes           |
| `ny-2d`   | New York Reports, 2d              | 1956–2003                           |
| `ny3d`    | New York Reports, 3d              | 2003–2017                           |
| `nys`     | West's New York Supplement        | 1888–1916 (partial; CAP's digitized slice) |

The N.Y. + N.Y.2d + N.Y.3d series together are the New York Court of Appeals reporter (the state's highest court). N.Y.S. adds Appellate Division opinions for the late-19th / early-20th century.

**Known coverage gaps** (real limitations, not shortcuts):
- 1917–1956: gap in N.Y. Reports digitization on CAP (vols 220-ish have inconsistent coverage).
- Post-2017: not available in CAP static bulk; would need CourtListener.
- Trial-court opinions: invisible to this corpus. If the defense is dying at the pleading stage, we cannot see it.

## Pipeline

```
src/download.py  → downloads ~594 zip volumes (~1 GB) to data/raw/{reporter}/
src/extract.py   → regex scans all ~300k cases for "act of God" and related terms,
                    extracts ±3 paragraph windows, triages mention type
                    outputs data/interim/hits.parquet + data/processed/cases.parquet
src/classify.py  → Vertex AI batch prediction (Gemini 2.5 Pro) over each
                    case's primary window. Builds JSONL, uploads to GCS,
                    submits batch job, polls to completion, parses results.
                    outputs data/processed/classified.parquet
src/analyze.py   → per-decade rate tables + figures/decade_rates.json payload
figures/decade_rates.html → bespoke D3 visualization, standalone
```

Run order:
```bash
python3 src/download.py    # one-time, idempotent
python3 src/extract.py

# Optional LLM classification (Vertex AI batch, Gemini 2.5 Pro).
# Requires: `gcloud auth application-default login`, a GCS bucket in the
# same region, and GOOGLE_CLOUD_PROJECT + GCS_BUCKET set.
export GOOGLE_CLOUD_PROJECT=your-gcp-project
export GOOGLE_CLOUD_LOCATION=us-central1
export GCS_BUCKET=your-bucket-name
python3 src/classify.py

python3 src/analyze.py
open figures/decade_rates.html
```

## What this MVP establishes

1. CAP bulk data for NY is accessible and tractable (~1.5 GB zipped).
2. Regex + paragraph-window extraction surfaces 90 hit-cases in the NY Court of Appeals reporter series (102,635 opinions scanned; 226,156 across all four NY reporters).
3. Three mention grammars emerge from lightweight lexical triage: **active adjudication**, **common-carrier boilerplate**, and **quotation from prior case**. Treating them as the same thing distorts the trend.
4. At the decade level, the invocation rate per 10,000 opinions shows a specific shape — headline: peak in the 1860s, collapse by the 1920s, boilerplate-only survival through the 1980s, zero mentions of any kind 1990–2017. Documented in `findings.md`.

## What this MVP does not do (yet)

- No supervised foreseeability scoring. Notes specify 400 hand-labeled reasoning windows on a 5-point scale. Deferred.
- No hand-coded 200-case validation set. Notes specify stratified by era. MVP uses spot-checking only; quantitative accuracy is not established.
- No centroid-drift diachronic embedding analysis.
- No climate-era matched test (too small a post-2010 N in a single-state slice).
- No cross-jurisdiction comparison. One state, one docket.

See `acts-of-god-notes.md` for the full project spec.

## Reproducing

Python 3.11+, packages: `pandas`, `pyarrow`, `duckdb`, `requests`, `tqdm`. Optional (for LLM classification via Vertex AI batch): `google-genai`, `google-cloud-storage`.

```bash
pip install pandas pyarrow duckdb requests tqdm
pip install google-genai google-cloud-storage    # optional, for classify.py

python3 src/download.py       # ~15 min
python3 src/extract.py        # ~2-3 min
python3 src/analyze.py        # <10s
```

Random seeds: none needed in the extraction pipeline (deterministic). The Vertex batch job runs at `temperature=0.0`; re-running against the same requests JSONL should be near-deterministic but Gemini does not guarantee exact reproducibility.
