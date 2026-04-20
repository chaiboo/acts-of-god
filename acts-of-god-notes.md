# Acts of God — Project Notes

Longitudinal empirical analysis of the "act of God" defense in US appellate opinions (~1850–2025). Descriptive time series of invocation and success rates by event type and domain; diachronic embedding analysis of reasoning language; test of whether climate-attribution-era rulings diverge from prior foreseeability-era rulings.

## Scholarly positioning

The doctrinal/theoretical territory is well-worked. The empirical-NLP territory is not.

**Existing theoretical claims to engage (all argue the defense is shrinking or dead):**

- Kenneth Kristl, "Diminishing the Divine: Climate Change and the Act of God Defense," 15 Widener L. Rev. 325 (2010). Canonical. Distinguishes Event Foreseeability from Response Foreseeability. Purely theoretical.
- Myanna Dellinger, "An 'Act of God'? Rethinking Contractual Impracticability in an Era of Anthropogenic Climate Change," 67 Hastings L.J. 1551 (2016). Same argument for contract law.
- Jill Fraley, "Re-examining Acts of God," 27 Pace Envtl. L. Rev. 669 (2010).
- Clifford Villa, "Is the 'Act of God' Dead?" (WJELP 2017). Closest to empirical — qualitative survey of federal environmental cases, finds **zero** successful invocations. Narrow-domain but important prior.
- Lloyd, Oppenheimer et al., "Acts of God, human influence and litigation," Nature Geoscience (2017); expanded in J. Energy & Nat. Resources L. 36(3) (2018). Attribution science + law review.
- Miller, "(The Act of) God's Not Dead: Reforming the Act of God Defense," 11 Tex. A&M L. Rev. (2024). Counter-arguing on equity grounds.

**Before committing:** 2–4 hours on Westlaw/Lexis for 2022–2026 empirical work my web search would miss.

**Our contribution:** the empirical backbone the doctrinal literature lacks — the first quantitative longitudinal description of invocation and success across all domains and event types in US law, plus diachronic semantic analysis of how the reasoning language migrates. Doctrinal scholars will cite the descriptive findings; we engage their theoretical claims and say which are supported and which aren't.

Villa's null result (no successful environmental defense, ever) is a real constraint. The "shrinking doctrine" story is different across tort (still sometimes works), contract (rarely), and environmental (never). Don't pool across domains.

## Data sources

**Primary: Caselaw Access Project (CAP) bulk data.** Fully open since 2024. Federal and state appellate opinions, 1658–2020. JSONL by jurisdiction. Backbone of the pre-1950 coverage.

**Secondary: CourtListener bulk data.** Fills 2020–present. Better metadata (parallel citations, judge names, case type tags) for modern opinions. Free Law Project API is rate-limited; prefer quarterly bulk dumps.

**Optional: Climate Change Litigation Databases (Sabin Center, Columbia Law).** Cross-reference against post-2010 subset to validate the climate-era test. Do NOT use as primary source — it's curated and would bias the sample.

## Pipeline

### 1. Extraction

Regex: `\bact[s]? of [Gg]od\b` across full opinion text. Keep all hits.

Also capture `vis major`, `damnum fatale`, and `inevitable accident` as related doctrinal terms — mark separately. Cousins, not synonyms.

For each hit: extract ±3 paragraph window around the mention. Multiple mentions per opinion: treat each as a unit at first, dedupe at case level later.

### 2. Case-level metadata

Extract per case:

- Citation, year, jurisdiction, court level (trial/appellate/supreme)
- Case type — tort / contract / admiralty / environmental / insurance / product liability / other. CAP's topic tags are unreliable; infer from opinion text with a cheap LLM classifier.
- Who raised the defense, whether it's the main defense or alternative theory
- **Disposition** — succeeded / failed / not_reached / affirmed below / reversed. Hardest field. Needs careful LLM extraction with a validated prompt. Reserve `not_reached` as its own category; its prevalence is itself meaningful.
- Foreseeability standard cited (if any) — quote the standard's language verbatim for downstream analysis

### 3. Event-type classification

