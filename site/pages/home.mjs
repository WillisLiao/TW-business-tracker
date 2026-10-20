import { esc, ntd, pct, signClass, int, dateTime } from '../lib/format.mjs';
import { layout, statTile, meter, proCta } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { basketHeatmap } from './groups.mjs';
import { metricsTable, label } from './shared.mjs';

export function homePage(ctx) {
  const { ds, siteConfig: cfg } = ctx;
  const period = ds.latestPeriod;
  if (!period) {
    return layout(ctx, {
      title: cfg.siteName,
      description: cfg.tagline,
      path: '/',
      body: `<section class="hero"><h1>${esc(cfg.tagline)}</h1><p class="lede">The first data run has not completed yet. Check back shortly.</p></section>`,
    });
  }
  const prog = ds.progress(period);
  const total = ds.marketTotal(period);
  const tsmc = ds.metrics('2330', period);
  const highs = ds.recordHighs(period);
  const { up, down } = ds.movers(period, 10);
  const [py, pm] = period.split('-').map(Number);
  const due = new Date(Date.UTC(pm === 12 ? py + 1 : py, pm % 12, 10));
  const dueText = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const lastChange = ds.status.lastChangeAt;

  const body = `
<section class="hero">
<h1>Taiwan's monthly revenue filings, in English</h1>
<p class="lede">Every Taiwan-listed and OTC company must publish its sales by the 10th of each month. We collect ${prog.expected >= 1000 ? `all ~${int(Math.round(prog.expected / 100) * 100)}` : 'all the'} filings from the official open data, translate them, chart them and link every number to its source.</p>
</section>

<section class="card">
<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline">
<h2 style="margin:0">${prog.complete ? `${label(period, true)} results` : `Now reporting: ${label(period, true)}`}</h2>
<span class="muted small">Last update: ${esc(dateTime(lastChange))}</span>
</div>
<p class="small muted" style="margin:4px 0 0">${int(prog.reported)} of about ${int(prog.expected)} companies have filed${prog.complete ? '.' : `. Filings are due by ${dueText}.`} <a href="/reporting/">Who has reported?</a></p>
${meter(prog.share, 'Share of companies that have reported')}
<div class="tiles">
${statTile('All companies, combined growth', pct(total.yoy), { note: `${label(period)} vs ${label(addMonths(period, -12))}, same ${int(total.compared)} companies` })}
${statTile('Combined revenue so far', ntd(total.rev))}
${tsmc ? statTile(`TSMC, ${label(period)}`, ntd(tsmc.rev), { delta: `${pct(tsmc.yoy)} YoY`, deltaClass: signClass(tsmc.yoy), note: '<a href="/company/2330/">Full history</a>' }) : statTile('TSMC', 'Not yet reported', { note: '<a href="/company/2330/">Full history</a>' })}
${statTile('Record highs', int(highs.length), { note: 'companies at their highest monthly revenue in our data' })}
</div>
</section>

<h2>Supply chains at a glance</h2>
<p>Combined revenue growth of each group versus a year earlier. Blue is growth, red is decline.</p>
${basketHeatmap(ds, period, 6)}

<div class="grid-2">
<section><h2>Biggest gains</h2><p class="small muted">Companies with at least ${ntd(cfg.minRevenueForMoversThousandNtd, { digits: 0 })} monthly revenue, ${label(period)} vs a year earlier.</p>${metricsTable(ds, up, { compact: true })}</section>
<section><h2>Biggest declines</h2><p class="small muted">Same size filter.</p>${metricsTable(ds, down, { compact: true })}</section>
</div>

${highs.length ? `<h2>Record highs in ${label(period, true)}</h2><p class="small muted">Highest monthly revenue in at least two years of our data, for companies above ${ntd(cfg.minRevenueForRecordsThousandNtd, { digits: 0 })}.</p>${metricsTable(ds, highs.slice(0, 15))}` : ''}

${proCta(ctx)}

<section class="card">
<h2 style="margin-top:0">Why trust these numbers?</h2>
<ul>
<li><strong>Official source, linked.</strong> Every figure comes from the Taiwan Stock Exchange and Taipei Exchange open data and links back to the filing.</li>
<li><strong>Checked before publishing.</strong> Our growth rates must match the exchanges' own published percentages, or nothing is published. <a href="/methodology/">How it works</a>.</li>
<li><strong>Corrections stay visible.</strong> If a company revises a figure, we show the old value and when it changed.</li>
<li><strong>A public record.</strong> Every month's report stays online in the <a href="/reports/">archive</a>.</li>
</ul>
</section>
`;
  return layout(ctx, {
    title: cfg.siteName,
    description: `Monthly revenue for every Taiwan-listed company, in English. ${label(period, true)}: ${int(prog.reported)} companies reported, combined ${pct(total.yoy)} year on year. TSMC, Foxconn, Quanta, MediaTek and more.`,
    path: '/',
    body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: cfg.siteUrl + '/', potentialAction: { '@type': 'SearchAction', target: `${cfg.siteUrl}/search/?q={query}`, 'query-input': 'required name=query' } },
  });
}
