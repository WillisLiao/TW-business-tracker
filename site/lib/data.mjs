// Loads data/ and derives everything the pages, alerts and exports need.
// All growth figures are computed by us from the published amounts (and
// cross-checked against the exchanges' own percentages by the pipeline).

import fs from 'node:fs';
import path from 'node:path';
import { listPeriods, readPeriod, readJson } from '../../pipeline/lib/store.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { slugify } from './format.mjs';
import { loadSiteConfig } from './config.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const loadConfig = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

export const MARKET_LABEL = { TWSE: 'Listed (TWSE)', TPEx: 'OTC (TPEx)' };

const ratio = (a, b) => (a != null && b != null && b > 0 ? a / b - 1 : null);

export function loadDataset(dataDir, { siteConfig = loadSiteConfig() } = {}) {
  const industries = loadConfig('config/industries.json');
  const { baskets } = loadConfig('config/baskets.json');
  const profiles = readJson(path.join(dataDir, 'companies.json'), {});
  const status = readJson(path.join(dataDir, 'status.json'), {});
  const periods = listPeriods(dataDir);
  const byPeriod = new Map(periods.map((p) => [p, readPeriod(dataDir, p).companies]));

  const basketName = new Map();
  for (const b of baskets) for (const m of b.members) if (!basketName.has(m.code)) basketName.set(m.code, m.name);

  const industryEn = (raw) => {
    if (!raw) return 'Other';
    const zh = industries.codes[raw] || industries.codes[raw.padStart?.(2, '0')] || raw;
    return industries.names[zh] || zh;
  };

  // Company directory: every code that appears in any period or profile.
  const codes = new Set(Object.keys(profiles));
  for (const recs of byPeriod.values()) Object.keys(recs).forEach((c) => codes.add(c));
  const companies = new Map();
  for (const code of [...codes].sort()) {
    const pr = profiles[code] || {};
    let market = pr.market;
    if (!market) for (const p of [...periods].reverse()) { if (byPeriod.get(p)[code]) { market = byPeriod.get(p)[code].market; break; } }
    const nameEn = basketName.get(code) || pr.nameEn || pr.fullNameEn || '';
    companies.set(code, {
      code,
      market: market || 'TWSE',
      nameZh: pr.nameZh || '',
      nameEn,
      display: nameEn || pr.nameZh || code,
      industry: industryEn(pr.industry),
      industrySlug: slugify(industryEn(pr.industry)),
      website: pr.website || '',
      baskets: baskets.filter((b) => b.members.some((m) => m.code === code)).map((b) => b.slug),
    });
  }

  // Per-company monthly series, oldest first.
  const series = new Map();
  for (const p of periods) {
    for (const [code, r] of Object.entries(byPeriod.get(p))) {
      if (!series.has(code)) series.set(code, []);
      series.get(code).push({ period: p, ...r });
    }
  }

  const point = (code, period) => byPeriod.get(period)?.[code] ?? null;

  // Metrics for one company in one month.
  function metrics(code, period) {
    const r = point(code, period);
    if (!r) return null;
    const ya = r.ya ?? point(code, addMonths(period, -12))?.rev ?? null;
    const prev = r.prev ?? point(code, addMonths(period, -1))?.rev ?? null;
    let sum3 = 0, sum3ya = 0, n3 = 0;
    for (let i = 0; i < 3; i++) {
      const q = point(code, addMonths(period, -i));
      const qya = q?.ya ?? point(code, addMonths(period, -i - 12))?.rev;
      if (q?.rev != null && qya > 0) { sum3 += q.rev; sum3ya += qya; n3++; }
    }
    const s = series.get(code) || [];
    const earlier = s.filter((x) => x.period < period && x.rev != null);
    const recordHigh = earlier.length >= 24 && r.rev != null && r.rev > Math.max(...earlier.map((x) => x.rev));
    return {
      code,
      period,
      rev: r.rev,
      ya,
      prev,
      yoy: ratio(r.rev, ya),
      mom: ratio(r.rev, prev),
      ytd: r.ytd,
      ytdPrev: r.ytdPrev,
      ytdYoy: ratio(r.ytd, r.ytdPrev),
      yoy3m: n3 === 3 ? sum3 / sum3ya - 1 : null,
      recordHigh,
      historyMonths: earlier.length + 1,
      firstSeen: r.firstSeen || null,
      note: r.note || '',
      revisions: r.revisions || [],
      market: r.market,
    };
  }

  const latestPeriod = periods.at(-1) || null;

  // Same-company aggregate growth for a set of codes in a period.
  function aggregate(codesList, period) {
    let rev = 0, ya = 0, n = 0, reported = 0;
    for (const c of codesList) {
      const m = metrics(c, period);
      if (!m || m.rev == null) continue;
      reported++;
      if (m.ya > 0) { rev += m.rev; ya += m.ya; n++; }
    }
    return { reported, total: codesList.length, compared: n, rev, ya, yoy: ya > 0 ? rev / ya - 1 : null };
  }

  function progress(period) {
    const reported = Object.keys(byPeriod.get(period) || {}).length;
    const prevCount = Object.keys(byPeriod.get(addMonths(period, -1)) || {}).length;
    const expected = Math.max(reported, prevCount);
    return { reported, expected, share: expected ? reported / expected : 0, complete: expected > 0 && reported >= expected * 0.97 };
  }

  function allMetrics(period) {
    return Object.keys(byPeriod.get(period) || {}).map((c) => metrics(c, period)).filter(Boolean);
  }

  function movers(period, n = 10) {
    const min = siteConfig.minRevenueForMoversThousandNtd;
    const eligible = allMetrics(period).filter((m) => m.yoy != null && m.rev >= min && m.ya >= min * 0.2);
    eligible.sort((a, b) => b.yoy - a.yoy);
    return { up: eligible.filter((m) => m.yoy > 0).slice(0, n), down: eligible.filter((m) => m.yoy < 0).reverse().slice(0, n) };
  }

  function recordHighs(period) {
    const min = siteConfig.minRevenueForRecordsThousandNtd;
    return allMetrics(period).filter((m) => m.recordHigh && m.rev >= min).sort((a, b) => b.rev - a.rev);
  }

  const basketCodes = (b) => [...new Set(b.members.map((m) => m.code))];

  function basketSummary(b, period) {
    const agg = aggregate(basketCodes(b), period);
    const members = b.members.map((m) => ({ ...m, company: companies.get(m.code) || null, m: metrics(m.code, period) }));
    return { ...b, agg, members };
  }

  // Same-member YoY for each of the last n months (for heatmaps and group charts).
  function basketYoySeries(b, endPeriod, n) {
    return Array.from({ length: n }, (_, i) => addMonths(endPeriod, i - n + 1)).map((p) => ({ period: p, ...aggregate(basketCodes(b), p) }));
  }

  function industriesIndex() {
    const map = new Map();
    for (const c of companies.values()) {
      if (!map.has(c.industrySlug)) map.set(c.industrySlug, { slug: c.industrySlug, name: c.industry, codes: [] });
      map.get(c.industrySlug).codes.push(c.code);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    siteConfig,
    status,
    periods,
    latestPeriod,
    byPeriod,
    companies,
    series,
    baskets,
    metrics,
    aggregate,
    progress,
    allMetrics,
    movers,
    recordHighs,
    basketSummary,
    basketYoySeries,
    industriesIndex,
    marketTotal: (period) => aggregate(Object.keys(byPeriod.get(period) || {}), period),
  };
}
