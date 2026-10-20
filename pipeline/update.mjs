// Main pipeline run: fetch the latest monthly-revenue snapshot from both exchanges,
// validate, merge into data/, and write out/changes.json for the alert step.
//
// Exit codes: 0 = all good; 3 = partial (one market had a problem, the healthy one
// was still published); 1 = nothing could be published because of an error.
// Transient fetch failures only become errors after several runs in a row, so a
// brief exchange outage does not email the owner.

import fs from 'node:fs';
import path from 'node:path';
import { SOURCES } from './sources.mjs';
import { fetchWithRetry } from './lib/http.mjs';
import { normaliseRevenueRows } from './lib/fields.mjs';
import { validateBatch } from './lib/validate.mjs';
import { dataPaths, mergeRecords, readJson, readPeriod, writeJson, mergeProfiles } from './lib/store.mjs';
import { refreshProfiles } from './profiles.mjs';

const FETCH_FAILURES_BEFORE_ALERT = 6;

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const outDir = opt('--out', 'out');
// For tests: read source JSON from files instead of the network.
const fixtureDir = opt('--fixtures', null);

const now = new Date().toISOString();
const p = dataPaths(dataDir);
const status = readJson(p.status, { sources: {} });
const summary = [];
const errors = [];
const warnings = [];
const allAdded = [];
const allRevised = [];
let mergedMarkets = 0;

async function load(market) {
  if (fixtureDir) return JSON.parse(fs.readFileSync(path.join(fixtureDir, `${market}.json`), 'utf8'));
  return fetchWithRetry(SOURCES[market].revenue);
}

for (const market of Object.keys(SOURCES)) {
  const st = status.sources[market] || {};
  let rows;
  try {
    rows = await load(market);
  } catch (err) {
    st.consecutiveFetchFailures = (st.consecutiveFetchFailures || 0) + 1;
    st.lastError = err.message;
    st.lastErrorAt = now;
    status.sources[market] = st;
    const msg = `${market}: fetch failed (${st.consecutiveFetchFailures} in a row): ${err.message}`;
    (st.consecutiveFetchFailures >= FETCH_FAILURES_BEFORE_ALERT ? errors : warnings).push(msg);
    continue;
  }
  st.consecutiveFetchFailures = 0;

  let records;
  try {
    ({ records } = normaliseRevenueRows(rows, market));
  } catch (err) {
    errors.push(err.message);
    status.sources[market] = { ...st, ok: false, lastError: err.message, lastErrorAt: now };
    continue;
  }

  const newest = records.map((r) => r.period).sort().at(-1);
  const existing = newest ? Object.values(readPeriod(dataDir, newest).companies).filter((c) => c.market === market).length : 0;
  const v = validateBatch(records, { market, existingCount: existing });
  warnings.push(...v.warnings);
  if (v.errors.length) {
    errors.push(...v.errors);
    status.sources[market] = { ...st, ok: false, lastError: v.errors.join(' | '), lastErrorAt: now };
    continue;
  }

  const { added, revised, touched } = mergeRecords(dataDir, records, { now, source: market });
  allAdded.push(...added);
  allRevised.push(...revised);
  mergedMarkets++;

  // Make sure every company has at least a Chinese name and industry on file.
  const known = readJson(p.companies, {});
  const unknown = records.filter((r) => !known[r.code]);
  if (unknown.length) {
    mergeProfiles(dataDir, unknown.map((r) => ({ code: r.code, market, nameZh: r.name, industry: r.industry })), now);
  }

  status.sources[market] = {
    ...st,
    ok: true,
    lastSuccessAt: now,
    newestPeriod: newest,
    rows: records.length,
    lastError: null,
  };
  summary.push(`${market}: ${records.length} rows for ${[...new Set(records.map((r) => r.period))].join(', ')} - ${added.length} new filings, ${revised.length} revisions${touched.length ? '' : ' (no changes)'}.`);
}

// New companies get proper English names from the profile endpoints.
const companies = readJson(p.companies, {});
if (!fixtureDir && Object.values(companies).some((c) => !c.nameEn && !c.fullNameEn)) {
  const due = !status.profilesRefreshedAt || Date.now() - Date.parse(status.profilesRefreshedAt) > 6 * 24 * 3600 * 1000;
  if (due || allAdded.some((a) => !companies[a.code]?.nameEn)) {
    summary.push('Refreshing company profiles...');
    const r = await refreshProfiles(dataDir, { log: (m) => summary.push(m) });
    if (!r.failures.length) status.profilesRefreshedAt = now;
  }
}

status.lastRunAt = now;
if (allAdded.length || allRevised.length) status.lastChangeAt = now;
// Alerts are queued here and cleared by notify.mjs only after they are sent, so a
// failed deploy or send is retried by the next run instead of being lost.
const queued = new Set((status.pendingAlerts || []).map((a) => `${a.period}|${a.code}`));
status.pendingAlerts = [...(status.pendingAlerts || []), ...allAdded.filter((a) => !queued.has(`${a.period}|${a.code}`)).map((a) => ({ period: a.period, code: a.code }))];
writeJson(p.status, status);

fs.mkdirSync(outDir, { recursive: true });
writeJson(path.join(outDir, 'changes.json'), { at: now, added: allAdded, revised: allRevised });

const report = [
  `## Pipeline run ${now}`,
  ...summary.map((s) => `- ${s}`),
  ...(warnings.length ? ['', '### Warnings', ...warnings.map((w) => `- ${w}`)] : []),
  ...(errors.length ? ['', '### Errors (blocked from publishing)', ...errors.map((e) => `- ${e}`)] : []),
].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

if (errors.length) process.exit(mergedMarkets > 0 ? 3 : 1);
