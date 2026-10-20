import { esc, ntd, pct, signClass, int } from '../lib/format.mjs';
import { columnChart, divergingBars, heatClass, heatLegend } from '../lib/charts.mjs';
import { layout, statTile, breadcrumbs, proCta, meter } from '../lib/layout.mjs';
import { companyName, chartCard, metricsTable, pctCell, label, companyHref } from './shared.mjs';

// Rows = groups, columns = last n months, cells = same-member YoY growth.
export function basketHeatmap(ds, period, n = 6) {
  const months = ds.basketYoySeries(ds.baskets[0], period, n).map((x) => x.period);
  const head = `<tr><th>Group</th>${months.map((p) => `<th class="num">${label(p)}</th>`).join('')}</tr>`;
  const rows = ds.baskets.map((b) => {
    const s = ds.basketYoySeries(b, period, n);
    return `<tr><td class="name"><a href="/groups/${b.slug}/">${esc(b.name)}</a></td>${s.map((x) => {
      const partial = x.reported < x.total;
      const tip = `${b.name}, ${label(x.period)}: ${pct(x.yoy)} YoY (${x.compared} of ${x.total} companies compared)`;
      return `<td class="cell ${heatClass(x.yoy)}" title="${esc(tip)}">${x.yoy == null ? '—' : pct(x.yoy, 0)}${partial && x.yoy != null ? '<span class="visually-hidden"> (partial)</span>*' : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="heat"><caption class="visually-hidden">Revenue growth versus the same month a year earlier, by supply-chain group</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div>${heatLegend()}<p class="small muted">Combined revenue of each group's members versus the same members a year earlier. * = not every member has reported yet.</p>`;
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
    tip: mem.m ? `${mem.name} (${mem.code}), ${label(period)}\n${ntd(mem.m.rev)}\n${pct(mem.m.yoy)} YoY` : `${mem.name} (${mem.code})\nNot yet reported for ${label(period)}`,
  })), { title: `${b.name}: revenue growth by company, ${label(period)}`, format: (v) => pct(v) });

  const s24 = ds.basketYoySeries(b, period, 24);
  const trend = columnChart(s24.map((x) => ({
    key: x.period,
    value: x.yoy,
    xLabel: x.period.endsWith('-01') ? x.period.slice(0, 4) : '',
    tip: `${label(x.period)}\n${pct(x.yoy)} YoY\n${x.compared} of ${x.total} companies compared`,
  })), { title: `${b.name}: combined revenue growth, last 24 months`, diverging: true, height: 200, yFormat: (v) => `${Math.round(v * 100)}%`, labelFormat: (v) => pct(v) });
  const trendTable = `<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Combined revenue</th><th class="num">YoY</th><th class="num">Companies compared</th></tr></thead><tbody>${[...s24].reverse().map((x) => `<tr><td>${label(x.period)}</td><td class="num">${ntd(x.rev)}</td>${pctCell(x.yoy)}<td class="num">${x.compared} / ${x.total}</td></tr>`).join('')}</tbody></table></div>`;

  const table = `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Role</th><th class="num">Revenue</th><th class="num">YoY</th><th class="num">MoM</th><th class="num">YTD YoY</th></tr></thead><tbody>${sum.members.map((mem) => `<tr><td class="name">${mem.company ? companyName(mem.company) : `${esc(mem.name)} <span class="muted">${esc(mem.code)}</span>`}</td><td>${esc(mem.role)}</td>${mem.m ? `<td class="num">${ntd(mem.m.rev)}</td>${pctCell(mem.m.yoy)}${pctCell(mem.m.mom)}${pctCell(mem.m.ytdYoy)}` : '<td class="num muted" colspan="4">Not yet reported</td>'}</tr>`).join('')}</tbody></table></div>`;

  const body = `
${breadcrumbs([['/', 'Home'], ['/groups/', 'Groups'], ['', b.name]])}
<h1>${esc(b.name)}: Taiwan monthly revenue</h1>
<p class="lede">${esc(b.blurb)}</p>
<div class="tiles">
${statTile(`Combined growth, ${label(period)}`, pct(sum.agg.yoy), { note: `vs ${label(period).replace(/\d{4}/, (y) => y - 1)}, same ${sum.agg.compared} companies` })}
${statTile('Combined revenue', ntd(sum.agg.rev))}
${statTile('Members reported', `${sum.agg.reported} of ${sum.agg.total}`, { note: meter(sum.agg.reported / sum.agg.total, 'Share of members reported') })}
</div>
${chartCard(`Growth by company, ${label(period)}`, 'Versus the same month a year earlier. Click a name for its full history.', bars)}
${chartCard('Combined growth, last 24 months', 'Revenue of the members that reported, versus the same members a year earlier.', trend, trendTable)}
<h2>Members</h2>
${table}
<p class="small muted">Groups are hand-picked by ${esc(ctx.siteConfig.siteName)} to follow supply chains; they are not official exchange classifications.</p>
${proCta(ctx, { heading: `Get an email when companies in "${b.name}" report`, watch: b.slug })}
`;
  return layout(ctx, {
    title: `${b.name} — Taiwan supply-chain monthly revenue (${label(period, true)})`,
    description: `${b.name} in Taiwan: monthly revenue for ${b.members.map((m) => m.name).slice(0, 6).join(', ')} and more. ${label(period, true)} combined revenue ${pct(sum.agg.yoy)} year on year.`,
    path: `/groups/${b.slug}/`,
    body,
  });
}

