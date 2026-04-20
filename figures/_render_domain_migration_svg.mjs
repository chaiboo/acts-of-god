// Render the domain_migration figure to a standalone static SVG.
// REDESIGN: replace stacked bars with a dot-matrix "docket."
//   - Rows = doctrinal domains (shared across both panels for comparability)
//   - Columns = decades (1840 → 2010)
//   - Each case is a single circle at (decade, domain), jittered within-cell vertically
//     if more than one case sits in the same cell.
//   - Fill encodes disposition: gold = succeeded, coral = failed, grey-ring = not_reached.
//   - Two panels stacked vertically — NY on top, IL below — so the eye reads the
//     comparison as "NY empties" / "IL migrates down into tort."
// No stacking, no fake aggregation. One case = one dot.
//
// Data: domain_by_decade.json is keyed on (state, decade, domain, n) for merits-adjudicated
//       cases. We pull per-case dispositions from case_timeline.json so every dot carries
//       the outcome it earned.

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const TIMELINE_PATH = path.join(HERE, "case_timeline.json");
const OUT_PATH = path.join(HERE, "domain_migration.svg");

const P = {
  card:   "#ffffff",
  ink:    "#1a1a28",
  ink2:   "#5a5870",
  rule:   "#e4dfef",
  ny:     "#0039A6",
  nyDeep: "#002060",
  il:     "#E84A27",
  ilDeep: "#B03418",
  gold:   "#f5b400",
  indigo: "#3d4e9e",
  plum:   "#a23d7a",
  sky:    "#74b7d4",
  nyWash: "#e5ecf8",
  ilWash: "#fce4d8"
};

const cases = JSON.parse(fs.readFileSync(TIMELINE_PATH, "utf8")).cases;

// Row order (top to bottom). Shared across panels so the migration-downward reads.
const DOMAINS = [
  "common_carrier",
  "contract",
  "insurance",
  "admiralty",
  "property",
  "other",
  "tort"          // deliberately last — the "migration target"
];
const LABEL = {
  common_carrier: "carrier",
  contract:       "contract",
  insurance:      "insurance",
  admiralty:      "admiralty",
  property:       "property",
  other:          "other",
  tort:           "tort"
};

const decades = [];
for (let d = 1830; d <= 2010; d += 10) decades.push(d);

// Group cases into { state, decade, domain } → array of cases
const bucket = new Map();
const key = (s, d, dom) => `${s}|${d}|${dom}`;
cases.forEach(c => {
  const k = key(c.state, c.decade, c.domain);
  if (!bucket.has(k)) bucket.set(k, []);
  bucket.get(k).push(c);
});

// ---- dimensions ----
const W = 1040;
const H = 600;
const M = { top: 82, right: 40, bottom: 70, left: 200 };
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;

const panelGap = 36;
const panelH = (innerH - panelGap) / 2;

// column scale
const colStep = innerW / decades.length;
const xCol = d => {
  const i = decades.indexOf(d);
  return i * colStep + colStep / 2;
};

// row scale (within panel)
const rowStep = panelH / DOMAINS.length;
const yRow = dom => DOMAINS.indexOf(dom) * rowStep + rowStep / 2;

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Domain migration of the act-of-God defense across decades: New York and Illinois, 1840-2010. Each dot is one adjudicated case; rows are doctrinal domains; columns are decades.">`);
out.push(`<defs><style>
  .mono    { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.04em; }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.16em; text-transform: uppercase; }
  .ax-tick { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; }
  .ax-cap  { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; letter-spacing: 0.14em; text-transform: uppercase; }
  .rowlbl  { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; fill: ${P.ink}; }
  .state   { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-size: 22px; font-weight: 500; font-style: italic; letter-spacing: 0.02em; }
  .headline { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 18px; fill: ${P.ink}; }
  .body    { font-family: "Fraunces", "Source Serif 4", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 13px; fill: ${P.ink}; }
  text { dominant-baseline: middle; }
</style></defs>`);

out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${P.card}"/>`);

