// Checks a freshly fetched batch before anything is written. An error blocks the
// publish (the GitHub Action fails and GitHub emails the owner); a warning is
// logged in the run summary. Trust is the product, so we fail closed.

import { latestPossiblePeriod, monthsBetween } from './period.mjs';

const pctMismatch = (computed, reported) => Math.abs(computed - reported) > 0.06 + Math.abs(reported) * 0.001;

function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function validateBatch(records, { market, now = new Date(), existingCount = 0 } = {}) {
  const errors = [];
  const warnings = [];
  if (!records.length) {
    errors.push(`${market}: no usable rows (no valid company code + period).`);
    return { errors, warnings };
  }

  // 1. Periods: never in the future; a stale source is only a warning.
  const latest = latestPossiblePeriod(now);
  const periods = [...new Set(records.map((r) => r.period))].sort();
  const future = periods.filter((p) => monthsBetween(latest, p) > 0);
  if (future.length) errors.push(`${market}: period(s) ${future.join(', ')} are in the future - date parsing is wrong.`);
  if (periods.length > 1) warnings.push(`${market}: batch contains several periods: ${periods.join(', ')}.`);
  const newest = periods[periods.length - 1];
  if (monthsBetween(newest, latest) > 2) warnings.push(`${market}: newest period is ${newest}; the source may be stale.`);

  // 2. Revenue must be present for almost every row.
  const missing = records.filter((r) => r.rev == null).length;
  if (missing / records.length > 0.02) {
    errors.push(`${market}: ${missing} of ${records.length} rows have no revenue value.`);
  }

  // 3. Units: amounts are thousand NT$. A typical company sells NT$10M-NT$10B a month.
  const med = median(records.map((r) => r.rev));
  if (med != null && (med < 1e3 || med > 1e7)) {
    errors.push(`${market}: median monthly revenue is ${med} (thousand NT$) - units look wrong.`);
  }
  const tsmc = records.find((r) => r.code === '2330');
  if (tsmc && tsmc.rev != null && (tsmc.rev < 1e7 || tsmc.rev > 1e10)) {
    errors.push(`${market}: TSMC revenue ${tsmc.rev} (thousand NT$) is outside a sane range - units look wrong.`);
  }

  // 4. Our own YoY/MoM must match the percentages the exchange published. A mismatch
  //    on many rows means columns were mixed up.
  for (const [label, base, pct] of [['YoY', 'ya', 'yoyPct'], ['MoM', 'prev', 'momPct']]) {
    const checkable = records.filter((r) => r.rev != null && r[base] > 0 && r[pct] != null);
    if (checkable.length < 20) continue;
    const bad = checkable.filter((r) => pctMismatch((r.rev / r[base] - 1) * 100, r[pct]));
    if (bad.length / checkable.length > 0.02) {
      const ex = bad.slice(0, 3).map((r) => `${r.code}: computed ${((r.rev / r[base] - 1) * 100).toFixed(2)}% vs published ${r[pct]}%`);
      errors.push(`${market}: our ${label} differs from the published ${label} on ${bad.length}/${checkable.length} rows (${ex.join('; ')}).`);
    } else if (bad.length) {
      warnings.push(`${market}: ${bad.length} row(s) where our ${label} differs from the published figure: ${bad.slice(0, 5).map((r) => r.code).join(', ')}.`);
    }
  }

  // 5. Duplicates.
  const seen = new Set();
  for (const r of records) {
    const k = `${r.period}|${r.code}`;
    if (seen.has(k)) { errors.push(`${market}: duplicate row for ${r.code} in ${r.period}.`); break; }
    seen.add(k);
  }

  // 6. A snapshot that suddenly has far fewer companies suggests a broken source.
  //    Merging never deletes, so this is a warning, not an error.
  if (existingCount > 100 && records.length < existingCount * 0.5) {
    warnings.push(`${market}: only ${records.length} rows, versus ${existingCount} already stored for ${newest}.`);
  }

  return { errors, warnings };
}
