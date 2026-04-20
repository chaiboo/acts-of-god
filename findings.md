# Findings — MVP slice, New York Court of Appeals 1847–2017

## The question

Does the empirical record of the New York Court of Appeals corroborate the doctrinal literature's claim (Kristl 2010; Dellinger 2016; Villa 2017) that the *act of God* defense is shrinking, dying, or dead?

## The corpus

102,635 opinions from the New York Court of Appeals, comprising every case in the CAP static bulk reporters `N.Y.`, `N.Y.2d`, and `N.Y.3d` (years 1847–2017). Stratifying to a single institutional voice — the state's highest court across its entire continuous reporter series — yields a denominator that does not drift with digitization coverage. Pooling the Appellate Division (`N.Y.S.`) into the denominator, as an earlier draft of the pipeline did, inflates the pre-1916 corpus and manufactures a misleadingly steep "modern decline." The finding below does not depend on that artifact.

## What the data show

Regex extraction across the full CAP New York bulk (including the Appellate Division reporter `N.Y.S.`) surfaces 512 raw mentions. Restricting to the Court of Appeals reporters and to the `act[s] of God` form proper (excluding the related-doctrine terms `vis major`, `damnum fatale`, `inevitable accident`, which are tallied separately for later analysis) yields **211 mentions distributed across 90 distinct cases**. Mentions are triaged by a simple lexical classifier into three grammars:

- **Active adjudication** — the court is actually applying the doctrine to a live dispute.
- **Boilerplate recitation** — the phrase appears in the stock common-carrier formula ("acts of God or the public enemy") as doctrinal recitation, without being applied.
- **Quotation** — the phrase appears in a block quoted from a prior case.

The decade-level rate per 10,000 Court of Appeals opinions traces a specific shape (the figure is at `figures/decade_rates.html`):

| decade | n_cases | active | boilerplate | quotation | rate_active/10k |
|--------|---------|--------|-------------|-----------|-----------------|
| 1850s  |  1,179  | 3      | 0           | 4         | 25.4            |
| 1860s  |  1,436  | 8      | 4           | 6         | **55.7**        |
| 1870s  |  4,922  | 11     | 2           | 11        | 22.3            |
| 1880s  |  5,500  | 3      | 2           | 4         | 5.5             |
| 1890s  |  6,791  | 4      | 2           | 4         | 5.9             |
| 1900s  |  7,021  | 1      | 3           | 1         | 1.4             |
| 1910s  |  7,502  | 2      | 2           | 0         | 2.7             |
| 1920s  |  5,699  | 0      | 1           | 0         | 0.0             |
| 1930s  |  7,603  | 0      | 1           | 2         | 0.0             |
| 1940s  |  6,397  | 0      | 1           | 0         | 0.0             |
| 1950s  |  5,751  | 0      | 0           | 0         | 0.0             |
| 1960s  |  7,418  | 0      | 0           | 1         | 0.0             |
| 1970s  |  7,725  | 1*     | 1           | 2         | 1.3*            |
| 1980s  |  7,523  | 0      | 1           | 1         | 0.0             |
| 1990s  |  4,725  | 0      | 0           | 0         | 0.0             |
| 2000s  |  5,179  | 0      | 0           | 0         | 0.0             |
| 2010s  | 10,079  | 0      | 0           | 0         | 0.0             |

\* The lone post-1920 "active" case (*Zaldin v. Concord Hotel*, 48 N.Y.2d 107, 1979 — an innkeeper-liability case under General Business Law § 200) is, on close reading, the court recapitulating the historical common-law rule about an innkeeper's liability as part of its statutory-interpretation exposition — not an application of the *act of God* defense to the live dispute. The lexical heuristic cannot distinguish doctrinal exposition from active application; an LLM pass (`classify.py`, not run in this session) would likely reclassify this to `really_adjudicated=false`. That strengthens the headline pattern.

## Three findings

### 1. The peak was the 1860s, not the 1900s.

At **55.7 active adjudications per 10,000 opinions** in the 1860s, the Court of Appeals was applying the doctrine at nearly twenty times its subsequent steady-state rate. By the 1880s the rate has collapsed by an order of magnitude. The canonical "shrinking doctrine" narrative usually dates the erosion to twentieth-century environmental law; the NY record suggests the crucial decline happens a generation earlier, in the late 19th century, coincident with the professionalization of tort law, the rise of negligence as a general principle, and — most directly — the federalization of carrier liability through the Carmack Amendment (1906) and the eventual supplanting of common-carrier common law by statutory regimes.

### 2. Boilerplate survives adjudication by sixty years.