Not NER. Embed the extracted window, either cluster-and-label or few-shot classify.

Starting taxonomy (expand as clusters surface unexpected categories):

- Flood (ordinary / extraordinary — let the data decide the threshold)
- Storm / hurricane / tornado / wind
- Lightning / fire (natural ignition)
- Earthquake
- Ice / snow / freeze
- Drought
- Disease / epidemic
- Animal (livestock, wildlife, pests)
- Geological (landslide, subsidence)
- Other / ambiguous

Hand-code 200 cases stratified by era (50 pre-1900, 50 1900–1950, 50 1950–2000, 50 post-2000) for classifier validation. Report accuracy per era separately — pre-1900 legal English drifts enough that modern embeddings degrade.

### 4. Foreseeability scoring

Semantic axis: **providential/inscrutable ↔ foreseeable/preventable.** Run both approaches.

**Anchor approach.** ~10 anchor phrases per pole.

- Providential pole: "beyond human anticipation," "sudden and unprecedented," "could not have been foreseen," "inscrutable," "extraordinary visitation," "without human agency."
- Foreseeable pole: "reasonably foreseeable," "known risk," "should have anticipated," "ordinary incident," "not unprecedented," "within the range of ordinary experience."

Embed anchors, score each reasoning window by cosine similarity to each pole, output continuous score.

**Supervised approach.** Hand-label 400 reasoning windows on a 5-point foreseeability scale. Logistic regression on embeddings. Headline measure; anchor approach as robustness check.

**Interpretability:** output per-case scores AND the highest-similarity anchor phrase, so we can always trace why a case scored where it did. Law review audience will be skeptical of black-box embedding scores.

### 5. Diachronic analysis

Two methods:

**Centroid drift.** Per decade, mean embedding of reasoning windows where defense succeeded vs. failed. Track centroid trajectories. Converging (doctrine stabilizing), diverging (bifurcating), or drifting together (semantic shift)?

**Anchor-phrase decomposition.** Per decade, average cosine similarity of full corpus to each anchor phrase. Time series. Expected pattern if theory holds: providential anchors decline monotonically, foreseeability anchors rise. Null result is itself interesting — means the language didn't shift, just the event types did.

**Methods refs.** Hamilton/Leskovec/Jurafsky 2016 (canonical diachronic embeddings); Kutuzov 2018 (survey); Livermore & Rockmore on SCOTUS embeddings (closest legal analog).

Do NOT train separate per-era embedding models — sample size won't support it. Single embedding model, diachronic signal from document-level aggregation.

### 6. Climate-era test

Post-2010 subset: for weather-event cases, does success rate differ from a matched pre-2000 baseline **holding event type fixed**? Theoretical claim predicts a drop. Stratify by jurisdiction if sample allows (9th Circuit and certain state supreme courts have more climate-aware dockets per Sabin Center data).

Sharpest confirmatory/falsifying test. If null: doctrinal scholars are wrong, OR the effect is too small to detect in published opinions, OR it's happening at trial court level and getting filtered out by appeal. All three are interesting.

## Tech stack

- Python throughout. `pandas`, `duckdb` for the case-level dataframe (2k–5k rows, duckdb is overkill but handy for JSONL ingest).
- Embeddings: start with `voyage-3` or `text-embedding-3-large`. Voyage tends to be better on legal prose; OpenAI is cheaper. **Cache aggressively** — will re-embed during debugging.
- LLM classification for disposition and case type: Claude Haiku or GPT-4o-mini, structured outputs. Budget a few hundred dollars for full corpus pass with retries.
- D3 for final visualizations per `CLAUDE.md` no-default-charts brief. Expect: small multiples of event-type trajectories, centroid drift scatter with time as color gradient, anchor-phrase time series with confidence bands.
- Git LFS for CAP JSONL dumps, or better, keep them outside the repo and script the download.

## Validation — things that will go wrong

**False positives on regex.** "Act of God" appears in religious invocations, quotations of prior cases, footnotes citing other jurisdictions, and the boilerplate "acts of God or the public enemy" in common-carrier contracts. Filter out windows where the phrase appears only in quotation blocks or citation context — cheap LLM pass asking "is the court actually applying the doctrine here, or just mentioning it?"

