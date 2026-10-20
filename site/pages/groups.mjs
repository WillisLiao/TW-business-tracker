import { esc, ntd, pct, signClass, int } from '../lib/format.mjs';
import { columnChart, divergingBars, heatClass, heatLegend } from '../lib/charts.mjs';
import { layout, statTile, breadcrumbs, proCta, meter, siteName } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { L, href } from '../lib/lang.mjs';
import { companyName, chartCard, metricsTable, pctCell, label, companyHref } from './shared.mjs';

// Rows = groups, columns = last n months, cells = same-member YoY growth.
export function basketHeatmap(ds, period, n = 6) {
  const months = ds.basketYoySeries(ds.baskets[0], period, n).map((x) => x.period);
  const head = `<tr><th>${L('Group', '族群')}</th>${months.map((p) => `<th class="num">${label(p)}</th>`).join('')}</tr>`;
  const rows = ds.baskets.map((b) => {
    const s = ds.basketYoySeries(b, period, n);
    return `<tr><td class="name"><a href="${href(`/groups/${b.slug}/`)}">${esc(b.name)}</a></td>${s.map((x) => {
      const partial = x.reported < x.total;
      const tip = L(`${b.name}, ${label(x.period)}: ${pct(x.yoy)} YoY (${x.compared} of ${x.total} companies compared)`, `${b.name}，${label(x.period)}：年增${pct(x.yoy)}（${x.total}家中${x.compared}家可比較）`);
      return `<td class="cell ${heatClass(x.yoy)}" title="${esc(tip)}">${x.yoy == null ? '—' : pct(x.yoy, 0)}${partial && x.yoy != null ? `<span class="visually-hidden">${L(' (partial)', '（部分公司）')}</span>*` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="heat"><caption class="visually-hidden">${L('Revenue growth versus the same month a year earlier, by supply-chain group', '各供應鏈族群營收年增率')}</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div>${heatLegend()}<p class="small muted">${L("Combined revenue of each group's members versus the same members a year earlier. * = not every member has reported yet.", '各族群成員合計營收，與同一批公司去年同月相比。* 表示尚有成員未公布。')}</p>`;
}

export function basketPage(ctx, b) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  const sum = ds.basketSummary(b, period);
  const ordered = [...sum.members].sort((x, y) => (y.m?.yoy ?? -Infinity) - (x.m?.yoy ?? -Infinity));
  const bars = divergingBars(ordered.map((mem) => ({
    label: `${mem.name} ${mem.code}`,
    value: mem.m?.yoy ?? null,
    href: companyHref(mem.code),
    tip: mem.m
      ? `${mem.name} (${mem.code}), ${label(period)}\n${ntd(mem.m.rev)}\n${L(`${pct(mem.m.yoy)} YoY`, `年增 ${pct(mem.m.yoy)}`)}`
      : `${mem.name} (${mem.code})\n${L(`Not yet reported for ${label(period)}`, `尚未公布${label(period)}營收`)}`,
  })), { title: L(`${b.name}: revenue growth by company, ${label(period)}`, `${b.name}：各公司${label(period)}營收年增率`), format: (v) => pct(v) });

  const s24 = ds.basketYoySeries(b, period, 24);
  const trend = columnChart(s24.map((x) => ({
    key: x.period,
    value: x.yoy,
    xLabel: x.period.endsWith('-01') ? x.period.slice(0, 4) : '',
    tip: `${label(x.period)}\n${L(`${pct(x.yoy)} YoY`, `年增 ${pct(x.yoy)}`)}\n${L(`${x.compared} of ${x.total} companies compared`, `${x.total}家中${x.compared}家可比較`)}`,
  })), { title: L(`${b.name}: combined revenue growth, last 24 months`, `${b.name}：近24個月合計營收年增率`), diverging: true, height: 200, yFormat: (v) => `${Math.round(v * 100)}%`, labelFormat: (v) => pct(v), mobileCount: 12 });
  const trendTable = `<div class="table-wrap"><table><thead><tr><th>${L('Month', '月份')}</th><th class="num">${L('Combined revenue', '合計營收')}</th><th class="num">${L('YoY', '年增率')}</th><th class="num">${L('Companies compared', '可比較家數')}</th></tr></thead><tbody>${[...s24].reverse().map((x) => `<tr><td>${label(x.period)}</td><td class="num">${ntd(x.rev)}</td>${pctCell(x.yoy)}<td class="num">${x.compared} / ${x.total}</td></tr>`).join('')}</tbody></table></div>`;

  const table = `<div class="table-wrap"><table><thead><tr><th>${L('Company', '公司')}</th><th>${L('Role', '角色')}</th><th class="num">${L('Revenue', '營收')}</th><th class="num">${L('YoY', '年增率')}</th><th class="num">${L('MoM', '月增率')}</th><th class="num">${L('YTD YoY', '累計年增率')}</th></tr></thead><tbody>${sum.members.map((mem) => `<tr><td class="name">${mem.company ? companyName(mem.company) : `${esc(mem.name)} <span class="muted">${esc(mem.code)}</span>`}</td><td>${esc(mem.role)}</td>${mem.m ? `<td class="num">${ntd(mem.m.rev)}</td>${pctCell(mem.m.yoy)}${pctCell(mem.m.mom)}${pctCell(mem.m.ytdYoy)}` : `<td class="num muted" colspan="4">${L('Not yet reported', '尚未公布')}</td>`}</tr>`).join('')}</tbody></table></div>`;

  const body = `
${breadcrumbs([['/', L('Home', '首頁')], ['/groups/', L('Groups', '供應鏈族群')], ['', b.name]])}
<h1>${L(`${esc(b.name)}: Taiwan monthly revenue`, `${esc(b.name)}：月營收`)}</h1>
<p class="lede">${esc(b.blurb)}</p>
<div class="tiles">
${statTile(L(`Combined growth, ${label(period)}`, `${label(period)}合計年增率`), pct(sum.agg.yoy), { note: L(`vs ${label(addMonths(period, -12))}, same ${sum.agg.compared} companies`, `較${label(addMonths(period, -12))}，同一批${sum.agg.compared}家公司`) })}
${statTile(L('Combined revenue', '合計營收'), ntd(sum.agg.rev))}
${statTile(L('Members reported', '已公布成員'), L(`${sum.agg.reported} of ${sum.agg.total}`, `${sum.agg.total}家中${sum.agg.reported}家`), { note: meter(sum.agg.reported / sum.agg.total, L('Share of members reported', '已公布成員比例')) })}
</div>
${chartCard(L(`Growth by company, ${label(period)}`, `各公司年增率，${label(period)}`), L('Versus the same month a year earlier. Click a name for its full history.', '與去年同月相比。點選公司名稱可看完整歷史。'), bars)}
${chartCard(L('Combined growth, last 24 months', '近24個月合計年增率'), L('Revenue of the members that reported, versus the same members a year earlier.', '已公布成員的合計營收，與同一批公司去年同月相比。'), trend, trendTable)}
<h2>${L('Members', '成員')}</h2>
${table}
<p class="small muted">${L(`Groups are hand-picked by ${esc(siteName(ctx.siteConfig))} to follow supply chains; they are not official exchange classifications.`, `族群由${esc(siteName(ctx.siteConfig))}依供應鏈自行挑選，並非交易所的官方分類。`)}</p>
${proCta(ctx, { heading: L(`Get an email when companies in "${b.name}" report`, `「${b.name}」公司公布營收時，用 Email 通知你`), watch: b.slug })}
`;
  return layout(ctx, {
    title: L(`${b.name} — Taiwan supply-chain monthly revenue (${label(period, true)})`, `${b.name}供應鏈月營收（${label(period)}）`),
    description: L(
      `${b.name} in Taiwan: monthly revenue for ${b.members.map((m) => m.name).slice(0, 6).join(', ')} and more. ${label(period, true)} combined revenue ${pct(sum.agg.yoy)} year on year.`,
      `${b.name}：${b.members.map((m) => m.name).slice(0, 6).join('、')}等公司月營收。${label(period)}合計營收年增${pct(sum.agg.yoy)}。`),
    path: `/groups/${b.slug}/`,
    body,
  });
}

export function groupsIndex(ctx) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  const cards = ds.baskets.map((b) => {
    const agg = ds.aggregate([...new Set(b.members.map((m) => m.code))], period);
    return `<a class="group-card" href="${href(`/groups/${b.slug}/`)}"><div class="muted small">${esc(b.name)}</div><div class="big ${signClass(agg.yoy)}">${pct(agg.yoy)}</div><div class="small muted">${L(`${label(period)} YoY · ${agg.reported}/${agg.total} reported`, `${label(period)}年增率 · 已公布 ${agg.reported}/${agg.total}`)}</div></a>`;
  }).join('');
  const inds = ds.industriesIndex().map((i) => {
    const agg = ds.aggregate(i.codes, period);
    return `<tr><td class="name"><a href="${href(`/industries/${i.slug}/`)}">${esc(i.name)}</a></td><td class="num">${int(i.codes.length)}</td><td class="num">${ntd(agg.rev)}</td>${pctCell(agg.yoy)}</tr>`;
  }).join('');
  const body = `
<h1>${L('Supply-chain groups and industries', '供應鏈族群與產業')}</h1>
<p class="lede">${L(`Hand-picked supply-chain groups, plus every official exchange industry. Growth is combined revenue versus the same companies a year earlier, for ${label(period, true)}.`, `精選供應鏈族群，以及交易所的全部官方產業分類。年增率為${label(period)}合計營收與同一批公司去年同月相比。`)}</p>
<div class="groups">${cards}</div>
<h2>${L('Supply-chain heatmap', '供應鏈熱度圖')}</h2>
${basketHeatmap(ds, period, 12)}
<h2>${L('All industries', '全部產業')}</h2>
<div class="table-wrap"><table><thead><tr><th>${L('Industry', '產業')}</th><th class="num">${L('Companies', '家數')}</th><th class="num">${L(`Revenue, ${label(period)}`, `${label(period)}營收`)}</th><th class="num">${L('YoY', '年增率')}</th></tr></thead><tbody>${inds}</tbody></table></div>
`;
  return layout(ctx, {
    title: L('Supply-chain groups and industries', '供應鏈族群與產業'),
    description: L('Taiwan monthly revenue by supply-chain group (AI servers, foundry, IC design, cooling, PCB and more) and by official industry.', '依供應鏈族群（AI伺服器、晶圓代工、IC設計、散熱、PCB等）與官方產業分類整理的台股月營收。'),
    path: '/groups/',
    body,
  });
}

export function industryPage(ctx, ind) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  const rows = ind.codes.map((c) => ds.metrics(c, period)).filter(Boolean).sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0));
  const notYet = ind.codes.filter((c) => !ds.metrics(c, period)).map((c) => ds.companies.get(c));
  const agg = ds.aggregate(ind.codes, period);
  const body = `
${breadcrumbs([['/', L('Home', '首頁')], ['/groups/', L('Industries', '產業')], ['', ind.name]])}
<h1>${L(`${esc(ind.name)}: Taiwan monthly revenue`, `${esc(ind.name)}：月營收`)}</h1>
<div class="tiles">
${statTile(L(`Combined growth, ${label(period)}`, `${label(period)}合計年增率`), pct(agg.yoy), { note: L(`same ${agg.compared} companies, year on year`, `同一批${agg.compared}家公司，與去年同月相比`) })}
${statTile(L('Combined revenue', '合計營收'), ntd(agg.rev))}
${statTile(L('Companies reported', '已公布家數'), L(`${agg.reported} of ${ind.codes.length}`, `${ind.codes.length}家中${agg.reported}家`))}
</div>
<h2>${L(`${label(period, true)}, largest first`, `${label(period)}，依營收排序`)}</h2>
${metricsTable(ds, rows, { caption: L(`${ind.name} companies`, `${ind.name}公司`) })}
${notYet.length ? `<h2>${L(`No filing yet for ${label(period)}`, `尚未公布${label(period)}營收`)}</h2><ul class="link-list">${notYet.map((c) => `<li>${companyName(c)}</li>`).join('')}</ul>` : ''}
`;
  return layout(ctx, {
    title: L(`${ind.name} — Taiwan listed companies' monthly revenue`, `${ind.name}上市櫃公司月營收`),
    description: L(
      `Monthly revenue for all ${ind.codes.length} Taiwan-listed ${ind.name.toLowerCase()} companies, in English. ${label(period, true)}: combined ${pct(agg.yoy)} year on year.`,
      `${ind.name}全部${ind.codes.length}家上市櫃公司的月營收。${label(period)}合計營收年增${pct(agg.yoy)}。`),
    path: `/industries/${ind.slug}/`,
    body,
  });
}
