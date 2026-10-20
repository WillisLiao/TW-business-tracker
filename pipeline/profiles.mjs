// Refreshes company profiles (English names, industry) from the exchanges.
// Run weekly by the GitHub Action, and automatically when a new company appears.

import { pathToFileURL } from 'node:url';
import { SOURCES } from './sources.mjs';
import { fetchWithRetry } from './lib/http.mjs';
import { normaliseProfileRows } from './lib/fields.mjs';
import { mergeProfiles } from './lib/store.mjs';

// Returns the field names each source used, so a format change can be diagnosed
// from data/status.json without access to the run logs.
export async function refreshProfiles(dataDir, { log = console.log } = {}) {
  let total = 0;
  const failures = [];
  const fields = {};
  for (const [market, src] of Object.entries(SOURCES)) {
    try {
      const rows = await fetchWithRetry(src.profile);
      const { records, fieldMap } = normaliseProfileRows(rows, market);
      fields[market] = { keys: Object.keys(rows[0] || {}), mapped: fieldMap };
      if (!fieldMap.nameEn && !fieldMap.fullNameEn) {
        log(`  ${market}: no English-name field found in profiles (keys: ${Object.keys(rows[0] || {}).join(', ')})`);
      }
      const changed = mergeProfiles(dataDir, records);
      log(`  ${market}: ${records.length} profiles, ${changed} changed`);
      total += changed;
    } catch (err) {
      failures.push(`${market}: ${err.message}`);
      log(`  ${market}: profile refresh failed - ${err.message}`);
    }
  }
  return { changed: total, failures, fields };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dataDir = process.argv.includes('--data') ? process.argv[process.argv.indexOf('--data') + 1] : 'data';
  console.log('Refreshing company profiles...');
  const { failures } = await refreshProfiles(dataDir);
  if (failures.length === Object.keys(SOURCES).length) process.exit(1);
}
