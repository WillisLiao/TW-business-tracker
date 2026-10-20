// Build-time SVG charts. Colours come from CSS custom properties (see styles.css)
// so light/dark mode is handled by the stylesheet, not here.
//
// Mark specs: columns <= 24px wide with a 2px gap, 4px rounded data end and a
// square baseline; hairline solid gridlines; selective direct labels (latest
// value only). Every mark has a larger transparent hit area carrying a tooltip
// (read by assets/app.js) and every chart has a table twin on the page.

import { esc } from './format.mjs';

// Charts are rendered twice: a desktop version and a narrower one for phones,
// so text stays legible instead of shrinking with the viewBox.
const DESKTOP = 720;
const MOBILE = 360;

const responsive = (desktop, mobile) => `<div class="chart-d">${desktop}</div><div class="chart-m">${mobile}</div>`;

function niceStep(range, ticks) {
  const raw = range / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
}

function niceDomain(min, max, ticks = 4) {
  if (min === max) { max = min + 1; }
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const step = niceStep(hi - lo, ticks);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const values = [];
  for (let v = start; v <= end + step / 2; v += step) values.push(Number(v.toFixed(10)));
  return { min: start, max: end, ticks: values };
}

// Column with a 4px rounded data end and a square baseline end.
function columnPath(x, w, yBase, yEnd) {
  const up = yEnd < yBase;
  const h = Math.abs(yBase - yEnd);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return '';
  if (up) {
    return `M${x},${yBase}V${yEnd + r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yEnd - r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd - r}V${yBase}Z`;
}

function barPath(xBase, xEnd, y, h) {
  const right = xEnd > xBase;
  const w = Math.abs(xEnd - xBase);
  const r = Math.min(4, h / 2, w);
  if (w < 0.5) return '';
  if (right) return `M${xBase},${y}H${xEnd - r}Q${xEnd},${y} ${xEnd},${y + r}V${y + h - r}Q${xEnd},${y + h} ${xEnd - r},${y + h}H${xBase}Z`;
  return `M${xBase},${y}H${xEnd + r}Q${xEnd},${y} ${xEnd},${y + r}V${y + h - r}Q${xEnd},${y + h} ${xEnd + r},${y + h}H${xBase}Z`;
}

/**
 * Vertical column chart for one series over time.
 * points: [{ key, value, xLabel?, tip }]
 * opts: { title, height, yFormat, labelLast, labelFormat, diverging }
 * diverging=true colours positive/negative with the diverging pair (for growth rates).
 */
export function columnChart(points, opts = {}) {
  const mobilePoints = opts.mobileCount ? points.slice(-opts.mobileCount) : points;
  return responsive(columnChartAt(points, { ...opts, width: DESKTOP }), columnChartAt(mobilePoints, { ...opts, width: MOBILE }));
}

function columnChartAt(points, opts) {
  const { title = '', height = 220, yFormat = String, labelLast = true, labelFormat = yFormat, diverging = false, width: W } = opts;
  const m = { top: 22, right: 8, bottom: 26, left: W < 500 ? 44 : 52 };
  const plotW = W - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  const values = points.map((p) => p.value).filter((v) => v != null);
  if (!values.length) return '<p class="muted">Not enough data for this chart yet.</p>';
  const dom = niceDomain(Math.min(...values), Math.max(...values));
  const y = (v) => m.top + plotH - ((v - dom.min) / (dom.max - dom.min)) * plotH;
  const band = plotW / points.length;
  const bw = Math.max(1, Math.min(24, band - 2));
  const y0 = y(0);

  const grid = dom.ticks.map((t) => `<line class="grid${t === 0 ? ' base' : ''}" x1="${m.left}" x2="${W - m.right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="tick" x="${m.left - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yFormat(t))}</text>`).join('');

  let bars = '';
  let hits = '';
  let xLabels = '';
  points.forEach((p, i) => {
    const x = m.left + i * band + (band - bw) / 2;
    if (p.value != null) {
      const cls = diverging ? (p.value >= 0 ? 'pos' : 'neg') : (p.highlight ? 'series-1' : 'series-1 dim');
      bars += `<path class="mark ${cls}" d="${columnPath(x, bw, y0, y(p.value))}"/>`;
    }
    hits += `<rect class="hit" x="${(m.left + i * band).toFixed(1)}" y="${m.top}" width="${band.toFixed(1)}" height="${plotH}" tabindex="0" aria-label="${esc(p.tip.replace(/\n/g, ', '))}" data-tip="${esc(p.tip)}"/>`;
    if (p.xLabel) xLabels += `<text class="tick" x="${(m.left + i * band + band / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${esc(p.xLabel)}</text>`;
  });

  let label = '';
  const last = [...points].reverse().find((p) => p.value != null);
  if (labelLast && last) {
    const i = points.lastIndexOf(last);
    const cx = m.left + i * band + band / 2;
    // Sit clear of the neighbouring bars, which may be taller than the last one.
    const near = points.slice(Math.max(0, i - 6), i + 1).map((p) => p.value).filter((v) => v != null);
    const ly = last.value >= 0 ? y(Math.max(...near)) - 6 : y(Math.min(...near)) + 14;
    label = `<text class="value-label" x="${Math.min(cx, W - m.right - 2).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="end">${esc(labelFormat(last.value))}</text>`;
  }

  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">${grid}${bars}${label}${xLabels}<g class="hits">${hits}</g></svg>`;
}

/**
 * Horizontal diverging bars (e.g. YoY growth by company), value at the tip.
 * rows: [{ label, sublabel?, value, tip, href? }]
 */
export function divergingBars(rows, opts = {}) {
  const short = (t) => (t.length > 17 ? `${t.slice(0, 16)}\u2026` : t);
  return responsive(
    divergingBarsAt(rows, { ...opts, width: DESKTOP }),
    divergingBarsAt(rows.map((r) => ({ ...r, label: short(r.label) })), { ...opts, width: MOBILE }),
  );
}

function divergingBarsAt(rows, opts) {
  const { title = '', format = String, width: W } = opts;
  const rowH = 26;
  const labelW = W < 500 ? 118 : 210;
  const valueW = W < 500 ? 52 : 64;
  const m = { top: 8, right: valueW, bottom: 8, left: labelW };
  const height = m.top + m.bottom + rows.length * rowH;
  const vals = rows.map((r) => r.value).filter((v) => v != null);
  if (!vals.length) return '<p class="muted">No members have reported for this month yet.</p>';
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  // Room for a value label on both sides, so negative labels never reach the names.
  const plotLeft = m.left + (lo < 0 ? valueW : 8);
  const plotW = W - m.right - plotLeft;
  const x = (v) => plotLeft + ((v - lo) / span) * plotW;
  const x0 = x(0);
  let out = `<line class="grid base" x1="${x0.toFixed(1)}" x2="${x0.toFixed(1)}" y1="${m.top}" y2="${height - m.bottom}"/>`;
  rows.forEach((r, i) => {
    const yTop = m.top + i * rowH;
    const yMid = yTop + rowH / 2;
    const name = r.href ? `<a href="${esc(r.href)}"><text class="row-label" x="${labelW - 10}" y="${yMid + 4}" text-anchor="end">${esc(r.label)}</text></a>` : `<text class="row-label" x="${labelW - 10}" y="${yMid + 4}" text-anchor="end">${esc(r.label)}</text>`;
    out += name;
    if (r.value == null) {
      out += `<text class="tick" x="${(x0 + 6).toFixed(1)}" y="${yMid + 4}">not yet reported</text>`;
    } else {
      const xe = x(r.value);
      out += `<path class="mark ${r.value >= 0 ? 'pos' : 'neg'}" d="${barPath(x0, xe, yMid - 8, 16)}"/>`;
      const tx = r.value >= 0 ? xe + 6 : xe - 6;
      out += `<text class="value-label" x="${tx.toFixed(1)}" y="${yMid + 4}" text-anchor="${r.value >= 0 ? 'start' : 'end'}">${esc(format(r.value))}</text>`;
    }
    out += `<rect class="hit" x="0" y="${yTop}" width="${W}" height="${rowH}" tabindex="0" aria-label="${esc(r.tip.replace(/\n/g, ', '))}" data-tip="${esc(r.tip)}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="${esc(title)}">${out}</svg>`;
}

// Diverging bins for heat cells (YoY growth). Returns a CSS class.
const EDGES = [0.05, 0.15, 0.3, 0.6];
export function heatClass(r) {
  if (r == null) return 'heat-na';
  const a = Math.abs(r);
  if (a < 0.01) return 'heat-0';
  let bin = 1;
  for (const e of EDGES) if (a >= e) bin++;
  return `heat-${r > 0 ? 'p' : 'n'}${bin}`;
}

export function heatLegend() {
  const cells = [
    ['heat-n5', '≤−60%'], ['heat-n4', ''], ['heat-n3', ''], ['heat-n2', ''], ['heat-n1', ''],
    ['heat-0', '0'],
    ['heat-p1', ''], ['heat-p2', ''], ['heat-p3', ''], ['heat-p4', ''], ['heat-p5', '≥+60%'],
  ];
  return `<div class="heat-legend" aria-label="Colour scale: red is a decline, blue is growth versus the same month last year">${cells.map(([c, l]) => `<span class="${c}">${l}</span>`).join('')}</div>`;
}
