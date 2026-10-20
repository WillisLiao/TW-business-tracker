// One-time history backfill from the MOPS static monthly summary pages.
// Usage: node pipeline/backfill.mjs [--months 60] [--data data]
// Safe to re-run: months that are already complete are skipped, and values are
// validated exactly like the live pipeline. Requests are spaced out politely.

import { SOURCES, MOPS_HOSTS, mopsSummaryPath } from './sources.mjs';
import { fetchWithRetry, sleep } from './lib/http.mjs';
import { decodeMopsHtml, parseMopsSummary } from './lib/mops.mjs';
import { validateBatch } from './lib/validate.mjs';
import { addMonths, latestPossiblePeriod } from './lib/period.mjs';
import { mergeRecords, readPeriod } from './lib/store.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const months = Number(opt('--months', '60'));
const delayMs = Number(opt('--delay', '4000'));

const latest = latestPossiblePeriod();
const periods = Array.from({ length: months }, (_, i) => addMonths(latest, -i)).reverse();
const problems = [];

async function fetchPage(path) {
  let lastErr;
  for (const host of MOPS_HOSTS) {
    try {
      return await fetchWithRetry(host + path, { as: 'buffer', retries: 3 });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

for (const period of periods) {
  for (const [market, src] of Object.entries(SOURCES)) {
    const have = Object.values(readPeriod(dataDir, period).companies).filter((c) => c.market === market).length;
    if (have >= (market === 'TWSE' ? 800 : 600)) continue;
    const records = [];
    for (const kind of [0, 1]) {
      try {
        const html = decodeMopsHtml(await fetchPage(mopsSummaryPath(src.mopsMarket, period, kind)));
        records.push(...parseMopsSummary(html, { market, period }));
      } catch (err) {
        // Foreign (KY) pages do not exist for every market/month.
        if (kind === 0) problems.push(`${period} ${market}: ${err.message}`);
      }
      await sleep(delayMs);
    }
    if (!records.length) continue;
    const { errors, warnings } = validateBatch(records, { market, now: new Date() });
    if (errors.length) {
      problems.push(...errors.map((e) => `${period} ${e}`));
      continue;
    }
    warnings.forEach((w) => console.log(`  warning: ${period} ${w}`));
    const { added } = mergeRecords(dataDir, records, { source: 'MOPS', firstSeen: null });
    console.log(`${period} ${market}: ${records.length} rows, ${added.length} added`);
  }
}

if (problems.length) {
  console.log('\nProblems:\n' + problems.map((p) => `- ${p}`).join('\n'));
  process.exitCode = 1;
}