// ---- header ----
out.push(`<text class="eyebrow" x="${M.left}" y="30" text-anchor="start">every adjudicated case, by doctrinal domain</text>`);
out.push(`<text class="mono" x="${M.left}" y="48" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.02em">Rows = doctrinal domain · columns = decade · one dot = one case · 72 cases total</text>`);

// ---- legend ----
{
  const lx = W - M.right;
  const ly = 36;
  const entries = [
    { fill: P.gold, stroke: P.gold, label: "succeeded" },
    { fill: P.card, stroke: P.ny, label: "failed", ringW: 1.4 },
    { fill: P.card, stroke: P.ink2, label: "not reached", ringW: 1.0, dashed: true }
  ];
  let cx = lx;
  entries.slice().reverse().forEach(e => {
    const tw = e.label.length * 6.7;
    cx -= tw + 18;
    out.push(`<text class="mono" x="${cx + 12}" y="${ly}" text-anchor="start" fill="${P.ink}">${e.label}</text>`);
    if (e.dashed) {
      out.push(`<circle cx="${cx}" cy="${ly}" r="4.5" fill="${e.fill}" stroke="${e.stroke}" stroke-width="${e.ringW}" stroke-dasharray="1.2 1.4"/>`);
    } else {
      out.push(`<circle cx="${cx}" cy="${ly}" r="4.5" fill="${e.fill}" stroke="${e.stroke}" stroke-width="${e.ringW || 0.6}"/>`);
    }
    cx -= 8;
  });
}

out.push(`<g transform="translate(${M.left},${M.top})">`);

// ---- panel backgrounds (subtle state wash) ----
out.push(`<rect x="0" y="0" width="${innerW}" height="${panelH}" fill="${P.nyWash}" opacity="0.7"/>`);
out.push(`<rect x="0" y="${panelH + panelGap}" width="${innerW}" height="${panelH}" fill="${P.ilWash}" opacity="0.7"/>`);

// ---- draw a panel (rows = domains, cols = decades, dots = cases) ----
function drawPanel(state, panelY, stateColor, stateFill) {
  out.push(`<g transform="translate(0,${panelY})">`);

  // state nameplate at left gutter (placed outside the left margin — away from domain-row labels)
  out.push(`<text class="state" x="-75" y="${panelH / 2 - 10}" text-anchor="end" fill="${stateColor}">${state === "NY" ? "NEW YORK" : "ILLINOIS"}</text>`);
  const adjCount = cases.filter(c => c.state === state).length;
  out.push(`<text class="mono" x="-75" y="${panelH / 2 + 10}" text-anchor="end" fill="${P.ink2}" style="letter-spacing:0.02em">${adjCount} cases</text>`);

  // faint domain-row rules
  DOMAINS.forEach((dom, i) => {
    const yy = yRow(dom);
    out.push(`<line x1="0" x2="${innerW}" y1="${yy}" y2="${yy}" stroke="${P.rule}" stroke-width="0.6" opacity="0.5"/>`);
    // row label on the inside-left edge
    out.push(`<text class="rowlbl" x="-6" y="${yy}" text-anchor="end" fill="${P.ink2}">${LABEL[dom]}</text>`);
  });

  // faint decade column rules (short, just where panel is)
  decades.forEach(d => {
    const xx = xCol(d);
    out.push(`<line x1="${xx}" x2="${xx}" y1="-4" y2="${panelH + 4}" stroke="${P.rule}" stroke-width="0.4" opacity="0.7"/>`);
  });

  // dots — per (decade, domain) group, place all cases in the cell
  DOMAINS.forEach(dom => {
    decades.forEach(d => {
      const cs = bucket.get(key(state, d, dom)) || [];
      if (cs.length === 0) return;
      const cx = xCol(d);
      const cy = yRow(dom);
      // spread cases horizontally within the cell if >1
      const R = 4.3;
      const spread = Math.min(colStep * 0.85, cs.length * 10);
      const step = cs.length > 1 ? spread / (cs.length - 1) : 0;
      const start = cx - spread / 2;
      cs.forEach((c, i) => {
        const x = cs.length === 1 ? cx : start + i * step;
        if (c.disposition === "succeeded") {
          out.push(`<circle cx="${x}" cy="${cy}" r="${R}" fill="${P.gold}" stroke="${P.ink}" stroke-width="0.5"/>`);
        } else if (c.disposition === "failed") {
          out.push(`<circle cx="${x}" cy="${cy}" r="${R}" fill="${P.card}" stroke="${stateColor}" stroke-width="1.4"/>`);
        } else {
          // not_reached (only happens once in this dataset — 1870 IL Schwartz v. Daegling)
          out.push(`<circle cx="${x}" cy="${cy}" r="${R}" fill="${P.card}" stroke="${P.ink2}" stroke-width="1" stroke-dasharray="1.2 1.4"/>`);
        }
      });
    });
  });

  out.push(`</g>`);
}

