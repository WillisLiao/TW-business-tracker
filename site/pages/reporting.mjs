import { esc, ntd, pct, int, date, dateTime } from '../lib/format.mjs';
import { layout, statTile, meter, proCta, breadcrumbs } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { marketLabel } from '../lib/data.mjs';
import { L, href, isZh } from '../lib/lang.mjs';
import { basketHeatmap } from './groups.mjs';
import { companyName, metricsTable, pctCell, label, changeWord } from './shared.mjs';

export function reportingPage(ctx) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  if (!period) return null;
  const prog = ds.progress(period);
  const reported = ds.allMetrics(period).sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)) || (b.rev ?? 0) - (a.rev ?? 0));
  const prevCodes = Object.keys(ds.byPeriod.get(addMonths(period, -1)) || {});
  const waiting = prevCodes.filter((c) => !ds.byPeriod.get(period)[c]).map((c) => ds.metrics(c, addMonths(period, -1))).filter(Boolean).sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0));
  const keyCodes = [...new Set(ds.baskets.flatMap((b) => b.members.map((m) => m.code)))];
  const keyRows = keyCodes.map((c) => ({ c: ds.companies.get(c), m: ds.metrics(c, period) })).filter((x) => x.c)
    .sort((a, b) => (a.m ? 0 : 1) - (b.m ? 0 : 1) || String(b.m?.firstSeen).localeCompare(String(a.m?.firstSeen)));
  const status = (m) => (m ? `${L('Reported', '已公布')}${m.firstSeen ? ` ${esc(date(m.firstSeen))}` : ''}` : `<span class="muted">${L('Waiting', '尚未公布')}</span>`);
  const keyTable = `<div class="table-wrap"><table><thead><tr><th>${L('Company', '公司')}</th><th>${L('Status', '狀態')}</th><th class="num">${L('Revenue', '營收')}</th><th class="num">${L('YoY', '年增率')}</th></tr></thead><tbody>${keyRows.map(({ c, m }) => `<tr><td class="name">${companyName(c)}</td><td>${status(m)}</td>${m ? `<td class="num">${ntd(m.rev)}</td>${pctCell(m.yoy)}` : '<td></td><td></td>'}</tr>`).join('')}</tbody></table></div>`;

  const body = `
<h1>${L(`Who has reported for ${label(period, true)}?`, `${label(period)}營收公布進度`)}</h1>
<p class="lede">${L(`${int(prog.reported)} of about ${int(prog.expected)} companies have filed so far. "First seen" is when the figure first appeared in the official open data.`, `約${int(prog.expected)}家公司中，目前已有${int(prog.reported)}家公布。「首次出現」是數字第一次出現在官方開放資料的時間。`)}</p>
${meter(prog.share, L('Share of companies that have reported', '已公布公司比例'))}
<h2>${L('Key supply-chain companies', '重點供應鏈公司')}</h2>
${keyTable}
${proCta(ctx, { heading: L('Get these the same day, by email', '公布當天，用 Email 收到這些數字') })}
<h2>${L(`All filings so far (${int(reported.length)})`, `目前全部申報（${int(reported.length)}家）`)}</h2>
${metricsTable(ds, reported, { showReported: true })}
${waiting.length ? `<h2>${L(`Not yet reported (${int(waiting.length)})`, `尚未公布（${int(waiting.length)}家）`)}</h2><p class="small muted">${L(`Companies that filed for ${label(addMonths(period, -1))} but not yet for ${label(period)}, largest first.`, `已公布${label(addMonths(period, -1))}、但尚未公布${label(period)}營收的公司，依規模排序。`)}</p><ul class="link-list">${waiting.map((m) => `<li>${companyName(ds.companies.get(m.code))}</li>`).join('')}</ul>` : ''}
`;
  return layout(ctx, {
    title: L(`${label(period, true)} monthly revenue: reporting progress`, `${label(period)}月營收公布進度`),
    description: L(`Which Taiwan-listed companies have published their ${label(period, true)} revenue, and which are still to come. Updated through the reporting window.`, `哪些上市櫃公司已公布${label(period)}營收、哪些還沒公布。申報期間持續更新。`),
    path: '/reporting/',
    body,
  });
}

