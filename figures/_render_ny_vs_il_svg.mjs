// Render the ny_vs_il figure to a standalone static SVG file.
// Twin-line time series, NY vs IL, merits-adjudication rate per 10k opinions per decade.
// Redesign: new alive palette (coral / jade / marigold / indigo), small-dot per-case glyphs
// instead of the old "composite dot cluster above the line," and a lively spot-illustration for
// the 1920 inflection rather than the old parchment ribbon.

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const DATA_PATH = path.join(HERE, "ny_vs_il.json");
const OUT_PATH = path.join(HERE, "ny_vs_il.svg");

// ---- palette ----
const P = {
  page:   "#ffffff",
  card:   "#ffffff",   // pure white — rivalry palette needs a hard background
  ink:    "#1a1a28",
  ink2:   "#5a5870",
  rule:   "#dad7e6",
  ny:     "#0039A6",   // NYC subway-bullet blue
  nyDeep: "#002060",
  il:     "#E84A27",   // Illini orange
  ilDeep: "#B03418",
  gold:   "#f5b400",   // marigold (= succeeded)
  indigo: "#3d4e9e",   // (= not-reached / boilerplate)
  plum:   "#a23d7a",
  mustard:"#d89a2a",
  sky:    "#74b7d4"
};

const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const rows = payload.rows;

// ---- reshape ----
const decades = Array.from(new Set(rows.map(r => +r.decade))).sort((a, b) => a - b);
const decadeMap = new Map();
decades.forEach(d => decadeMap.set(d, { decade: d, NY: null, IL: null }));
rows.forEach(r => {
  const slot = decadeMap.get(+r.decade);
  slot[r.state] = {
    n_denom: +r.n_denom,
    n_mentions: +r.n_mentions,
    n_really: +r.n_really_adjudicated,
    n_succ: +r.n_succeeded,
    n_fail: +r.n_failed,
    rate: +r.rate_adjudicated_per10k,
  };
});
const data = decades.map(d => decadeMap.get(d));
const plotData = data.filter(d =>
  (d.NY && d.NY.n_denom > 0) || (d.IL && d.IL.n_denom > 0)
);

// ---- dimensions ----
const W = 1040;
const H = 600;
const M = { top: 68, right: 108, bottom: 108, left: 76 };
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;

// ---- scales ----
function bandScale(domain, range, paddingInner = 0.22, paddingOuter = 0.1) {
  const n = domain.length;
  const [r0, r1] = range;
  const step = (r1 - r0) / (n - paddingInner + 2 * paddingOuter);
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + step * paddingOuter;
  const map = new Map();
  domain.forEach((v, i) => map.set(v, start + i * step));
  const f = (v) => map.get(v);
  f.bandwidth = () => bandwidth;
  f.step = () => step;
  return f;
}
function linearScale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const f = (v) => r0 + (v - d0) * (r1 - r0) / (d1 - d0);
  f.ticks = (n = 5) => {
    const step = niceStep((d1 - d0) / n);
    const t0 = Math.ceil(d0 / step) * step;
    const out = [];
    for (let v = t0; v <= d1 + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  };
  return f;
}
function niceStep(x) {
  const exp = Math.floor(Math.log10(x));
  const frac = x / Math.pow(10, exp);
  let nice;
  if (frac < 1.5) nice = 1;
  else if (frac < 3) nice = 2;
  else if (frac < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

// Catmull-Rom (lively, less prim than monotone cubic)
function smoothPath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const tension = 0.5;
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0]} ${p2[1]}`;
  }
  return path;
}
function linePathSegs(pts, isDefined) {
  const segs = [];
  let cur = [];
  pts.forEach(p => {
    if (isDefined(p)) cur.push(p);
    else { if (cur.length) { segs.push(cur); cur = []; } }
  });
  if (cur.length) segs.push(cur);
  return segs.map(smoothPath).join(" ");
}

// ---- scales bound ----
const xDec = bandScale(plotData.map(d => d.decade), [0, innerW], 0.22, 0.1);
const xCenter = d => xDec(d.decade) + xDec.bandwidth() / 2;

const maxRate = Math.max(...plotData.map(d => Math.max(
  d.NY ? d.NY.rate : 0,
  d.IL ? d.IL.rate : 0
)));
const y = linearScale([0, maxRate * 1.12], [innerH, 0]);

// ---- assembly ----
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Decade-by-decade merits-adjudicated act-of-God rate per 10,000 opinions: New York Court of Appeals vs. Illinois Supreme Court, 1820-2010.">`);

