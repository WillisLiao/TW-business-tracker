// Generates INVENTED sample data for local previews and UI tests only.
// The output folder contains a SAMPLE marker file; site/build.mjs refuses to
// build from it without --sample, and --sample pages carry a banner + noindex.

import fs from 'node:fs';
import path from 'node:path';
import { addMonths, latestPossiblePeriod } from '../pipeline/lib/period.mjs';
import { writePeriod, writeJson } from '../pipeline/lib/store.mjs';

const out = process.argv[2] || 'test/sample-data';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'SAMPLE'), 'Invented numbers for testing. Never publish.\n');

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const { baskets } = JSON.parse(fs.readFileSync('config/baskets.json', 'utf8'));
const industries = ['24', '25', '26', '27', '28', '01', '02', '03', '15', '17', '22', '31'];

const companies = {};
for (const b of baskets) for (const m of b.members) {
  companies[m.code] = { market: /^[3-9]\d{3}$/.test(m.code) && rand() < 0.3 ? 'TPEx' : 'TWSE', nameZh: `樣本${m.code}`, nameEn: '', industry: '24' };
}
for (let i = 0; i < 260; i++) {
  const code = String(1100 + Math.floor(rand() * 8800));
  if (companies[code]) continue;
  companies[code] = { market: rand() < 0.45 ? 'TPEx' : 'TWSE', nameZh: `樣本公司${i}`, nameEn: `Sample Company ${i}`, industry: industries[Math.floor(rand() * industries.length)] };
}
writeJson(path.join(out, 'companies.json'), companies);

const latest = latestPossiblePeriod();
const months = Array.from({ length: 60 }, (_, i) => addMonths(latest, i - 59));
const params = Object.fromEntries(Object.keys(companies).map((c) => [c, {
  base: c === '2330' ? 1.5e8 : Math.exp(Math.log(5e4) + rand() * Math.log(800)),
  growth: c === '2330' ? 0.3 : -0.1 + rand() * 0.5,
  season: rand() * 0.2,
  noise: 0.04 + rand() * 0.1,
  start: rand() < 0.08 ? Math.floor(rand() * 40) : 0,
}]));
const rev = {};
for (const [code, p] of Object.entries(params)) {
  rev[code] = months.map((m, i) => {
    if (i < p.start) return null;
    const month = Number(m.slice(5));
    const v = p.base * (1 + p.growth) ** (i / 12) * (1 + p.season * Math.sin((month / 12) * 2 * Math.PI)) * (1 + (rand() - 0.5) * 2 * p.noise);
    return Math.round(v);
  });
}

months.forEach((period, i) => {
  const file = { period, updatedAt: new Date().toISOString(), companies: {} };
  const isLatest = i === months.length - 1;
  for (const code of Object.keys(companies)) {
    const r = rev[code][i];
    if (r == null) continue;
    if (isLatest && rand() < 0.3) continue; // reporting still in progress
    const prev = rev[code][i - 1] ?? null;
    const ya = rev[code][i - 12] ?? null;
    const yearStart = i - (Number(period.slice(5)) - 1);
    const ytd = rev[code].slice(Math.max(0, yearStart), i + 1).reduce((a, b) => a + (b || 0), 0);
    const ytdPrev = yearStart - 12 >= 0 ? rev[code].slice(yearStart - 12, i - 11).reduce((a, b) => a + (b || 0), 0) : null;
    const pc = (a, b) => (a != null && b ? Number(((a / b - 1) * 100).toFixed(2)) : null);
    const [y, m] = period.split('-').map(Number);
    const seen = new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1 + Math.floor(rand() * 10), 1 + Math.floor(rand() * 10)));
    file.companies[code] = { market: companies[code].market, rev: r, prev, ya, momPct: pc(r, prev), yoyPct: pc(r, ya), ytd, ytdPrev, ytdPct: pc(ytd, ytdPrev), note: '', firstSeen: seen.toISOString(), source: 'SAMPLE' };
  }
  writePeriod(out, file);
});
writeJson(path.join(out, 'status.json'), { lastRunAt: new Date().toISOString(), lastChangeAt: new Date().toISOString(), sources: {} });
console.log(`Sample data (invented) written to ${out}: ${Object.keys(companies).length} companies x ${months.length} months.`);