// One permanent page per month: the public track record.
export function monthlyReport(ctx, period) {
  const { ds } = ctx;
  const prog = ds.progress(period);
  const total = ds.marketTotal(period);
  const tsmc = ds.metrics('2330', period);
  const tsmcName = ds.companies.get('2330')?.display || 'TSMC';
  const { up, down } = ds.movers(period, 10);
  const highs = ds.recordHighs(period);
  const inProgress = period === ds.latestPeriod && !prog.complete;
  const byMarket = ['TWSE', 'TPEx'].map((mk) => ({ mk, agg: ds.aggregate(Object.entries(ds.byPeriod.get(period)).filter(([, r]) => r.market === mk).map(([c]) => c), period) }));
  const groups = ds.baskets.map((b) => ({ b, agg: ds.aggregate([...new Set(b.members.map((m) => m.code))], period) })).sort((a, b) => (b.agg.yoy ?? -9) - (a.agg.yoy ?? -9));
  const unsigned = (r) => pct(Math.abs(r)).replace('+', '');
  let summary = '';
  if (total.yoy != null) {
    summary = isZh()
      ? `${label(period)}上市櫃公司合計營收${ntd(total.rev)}，以同一批${int(total.compared)}家公司計算，較去年同月${changeWord(total.yoy)}${unsigned(total.yoy)}。${tsmc ? `${tsmcName}營收${ntd(tsmc.rev)}（年增${pct(tsmc.yoy)}）。` : ''}${groups[0]?.agg.yoy != null ? `表現最強的供應鏈族群為${groups[0].b.name}（${pct(groups[0].agg.yoy)}）。` : ''}`
      : `Taiwan's listed and OTC companies reported combined revenue of ${ntd(total.rev)} for ${label(period, true)}, ${changeWord(total.yoy)} ${unsigned(total.yoy)} from a year earlier on a same-company basis (${int(total.compared)} companies).${tsmc ? ` ${tsmcName} reported ${ntd(tsmc.rev)} (${pct(tsmc.yoy)} YoY).` : ''}${groups[0]?.agg.yoy != null ? ` The strongest supply-chain group was ${groups[0].b.name} (${pct(groups[0].agg.yoy)}).` : ''}`;
  }

  const body = `
${breadcrumbs([['/', L('Home', '首頁')], ['/reports/', L('Monthly reports', '月報')], ['', label(period, true)]])}
<h1>${L(`Taiwan monthly revenue report: ${label(period, true)}`, `台股月營收月報：${label(period)}`)}</h1>
${inProgress ? `<p class="notice">${L(`Reporting is still in progress: ${int(prog.reported)} of about ${int(prog.expected)} companies so far. This page updates until the month is complete.`, `本月仍在公布中：約${int(prog.expected)}家公司中目前已有${int(prog.reported)}家公布。本頁會持續更新到公布完成。`)}</p>` : ''}
<p class="lede">${esc(summary)}</p>
<div class="tiles">
${statTile(L('All companies', '全體公司'), pct(total.yoy), { note: L(`same ${int(total.compared)} companies, YoY`, `同一批${int(total.compared)}家公司，年增率`) })}
${byMarket.map(({ mk, agg }) => statTile(marketLabel(mk), pct(agg.yoy), { note: L(`${int(agg.reported)} companies, ${ntd(agg.rev)}`, `${int(agg.reported)}家，${ntd(agg.rev)}`) })).join('')}
${statTile(L('Record highs', '創新高'), int(highs.length))}
</div>
<h2>${L('Supply-chain groups', '供應鏈族群')}</h2>
<div class="table-wrap"><table><thead><tr><th>${L('Group', '族群')}</th><th class="num">${L('Combined revenue', '合計營收')}</th><th class="num">${L('YoY', '年增率')}</th><th class="num">${L('Reported', '已公布')}</th></tr></thead><tbody>${groups.map(({ b, agg }) => `<tr><td class="name"><a href="${href(`/groups/${b.slug}/`)}">${esc(b.name)}</a></td><td class="num">${ntd(agg.rev)}</td>${pctCell(agg.yoy)}<td class="num">${agg.reported}/${agg.total}</td></tr>`).join('')}</tbody></table></div>
<h2>${L('Six-month view', '近六個月')}</h2>
${basketHeatmap(ds, period, 6)}
<div class="grid-2">
<section><h2>${L('Biggest gains', '年增最多')}</h2>${metricsTable(ds, up, { compact: true })}</section>
<section><h2>${L('Biggest declines', '年減最多')}</h2>${metricsTable(ds, down, { compact: true })}</section>
</div>
${highs.length ? `<h2>${L('Record highs', '創新高')}</h2>${metricsTable(ds, highs.slice(0, 25))}` : ''}
<p class="small muted">${L(`Generated from official open data${ds.status.lastChangeAt ? `; data last changed ${esc(dateTime(ds.status.lastChangeAt))}` : ''}. See the <a href="${href('/methodology/')}">methodology</a>. Not investment advice.`, `依官方開放資料產生${ds.status.lastChangeAt ? `；資料最後更新於${esc(dateTime(ds.status.lastChangeAt))}` : ''}。請參考<a href="${href('/methodology/')}">計算方式</a>。本站內容不構成投資建議。`)}</p>
`;
  return layout(ctx, {
    title: L(`Taiwan monthly revenue report — ${label(period, true)}`, `台股月營收月報｜${label(period)}`),
    description: summary || L(`Taiwan listed companies' monthly revenue for ${label(period, true)}.`, `${label(period)}上市櫃公司月營收。`),
    path: `/reports/${period}/`,
    body,
  });
}

export function reportsIndex(ctx) {
  const { ds } = ctx;
  const rows = [...ds.periods].reverse().map((p) => {
    const t = ds.marketTotal(p);
    const pr = ds.progress(p);
    return `<tr><td><a href="${href(`/reports/${p}/`)}">${label(p, true)}</a></td><td class="num">${int(pr.reported)}</td><td class="num">${ntd(t.rev)}</td>${pctCell(t.yoy)}</tr>`;
  }).join('');
  const body = `
<h1>${L('Monthly reports archive', '月報彙整')}</h1>
<p class="lede">${L('One permanent report per month, generated from the official filings. Nothing is removed, so you can check our record.', '每月一份月報，依官方申報資料產生並永久保存，方便你檢視我們的紀錄。')}</p>
<div class="table-wrap"><table><thead><tr><th>${L('Month', '月份')}</th><th class="num">${L('Companies', '家數')}</th><th class="num">${L('Combined revenue', '合計營收')}</th><th class="num">${L('YoY (same companies)', '年增率（同一批公司）')}</th></tr></thead><tbody>${rows}</tbody></table></div>
`;
  return layout(ctx, {
    title: L('Monthly reports archive', '月報彙整'),
    description: L('Archive of monthly reports on Taiwan-listed companies’ revenue, one per month.', '台股上市櫃公司月營收月報彙整，每月一份。'),
    path: '/reports/',
    body,
  });
}
