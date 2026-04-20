// Render the disposition_flow figure to a standalone static SVG.
// REDESIGN: replace stacked bars with a "docket of tiles."
//   - Two panels: NY (left), IL (right). Shared y-axis so the magnitudes compare.
//   - Each "hit" is ONE glyph:
//       · succeeded  → saturated GOLD disc, anchored at the bottom of its decade column
//       · failed     → saturated CORAL disc (open ring), anchored above the successes
//       · not_reached→ pale INDIGO ring, stacked above the adjudicated pair
//   - Baseline-anchored adjudicated ledger + ring-cloud of mere-mentions above it
//     makes two truths visible simultaneously:
//       (1) Most hits are never adjudicated — the ring-cloud is the majority.
//       (2) Where the court DOES decide, it rejects about two-thirds of the time.
//   - No stacking, no fake aggregation. Every tile = one case/mention.

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const DATA_PATH = path.join(HERE, "disposition_by_decade.json");
const OUT_PATH = path.join(HERE, "disposition_flow.svg");

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
  indigoPale: "#b8c0e0",
  plum:   "#a23d7a",
  sky:    "#74b7d4",
  nyWash: "#e5ecf8",
  ilWash: "#fce4d8"
};

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const rows = payload.rows;

const decades = [];
for (let d = 1820; d <= 2000; d += 10) decades.push(d);

const byStateDecade = {};
["NY", "IL"].forEach(s => {
  byStateDecade[s] = {};
  decades.forEach(d => {
    byStateDecade[s][d] = { succeeded: 0, failed: 0, not_reached: 0, unclear: 0 };
  });
});
rows.forEach(r => {
  if (byStateDecade[r.state] && byStateDecade[r.state][+r.decade]) {
    byStateDecade[r.state][+r.decade][r.disposition] = +r.n;
  }
});

// totals (for panel headers + integrity checks)
const tot = { NY: { s: 0, f: 0, n: 0, u: 0, all: 0 }, IL: { s: 0, f: 0, n: 0, u: 0, all: 0 } };
decades.forEach(d => {
  ["NY", "IL"].forEach(s => {
    tot[s].s += byStateDecade[s][d].succeeded;
    tot[s].f += byStateDecade[s][d].failed;
    tot[s].n += byStateDecade[s][d].not_reached;
    tot[s].u += byStateDecade[s][d].unclear;
  });
  tot.NY.all = tot.NY.s + tot.NY.f + tot.NY.n + tot.NY.u;
  tot.IL.all = tot.IL.s + tot.IL.f + tot.IL.n + tot.IL.u;
});

// max column height (in "tiles") across both panels
const maxCol = Math.max(
  ...decades.flatMap(d => {
    const n = byStateDecade.NY[d];
    const i = byStateDecade.IL[d];
    return [n.succeeded + n.failed + n.not_reached + n.unclear,
            i.succeeded + i.failed + i.not_reached + i.unclear];
  })
);

// ---- dimensions ----
const W = 1040;
const H = 600;
const M = { top: 108, right: 36, bottom: 80, left: 70 };
const panelGap = 28;
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;
const panelW = (innerW - panelGap) / 2;

// tile size: compute so maxCol tiles fit the panel height comfortably
const tileR = 4.3;          // radius
const tileStep = 9.6;       // vertical spacing between tile centers
// baseline is at the bottom of the panel; tiles grow upward
const baselineY = innerH;
const headroomRequired = (maxCol * tileStep) + 16;
// If we need more vertical room, we shrink tileStep proportionally
let tileStepActual = tileStep;
if (headroomRequired > innerH) {
  tileStepActual = (innerH - 16) / maxCol;
}

// column positions (per panel)
const colStep = panelW / decades.length;
const xInPanel = d => decades.indexOf(d) * colStep + colStep / 2;

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Disposition of every act-of-God mention by decade, NY and IL. Each tile is one court opinion. Gold = defense succeeded; coral = failed; pale indigo ring = mere mention, never adjudicated.">`);

out.push(`<defs><style>
  .mono    { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.04em; }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.16em; text-transform: uppercase; }
  .ax-tick { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; }
  .ax-cap  { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; letter-spacing: 0.14em; text-transform: uppercase; }
  .state   { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-size: 22px; font-weight: 500; font-style: italic; letter-spacing: 0.02em; }
  .headline { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 18px; fill: ${P.ink}; }
  .body    { font-family: "Fraunces", "Source Serif 4", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 13px; fill: ${P.ink}; }
  text { dominant-baseline: middle; }
</style></defs>`);

