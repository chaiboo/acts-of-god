// Render the case_timeline figure to a standalone static SVG.
// Shape keeper: one glyph per case on NY / IL horizontal spines, domain = shape,
// disposition = fill/stroke. Re-paletted to the new alive palette
// (coral / jade / marigold / indigo / plum).

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const DATA_PATH = path.join(HERE, "case_timeline.json");
const OUT_PATH = path.join(HERE, "case_timeline.svg");

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

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const cases = payload.cases;

const domainGlyph = {
  common_carrier: "circle",
  contract:       "square",
  tort:           "triangle",
  insurance:      "diamond",
  admiralty:      "hex",
  property:       "cross",
  environmental:  "cross",
  other:          "bar"
};
const DOM_LABEL = {
  common_carrier: "carrier",
  contract:       "contract",
  tort:           "tort",
  insurance:      "insurance",
  admiralty:      "admiralty",
  property:       "property",
  other:          "other"
};
const LEGEND_ORDER = ["common_carrier", "contract", "tort", "insurance", "admiralty", "property", "other"];

function glyphStr(shape, cx, cy, r, fill, stroke, sw) {
  if (shape === "circle") {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (shape === "square") {
    const s = r * 1.7;
    return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (shape === "triangle") {
    const s = r * 1.25;
    return `<path d="M ${cx} ${cy - s} L ${cx + s * 0.95} ${cy + s * 0.72} L ${cx - s * 0.95} ${cy + s * 0.72} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (shape === "diamond") {
    const s = r * 1.15;
    return `<path d="M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (shape === "hex") {
    const s = r * 1.05;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      pts.push(`${(cx + s * Math.cos(a)).toFixed(2)} ${(cy + s * Math.sin(a)).toFixed(2)}`);
    }
    return `<path d="M ${pts.join(" L ")} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else if (shape === "cross") {
    const s = r * 1.05;
    const t = s * 0.36;
    return `<path d="M ${cx - t} ${cy - s} L ${cx + t} ${cy - s} L ${cx + t} ${cy - t} L ${cx + s} ${cy - t} L ${cx + s} ${cy + t} L ${cx + t} ${cy + t} L ${cx + t} ${cy + s} L ${cx - t} ${cy + s} L ${cx - t} ${cy + t} L ${cx - s} ${cy + t} L ${cx - s} ${cy - t} L ${cx - t} ${cy - t} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  } else {
    const w = r * 2.2, h = r * 0.9;
    return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  }
}

// ---- dimensions ----
const W = 1040;
const H = 600;
const M = { top: 78, right: 40, bottom: 80, left: 138 };
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;

function xScale(yr) { return ((yr - 1835) / (2010 - 1835)) * innerW; }

const rowNY = innerH * 0.28;
const rowIL = innerH * 0.72;

function layoutSmart(caseList, baseY) {
  const sorted = caseList.slice().sort((a, b) => (a.year - b.year) || a.citation.localeCompare(b.citation));
  const placed = [];
  const minGapPx = 10;
  sorted.forEach(c => {
    const px = xScale(c.year);
    const neighbors = placed.filter(p => Math.abs(p.px - px) < minGapPx);
    const step = 10.5;
    const taken = new Set(neighbors.map(n => n.slot));
    let slot = 0;
    for (let k = 0; ; k++) {
      slot = (k % 2 === 0) ? -Math.ceil(k / 2) : Math.ceil(k / 2);
      if (!taken.has(slot)) break;
    }
    placed.push({ ...c, px, py: baseY + slot * step, slot });
  });
  return placed;
}

const nyCases = cases.filter(c => c.state === "NY");
const ilCases = cases.filter(c => c.state === "IL");
const nyPos = layoutSmart(nyCases, rowNY);
const ilPos = layoutSmart(ilCases, rowIL);

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Every act-of-God case adjudicated on the merits, NY and IL, 1835-2006. Each glyph is one case.">`);

out.push(`<defs><style>
  .mono    { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.04em; }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.16em; text-transform: uppercase; }
  .ax-tick { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; }
  .state   { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-size: 26px; font-weight: 500; font-style: italic; }
  .headline { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 18px; fill: ${P.ink}; }
  .body    { font-family: "Fraunces", "Source Serif 4", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 13px; fill: ${P.ink}; }
  text { dominant-baseline: middle; }
</style></defs>`);

out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${P.card}"/>`);

// ---- header ----
out.push(`<text class="eyebrow" x="${M.left - 94}" y="28" text-anchor="start">every adjudicated case · one glyph each · 1835–2006</text>`);

// ---- legend (single row, top) ----
{
  let lx = M.left - 94;
  const ly = 48;
  out.push(`<text class="mono" x="${lx}" y="${ly}" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.12em;text-transform:uppercase">disposition ·</text>`);
  lx += 96;
  out.push(`<circle cx="${lx}" cy="${ly}" r="4.5" fill="${P.gold}" stroke="${P.ink}" stroke-width="0.5"/>`);
  out.push(`<text class="mono" x="${lx + 9}" y="${ly}" text-anchor="start">succeeded</text>`);
  lx += 80;
  out.push(`<circle cx="${lx}" cy="${ly}" r="4.5" fill="${P.card}" stroke="${P.ink}" stroke-width="1.3"/>`);
  out.push(`<text class="mono" x="${lx + 9}" y="${ly}" text-anchor="start">failed</text>`);
  lx += 60;
  out.push(`<text class="mono" x="${lx}" y="${ly}" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.12em;text-transform:uppercase">domain ·</text>`);
  lx += 64;
  LEGEND_ORDER.forEach(dom => {
    const shape = domainGlyph[dom];
    out.push(glyphStr(shape, lx, ly, 4.2, "none", P.ink, 1));
    out.push(`<text class="mono" x="${lx + 9}" y="${ly}" text-anchor="start">${DOM_LABEL[dom]}</text>`);
    lx += 9 + DOM_LABEL[dom].length * 6.3 + 8;
  });
}

out.push(`<g transform="translate(${M.left},${M.top})">`);

// section subline
out.push(`<text class="mono" x="0" y="-14" text-anchor="start" fill="${P.ink2}">72 cases · shape = domain · filled gold = defense succeeded · open ring = failed</text>`);

// ---- state row backgrounds (subtle washes) ----
out.push(`<rect x="-120" y="${rowNY - 36}" width="${innerW + 128}" height="72" fill="${P.nyWash}" opacity="0.55"/>`);
out.push(`<rect x="-120" y="${rowIL - 36}" width="${innerW + 128}" height="72" fill="${P.ilWash}" opacity="0.55"/>`);

// ---- spines ----
out.push(`<line x1="0" x2="${innerW}" y1="${rowNY}" y2="${rowNY}" stroke="${P.nyDeep}" stroke-width="1.2" opacity="0.5"/>`);
out.push(`<line x1="0" x2="${innerW}" y1="${rowIL}" y2="${rowIL}" stroke="${P.ilDeep}" stroke-width="1.2" opacity="0.5"/>`);

// ---- year ticks (vertical faint rules) ----
const tickYears = [];
for (let yr = 1840; yr <= 2010; yr += 20) tickYears.push(yr);
tickYears.forEach(yr => {
  out.push(`<line x1="${xScale(yr)}" x2="${xScale(yr)}" y1="0" y2="${innerH}" stroke="${P.rule}" stroke-width="0.5" stroke-dasharray="1 3" opacity="0.8"/>`);
  out.push(`<text class="ax-tick" x="${xScale(yr)}" y="${innerH + 22}" text-anchor="middle">${yr}</text>`);
});

// ---- state labels ----
out.push(`<text class="state" fill="${P.nyDeep}" x="-124" y="${rowNY}" text-anchor="start">NEW YORK</text>`);
out.push(`<text class="state" fill="${P.ilDeep}" x="-124" y="${rowIL}" text-anchor="start">ILLINOIS</text>`);

// ---- NY silence band ----
const silenceX1 = xScale(1920);
const silenceX2 = innerW;
out.push(`<rect x="${silenceX1}" y="${rowNY - 36}" width="${silenceX2 - silenceX1}" height="72" fill="${P.ny}" opacity="0.07"/>`);
out.push(`<line x1="${xScale(1918)}" x2="${xScale(1918)}" y1="${rowNY - 36}" y2="${rowNY + 36}" stroke="${P.nyDeep}" stroke-width="0.9" stroke-dasharray="3 3" opacity="0.7"/>`);
out.push(`<text class="mono" x="${xScale(1918) + 6}" y="${rowNY - 46}" text-anchor="start" fill="${P.nyDeep}" style="letter-spacing:0.12em;text-transform:uppercase">last NY adjudication</text>`);
out.push(`<text class="body" x="${xScale(1918) + 6}" y="${rowNY - 30}" text-anchor="start" fill="${P.nyDeep}">Barnet v. NY Central · 1918</text>`);

// ---- connectors (from spine up/down to glyph) ----
[...nyPos, ...ilPos].forEach(c => {
  const baseY = (c.state === "NY") ? rowNY : rowIL;
  const stroke = c.state === "NY" ? P.nyDeep : P.ilDeep;
  out.push(`<line x1="${c.px}" x2="${c.px}" y1="${baseY}" y2="${c.py}" stroke="${stroke}" stroke-width="0.4" opacity="0.45"/>`);
});

// ---- draw case glyphs ----
function drawCase(c) {
  const shape = domainGlyph[c.domain] || "bar";
  const isSucc = c.disposition === "succeeded";
  const isFail = c.disposition === "failed";
  let fillColor, strokeColor, strokeW;
  if (isSucc) {
    fillColor = P.gold;
    strokeColor = P.ink;
    strokeW = 0.5;
  } else if (isFail) {
    fillColor = P.card;
    strokeColor = c.state === "NY" ? P.nyDeep : P.ilDeep;
    strokeW = 1.4;
  } else {
    // not_reached — very rare here (only 1 IL case: Schwartz v. Daegling, 1870)
    fillColor = P.card;
    strokeColor = P.ink2;
    strokeW = 1;
  }
  out.push(glyphStr(shape, c.px, c.py, 5.4, fillColor, strokeColor, strokeW));
}
nyPos.forEach(drawCase);
ilPos.forEach(drawCase);

// ---- IL workers-comp bracket (1939–2006 cluster) ----
{
  const tx = (xScale(1939) + xScale(2006)) / 2;
  const ty = rowIL + 44;
  out.push(`<line x1="${xScale(1939)}" x2="${xScale(2006)}" y1="${ty}" y2="${ty}" stroke="${P.ilDeep}" stroke-width="0.9" opacity="0.6"/>`);
  out.push(`<line x1="${xScale(1939)}" x2="${xScale(1939)}" y1="${ty - 4}" y2="${ty + 4}" stroke="${P.ilDeep}" stroke-width="0.9"/>`);
  out.push(`<line x1="${xScale(2006)}" x2="${xScale(2006)}" y1="${ty - 4}" y2="${ty + 4}" stroke="${P.ilDeep}" stroke-width="0.9"/>`);
  out.push(`<text class="mono" x="${tx}" y="${ty + 14}" text-anchor="middle" fill="${P.ilDeep}" style="letter-spacing:0.1em;text-transform:uppercase">IL long tail · 1939–2006 · 4/8 Industrial-Commission workers' comp</text>`);
}

// ---- tallies ----
const nySucc = nyCases.filter(c => c.disposition === "succeeded").length;
const nyFail = nyCases.filter(c => c.disposition === "failed").length;
const ilSucc = ilCases.filter(c => c.disposition === "succeeded").length;
const ilFail = ilCases.filter(c => c.disposition === "failed").length;
const ilNR   = ilCases.filter(c => c.disposition === "not_reached").length;

out.push(`<text class="mono" x="${innerW}" y="${rowNY - 46}" text-anchor="end" fill="${P.nyDeep}" style="letter-spacing:0.1em;text-transform:uppercase">NY · ${nyCases.length} cases · ${nySucc} succ / ${nyFail} fail</text>`);
out.push(`<text class="mono" x="-124" y="${rowIL + 30}" text-anchor="start" fill="${P.ilDeep}" style="letter-spacing:0.1em;text-transform:uppercase">IL · ${ilCases.length} cases · ${ilSucc} succ / ${ilFail} fail${ilNR ? ` · ${ilNR} not reached` : ""}</text>`);

out.push(`</g>`);
out.push(`</svg>`);

fs.writeFileSync(OUT_PATH, out.join("\n"), "utf8");
console.log(`wrote ${OUT_PATH}`);
