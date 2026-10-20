// Reads and writes the data/ folder. The folder is committed to git, so its history
// is a public, timestamped record of what was published and when.
//
//   data/companies.json          code -> { nameZh, nameEn, market, industry, ... }
//   data/revenue/YYYY-MM.json    one file per month, one company per line
//   data/status.json             last pipeline run, per-source health
//
// Amounts are thousand NT$, exactly as the exchanges publish them.

import fs from 'node:fs';
import path from 'node:path';

export const VALUE_FIELDS = ['rev', 'prev', 'ya', 'momPct', 'yoyPct', 'ytd', 'ytdPrev', 'ytdPct'];

export function dataPaths(dataDir) {
  return {
    dir: dataDir,
    companies: path.join(dataDir, 'companies.json'),
    status: path.join(dataDir, 'status.json'),
    revenueDir: path.join(dataDir, 'revenue'),
    periodFile: (p) => path.join(dataDir, 'revenue', `${p}.json`),
  };
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function listPeriods(dataDir) {
  const { revenueDir } = dataPaths(dataDir);
  if (!fs.existsSync(revenueDir)) return [];
  return fs.readdirSync(revenueDir)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 7))
    .sort();
}

export function readPeriod(dataDir, period) {
  return readJson(dataPaths(dataDir).periodFile(period), { period, updatedAt: null, companies: {} });
}

// One company per line keeps git diffs readable ("which numbers changed today").
export function writePeriod(dataDir, file) {
  const codes = Object.keys(file.companies).sort();
  const lines = codes.map((c, i) => `    ${JSON.stringify(c)}: ${JSON.stringify(file.companies[c])}${i < codes.length - 1 ? ',' : ''}`);
  const text = `{\n  "period": ${JSON.stringify(file.period)},\n  "updatedAt": ${JSON.stringify(file.updatedAt)},\n  "companies": {\n${lines.join('\n')}\n  }\n}\n`;
  const target = dataPaths(dataDir).periodFile(file.period);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

const sameValues = (a, b) => VALUE_FIELDS.every((f) => (a[f] ?? null) === (b[f] ?? null));

// Merges normalised records into the period files. Never deletes: a company that
// drops out of a later snapshot keeps its published numbers. Changed numbers are
// kept, with the old values appended to `revisions` so corrections stay visible.
// Returns the companies that are new (first filing seen) and those revised.
// `firstSeen` is when we first saw the filing; the backfill passes null because
// the original filing time of old months is unknown.
export function mergeRecords(dataDir, records, { now = new Date().toISOString(), source, firstSeen = now }) {
  const byPeriod = new Map();
  for (const r of records) {
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
    byPeriod.get(r.period).push(r);
  }
  const added = [];
  const revised = [];
  const touched = [];
  for (const [period, recs] of byPeriod) {
    const file = readPeriod(dataDir, period);
    let changed = false;
    for (const r of recs) {
      const values = Object.fromEntries(VALUE_FIELDS.map((f) => [f, r[f] ?? null]));
      const existing = file.companies[r.code];
      if (!existing) {
        file.companies[r.code] = { market: r.market, ...values, note: r.note || '', firstSeen, source };
        added.push({ period, code: r.code, market: r.market, ...values });
        changed = true;
      } else if (!sameValues(existing, values)) {
        const old = Object.fromEntries(VALUE_FIELDS.map((f) => [f, existing[f] ?? null]));
        file.companies[r.code] = {
          ...existing,
          ...values,
          note: r.note || existing.note || '',
          revisions: [...(existing.revisions || []), { replacedAt: now, ...old }],
        };
        revised.push({ period, code: r.code, market: r.market, before: old, after: values });
        changed = true;
      }
    }
    if (changed) {
      file.updatedAt = now;
      writePeriod(dataDir, file);
      touched.push(period);
    }
  }
  return { added, revised, touched };
}

// Adds or refreshes company profiles. Existing English names are kept when a
// source returns an empty one.
export function mergeProfiles(dataDir, profiles, now = new Date().toISOString()) {
  const p = dataPaths(dataDir);
  const companies = readJson(p.companies, {});
  let changed = 0;
  for (const pr of profiles) {
    const prev = companies[pr.code] || {};
    const next = {
      ...prev,
      market: pr.market || prev.market,
      nameZh: pr.nameZh || prev.nameZh || '',
      nameEn: pr.nameEn || prev.nameEn || '',
      fullNameEn: pr.fullNameEn || prev.fullNameEn || '',
      industry: pr.industry || prev.industry || '',
      website: pr.website || prev.website || '',
    };
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      companies[pr.code] = { ...next, profileUpdatedAt: now };
      changed++;
    }
  }
  if (changed) {
    const sorted = Object.fromEntries(Object.keys(companies).sort().map((k) => [k, companies[k]]));
    writeJson(p.companies, sorted);
  }
  return changed;
}
