import { esc, ntd, pct, signClass, date } from '../lib/format.mjs';
import { periodLabel } from '../../pipeline/lib/period.mjs';

export const companyHref = (code) => `/company/${encodeURIComponent(code)}/`;

export function companyName(c, { link = true, zh = true } = {}) {
  if (!c) return '';
  const name = `${esc(c.display)} <span class="muted">${esc(c.code)}</span>`;
  const zhPart = zh && c.nameZh && c.nameZh !== c.display ? ` <span class="zh">${esc(c.nameZh)}</span>` : '';
  return link ? `<a href="${companyHref(c.code)}">${name}</a>${zhPart}` : `${name}${zhPart}`;
}

export const pctCell = (r) => `<td class="num ${signClass(r)}">${pct(r)}</td>`;

// Standard table of company metrics.
// compact: drops the Chinese name and YTD column for side-by-side tables.
export function metricsTable(ds, rows, { caption = '', showReported = false, extra = null, compact = false } = {}) {
  if (!rows.length) return '<p class="muted">Nothing to show yet.</p>';
  const head = `<tr><th>Company</th>${extra ? `<th>${esc(extra.label)}</th>` : ''}<th class="num">Revenue</th><th class="num">YoY</th><th class="num">MoM</th>${compact ? '' : '<th class="num">YTD YoY</th>'}${showReported ? '<th>First seen</th>' : ''}</tr>`;
  const body = rows.map((m) => {
    const c = ds.companies.get(m.code);
    return `<tr><td class="name">${companyName(c, { zh: !compact })}</td>${extra ? `<td>${esc(extra.value(m))}</td>` : ''}<td class="num">${ntd(m.rev)}</td>${pctCell(m.yoy)}${pctCell(m.mom)}${compact ? '' : pctCell(m.ytdYoy)}${showReported ? `<td>${m.firstSeen ? esc(date(m.firstSeen)) : '<span class="muted">—</span>'}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table>${caption ? `<caption class="visually-hidden">${esc(caption)}</caption>` : ''}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function chartCard(title, sub, svg, twin = '') {
  return `<section class="card chart-card"><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${svg}${twin ? `<details class="table-twin"><summary>Show the numbers as a table</summary>${twin}</details>` : ''}</section>`;
}

export const label = periodLabel;
