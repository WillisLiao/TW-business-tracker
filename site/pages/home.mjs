import { esc, ntd, pct, signClass, int, dateTime } from '../lib/format.mjs';
import { layout, statTile, meter, proCta, siteName, tagline } from '../lib/layout.mjs';
import { addMonths } from '../../pipeline/lib/period.mjs';
import { L, href } from '../lib/lang.mjs';
import { basketHeatmap } from './groups.mjs';
import { metricsTable, label } from './shared.mjs';

export function homePage(ctx) {
  const { ds, siteConfig: cfg } = ctx;
  const period = ds.latestPeriod;
  const name = siteName(cfg);
  if (!period) {
    return layout(ctx, {
      title: name,
      description: tagline(cfg),
      path: '/',
      body: `<section class="hero"><h1>${esc(tagline(cfg))}</h1><p class="lede">${L('The first data run has not completed yet. Check back shortly.', '第一次資料更新尚未完成，請稍後再來。')}</p></section>`,
    });
  }
  const prog = ds.progress(period);
  const total = ds.marketTotal(period);
  const tsmc = ds.metrics('2330', period);
  const tsmcName = ds.companies.get('2330')?.display || 'TSMC';
  const highs = ds.recordHighs(period);
  const { up, down } = ds.movers(period, 10);
  const [py, pm] = period.split('-').map(Number);
  const dueMonth = pm === 12 ? 1 : pm + 1;
  const due = new Date(Date.UTC(pm === 12 ? py + 1 : py, pm % 12, 10));
  const dueText = L(due.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }), `${dueMonth}月10日`);
  const filings = prog.expected >= 1000 ? int(Math.round(prog.expected / 100) * 100) : '';
  const fullHistory = `<a href="${href('/company/2330/')}">${L('Full history', '完整歷史')}</a>`;

  const body = `
<section class="hero">
<h1>${L("Taiwan's monthly revenue filings, in English", '台股上市櫃公司月營收，一次看懂')}</h1>
<p class="lede">${L(
    `Every Taiwan-listed and OTC company must publish its sales by the 10th of each month. We collect ${filings ? `all ~${filings}` : 'all the'} filings from the official open data, translate them, chart them and link every number to its source.`,
    `所有上市櫃公司都必須在每月10日前公布上月營收。我們從官方開放資料收集${filings ? `全部約${filings}家公司的` : '所有'}申報，整理成圖表、提供中英對照，每個數字都附上官方來源。`)}</p>
</section>

<section class="card">
<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline">
<h2 style="margin:0">${prog.complete ? L(`${label(period, true)} results`, `${label(period)}營收總覽`) : L(`Now reporting: ${label(period, true)}`, `公布中：${label(period)}營收`)}</h2>
<span class="muted small">${L('Last update', '最後更新')}${L(': ', '：')}${esc(dateTime(ds.status.lastChangeAt))}</span>
</div>
<p class="small muted" style="margin:4px 0 0">${L(
    `${int(prog.reported)} of about ${int(prog.expected)} companies have filed${prog.complete ? '.' : `. Filings are due by ${dueText}.`}`,
    `約${int(prog.expected)}家公司中，已有${int(prog.reported)}家公布${prog.complete ? '。' : `，申報期限為${dueText}。`}`)} <a href="${href('/reporting/')}">${L('Who has reported?', '看公布進度')}</a></p>
${meter(prog.share, L('Share of companies that have reported', '已公布公司比例'))}
<div class="tiles">
${statTile(L('All companies, combined growth', '全體合計年增率'), pct(total.yoy), { note: L(`${label(period)} vs ${label(addMonths(period, -12))}, same ${int(total.compared)} companies`, `${label(period)}較${label(addMonths(period, -12))}，同一批${int(total.compared)}家公司`) })}
${statTile(prog.complete ? L('Combined revenue', '合計營收') : L('Combined revenue so far', '目前合計營收'), ntd(total.rev))}
${tsmc ? statTile(L(`${tsmcName}, ${label(period)}`, `${tsmcName}，${label(period)}`), ntd(tsmc.rev), { delta: L(`${pct(tsmc.yoy)} YoY`, `年增 ${pct(tsmc.yoy)}`), deltaClass: signClass(tsmc.yoy), note: fullHistory }) : statTile(tsmcName, L('Not yet reported', '尚未公布'), { note: fullHistory })}
${statTile(L('Record highs', '創新高'), int(highs.length), { note: L('companies at their highest monthly revenue in our data', '家公司單月營收創本站資料新高') })}
</div>
</section>

<h2>${L('Supply chains at a glance', '供應鏈一覽')}</h2>
<p>${L('Combined revenue growth of each group versus a year earlier. Blue is growth, red is decline.', '各族群合計營收與去年同月相比。藍色為成長，紅色為衰退。')}</p>
${basketHeatmap(ds, period, 6)}

<div class="grid-2">
<section><h2>${L('Biggest gains', '年增最多')}</h2><p class="small muted">${L(`Companies with at least ${ntd(cfg.minRevenueForMoversThousandNtd, { digits: 0 })} monthly revenue, ${label(period)} vs a year earlier.`, `單月營收至少${ntd(cfg.minRevenueForMoversThousandNtd, { digits: 0 })}的公司，${label(period)}與去年同月相比。`)}</p>${metricsTable(ds, up, { compact: true })}</section>
<section><h2>${L('Biggest declines', '年減最多')}</h2><p class="small muted">${L('Same size filter.', '篩選條件相同。')}</p>${metricsTable(ds, down, { compact: true })}</section>
</div>

${highs.length ? `<h2>${L(`Record highs in ${label(period, true)}`, `${label(period)}營收創新高`)}</h2><p class="small muted">${L(`Highest monthly revenue in at least two years of our data, for companies above ${ntd(cfg.minRevenueForRecordsThousandNtd, { digits: 0 })}.`, `單月營收創本站至少兩年資料以來新高，且營收超過${ntd(cfg.minRevenueForRecordsThousandNtd, { digits: 0 })}的公司。`)}</p>${metricsTable(ds, highs.slice(0, 15))}` : ''}

${proCta(ctx)}

<section class="card">
<h2 style="margin-top:0">${L('Why trust these numbers?', '為什麼可以相信這些數字？')}</h2>
<ul>
<li>${L('<strong>Official source, linked.</strong> Every figure comes from the Taiwan Stock Exchange and Taipei Exchange open data and links back to the filing.', '<strong>官方來源，附連結。</strong>每個數字都來自證交所與櫃買中心的開放資料，並連回原始申報。')}</li>
<li>${L(`<strong>Checked before publishing.</strong> Our growth rates must match the exchanges' own published percentages, or nothing is published. <a href="${href('/methodology/')}">How it works</a>.`, `<strong>發布前先檢查。</strong>我們算出的成長率必須與交易所公布的百分比一致，否則不會發布。<a href="${href('/methodology/')}">計算方式</a>。`)}</li>
<li>${L('<strong>Corrections stay visible.</strong> If a company revises a figure, we show the old value and when it changed.', '<strong>修正紀錄公開。</strong>公司若修正數字，我們會保留舊數值並標示修正時間。')}</li>
<li>${L(`<strong>A public record.</strong> Every month's report stays online in the <a href="${href('/reports/')}">archive</a>.`, `<strong>公開紀錄。</strong>每個月的月報都永久保存在<a href="${href('/reports/')}">月報彙整</a>。`)}</li>
</ul>
</section>
`;
  const base = cfg.siteUrl.replace(/\/$/, '');
  return layout(ctx, {
    title: name,
    description: L(
      `Monthly revenue for every Taiwan-listed company, in English. ${label(period, true)}: ${int(prog.reported)} companies reported, combined ${pct(total.yoy)} year on year. TSMC, Foxconn, Quanta, MediaTek and more.`,
      `每家上市櫃公司的月營收，中英對照。${label(period)}：已有${int(prog.reported)}家公布，合計年增${pct(total.yoy)}。台積電、鴻海、廣達、聯發科等。`),
    path: '/',
    body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name, url: base + href('/'), inLanguage: L('en', 'zh-Hant-TW'), potentialAction: { '@type': 'SearchAction', target: `${base}${href('/search/')}?q={query}`, 'query-input': 'required name=query' } },
  });
}