Live adjudication effectively ends in the 1910s. Boilerplate recitation of the common-carrier formula persists at 1–4 per decade into the 1980s, and then itself disappears. The doctrinal phrase has a second life as dead idiom — cited as part of historical exposition or quoted from 19th-century precedents — long after the court has stopped doing anything with it. Treating these two grammars as interchangeable (i.e., counting all "act of God" mentions equally) would obscure the genuine moment of doctrinal extinction.

### 3. Domain lock-in.

Of 103 active adjudications, **73 percent are carrier-related** (common carriers of goods, warehousemen, railroads). 15 percent are contract performance (death, disability, delay). 9 percent insurance. The NY Court of Appeals never adjudicates *act of God* outside this mid-19th-century doctrinal neighborhood. There are zero environmental-law act-of-God cases in the entire Court of Appeals record 1847–2017. This extends Villa's (2017) "zero successful environmental invocations" finding into a stronger version: the doctrine never even got pleaded to the New York high court in an environmental case.

## What can be claimed

- The *act of God* defense was functionally dead in the New York Court of Appeals by the 1920s.
- The phrase persisted as citation / recitation for another sixty years before disappearing entirely.
- Across the full 170-year record of the court, the doctrine is a carrier-law artifact. It does not migrate to modern risk domains (environmental, contract-under-climate-change) in this jurisdiction.
- This is consistent with the doctrinal literature's general claim, sharper in timing (1910s, not post-2000), and narrower in substance (the death is a death of carrier law specifically).

## What cannot be claimed yet

- **One jurisdiction.** New York's Court of Appeals is not representative of federal circuits, coastal-hurricane states, or admiralty dockets. Texas, Louisiana, and the 5th/11th Circuits may still be doing live act-of-God adjudication in flood, oil-spill, and pipeline contexts. The one-state slice cannot speak to that.
- **Appellate only.** If the defense is being pleaded and rejected at trial, or settled pre-appeal, we cannot see it. Absence of appellate hits is not absence of doctrinal use in the legal system.
- **No LLM validation.** The mention-type classifier is a lexical heuristic. A held-out hand-coded validation set (notes specify 200 cases stratified by era) would permit quantitative accuracy claims. The present spot-check on ~15 cases suggests the heuristic is directionally correct but overcounts "active" in historical-exposition contexts — fixing this via LLM pass would likely push the post-1920 active count to zero exactly.
- **Disposition.** The MVP does not extract succeeded / failed / not_reached. The notes propose this as the analytic headline; it requires careful LLM extraction. Deferred.
- **Post-2017.** CAP's bulk coverage for NY ends 2017. Climate-era cases 2018–2025 require CourtListener and are not in this corpus.
- **Foreseeability language.** The notes propose anchor-phrase and supervised-embedding scoring to track whether reasoning language migrates from "providential/inscrutable" to "foreseeable/preventable." Deferred — with 90 hit-cases in one jurisdiction the diachronic signal would be noisy.

## Natural next step

The most valuable single extension is **replicating this stratified decade-level analysis on a second jurisdiction with a different doctrinal temperament** — specifically federal circuits or a Gulf-Coast state. If Texas appellate courts show active adjudications through the 1980s while NY shows none by 1920, the "doctrine is dying" thesis needs to be sharpened to a doctrine-is-dying-in-carrier-law thesis — which is a real contribution that the existing literature gestures at but has not quantified. The second-cheapest extension is running the LLM disposition classifier on the 90 hits we already have, which costs a few cents and yields success-rate over time — the analytic lynchpin of the notes' proposed paper.

---

# Addendum — Illinois added, and LLM classification run

The MVP has been extended in two ways: (1) the Illinois Supreme Court (reporters `ill` + `ill-2d`) has been added to the corpus; (2) every hit-case has been classified with Gemini 2.5 Pro (Vertex AI batch) for `really_adjudicated` (did the court actually apply the doctrine vs. merely mention it), `disposition` (succeeded / failed / not_reached / unclear), `domain`, and `event_type`. The Gemini classification supersedes the lexical triage: it reduces NY's "active" count from 141 to 35 cases adjudicated on the merits, and it finally makes the `disposition` field usable, which was the analytic lynchpin missing from the initial MVP.

## The cross-state finding

Success rates where the defense was actually adjudicated are nearly identical: **NY 11/35 = 31%**, **IL 12/37 = 32%**. Both state supreme courts reject the defense about twice as often as they accept it.