export function groupsIndex(ctx) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  const cards = ds.baskets.map((b) => {
    const agg = ds.aggregate([...new Set(b.members.map((m) => m.code))], period);
    return `<a class="group-card" href="/groups/${b.slug}/"><div class="muted small">${esc(b.name)}</div><div class="big ${signClass(agg.yoy)}">${pct(agg.yoy)}</div><div class="small muted">${label(period)} YoY · ${agg.reported}/${agg.total} reported</div></a>`;
  }).join('');
  const inds = ds.industriesIndex().map((i) => {
    const agg = ds.aggregate(i.codes, period);
    return `<tr><td class="name"><a href="/industries/${i.slug}/">${esc(i.name)}</a></td><td class="num">${int(i.codes.length)}</td><td class="num">${ntd(agg.rev)}</td>${pctCell(agg.yoy)}</tr>`;
  }).join('');
  const body = `
<h1>Supply-chain groups and industries</h1>
<p class="lede">Hand-picked supply-chain groups, plus every official exchange industry. Growth is combined revenue versus the same companies a year earlier, for ${label(period, true)}.</p>
<div class="groups">${cards}</div>
<h2>Supply-chain heatmap</h2>
${basketHeatmap(ds, period, 12)}
<h2>All industries</h2>
<div class="table-wrap"><table><thead><tr><th>Industry</th><th class="num">Companies</th><th class="num">Revenue, ${label(period)}</th><th class="num">YoY</th></tr></thead><tbody>${inds}</tbody></table></div>
`;
  return layout(ctx, { title: 'Supply-chain groups and industries', description: 'Taiwan monthly revenue by supply-chain group (AI servers, foundry, IC design, cooling, PCB and more) and by official industry.', path: '/groups/', body });
}

export function industryPage(ctx, ind) {
  const { ds } = ctx;
  const period = ds.latestPeriod;
  const rows = ind.codes.map((c) => ds.metrics(c, period)).filter(Boolean).sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0));
  const notYet = ind.codes.filter((c) => !ds.metrics(c, period)).map((c) => ds.companies.get(c));
  const agg = ds.aggregate(ind.codes, period);
  const body = `
${breadcrumbs([['/', 'Home'], ['/groups/', 'Industries'], ['', ind.name]])}
<h1>${esc(ind.name)}: Taiwan monthly revenue</h1>
<div class="tiles">
${statTile(`Combined growth, ${label(period)}`, pct(agg.yoy), { note: `same ${agg.compared} companies, year on year` })}
${statTile('Combined revenue', ntd(agg.rev))}
${statTile('Companies reported', `${agg.reported} of ${ind.codes.length}`)}
</div>
<h2>${label(period, true)}, largest first</h2>
${metricsTable(ds, rows, { caption: `${ind.name} companies` })}
${notYet.length ? `<h2>No filing yet for ${label(period)}</h2><ul class="link-list">${notYet.map((c) => `<li>${companyName(c)}</li>`).join('')}</ul>` : ''}
`;
  return layout(ctx, {
    title: `${ind.name} — Taiwan listed companies' monthly revenue`,
    description: `Monthly revenue for all ${ind.codes.length} Taiwan-listed ${ind.name.toLowerCase()} companies, in English. ${label(period, true)}: combined ${pct(agg.yoy)} year on year.`,
    path: `/industries/${ind.slug}/`,
    body,
  });
}
