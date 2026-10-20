import { esc, ntd, pct, compact, signClass, dateTime, int } from '../lib/format.mjs';
import { columnChart } from '../lib/charts.mjs';
import { layout, statTile, breadcrumbs, proCta } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { mopsSummaryUrl, SOURCES } from '../../pipeline/sources.mjs';
import { marketLabel } from '../lib/data.mjs';
import { L, href, isZh } from '../lib/lang.mjs';
import { chartCard, metricsTable, pctCell, label, changeWord } from './shared.mjs';

const SOURCE_ZH = { TWSE: '臺灣證券交易所 OpenAPI', TPEx: '證券櫃檯買賣中心 OpenAPI' };
const unsigned = (r) => pct(Math.abs(r)).replace('+', '');

export function companyPage(ctx, code) {
  const { ds } = ctx;
  const c = ds.companies.get(code);
  const s = ds.series.get(code) || [];
  const latest = s.at(-1)?.period;
  if (!c || !latest) return null;
  const m = ds.metrics(code, latest);
  const name = c.display;
  const yoyText = m.yoy == null ? '' : L(`, ${pct(m.yoy)} YoY`, `，年增${pct(m.yoy)}`);

  // Revenue columns: last 60 months ending at the latest filing.
  const span = Math.min(60, Math.max(13, ds.periods.length));
  const months = Array.from({ length: span }, (_, i) => addMonths(latest, i - span + 1));
  const revPoints = months.map((p, i) => {
    const mm = ds.metrics(code, p);
    const [y, mo] = p.split('-');
    return {
      key: p,
      value: mm?.rev ?? null,
      highlight: p === latest,
      xLabel: mo === '01' || (i === 0 && months.length <= 24) ? (months.length > 24 ? y : label(p)) : '',
      tip: mm
        ? `${label(p)}\n${ntd(mm.rev)}\n${L(`${pct(mm.yoy)} YoY · ${pct(mm.mom)} MoM`, `年增 ${pct(mm.yoy)} · 月增 ${pct(mm.mom)}`)}`
        : `${label(p)}\n${L('No filing', '無申報')}`,
    };
  });
  const revSvg = columnChart(revPoints, {
    title: L(`${name} monthly revenue, ${label(months[0])} to ${label(latest)}`, `${name}月營收，${label(months[0])}至${label(latest)}`),
    yFormat: (v) => (v === 0 ? '0' : compact(v)),
    labelFormat: (v) => ntd(v),
    mobileCount: 36,
  });

  const yoyMonths = months.slice(-36);
  const yoyPoints = yoyMonths.map((p) => {
    const mm = ds.metrics(code, p);
    const [y, mo] = p.split('-');
    const tip = mm
      ? `${label(p)}\n${L(`${pct(mm.yoy)} vs ${label(addMonths(p, -12))}`, `較${label(addMonths(p, -12))} ${pct(mm.yoy)}`)}`
      : `${label(p)}\n${L('No comparison', '無比較數字')}`;
    return { key: p, value: mm?.yoy ?? null, xLabel: mo === '01' ? y : '', tip };
  });
  const yoySvg = columnChart(yoyPoints, {
    title: L(`${name} revenue growth versus the same month a year earlier`, `${name}營收年增率`),
    diverging: true,
    height: 200,
    yFormat: (v) => `${Math.round(v * 100)}%`,
    labelFormat: (v) => pct(v),
    mobileCount: 24,
  });

  const histRows = [...months].reverse().map((p) => ds.metrics(code, p)).filter(Boolean);
  const historyTable = (rows) => `<div class="table-wrap"><table><thead><tr><th>${L('Month', '月份')}</th><th class="num">${L('Revenue', '營收')}</th><th class="num">${L('MoM', '月增率')}</th><th class="num">${L('YoY', '年增率')}</th><th class="num">${L('Year to date', '累計營收')}</th><th class="num">${L('YTD YoY', '累計年增率')}</th><th>${L('Notes', '備註')}</th></tr></thead><tbody>${rows.map((h) => `<tr><td>${label(h.period)}</td><td class="num">${ntd(h.rev)}</td>${pctCell(h.mom)}${pctCell(h.yoy)}<td class="num">${ntd(h.ytd)}</td>${pctCell(h.ytdYoy)}<td>${h.revisions.length ? `<span class="pill" title="${L('The company corrected this figure', '公司曾修正此數字')}">${L('Revised', '已修正')}</span> ` : ''}${h.recordHigh ? `<span class="pill">${L('Record high', '創新高')}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;

  const peers = [...ds.companies.values()]
    .filter((o) => o.industrySlug === c.industrySlug && o.code !== code)
    .map((o) => ds.metrics(o.code, latest))
    .filter((x) => x && x.rev != null)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 8);

  const groups = ds.baskets.filter((b) => c.baskets.includes(b.slug));
  const replaced = m.revisions.map((r) => `${ntd(r.rev)} (${L('replaced', '於')} ${esc(dateTime(r.replacedAt))}${L('', '被取代')})`).join(L('; ', '；'));
  const revisionsHtml = m.revisions.length
    ? `<div class="notice">${L(`<strong>This figure was revised.</strong> Earlier published value${m.revisions.length > 1 ? 's' : ''}: ${replaced}.`, `<strong>此數字曾經修正。</strong>先前公布的數值：${replaced}。`)}</div>`
    : '';
  const record = m.recordHigh
    ? `<p><span class="pill">${L('Record high', '創新高')}</span> ${L(`Highest monthly revenue in the ${int(m.historyMonths)} months of data we hold for ${esc(name)}.`, `在本站收錄的${int(m.historyMonths)}個月資料中，${esc(name)}單月營收最高。`)}</p>`
    : '';
  const note = m.note
    ? `<p class="small">${L('<strong>Company\'s own note</strong> (in Chinese, as filed): ', '<strong>公司說明：</strong>')}<span lang="zh-Hant">${esc(m.note)}</span></p>`
    : '';

  const lede = isZh()
    ? `${esc(name)}${label(latest)}營收<strong>${ntd(m.rev)}</strong>${m.yoy != null ? `，較${label(addMonths(latest, -12))}<span class="${signClass(m.yoy)}">${changeWord(m.yoy)}${unsigned(m.yoy)}</span>` : ''}${m.mom != null ? `，較上月<span class="${signClass(m.mom)}">${changeWord(m.mom)}${unsigned(m.mom)}</span>` : ''}。`
    : `${esc(name)} reported revenue of <strong>${ntd(m.rev)}</strong> for ${label(latest, true)}${m.yoy != null ? `, <span class="${signClass(m.yoy)}">${changeWord(m.yoy)} ${unsigned(m.yoy)}</span> from ${label(addMonths(latest, -12))}` : ''}${m.mom != null ? ` and <span class="${signClass(m.mom)}">${changeWord(m.mom)} ${unsigned(m.mom)}</span> from the previous month` : ''}.`;

  const body = `
${breadcrumbs([['/', L('Home', '首頁')], [`/industries/${c.industrySlug}/`, c.industry], ['', L(`${name} (${c.code})`, `${name}（${c.code}）`)]])}
<h1>${L(`${esc(name)} (${esc(c.code)}) monthly revenue`, `${esc(name)}（${esc(c.code)}）月營收`)}</h1>
<div class="facts">${c.altName ? `<span lang="${isZh() ? 'en' : 'zh-Hant'}">${esc(c.altName)}</span>` : ''}<span>${esc(marketLabel(c.market))}</span><a href="${href(`/industries/${c.industrySlug}/`)}">${esc(c.industry)}</a>${groups.map((g) => `<a href="${href(`/groups/${g.slug}/`)}">${esc(g.name)}</a>`).join('')}</div>
<p class="lede">${lede}</p>
<div class="tiles">
${statTile(L(`Revenue, ${label(latest)}`, `${label(latest)}營收`), ntd(m.rev))}
${statTile(L('vs same month last year', '年增率（較去年同月）'), pct(m.yoy), { deltaClass: signClass(m.yoy), note: m.ya != null ? `${label(addMonths(latest, -12))}${L(': ', '：')}${ntd(m.ya)}` : '' })}
${statTile(L('vs previous month', '月增率（較上月）'), pct(m.mom), { note: m.prev != null ? `${label(addMonths(latest, -1))}${L(': ', '：')}${ntd(m.prev)}` : '' })}
${statTile(L(`Year to date (${latest.slice(0, 4)})`, `${latest.slice(0, 4)}年累計`), ntd(m.ytd), { delta: m.ytdYoy != null ? L(`${pct(m.ytdYoy)} YoY`, `年增 ${pct(m.ytdYoy)}`) : '', deltaClass: signClass(m.ytdYoy) })}
</div>
${record}${revisionsHtml}${note}
<p class="source-line">${L(`First seen in the official data: ${esc(dateTime(m.firstSeen))}. Source: <a href="${mopsSummaryUrl(c.market, latest, c.nameZh)}" rel="nofollow">MOPS monthly summary for ${label(latest)}</a> · <a href="${SOURCES[c.market].revenue}" rel="nofollow">${esc(SOURCES[c.market].label)}</a>. Amounts are as filed by the company, unaudited.`,
    `首次出現在官方資料：${esc(dateTime(m.firstSeen))}。來源：<a href="${mopsSummaryUrl(c.market, latest, c.nameZh)}" rel="nofollow">公開資訊觀測站 ${label(latest)}營收彙總表</a> · <a href="${SOURCES[c.market].revenue}" rel="nofollow">${SOURCE_ZH[c.market]}</a>。數字為公司自行申報，未經會計師查核。`)}</p>
${chartCard(L('Monthly revenue', '月營收'), L('New Taiwan dollars. The latest month is darker. Hover or tap a bar for details.', '新台幣。最新月份顏色較深，滑過或點選長條可看細節。'), revSvg, historyTable(histRows))}
${chartCard(L('Growth vs the same month last year', '年增率（較去年同月）'), `<span class="chart-legend" style="display:inline-flex"><span><i style="background:var(--pos)"></i>${L('Growth', '成長')}</span><span><i style="background:var(--neg)"></i>${L('Decline', '衰退')}</span></span>`, yoySvg)}
${proCta(ctx, { heading: L(`Get an email the day ${name} reports`, `${name}公布營收當天，用 Email 通知你`), watch: code })}
<h2>${L('Recent months', '近月營收')}</h2>
${historyTable(histRows.slice(0, 13))}
${peers.length ? `<h2>${L(`Largest peers in ${esc(c.industry)}`, `${esc(c.industry)}規模最大的同業`)}</h2>${metricsTable(ds, peers)}` : ''}
`;

  const base = ctx.siteConfig.siteUrl.replace(/\/$/, '');
  return layout(ctx, {
    title: L(`${name} (${c.code}) Monthly Revenue — ${label(latest, true)}: ${ntd(m.rev)}${yoyText}`, `${name}（${c.code}）月營收｜${label(latest)} ${ntd(m.rev)}${yoyText}`),
    description: L(
      `${name}${c.nameZh ? ` (${c.nameZh})` : ''}, stock code ${c.code}: monthly revenue in English. ${label(latest, true)} revenue ${ntd(m.rev)}${yoyText}. Five-year history, charts and links to the official filing.`,
      `${name}${c.nameEn ? `（${c.nameEn}）` : ''}，股票代號${c.code}：${label(latest)}營收${ntd(m.rev)}${yoyText}。五年月營收歷史、圖表與官方資料連結，中英對照。`),
    path: `/company/${encodeURIComponent(code)}/`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: L('Home', '首頁'), item: base + href('/') },
        { '@type': 'ListItem', position: 2, name: c.industry, item: base + href(`/industries/${c.industrySlug}/`) },
        { '@type': 'ListItem', position: 3, name: `${name} (${c.code})` },
      ],
    },
  });
}