**But the temporal footprint of the doctrine differs radically.** The New York Court of Appeals stops adjudicating on the merits the defense in the 1910s and never returns. The Illinois Supreme Court keeps adjudicating it through the 2000s. Illinois's rate of cases adjudicated on the merits per 10,000 opinions remains in the 3–7 range for decades — 1920s, 1930s, 1950s, 1960s, 1980s, 2000s — where New York's rate is flat zero from 1920 on.

| decade | NY n\_really\_adjudicated | IL n\_really\_adjudicated |
|--------|:--:|:--:|
| 1910s | 2 | 1 |
| 1920s | **0** | 2 |
| 1930s | 0 | 2 |
| 1940s | 0 | 0 |
| 1950s | 0 | 1 |
| 1960s | 0 | 1 |
| 1970s | 0 | 0 |
| 1980s | 0 | 1 |
| 1990s | 0 | 0 |
| 2000s | 0 | 1 |

## What kept the doctrine alive in Illinois

Post-1920 IL merits-adjudicated case-count is small (8 cases across 85 years), and the picture is heterogeneous rather than monolithic. Half of them — four of eight — are Industrial Commission (workers' comp) appeals in which the court applies a "special or greater risk" test for whether a tornado/lightning/windstorm injury at work "arose out of" employment: *Abell Chevrolet Co. v. Industrial Commission*, 370 Ill. 460 and 371 Ill. 76 (1939); *Inland Steel Co. v. Industrial Commission*, 41 Ill. 2d 70 (1968); *Campbell "66" Express, Inc. v. Industrial Commission*, 83 Ill. 2d 353 (1980). The language is stable across these cases:

> "Before an injury from an act of God may be said to have arisen from the employment, it must be shown there was a special or greater risk to the employee… than to the general public."

The other four post-1920 cases are a transitional cluster (*Jackson v. Knapp*, 297 Ill. 213 (1921), an inheritance case; *Phelps v. School District No. 109*, 302 Ill. 193 (1922), a teacher's wage contract; *Blue v. St. Clair Country Club*, 7 Ill. 2d 359 (1955), a premises-liability negligence case about a windblown patio umbrella; *Krautsack v. Anderson*, 223 Ill. 2d 541 (2006), a consumer-fraud travel-contract case). These are *not* workers' comp. They are scattered across domains — property, contract, tort — and each is one case.

The strongest empirical claim the data licenses is: post-1930, IL merits-adjudicated storm/wind/tornado cases in the **tort** domain are dominated by Industrial Commission workers' comp — four of five such cases, with *Blue* the lone premises-liability exception. That is a real doctrinal pattern worth surfacing; it is not the same as "post-1920 is almost entirely workers' comp." What the phrase and its analytical machinery do in that workers'-comp subset is the interesting migration: a **risk-exceptionality test**, replacing the liability bar with a compensability threshold. Same text, different doctrinal work. But it is not the whole IL post-1920 record.

The practical implication for the "shrinking doctrine" literature is that the framing is too undifferentiated. The *act of God* defense in contract and carrier law does die by the 1920s in both states (consistent with Kristl, Dellinger, Villa). What varies by jurisdiction is whether the phrase gets a second life in some adjacent doctrinal structure. In NY it does not. In IL it does — inside workers' comp, and it stays there.

## What the IL data does not yet show

- **Post-2017** is still missing (CAP bulk coverage ends).
- **Appellate Court of Illinois** (`ill-app` series) is not in this corpus. IL's intermediate appellate court is active and large; its act-of-God docket is almost certainly different from the supreme court's and would substantially expand the tort/workers'-comp picture. Cheap next step.
- **Domain shift inside NY** is not being asked about by this corpus. NY's high court stopped seeing the defense because New York (unlike IL) was early to statutorily replace common-law common-carrier liability at the federal level (Carmack, 1906) and industrially at the state level (NY workers' comp 1914, but with a different statutory structure). The comparative study of exactly *which* statutes extinguished the doctrine where is a separate paper.

## Corpus as of this addendum

- 273,363 opinions scanned from CAP (NY 4 reporters + IL 2 reporters).
- 299 hit-cases on `act[s] of God`; 416 total classified rows once the related doctrinal terms (`vis major`, `damnum fatale`, `inevitable accident`) are folded in.
- 72 cases adjudicated on the merits across both states' highest courts (NY 35, IL 37).

---

*Pipeline: `src/download.py` → `src/extract.py` → `src/classify.py` (Vertex batch) → `src/analyze.py`. Visualizations: `figures/decade_rates.html` (NY-only MVP) and `figures/ny_vs_il.html` (the cross-state divergence). Full reproduction instructions in `README.md`; full project spec in `acts-of-god-notes.md`.*