**Disposition extraction is the weakest link.** Courts don't always state cleanly whether a defense succeeded. "The court need not reach the act of God argument" is common. Reserve `not_reached`; its prevalence is meaningful.

**Pre-1950 OCR quality.** CAP's OCR is generally good but not perfect for 19th-century opinions. Spot-check 30 pre-1900 cases manually. If OCR errors are biting, either restrict to post-1900 for headline analysis (note as limitation) or run LLM cleanup pass.

**Embedding drift across eras.** Report results separately for pre-1950 and post-1950. Don't compute cosine similarities across the whole corpus as if the embedding space is temporally uniform — it isn't.

**Selection bias.** Appellate opinions only. Settled cases, trial court rulings, unpublished opinions are invisible. Acknowledge, don't solve. If the defense is being abandoned at pleading stage, we won't see it — which is itself a bounded finding.

**Domain pooling.** Per Villa's null result, the story differs across tort/contract/admiralty/environmental/product liability. Stratify from the start.

## Output artifacts

- `cases.parquet` — one row per case with all extracted metadata and scores
- `windows.parquet` — one row per regex hit with text window, embedding reference, scores
- Notebook / Quarto doc with all analyses, reproducible from parquet files
- D3 figures exportable as SVG for paper and personal site post
- Hand-labeled validation sets versioned in repo as JSONL — scholarly contribution even if analysis gets superseded

## Order of operations

1. Lit review sweep on Westlaw/Lexis. 2–4 hours. Catch 2022–2026 empirical work missed by web search. Firm commitment before building.
2. CAP bulk download, regex extraction, first-pass case counts by decade. Weekend. Tells us if sample size supports what we want to do.
3. Hand-code 200 cases for event type and disposition. One week, 2 hours/day. **Critical path** — everything downstream depends on this.
4. Build classifiers, validate, run on full corpus. One week.
5. Embedding pipeline + foreseeability scoring + diachronic analysis. One week.
6. Climate-era test, figures, draft. Two weeks.

Realistic circulatable draft: 5–6 focused weeks. Double for real-life timeline.

## Open decisions

- **Scope:** US-only (cleaner) or include UK/Commonwealth for historical baseline (strengthens pre-1850 origin story but triples scope)? Default: US-only.
- **Paper target:** *Journal of Empirical Legal Studies* (best methodological fit), *Journal of Law and Courts*, or law review with empirical appendix.
- **Personal site companion:** blog post with interactive D3, or full essay with figures. Essay probably — it's where the secularization-of-providence argument the paper can't sustain on its evidence can actually live.

## Repo structure (proposed)

```
acts-of-god/
├── CLAUDE.md                    # Claude Code persona: computational legal humanities, bespoke D3, no default charts
├── README.md
├── data/
│   ├── raw/                     # CAP + CourtListener dumps (gitignored)
│   ├── interim/                 # regex hits, pre-classification
│   └── processed/               # cases.parquet, windows.parquet
├── labels/
│   ├── event_type_200.jsonl     # hand-coded validation set
│   └── foreseeability_400.jsonl # hand-coded foreseeability scale
├── src/
│   ├── extract.py               # regex + window extraction
│   ├── classify.py              # LLM case-type and disposition classifiers
│   ├── embed.py                 # embedding pipeline w/ caching
│   ├── score.py                 # anchor + supervised foreseeability scoring
│   └── diachronic.py            # centroid drift, anchor time series
├── notebooks/
│   └── analysis.qmd             # Quarto doc, reproducible from parquet
├── figures/                     # D3 SVG exports
└── paper/
    └── draft.qmd
```

## Claude Code kickoff prompt

When starting in Claude Code, point it at this file and at the existing `CLAUDE.md` persona. First task: write `src/extract.py` — CAP JSONL ingest, regex hit extraction, paragraph window extraction, output to `data/interim/hits.parquet`. Validate on a single jurisdiction (e.g., New York appellate, manageable size) before running the full corpus.