out.push(`<defs>
<style>
  .ax-tick { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink2}; letter-spacing: 0.02em; }
  .ax-cap  { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; fill: ${P.ink2}; letter-spacing: 0.14em; text-transform: uppercase; }
  .eyebrow { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.16em; text-transform: uppercase; }
  .state   { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-size: 22px; font-weight: 500; font-style: italic; letter-spacing: 0.02em; }
  .headline { font-family: "Fraunces", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 19px; font-weight: 400; fill: ${P.ink}; }
  .body    { font-family: "Fraunces", "Source Serif 4", "Instrument Serif", Georgia, serif; font-style: italic; font-size: 13px; fill: ${P.ink}; }
  .mono    { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; fill: ${P.ink}; letter-spacing: 0.04em; }
  .rail    { stroke: ${P.rule}; stroke-width: 0.6; }
  .rail-bold { stroke: ${P.ink}; stroke-width: 0.8; opacity: 0.35; }
  text { dominant-baseline: middle; }
</style>
<linearGradient id="gWash" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0%" stop-color="${P.gold}" stop-opacity="0.18"/>
  <stop offset="100%" stop-color="${P.gold}" stop-opacity="0"/>
</linearGradient>
</defs>`);

// card
out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${P.card}"/>`);

// section eyebrow top-left
out.push(`<text class="eyebrow" x="${M.left}" y="30" text-anchor="start">merits-adjudication rate per 10k opinions · by decade</text>`);
out.push(`<text class="mono" x="${M.left}" y="48" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.02em">New York Court of Appeals vs. Illinois Supreme Court · 1840–2010</text>`);

out.push(`<g transform="translate(${M.left},${M.top})">`);

// gridlines
const yTicks = y.ticks(5).filter(t => t > 0);
yTicks.forEach(t => {
  out.push(`<line class="rail" x1="0" x2="${innerW}" y1="${y(t)}" y2="${y(t)}" stroke-dasharray="1 3"/>`);
  out.push(`<text class="ax-tick" x="-10" y="${y(t)}" text-anchor="end">${t.toFixed(0)}</text>`);
});
// baseline
out.push(`<line class="rail-bold" x1="0" x2="${innerW}" y1="${y(0)}" y2="${y(0)}"/>`);
out.push(`<text class="ax-tick" x="-10" y="${y(0)}" text-anchor="end">0</text>`);
// y-axis caption
out.push(`<text class="ax-cap" transform="translate(-54, ${innerH / 2}) rotate(-90)" text-anchor="middle">rate per 10k · adjudicated</text>`);

// 1920 inflection band (subtle warm wash — the "silence" zone for NY)
const d1920 = plotData.find(d => d.decade === 1920);
const d1910 = plotData.find(d => d.decade === 1910);
let inflectionX = null;
if (d1910 && d1920) inflectionX = (xDec(d1910.decade) + xDec.bandwidth() + xDec(d1920.decade)) / 2;
if (inflectionX !== null) {
  out.push(`<rect x="${inflectionX}" y="0" width="${innerW - inflectionX}" height="${innerH}" fill="${P.ny}" opacity="0.045"/>`);
  out.push(`<line x1="${inflectionX}" x2="${inflectionX}" y1="-10" y2="${innerH + 6}" stroke="${P.ny}" stroke-width="0.7" stroke-dasharray="3 3" opacity="0.55"/>`);
  out.push(`<text class="mono" x="${inflectionX + 6}" y="-2" text-anchor="start" fill="${P.ny}" style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase">1920 →</text>`);
}

// decade tick labels
const firstDec = plotData[0].decade;
const lastDec = plotData[plotData.length - 1].decade;
plotData.forEach(d => {
  if (d.decade % 20 === 0 || d.decade === firstDec || d.decade === lastDec) {
    out.push(`<text class="ax-tick" x="${xCenter(d)}" y="${innerH + 22}" text-anchor="middle">${d.decade}s</text>`);
  }
});

// ---- lines ----
function stateLinePath(stateKey) {
  const pts = plotData.map(d => {
    const s = d[stateKey];
    if (s && s.n_denom > 0) return [xCenter(d), y(s.rate), true];
    return [xCenter(d), 0, false];
  });
  return linePathSegs(pts, p => p[2]);
}
// glow / underlay for the lines
out.push(`<path d="${stateLinePath("NY")}" fill="none" stroke="${P.ny}" stroke-width="6" opacity="0.14" stroke-linecap="round" stroke-linejoin="round"/>`);
out.push(`<path d="${stateLinePath("IL")}" fill="none" stroke="${P.il}" stroke-width="6" opacity="0.14" stroke-linecap="round" stroke-linejoin="round"/>`);
out.push(`<path d="${stateLinePath("NY")}" fill="none" stroke="${P.ny}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`);
out.push(`<path d="${stateLinePath("IL")}" fill="none" stroke="${P.il}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`);

// Per-case resolution is handled by Figure 4 (case_timeline).
// Figure 1's job is the rate curve + the divergence annotation — keep the plot clean.