out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${P.card}"/>`);

// ---- header ----
out.push(`<text class="eyebrow" x="${M.left}" y="30" text-anchor="start">every mention of the defense, by decade</text>`);
out.push(`<text class="mono" x="${M.left}" y="48" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.02em">Each tile is one opinion. 269 mentions total · 85 decided · 184 never reached.</text>`);

// ---- legend (top-right) ----
{
  const lx = W - M.right;
  const ly = 36;
  const items = [
    { label: "mere mention", draw: (x, y) => `<circle cx="${x}" cy="${y}" r="4.3" fill="none" stroke="${P.indigo}" stroke-width="1.1" opacity="0.7"/>` },
    { label: "defense failed", draw: (x, y) => `<circle cx="${x}" cy="${y}" r="4.3" fill="${P.card}" stroke="${P.ny}" stroke-width="1.5"/>` },
    { label: "defense succeeded", draw: (x, y) => `<circle cx="${x}" cy="${y}" r="4.3" fill="${P.gold}" stroke="${P.ink}" stroke-width="0.5"/>` }
  ];
  let cx = lx;
  items.forEach(it => {
    const tw = it.label.length * 6.7;
    cx -= tw + 22;
    out.push(it.draw(cx, ly));
    out.push(`<text class="mono" x="${cx + 10}" y="${ly}" text-anchor="start" fill="${P.ink}">${it.label}</text>`);
  });
}

out.push(`<g transform="translate(${M.left},${M.top})">`);

// ---- panel backgrounds ----
out.push(`<rect x="0" y="0" width="${panelW}" height="${innerH}" fill="${P.nyWash}" opacity="0.45"/>`);
out.push(`<rect x="${panelW + panelGap}" y="0" width="${panelW}" height="${innerH}" fill="${P.ilWash}" opacity="0.45"/>`);

// ---- y-axis tile-count ruler on the far left ----
{
  // subtle horizontal rules every 10 tiles
  const yRules = [10, 20, 30];
  yRules.forEach(n => {
    const yy = baselineY - n * tileStepActual;
    if (yy < 4) return;
    out.push(`<line x1="-10" x2="${innerW}" y1="${yy}" y2="${yy}" stroke="${P.rule}" stroke-width="0.5" stroke-dasharray="1 4" opacity="0.6"/>`);
    out.push(`<text class="ax-tick" x="-12" y="${yy}" text-anchor="end">${n}</text>`);
  });
  // baseline
  out.push(`<line x1="0" x2="${innerW}" y1="${baselineY}" y2="${baselineY}" stroke="${P.ink}" stroke-width="0.8" opacity="0.45"/>`);
  out.push(`<text class="ax-tick" x="-12" y="${baselineY}" text-anchor="end">0</text>`);
  out.push(`<text class="ax-cap" transform="translate(-46, ${innerH / 2}) rotate(-90)" text-anchor="middle">hits per decade</text>`);
}

