import { esc, ntd, pct, signClass, date } from '../lib/format.mjs';
import { periodLabel } from '../../pipeline/lib/period.mjs';
import { L, href, isZh } from '../lib/lang.mjs';

export const companyHref = (code) => href(`/company/${encodeURIComponent(code)}/`);

// Name in the page language, code, then the other-language name in grey.
export function companyName(c, { link = true, zh = true } = {}) {
  if (!c) return '';
  const name = `${esc(c.display)} <span class="muted">${esc(c.code)}</span>`;
  const alt = zh && c.altName && c.altName !== c.display ? ` <span class="zh"${isZh() ? ' lang="en"' : ' lang="zh-Hant"'}>${esc(c.altName)}</span>` : '';
  return link ? `<a href="${companyHref(c.code)}">${name}</a>${alt}` : `${name}${alt}`;
}

export const pctCell = (r) => `<td class="num ${signClass(r)}">${pct(r)}</td>`;

// Standard table of company metrics.
// compact: drops the other-language name and YTD column for side-by-side tables.
export function metricsTable(ds, rows, { caption = '', showReported = false, extra = null, compact = false } = {}) {
  if (!rows.length) return `<p class="muted">${L('Nothing to show yet.', '目前尚無資料。')}</p>`;
  const head = `<tr><th>${L('Company', '公司')}</th>${extra ? `<th>${esc(extra.label)}</th>` : ''}<th class="num">${L('Revenue', '營收')}</th><th class="num">${L('YoY', '年增率')}</th><th class="num">${L('MoM', '月增率')}</th>${compact ? '' : `<th class="num">${L('YTD YoY', '累計年增率')}</th>`}${showReported ? `<th>${L('First seen', '首次出現')}</th>` : ''}</tr>`;
  const body = rows.map((m) => {
    const c = ds.companies.get(m.code);
    return `<tr><td class="name">${companyName(c, { zh: !compact })}</td>${extra ? `<td>${esc(extra.value(m))}</td>` : ''}<td class="num">${ntd(m.rev)}</td>${pctCell(m.yoy)}${pctCell(m.mom)}${compact ? '' : pctCell(m.ytdYoy)}${showReported ? `<td>${m.firstSeen ? esc(date(m.firstSeen)) : '<span class="muted">—</span>'}</td>` : ''}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table>${caption ? `<caption class="visually-hidden">${esc(caption)}</caption>` : ''}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

export function chartCard(title, sub, svg, twin = '') {
  return `<section class="card chart-card"><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${svg}${twin ? `<details class="table-twin"><summary>${L('Show the numbers as a table', '以表格顯示數字')}</summary>${twin}</details>` : ''}</section>`;
}

// "Sep 2026" / "September 2026" in English, "2026年9月" in Chinese.
export function label(period, long = false) {
  if (!isZh()) return periodLabel(period, long);
  const [y, m] = period.split('-').map(Number);
  return `${y}年${m}月`;
}

// "up 54.6%" / "成長54.6%" style phrases for running text.
export const changeWord = (r) => (r >= 0 ? L('up', '成長') : L('down', '衰退'));
