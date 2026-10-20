import { esc, ntd, pct, int, date, dateTime } from '../lib/format.mjs';
import { layout, statTile, meter, proCta, breadcrumbs } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { basketHeatmap } from './groups.mjs';
import { companyName, metricsTable, pctCell, label } from './shared.mjs';

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
  const keyTable = `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Status</th><th class="num">Revenue</th><th class="num">YoY</th></tr></thead><tbody>${keyRows.map(({ c, m }) => `<tr><td class="name">${companyName(c)}</td><td>${m ? `Reported${m.firstSeen ? ` ${esc(date(m.firstSeen))}` : ''}` : '<span class="muted">Waiting</span>'}</td>${m ? `<td class="num">${ntd(m.rev)}</td>${pctCell(m.yoy)}` : '<td></td><td></td>'}</tr>`).join('')}</tbody></table></div>`;

  const body = `
<h1>Who has reported for ${label(period, true)}?</h1>
<p class="lede">${int(prog.reported)} of about ${int(prog.expected)} companies have filed so far. "First seen" is when the figure first appeared in the official open data.</p>
${meter(prog.share, 'Share of companies that have reported')}
<h2>Key supply-chain companies</h2>
${keyTable}
${proCta(ctx, { heading: 'Get these the same day, by email' })}
<h2>All filings so far (${int(reported.length)})</h2>
${metricsTable(ds, reported, { showReported: true })}
${waiting.length ? `<h2>Not yet reported (${int(waiting.length)})</h2><p class="small muted">Companies that filed for ${label(addMonths(period, -1))} but not yet for ${label(period)}, largest first.</p><ul class="link-list">${waiting.map((m) => `<li>${companyName(ds.companies.get(m.code))}</li>`).join('')}</ul>` : ''}
`;
  return layout(ctx, {
    title: `${label(period, true)} monthly revenue: reporting progress`,
    description: `Which Taiwan-listed companies have published their ${label(period, true)} revenue, and which are still to come. Updated through the reporting window.`,
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
  const { up, down } = ds.movers(period, 10);
  const highs = ds.recordHighs(period);
  const inProgress = period === ds.latestPeriod && !prog.complete;
  const byMarket = ['TWSE', 'TPEx'].map((mk) => ({ mk, agg: ds.aggregate(Object.entries(ds.byPeriod.get(period)).filter(([, r]) => r.market === mk).map(([c]) => c), period) }));
  const groups = ds.baskets.map((b) => ({ b, agg: ds.aggregate([...new Set(b.members.map((m) => m.code))], period) })).sort((a, b) => (b.agg.yoy ?? -9) - (a.agg.yoy ?? -9));
  const summary = total.yoy == null ? '' : `Taiwan's listed and OTC companies reported combined revenue of ${ntd(total.rev)} for ${label(period, true)}, ${total.yoy >= 0 ? 'up' : 'down'} ${pct(Math.abs(total.yoy)).replace('+', '')} from a year earlier on a same-company basis (${int(total.compared)} companies).${tsmc ? ` TSMC reported ${ntd(tsmc.rev)} (${pct(tsmc.yoy)} YoY).` : ''}${groups[0]?.agg.yoy != null ? ` The strongest supply-chain group was ${groups[0].b.name.toLowerCase()} (${pct(groups[0].agg.yoy)}).` : ''}`;

  const body = `
${breadcrumbs([['/', 'Home'], ['/reports/', 'Monthly reports'], ['', label(period, true)]])}
<h1>Taiwan monthly revenue report: ${label(period, true)}</h1>
${inProgress ? `<p class="notice">Reporting is still in progress: ${int(prog.reported)} of about ${int(prog.expected)} companies so far. This page updates until the month is complete.</p>` : ''}
<p class="lede">${esc(summary)}</p>
<div class="tiles">
${statTile('All companies', pct(total.yoy), { note: `same ${int(total.compared)} companies, YoY` })}
${byMarket.map(({ mk, agg }) => statTile(mk === 'TWSE' ? 'Listed (TWSE)' : 'OTC (TPEx)', pct(agg.yoy), { note: `${int(agg.reported)} companies, ${ntd(agg.rev)}` })).join('')}
${statTile('Record highs', int(highs.length))}
</div>
<h2>Supply-chain groups</h2>
<div class="table-wrap"><table><thead><tr><th>Group</th><th class="num">Combined revenue</th><th class="num">YoY</th><th class="num">Reported</th></tr></thead><tbody>${groups.map(({ b, agg }) => `<tr><td class="name"><a href="/groups/${b.slug}/">${esc(b.name)}</a></td><td class="num">${ntd(agg.rev)}</td>${pctCell(agg.yoy)}<td class="num">${agg.reported}/${agg.total}</td></tr>`).join('')}</tbody></table></div>
<h2>Six-month view</h2>
${basketHeatmap(ds, period, 6)}
<div class="grid-2">
<section><h2>Biggest gains</h2>${metricsTable(ds, up, { compact: true })}</section>
<section><h2>Biggest declines</h2>${metricsTable(ds, down, { compact: true })}</section>
</div>
${highs.length ? `<h2>Record highs</h2>${metricsTable(ds, highs.slice(0, 25))}` : ''}
<p class="small muted">Generated from official open data${ds.status.lastChangeAt ? `; data last changed ${esc(dateTime(ds.status.lastChangeAt))}` : ''}. See the <a href="/methodology/">methodology</a>. Not investment advice.</p>
`;
  return layout(ctx, {
    title: `Taiwan monthly revenue report — ${label(period, true)}`,
    description: summary || `Taiwan listed companies' monthly revenue for ${label(period, true)}.`,
    path: `/reports/${period}/`,
    body,
  });
}

export function reportsIndex(ctx) {
  const { ds } = ctx;
  const rows = [...ds.periods].reverse().map((p) => {
    const t = ds.marketTotal(p);
    const pr = ds.progress(p);
    return `<tr><td><a href="/reports/${p}/">${label(p, true)}</a></td><td class="num">${int(pr.reported)}</td><td class="num">${ntd(t.rev)}</td>${pctCell(t.yoy)}</tr>`;
  }).join('');
  const body = `
<h1>Monthly reports archive</h1>
<p class="lede">One permanent report per month, generated from the official filings. Nothing is removed, so you can check our record.</p>
<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Companies</th><th class="num">Combined revenue</th><th class="num">YoY (same companies)</th></tr></thead><tbody>${rows}</tbody></table></div>
`;
  return layout(ctx, { title: 'Monthly reports archive', description: 'Archive of monthly reports on Taiwan-listed companies’ revenue, one per month.', path: '/reports/', body });
}