function drawPanel(state, panelX, stateColor) {
  out.push(`<g transform="translate(${panelX},0)">`);

  // state nameplate + subline
  const stateName = state === "NY" ? "NEW YORK" : "ILLINOIS";
  out.push(`<text class="state" x="6" y="-42" text-anchor="start" fill="${stateColor}">${stateName}</text>`);
  const st = tot[state];
  const decided = st.s + st.f;
  const pct = decided > 0 ? Math.round(100 * decided / st.all) : 0;
  out.push(`<text class="mono" x="6" y="-22" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.02em">${st.all} mentions · ${decided} decided (${pct}%) · ${st.s} succ / ${st.f} fail</text>`);

  // vertical faint decade rules
  decades.forEach(d => {
    const xx = xInPanel(d);
    out.push(`<line x1="${xx}" x2="${xx}" y1="0" y2="${innerH}" stroke="${P.rule}" stroke-width="0.4" opacity="0.7"/>`);
  });

  // tiles per decade
  decades.forEach(d => {
    const cell = byStateDecade[state][d];
    const xx = xInPanel(d);
    let stackIdx = 0;

    // bottom-up order:
    //   (1) succeeded (gold, saturated, most "weight")
    //   (2) failed    (coral ring)
    //   (3) unclear   (rare — plum ring)
    //   (4) not_reached (pale indigo ring, upper cloud)
    const series = [
      { n: cell.succeeded, kind: "succ" },
      { n: cell.failed,    kind: "fail" },
      { n: cell.unclear,   kind: "unc" },
      { n: cell.not_reached, kind: "nr" }
    ];
    series.forEach(seg => {
      for (let i = 0; i < seg.n; i++) {
        const yy = baselineY - (stackIdx + 0.5) * tileStepActual;
        if (seg.kind === "succ") {
          out.push(`<circle cx="${xx}" cy="${yy}" r="${tileR}" fill="${P.gold}" stroke="${P.ink}" stroke-width="0.5"/>`);
        } else if (seg.kind === "fail") {
          out.push(`<circle cx="${xx}" cy="${yy}" r="${tileR}" fill="${P.card}" stroke="${P.ny}" stroke-width="1.5"/>`);
        } else if (seg.kind === "unc") {
          out.push(`<circle cx="${xx}" cy="${yy}" r="${tileR}" fill="${P.card}" stroke="${P.plum}" stroke-width="1.1" stroke-dasharray="1.5 1.5"/>`);
        } else {
          out.push(`<circle cx="${xx}" cy="${yy}" r="${tileR}" fill="none" stroke="${P.indigo}" stroke-width="1.05" opacity="0.7"/>`);
        }
        stackIdx++;
      }
    });
  });

  // decade ticks
  decades.forEach(d => {
    if (d % 20 === 0 || d === 1840 || d === 2000) {
      const xx = xInPanel(d);
      out.push(`<text class="ax-tick" x="${xx}" y="${innerH + 18}" text-anchor="middle">${d}s</text>`);
    }
  });

  out.push(`</g>`);
}

drawPanel("NY", 0, P.nyDeep);
drawPanel("IL", panelW + panelGap, P.ilDeep);

// ---- divider between panels ----
out.push(`<line x1="${panelW + panelGap / 2}" x2="${panelW + panelGap / 2}" y1="0" y2="${innerH}" stroke="${P.rule}" stroke-width="1"/>`);

// ---- NY annotation: the silence after 1918 ----
{
  const nx = xInPanel(1920);
  out.push(`<rect x="${nx - colStep / 2}" y="0" width="${panelW - (nx - colStep / 2)}" height="${innerH}" fill="${P.ny}" opacity="0.05"/>`);
  out.push(`<line x1="${nx - colStep / 2}" x2="${nx - colStep / 2}" y1="0" y2="${innerH}" stroke="${P.ny}" stroke-width="0.7" stroke-dasharray="3 3" opacity="0.7"/>`);
  out.push(`<text class="mono" x="${nx - colStep / 2 + 6}" y="18" text-anchor="start" fill="${P.nyDeep}" style="letter-spacing:0.12em;text-transform:uppercase">after 1918 →</text>`);
  out.push(`<text class="body" x="${nx - colStep / 2 + 6}" y="38" text-anchor="start" fill="${P.ink}">only mere mentions remain.</text>`);
}

// ---- IL annotation: Krautsack 2006 ----
{
  const kx = (panelW + panelGap) + xInPanel(2000);
  const ky = baselineY - 0.5 * tileStepActual;
  // pointer + label — above the final decade column, anchored END (right-to-left)
  out.push(`<line x1="${kx - 4}" x2="${kx - 30}" y1="${ky}" y2="${ky - 34}" stroke="${P.ilDeep}" stroke-width="0.7"/>`);
  out.push(`<text class="mono" x="${kx - 32}" y="${ky - 38}" text-anchor="end" fill="${P.ilDeep}" style="letter-spacing:0.1em;text-transform:uppercase">Krautsack 2006</text>`);
  out.push(`<text class="body" x="${kx - 32}" y="${ky - 22}" text-anchor="end">last IL success.</text>`);
}

// ---- footer: the headline ratio ----
out.push(`</g>`);

// headline finding across the bottom
const bx = M.left;
const by = H - 46;
out.push(`<text class="headline" x="${bx}" y="${by}" text-anchor="start" fill="${P.ink}">Most of the time, the court mentions the defense and never decides it.</text>`);
out.push(`<text class="body" x="${bx}" y="${by + 20}" text-anchor="start" fill="${P.ink}">NY: 78 of 117 mentions never reached (67%). IL: 106 of 152 (70%). The decided ledger is the thin gold-and-coral stripe at the baseline.</text>`);

out.push(`</svg>`);

fs.writeFileSync(OUT_PATH, out.join("\n"), "utf8");
console.log(`wrote ${OUT_PATH}`);
