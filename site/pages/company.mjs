import { esc, ntd, pct, compact, signClass, dateTime, int } from '../lib/format.mjs';
import { columnChart } from '../lib/charts.mjs';
import { layout, statTile, breadcrumbs, proCta } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { mopsSummaryUrl, SOURCES } from '../../pipeline/sources.mjs';
import { MARKET_LABEL } from '../lib/data.mjs';
import { companyName, chartCard, metricsTable, pctCell, label } from './shared.mjs';

export function companyPage(ctx, code) {
  const { ds } = ctx;
  const c = ds.companies.get(code);
  const s = ds.series.get(code) || [];
  const latest = s.at(-1)?.period;
  if (!c || !latest) return null;
  const m = ds.metrics(code, latest);
  const yoyText = m.yoy == null ? '' : `, ${pct(m.yoy)} YoY`;

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
      tip: mm ? `${label(p)}\n${ntd(mm.rev)}\n${pct(mm.yoy)} YoY · ${pct(mm.mom)} MoM` : `${label(p)}\nNo filing`,
    };
  });
  const revSvg = columnChart(revPoints, {
    title: `${c.display} monthly revenue, ${label(months[0])} to ${label(latest)}`,
    yFormat: (v) => (v === 0 ? '0' : compact(v)),
    labelFormat: (v) => ntd(v),
    mobileCount: 36,
  });

  const yoyMonths = months.slice(-36);
  const yoyPoints = yoyMonths.map((p) => {
    const mm = ds.metrics(code, p);
    const [y, mo] = p.split('-');
    return { key: p, value: mm?.yoy ?? null, xLabel: mo === '01' ? y : '', tip: mm ? `${label(p)}\n${pct(mm.yoy)} vs ${label(addMonths(p, -12))}` : `${label(p)}\nNo comparison` };
  });
  const yoySvg = columnChart(yoyPoints, {
    title: `${c.display} revenue growth versus the same month a year earlier`,
    diverging: true,
    height: 200,
    yFormat: (v) => `${Math.round(v * 100)}%`,
    labelFormat: (v) => pct(v),
    mobileCount: 24,
  });

  const histRows = [...months].reverse().map((p) => ds.metrics(code, p)).filter(Boolean);
  const historyTable = (rows) => `<div class="table-wrap"><table><thead><tr><th>Month</th><th class="num">Revenue</th><th class="num">MoM</th><th class="num">YoY</th><th class="num">Year to date</th><th class="num">YTD YoY</th><th>Notes</th></tr></thead><tbody>${rows.map((h) => `<tr><td>${label(h.period)}</td><td class="num">${ntd(h.rev)}</td>${pctCell(h.mom)}${pctCell(h.yoy)}<td class="num">${ntd(h.ytd)}</td>${pctCell(h.ytdYoy)}<td>${h.revisions.length ? '<span class="pill" title="The company corrected this figure">Revised</span> ' : ''}${h.recordHigh ? '<span class="pill">Record high</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;

  const peers = [...ds.companies.values()]
    .filter((o) => o.industrySlug === c.industrySlug && o.code !== code)
    .map((o) => ds.metrics(o.code, latest))
    .filter((x) => x && x.rev != null)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 8);

  const groups = ds.baskets.filter((b) => c.baskets.includes(b.slug));
  const revisionsHtml = m.revisions.length
    ? `<div class="notice"><strong>This figure was revised.</strong> Earlier published value${m.revisions.length > 1 ? 's' : ''}: ${m.revisions.map((r) => `${ntd(r.rev)} (replaced ${esc(dateTime(r.replacedAt))})`).join('; ')}.</div>`
    : '';
  const record = m.recordHigh ? `<p><span class="pill">Record high</span> Highest monthly revenue in the ${int(m.historyMonths)} months of data we hold for ${esc(c.display)}.</p>` : '';
  const note = m.note ? `<p class="small"><strong>Company's own note</strong> (in Chinese, as filed): <span lang="zh-Hant">${esc(m.note)}</span></p>` : '';

  const body = `
${breadcrumbs([['/', 'Home'], [`/industries/${c.industrySlug}/`, c.industry], ['', `${c.display} (${c.code})`]])}
<h1>${esc(c.display)} (${esc(c.code)}) monthly revenue</h1>
<div class="facts">${c.nameZh ? `<span lang="zh-Hant">${esc(c.nameZh)}</span>` : ''}<span>${esc(MARKET_LABEL[c.market] || c.market)}</span><a href="/industries/${c.industrySlug}/">${esc(c.industry)}</a>${groups.map((g) => `<a href="/groups/${g.slug}/">${esc(g.name)}</a>`).join('')}</div>
<p class="lede">${esc(c.display)} reported revenue of <strong>${ntd(m.rev)}</strong> for ${label(latest, true)}${m.yoy != null ? `, <span class="${signClass(m.yoy)}">${m.yoy >= 0 ? 'up' : 'down'} ${pct(Math.abs(m.yoy)).replace('+', '')}</span> from ${label(addMonths(latest, -12))}` : ''}${m.mom != null ? ` and <span class="${signClass(m.mom)}">${m.mom >= 0 ? 'up' : 'down'} ${pct(Math.abs(m.mom)).replace('+', '')}</span> from the previous month` : ''}.</p>
<div class="tiles">
${statTile(`Revenue, ${label(latest)}`, ntd(m.rev))}
${statTile('vs same month last year', pct(m.yoy), { deltaClass: signClass(m.yoy), note: m.ya != null ? `${label(addMonths(latest, -12))}: ${ntd(m.ya)}` : '' })}
${statTile('vs previous month', pct(m.mom), { note: m.prev != null ? `${label(addMonths(latest, -1))}: ${ntd(m.prev)}` : '' })}
${statTile(`Year to date (${latest.slice(0, 4)})`, ntd(m.ytd), { delta: m.ytdYoy != null ? `${pct(m.ytdYoy)} YoY` : '', deltaClass: signClass(m.ytdYoy) })}
</div>
${record}${revisionsHtml}${note}
<p class="source-line">First seen in the official data: ${esc(dateTime(m.firstSeen))}. Source: <a href="${mopsSummaryUrl(c.market, latest, c.nameZh)}" rel="nofollow">MOPS monthly summary for ${label(latest)}</a> · <a href="${SOURCES[c.market].revenue}" rel="nofollow">${esc(SOURCES[c.market].label)}</a>. Amounts are as filed by the company, unaudited.</p>
${chartCard('Monthly revenue', 'New Taiwan dollars. The latest month is darker. Hover or tap a bar for details.', revSvg, historyTable(histRows))}
${chartCard('Growth vs the same month last year', '<span class="chart-legend" style="display:inline-flex"><span><i style="background:var(--pos)"></i>Growth</span><span><i style="background:var(--neg)"></i>Decline</span></span>', yoySvg)}
${proCta(ctx, { heading: `Get an email the day ${c.display} reports`, watch: code })}
<h2>Recent months</h2>
${historyTable(histRows.slice(0, 13))}
${peers.length ? `<h2>Largest peers in ${esc(c.industry)}</h2>${metricsTable(ds, peers)}` : ''}
`;

  return layout(ctx, {
    title: `${c.display} (${c.code}) Monthly Revenue — ${label(latest, true)}: ${ntd(m.rev)}${yoyText}`,
    description: `${c.display}${c.nameZh ? ` (${c.nameZh})` : ''}, stock code ${c.code}: monthly revenue in English. ${label(latest, true)} revenue ${ntd(m.rev)}${yoyText}. Five-year history, charts and links to the official filing.`,
    path: `/company/${encodeURIComponent(code)}/`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: ctx.siteConfig.siteUrl + '/' },
        { '@type': 'ListItem', position: 2, name: c.industry, item: `${ctx.siteConfig.siteUrl}/industries/${c.industrySlug}/` },
        { '@type': 'ListItem', position: 3, name: `${c.display} (${c.code})` },
      ],
    },
  });
}