drawPanel("NY", 0, P.nyDeep);
drawPanel("IL", panelH + panelGap, P.ilDeep);

// ---- bottom axis: decade ticks (once, below the IL panel) ----
decades.forEach(d => {
  if (d % 20 === 0 || d === 1830 || d === 2010) {
    const xx = xCol(d);
    out.push(`<text class="ax-tick" x="${xx}" y="${innerH + 18}" text-anchor="middle">${d}s</text>`);
  }
});

// ---- NY silence annotation ----
{
  // find the 1918 Barnet "last adjudication"
  const px1 = xCol(1910);
  const px2 = innerW;
  const ylab = panelH / 2;
  // subtle dashed enclosing the post-1910 NY zone
  out.push(`<rect x="${(px1 + xCol(1920)) / 2}" y="0" width="${innerW - (px1 + xCol(1920)) / 2}" height="${panelH}" fill="${P.ny}" opacity="0.04"/>`);
  out.push(`<text class="headline" x="${innerW - 4}" y="${panelH / 2 - 22}" text-anchor="end" fill="${P.nyDeep}">After Barnet 1918 — silence.</text>`);
  out.push(`<text class="body" x="${innerW - 4}" y="${panelH / 2 - 6}" text-anchor="end" fill="${P.ink}">No NY Court of Appeals</text>`);
  out.push(`<text class="body" x="${innerW - 4}" y="${panelH / 2 + 10}" text-anchor="end" fill="${P.ink}">adjudication in any domain.</text>`);
}

// ---- IL tort migration annotation ----
{
  // place the caption in the upper-right of the IL panel (the carrier/contract rows are
  // empty post-1920, so there is room there).
  const panel2Top = panelH + panelGap;
  const textX = xCol(1970);
  const textY = panel2Top + yRow("insurance") - 2;  // around the insurance row (middle-upper)
  out.push(`<text class="headline" x="${textX}" y="${textY}" text-anchor="start" fill="${P.ilDeep}">Illinois migrates into tort.</text>`);
  out.push(`<text class="body" x="${textX}" y="${textY + 18}" text-anchor="start">Eight post-1920 adjudications;</text>`);
  out.push(`<text class="body" x="${textX}" y="${textY + 34}" text-anchor="start">four are Industrial-Commission</text>`);
  out.push(`<text class="body" x="${textX}" y="${textY + 50}" text-anchor="start">workers'-comp appeals.</text>`);
  // sweeping arrow from top of IL panel into the tort row (lower-right cluster)
  const tortY = panel2Top + yRow("tort");
  const ax = xCol(1870);
  const ay = panel2Top + yRow("common_carrier");
  const bx = xCol(1990);
  const by = tortY;
  out.push(`<path d="M ${ax} ${ay - 8} Q ${(ax + bx) / 2} ${ay - 40} ${bx} ${by - 14}" fill="none" stroke="${P.plum}" stroke-width="1.4" opacity="0.55" stroke-dasharray="4 4"/>`);
  out.push(`<path d="M ${bx} ${by - 14} L ${bx - 4} ${by - 20} M ${bx} ${by - 14} L ${bx + 4} ${by - 20}" stroke="${P.plum}" stroke-width="1.4" fill="none" opacity="0.7"/>`);
}

out.push(`</g>`);
out.push(`</svg>`);

fs.writeFileSync(OUT_PATH, out.join("\n"), "utf8");
console.log(`wrote ${OUT_PATH}`);
