// Makes share-ready images (1200x675 PNG) and a suggested post caption for the
// latest month, written into dist/share/. They double as the og:image for the
// home page and monthly reports. Posting them is the owner's 5-minute monthly task.
// Usage: node share/make-share.mjs [--data data] [--out dist] [--sample]

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { loadDataset } from '../site/lib/data.mjs';
import { ntd, pct, esc } from '../site/lib/format.mjs';
import { periodLabel } from '../pipeline/lib/period.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const outDir = path.join(opt('--out', 'dist'), 'share');
const sample = args.includes('--sample');

const W = 1200;
const H = 675;
const C = { bg: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#6b6a66', grid: '#e1e0d9', axis: '#c3c2b7', pos: '#2a78d6', neg: '#e34948', banner: '#fab219' };
const FONT = 'Inter, DejaVu Sans, Liberation Sans, Arial, sans-serif';

const ds = loadDataset(dataDir);
const period = ds.latestPeriod;
if (!period) { console.log('No data yet; no share images.'); process.exit(0); }
const cfg = ds.siteConfig;
const domain = cfg.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
const prog = ds.progress(period);

function frame(title, subtitle, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${sample ? `<rect width="${W}" height="36" fill="${C.banner}"/><text x="${W / 2}" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="#0b0b0b">SAMPLE DATA - INVENTED NUMBERS, NOT REAL</text>` : ''}
<text x="56" y="${sample ? 92 : 76}" font-size="38" font-weight="700" fill="${C.ink}">${esc(title)}</text>
<text x="56" y="${sample ? 128 : 112}" font-size="21" fill="${C.ink2}">${esc(subtitle)}</text>
${inner}
<line x1="56" x2="${W - 56}" y1="${H - 58}" y2="${H - 58}" stroke="${C.grid}"/>
<text x="56" y="${H - 26}" font-size="18" font-weight="700" fill="${C.ink}">${esc(cfg.siteName)}</text>
<text x="${W - 56}" y="${H - 26}" font-size="18" text-anchor="end" fill="${C.ink2}">${esc(domain)} · Source: TWSE/TPEx open data</text>
</svg>`;
}

// Horizontal diverging bars with labels on the left and values at the tips.
function bars(rows, top) {
  const rowH = Math.min(42, (H - top - 80) / rows.length);
  const labelX = 380;
  const vals = rows.map((r) => r.value).filter((v) => v != null);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const left = labelX + 24 + (lo < 0 ? 90 : 0);
  const right = W - 56 - 100;
  const x = (v) => left + ((v - lo) / (hi - lo || 1)) * (right - left);
  let out = `<line x1="${x(0)}" x2="${x(0)}" y1="${top - 6}" y2="${top + rows.length * rowH}" stroke="${C.axis}"/>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const mid = y + rowH / 2;
    out += `<text x="${labelX}" y="${mid + 7}" font-size="20" text-anchor="end" fill="${C.ink}">${esc(r.label)}</text>`;
    if (r.value == null) return;
    const x0 = x(0);
    const x1 = x(r.value);
    const bh = Math.min(24, rowH - 10);
    out += `<rect x="${Math.min(x0, x1)}" y="${mid - bh / 2}" width="${Math.max(1, Math.abs(x1 - x0))}" height="${bh}" rx="4" fill="${r.value >= 0 ? C.pos : C.neg}"/>`;
    out += `<text x="${r.value >= 0 ? x1 + 10 : x1 - 10}" y="${mid + 7}" font-size="20" font-weight="700" text-anchor="${r.value >= 0 ? 'start' : 'end'}" fill="${C.ink}">${esc(pct(r.value))}</text>`;
  });
  return out;
}

const total = ds.marketTotal(period);
const groups = ds.baskets.map((b) => ({ b, agg: ds.aggregate([...new Set(b.members.map((m) => m.code))], period) }))
  .filter((g) => g.agg.yoy != null).sort((a, b) => b.agg.yoy - a.agg.yoy);
const status = prog.complete ? '' : ` (${prog.reported} of ~${prog.expected} reported so far)`;
const top = sample ? 168 : 152;

const images = {
  groups: frame(
    `Taiwan supply chains: ${periodLabel(period, true)} revenue`,
    `Combined revenue vs a year earlier, same companies${status}. All companies: ${pct(total.yoy)}.`,
    bars(groups.map((g) => ({ label: g.b.name, value: g.agg.yoy })), top),
  ),
};
const { up } = ds.movers(period, 8);
if (up.length) {
  images.movers = frame(
    `Biggest revenue gains, ${periodLabel(period, true)}`,
    `Year-on-year growth, Taiwan-listed companies with at least ${ntd(cfg.minRevenueForMoversThousandNtd, { digits: 0 })} monthly revenue.`,
    bars(up.map((m) => ({ label: `${ds.companies.get(m.code)?.display || m.code} ${m.code}`.slice(0, 30), value: m.yoy })), top),
  );
}

fs.mkdirSync(outDir, { recursive: true });
for (const [name, svg] of Object.entries(images)) {
  const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' }, fitTo: { mode: 'width', value: W } }).render().asPng();
  fs.writeFileSync(path.join(outDir, `${period}-${name}.png`), png);
  fs.writeFileSync(path.join(outDir, `latest-${name}.png`), png);
}

const tsmc = ds.metrics('2330', period);
const caption = [
  `Taiwan's ${periodLabel(period, true)} monthly revenue${prog.complete ? '' : ' so far'}: ${total.reported} companies, combined ${pct(total.yoy)} YoY (same companies).`,
  tsmc ? `TSMC: ${ntd(tsmc.rev)}, ${pct(tsmc.yoy)} YoY.` : '',
  groups.length ? `Strongest group: ${groups[0].b.name} ${pct(groups[0].agg.yoy)}. Weakest: ${groups.at(-1).b.name} ${pct(groups.at(-1).agg.yoy)}.` : '',
  `Every company, in English, with sources: ${cfg.siteUrl.replace(/\/$/, '')}/reports/${period}/`,
].filter(Boolean).join('\n');
fs.writeFileSync(path.join(outDir, 'latest-caption.txt'), caption + '\n');
console.log(`Share images for ${period}: ${Object.keys(images).join(', ')} -> ${outDir}`);
