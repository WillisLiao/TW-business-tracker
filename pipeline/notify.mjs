// Sends alert triggers to the site's /api/notify endpoint after a deploy:
//   - "filings": filings queued in data/status.json (pendingAlerts) by update.mjs
//   - "summary": once per month, when about 90% of companies have reported
// The server de-duplicates, so re-running is safe.
// Env: SITE_URL, NOTIFY_SECRET. Without them this script only prints what it would send.

import { loadDataset } from '../site/lib/data.mjs';
import { ntd, pct } from '../site/lib/format.mjs';
import { periodLabel, addMonths, latestPossiblePeriod } from './lib/period.mjs';
import { readJson, writeJson, dataPaths } from './lib/store.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
const secret = process.env.NOTIFY_SECRET || '';

const ds = loadDataset(dataDir);
const p = dataPaths(dataDir);
const status = readJson(p.status, {});
const recentFloor = addMonths(latestPossiblePeriod(), -2);

async function post(body) {
  if (!siteUrl || !secret) {
    console.log('(dry run: SITE_URL/NOTIFY_SECRET not set)', JSON.stringify(body).slice(0, 400));
    return { ok: true, dryRun: true };
  }
  const res = await fetch(`${siteUrl}/api/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`notify failed: HTTP ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// 1. New filings (only recent months, so a history backfill never triggers alerts).
const pending = status.pendingAlerts || [];
const items = pending
  .filter((a) => a.period >= recentFloor)
  .map((a) => {
    const m = ds.metrics(a.code, a.period);
    const c = ds.companies.get(a.code);
    return {
      code: a.code,
      name: c?.display || a.code,
      nameZh: c?.nameZh || '',
      period: a.period,
      periodLabel: periodLabel(a.period, true),
      rev: ntd(m?.rev),
      yoy: pct(m?.yoy),
      mom: pct(m?.mom),
      url: `${siteUrl}/company/${encodeURIComponent(a.code)}/`,
    };
  });
if (items.length) {
  const r = await post({ type: 'filings', items });
  console.log(`Filings alert: ${items.length} filings, ${r.emails ?? 0} emails.`);
}
if (pending.length && siteUrl && secret) {
  status.pendingAlerts = [];
  writeJson(p.status, status);
}

// 2. Month summary, once reporting is ~complete.
const period = ds.latestPeriod;
if (period && ds.progress(period).share >= 0.9 && !status.summarySent?.[period]) {
  const total = ds.marketTotal(period);
  const groups = ds.baskets.map((b) => ({ b, agg: ds.aggregate([...new Set(b.members.map((m) => m.code))], period) }))
    .filter((g) => g.agg.yoy != null).sort((a, b) => b.agg.yoy - a.agg.yoy);
  const { up, down } = ds.movers(period, 5);
  const name = (code) => ds.companies.get(code)?.display || code;
  const lines = [
    `${periodLabel(period, true)}: ${total.reported} companies reported combined revenue of ${ntd(total.rev)}, ${pct(total.yoy)} year on year (same ${total.compared} companies).`,
    '',
    'Supply-chain groups, YoY:',
    ...groups.map((g) => `  ${g.b.name}: ${pct(g.agg.yoy)}`),
    '',
    'Biggest gains:',
    ...up.map((m) => `  ${name(m.code)} (${m.code}): ${pct(m.yoy)}`),
    '',
    'Biggest declines:',
    ...down.map((m) => `  ${name(m.code)} (${m.code}): ${pct(m.yoy)}`),
  ];
  const r = await post({ type: 'summary', period, periodLabel: periodLabel(period, true), lines });
  if (!r.dryRun) {
    status.summarySent = { ...(status.summarySent || {}), [period]: new Date().toISOString() };
    writeJson(p.status, status);
  }
  console.log(`Summary for ${period}: ${r.emails ?? 0} emails.`);
}
if (!items.length) console.log('No new filings to alert on.');