// ---- end-of-line state labels ----
function lastDefined(stateKey) {
  for (let i = plotData.length - 1; i >= 0; i--) {
    const d = plotData[i];
    if (d[stateKey] && d[stateKey].n_denom > 0) return d;
  }
  return null;
}
const nyLast = lastDefined("NY");
const ilLast = lastDefined("IL");
// Compact state codes at line end — plot area was widened 40px on the right
// to guarantee they render fully without clipping.
if (nyLast) {
  const anchorX = xCenter(nyLast) + 2;
  const anchorY = y(nyLast.NY.rate);
  out.push(`<circle cx="${anchorX}" cy="${anchorY}" r="4" fill="${P.ny}"/>`);
  out.push(`<text class="state" fill="${P.ny}" x="${anchorX + 10}" y="${anchorY - 10}" text-anchor="start">N.Y.</text>`);
}
if (ilLast) {
  const anchorX = xCenter(ilLast) + 2;
  const anchorY = y(ilLast.IL.rate);
  out.push(`<circle cx="${anchorX}" cy="${anchorY}" r="4" fill="${P.il}"/>`);
  out.push(`<text class="state" fill="${P.il}" x="${anchorX + 10}" y="${anchorY + 12}" text-anchor="start">Ill.</text>`);
}

// Both annotations live in the post-1920 silence band (right half of the plot),
// stacked vertically so they never overlap the active-data band on the left.
if (inflectionX !== null) {
  const ax = inflectionX + 16;
  const topY = innerH * 0.12;
  // NY annotation (upper): points to the 1918 terminus
  out.push(`<text class="headline" x="${ax}" y="${topY}" text-anchor="start" fill="${P.nyDeep}">New York stops adjudicating.</text>`);
  out.push(`<text class="body" x="${ax}" y="${topY + 18}" text-anchor="start">Zero merits adjudications in the</text>`);
  out.push(`<text class="body" x="${ax}" y="${topY + 34}" text-anchor="start">Court of Appeals after 1918.</text>`);

  // IL annotation (lower): points to the IL long-tail
  const post1920 = plotData.filter(d => d.decade >= 1920 && d.IL && d.IL.n_really > 0);
  const pk = post1920.length ? post1920.reduce((a, b) => (b.IL.rate > (a ? a.IL.rate : -1) ? b : a), null) : null;
  const midY = innerH * 0.48;
  out.push(`<text class="headline" x="${ax}" y="${midY}" text-anchor="start" fill="${P.ilDeep}">Illinois keeps going.</text>`);
  out.push(`<text class="body" x="${ax}" y="${midY + 18}" text-anchor="start">Eight post-1920 IL adjudications;</text>`);
  out.push(`<text class="body" x="${ax}" y="${midY + 34}" text-anchor="start">four are Industrial Commission</text>`);
  out.push(`<text class="body" x="${ax}" y="${midY + 50}" text-anchor="start">workers'-compensation appeals.</text>`);
  if (pk) {
    const px = xCenter(pk);
    const py = y(pk.IL.rate);
    out.push(`<path d="M ${ax - 4} ${midY + 28} Q ${(ax + px) / 2} ${midY + 70} ${px + 2} ${py - 4}" fill="none" stroke="${P.ilDeep}" stroke-width="0.7" opacity="0.6"/>`);
  }
}

// legend — just the two state rate lines
{
  const lx = 0;
  const ly = innerH + 48;
  out.push(`<line x1="${lx}" x2="${lx + 22}" y1="${ly}" y2="${ly}" stroke="${P.ny}" stroke-width="2.2"/>`);
  out.push(`<text class="mono" x="${lx + 28}" y="${ly}" text-anchor="start" fill="${P.ink}">NY rate</text>`);
  out.push(`<line x1="${lx + 100}" x2="${lx + 122}" y1="${ly}" y2="${ly}" stroke="${P.il}" stroke-width="2.2"/>`);
  out.push(`<text class="mono" x="${lx + 128}" y="${ly}" text-anchor="start" fill="${P.ink}">IL rate</text>`);
}

// convergence identity — bottom line
out.push(`<text class="mono" x="0" y="${innerH + 70}" text-anchor="start" fill="${P.ink2}" style="letter-spacing:0.12em;text-transform:uppercase">Where the defense IS adjudicated, success rates converge</text>`);
out.push(`<text class="body" x="0" y="${innerH + 86}" text-anchor="start">NY 11 / 35 succeeded · 31%   ·   IL 12 / 36 succeeded · 33%   —   the divergence is survival, not outcome.</text>`);

out.push(`</g>`);
out.push(`</svg>`);

const svg = out.join("\n");
fs.writeFileSync(OUT_PATH, svg, "utf8");
console.log(`wrote ${OUT_PATH} (${svg.length} bytes)`);
