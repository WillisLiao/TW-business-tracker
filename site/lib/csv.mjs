// CSV exports. UTF-8 with BOM so Excel shows Chinese names correctly.

const HEADER = ['period', 'code', 'market', 'name_en', 'name_zh', 'industry', 'revenue_thousand_ntd', 'prev_month_thousand_ntd', 'same_month_last_year_thousand_ntd', 'mom_pct', 'yoy_pct', 'ytd_thousand_ntd', 'ytd_last_year_thousand_ntd', 'ytd_yoy_pct', 'first_seen_utc', 'revised'];

const cell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (r) => (r == null ? '' : (r * 100).toFixed(2));

export function toCsv(ds, periods) {
  const lines = [HEADER.join(',')];
  for (const p of periods) {
    const recs = ds.byPeriod.get(p) || {};
    for (const code of Object.keys(recs).sort()) {
      const m = ds.metrics(code, p);
      const c = ds.companies.get(code) || {};
      lines.push([p, code, m.market, c.nameEn, c.nameZh, c.industry, m.rev, m.prev, m.ya, pct(m.mom), pct(m.yoy), m.ytd, m.ytdPrev, pct(m.ytdYoy), m.firstSeen, m.revisions.length ? 'yes' : ''].map(cell).join(','));
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
