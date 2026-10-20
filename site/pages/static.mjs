import { esc, int } from '../lib/format.mjs';
import { layout } from '../lib/layout.mjs';
import { SOURCES, MOPS_HOSTS } from '../../pipeline/sources.mjs';
import { MARKET_LABEL } from '../lib/data.mjs';
import { companyHref } from './shared.mjs';

export function methodologyPage(ctx) {
  const name = esc(ctx.siteConfig.siteName);
  const body = `
<h1>Methodology</h1>
<p class="lede">How ${name} collects, checks and presents Taiwan's monthly revenue filings.</p>
<h2>Where the numbers come from</h2>
<p>Taiwan requires every company listed on the Taiwan Stock Exchange (TWSE) or the Taipei Exchange (TPEx, the OTC market) to report its revenue for each month by the 10th of the following month. The exchanges publish these filings as open data. We read the official feeds several times a day during the reporting window (1st–15th of each month) and daily otherwise. Full details are on the <a href="/sources/">sources page</a>.</p>
<h2>Units</h2>
<p>Companies report in thousands of New Taiwan dollars (NT$). We display amounts in NT$ millions (M), billions (B) or trillions (T). We do not convert to US dollars, because exchange-rate moves would distort growth rates.</p>
<h2>Growth rates</h2>
<ul>
<li><strong>YoY</strong>: revenue for the month divided by revenue for the same month a year earlier, minus one.</li>
<li><strong>MoM</strong>: versus the previous month. Many companies are seasonal, so MoM moves are often normal.</li>
<li><strong>YTD YoY</strong>: revenue from January to the month, versus the same period a year earlier.</li>
<li><strong>Combined growth</strong> for a group, industry or the whole market is calculated on a <em>same-company basis</em>: we add up the revenue of companies that reported in both periods, so new listings or late filers do not distort the comparison.</li>
</ul>
<h2>Checks before anything is published</h2>
<p>Every update is checked automatically. If any check fails, nothing from that source is published and we are alerted.</p>
<ul>
<li>Our own YoY and MoM calculations must match the percentages the exchanges publish alongside the amounts. A mismatch on more than 2% of companies means a column was misread, so the update is blocked.</li>
<li>Amounts must be in a plausible range (for example, TSMC's monthly revenue must be between NT$10 billion and NT$10 trillion), which catches unit errors.</li>
<li>Dates must be valid, and no month in the future is accepted.</li>
<li>Published figures are never deleted. If a company corrects a figure, we keep the old value and show when it changed.</li>
</ul>
<h2>Record highs</h2>
<p>A "record high" is the highest monthly revenue in the history we hold for that company, and we only show it once we hold at least 24 earlier months. Our history may not reach back to a company's listing, so this is "highest in our data", not necessarily all-time.</p>
<h2>Supply-chain groups</h2>
<p>Groups such as "AI servers & ODMs" are hand-picked by us to follow a supply chain. They are not official classifications, and membership may change. Industries are the exchanges' own official classifications.</p>
<h2>Company names</h2>
<p>English names come from the exchanges' company profiles, or from the name a company commonly uses in English. The Chinese name is shown alongside so you can match it to the original filing.</p>
<h2>Limitations</h2>
<ul>
<li>Monthly revenue is unaudited and reported by the companies themselves.</li>
<li>"First seen" is when the figure first appeared in the open data we read, which may be later than the company's own filing time.</li>
<li>Revenue is not profit. A sales increase can come with lower margins.</li>
</ul>
<p>Spotted an error? Please <a href="/about/">get in touch</a>. Corrections are published, never hidden.</p>
`;
  return layout(ctx, { title: 'Methodology', description: 'How we collect, check and calculate Taiwan monthly revenue figures: sources, units, growth rates and validation.', path: '/methodology/', body });
}

export function sourcesPage(ctx) {
  const body = `
<h1>Sources and licence</h1>
<p class="lede">All figures come from official Taiwanese open data.</p>
<h2>Data sources</h2>
<ul>
${Object.entries(SOURCES).map(([mk, s]) => `<li><strong>${esc(MARKET_LABEL[mk])}</strong>: ${esc(s.label)}, monthly revenue summary (<a href="${s.revenue}" rel="nofollow">${esc(s.revenue)}</a>) and company profiles (<a href="${s.profile}" rel="nofollow">${esc(s.profile)}</a>).</li>`).join('\n')}
<li><strong>History</strong>: the Market Observation Post System (MOPS) monthly revenue summary pages (<a href="${MOPS_HOSTS[0]}" rel="nofollow">${esc(MOPS_HOSTS[0])}</a>).</li>
</ul>
<h2>Licence and attribution</h2>
<p>The source data is published by the Taiwan Stock Exchange Corporation and the Taipei Exchange under the <a href="https://data.gov.tw/license" rel="nofollow">Open Government Data License, version 1.0</a>, which permits commercial and non-commercial use with attribution. Translations, calculations, charts and groupings are by ${esc(ctx.siteConfig.siteName)}. The exchanges have not reviewed or endorsed this site.</p>
`;
  return layout(ctx, { title: 'Sources and licence', description: 'Official data sources for Taiwan monthly revenue and the open data licence.', path: '/sources/', body });
}

export function aboutPage(ctx) {
  const cfg = ctx.siteConfig;
  const who = cfg.ownerName ? `${esc(cfg.siteName)} is run by ${esc(cfg.ownerName)}, based in Taiwan.` : `${esc(cfg.siteName)} is an independent project run from Taiwan.`;
  const body = `
<h1>About</h1>
<p class="lede">${who}</p>
<p>Taiwan's monthly revenue filings are one of the earliest signals of how global technology demand is moving: TSMC, Foxconn, Quanta and hundreds of their suppliers report every month, weeks before most US companies report their quarters. But the filings are published in Chinese, across several government websites, one company at a time.</p>
<p>${esc(cfg.siteName)} reads the official open data directly, checks it, translates it and presents it in one place. The free site covers every company. ${cfg.pro.enabled ? 'Pro subscribers get same-day email alerts and full-history downloads, which pays for running the site.' : ''}</p>
<p>We are not affiliated with the Taiwan Stock Exchange, the Taipei Exchange or any company listed here, and nothing on this site is investment advice.</p>
<h2>Contact</h2>
<p>${cfg.contactEmail ? `Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>. Reports of errors are especially welcome.` : 'Contact details are coming soon.'}</p>
`;
  return layout(ctx, { title: 'About', description: `About ${cfg.siteName}: who runs it and why.`, path: '/about/', body });
}

export function pricingPage(ctx) {
  const cfg = ctx.siteConfig;
  const p = cfg.pro;
  const buy = (url, text) => (url ? `<a class="button" data-checkout href="${esc(url)}">${esc(text)}</a>` : '');
  const body = `
<h1>${p.enabled ? 'Pro: same-day alerts and full history' : 'Email alerts'}</h1>
<p class="lede">The site is free to read, for every company. ${p.enabled ? 'Pro is for people who want the numbers delivered the day they come out.' : 'Email alerts are coming soon.'}</p>
<div class="plans">
<section class="plan"><h2 style="margin-top:0">Free</h2><div class="price">$0</div><ul>
<li>Every listed and OTC company, every month</li><li>Charts, 5-year history and official source links</li><li>Supply-chain groups and industry pages</li><li>Monthly reports archive</li><li>This month's data as a CSV download</li></ul></section>
<section class="plan featured"><h2 style="margin-top:0">Pro</h2><div class="price">$${p.monthlyPriceUsd}<span class="small muted">/month</span></div><p class="small muted">or $${p.yearlyPriceUsd}/year</p><ul>
<li><strong>Same-day email alerts</strong> for up to ${p.maxWatchlist} companies you choose</li><li>Summary email when a month's reporting is complete</li><li>Full-history downloads (CSV) for every company</li><li>${p.trialDays}-day free trial, cancel any time</li></ul>
${p.enabled ? `<p style="display:flex;gap:8px;flex-wrap:wrap">${buy(p.checkoutUrlMonthly, 'Start free trial — monthly')}${buy(p.checkoutUrlYearly, 'Yearly')}</p><p class="small muted">Use the same email to <a href="/account/">sign in</a> afterwards.</p>` : ctx.apiEnabled === false ? '<p class="muted">Coming soon.</p>' : `<form class="waitlist" data-waitlist><label class="visually-hidden" for="wl-pricing">Email</label><input id="wl-pricing" type="email" name="email" required placeholder="you@example.com"><input type="hidden" name="interest" value="pricing"><button class="button" type="submit">Tell me when it launches</button><p class="form-msg small" role="status"></p></form>`}
</section>
</div>
<h2>Questions</h2>
<h3>Who handles payment?</h3>
<p>Payments are processed by Lemon Squeezy, which acts as the merchant of record and handles receipts and sales tax. Your card details never reach this site.</p>
<h3>Can I cancel?</h3>
<p>Yes, any time, from the link in your receipt email or your account page. You keep access until the end of the period you paid for.</p>
<h3>Refunds?</h3>
<p>If you are not happy within 30 days of your first payment, email us and we will refund you in full.</p>
<h3>How fast are alerts?</h3>
<p>We check the official data several times a day during the reporting window. Alerts go out within a few hours of a figure appearing in the official open data, usually the same day.</p>
`;
  return layout(ctx, { title: p.enabled ? 'Pro pricing' : 'Email alerts', description: 'Same-day email alerts and full-history downloads for Taiwan monthly revenue filings.', path: '/pricing/', body });
}

export function accountPage(ctx) {
  const cfg = ctx.siteConfig;
  const body = `
<h1>Your account</h1>
<div id="account" data-max="${cfg.pro.maxWatchlist}" data-checkout="${esc(cfg.pro.checkoutUrlMonthly)}">
<section class="card" data-view="signin">
<h2 style="margin-top:0">Sign in</h2>
<p>Enter the email you used to subscribe. We will send you a 6-digit code. No password needed.</p>
<form data-signin style="display:flex;gap:8px;flex-wrap:wrap"><label class="visually-hidden" for="email">Email</label><input id="email" type="email" name="email" required placeholder="you@example.com"><button class="button" type="submit">Send code</button></form>
<form data-verify hidden style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><label class="visually-hidden" for="code">Code</label><input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="123456"><button class="button" type="submit">Sign in</button></form>
<p class="form-msg small" role="status"></p>
</section>
<section data-view="dashboard" hidden>
<section class="card"><h2 style="margin-top:0">Subscription</h2><p data-status></p><p data-manage></p><p><button class="button secondary" data-signout type="button">Sign out</button></p></section>
<section class="card" data-pro-only><h2 style="margin-top:0">Watchlist</h2>
<p class="small muted">You get one email when any of these companies reports, plus a summary when the month is complete. Up to ${cfg.pro.maxWatchlist} companies.</p>
<form data-add style="display:flex;gap:8px;flex-wrap:wrap;position:relative"><label class="visually-hidden" for="add">Add company</label><input id="add" type="text" placeholder="Add a company: 2330, Quanta…" autocomplete="off" style="flex:1 1 220px"><button class="button" type="submit">Add</button><ul class="search-results" hidden></ul></form>
<ul data-watchlist class="link-list" style="margin-top:12px"></ul>
<p><label><input type="checkbox" data-alerts> Send me alert emails</label></p>
<p class="form-msg small" role="status" data-watch-msg></p>
</section>
<section class="card" data-pro-only><h2 style="margin-top:0">Downloads</h2><p><a data-download="full" href="#">Full history, all companies (CSV)</a></p><p class="small muted">Updated after every data change. UTF-8 CSV; amounts in thousand NT$ as filed.</p></section>
</section>
</div>
<script src="/assets/account.js?v=${ctx.buildId}" defer></script>
`;
  return layout(ctx, { title: 'Account', description: 'Manage your alerts and downloads.', path: '/account/', body, noindex: true });
}

export function privacyPage(ctx) {
  const cfg = ctx.siteConfig;
  const body = `
<h1>Privacy</h1>
<p class="lede">We collect as little as possible.</p>
<ul>
<li><strong>Reading the site</strong> needs no account. We do not use advertising or tracking cookies. Our host (Cloudflare) keeps standard server logs for security.</li>
<li><strong>If you leave your email</strong> (waitlist or sign-in), we store it to send you what you asked for: the launch notice, sign-in codes and, for Pro, your alerts. We never sell or share it.</li>
<li><strong>Pro subscribers</strong>: payment is handled by Lemon Squeezy, which tells us your email and subscription status; we never see card details. We store your watchlist and alert settings.</li>
<li><strong>Emails</strong> are delivered through Resend. A sign-in cookie keeps you logged in for 30 days; it is used for nothing else.</li>
<li><strong>Deleting your data</strong>: ${cfg.contactEmail ? `email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : 'contact us'} and we will delete your email, watchlist and sign-in records.</li>
</ul>
`;
  return layout(ctx, { title: 'Privacy', description: 'What data we collect and why.', path: '/privacy/', body });
}

export function termsPage(ctx) {
  const name = esc(ctx.siteConfig.siteName);
  const body = `
<h1>Terms of use</h1>
<h2>Not investment advice</h2>
<p>${name} republishes and summarises public company filings. Nothing on this site or in our emails is a recommendation to buy or sell any security. Do your own research.</p>
<h2>Accuracy</h2>
<p>We take care to reproduce the official figures exactly and we check them automatically, but the data is provided "as is". Companies can revise their figures, and errors can occur. Always confirm important figures against the linked official source.</p>
<h2>Subscriptions</h2>
<p>Pro subscriptions renew automatically until cancelled. You can cancel at any time and keep access until the end of the paid period. If you are not satisfied within 30 days of your first payment, we will refund it in full on request.</p>
<h2>Fair use</h2>
<p>Please do not resell our downloads or redistribute alert emails in bulk. Quoting figures with a link back is welcome.</p>
<h2>Liability</h2>
<p>To the extent the law allows, ${name} is not liable for losses arising from use of the site or its data.</p>
`;
  return layout(ctx, { title: 'Terms of use', description: 'Terms of use, including our not-investment-advice notice.', path: '/terms/', body });
}

export function companiesDirectory(ctx) {
  const { ds } = ctx;
  const list = [...ds.companies.values()].filter((c) => ds.series.has(c.code));
  const body = `
<h1>All companies (${int(list.length)})</h1>
<p class="lede">Every Taiwan-listed and OTC company with monthly revenue on file.</p>
<div class="table-wrap"><table><thead><tr><th>Code</th><th>Company</th><th>Industry</th><th>Market</th></tr></thead><tbody>
${list.map((c) => `<tr><td>${esc(c.code)}</td><td class="name"><a href="${companyHref(c.code)}">${esc(c.display)}</a>${c.nameZh && c.nameZh !== c.display ? ` <span class="zh">${esc(c.nameZh)}</span>` : ''}</td><td><a href="/industries/${c.industrySlug}/">${esc(c.industry)}</a></td><td>${esc(MARKET_LABEL[c.market] || c.market)}</td></tr>`).join('\n')}
</tbody></table></div>`;
  return layout(ctx, { title: 'All companies', description: 'Directory of every Taiwan-listed and OTC company with monthly revenue history in English.', path: '/companies/', body });
}

export function searchPage(ctx) {
  const body = `
<h1>Search</h1>
<form action="/search/" style="display:flex;gap:8px;flex-wrap:wrap"><label class="visually-hidden" for="q2">Company name or code</label><input id="q2" name="q" type="text" placeholder="Company name or code" style="flex:1 1 240px"><button class="button" type="submit">Search</button></form>
<ul id="search-page-results" class="link-list" style="margin-top:16px"></ul>
<noscript><p>Search needs JavaScript. Browse the <a href="/companies/">full company list</a> instead.</p></noscript>
<p class="small muted">Or browse <a href="/companies/">all companies</a>.</p>`;
  return layout(ctx, { title: 'Search', description: 'Search Taiwan-listed companies by name or stock code.', path: '/search/', body, noindex: true });
}

export function notFoundPage(ctx) {
  return layout(ctx, { title: 'Page not found', description: 'Page not found.', path: '/404', noindex: true, body: '<h1>Page not found</h1><p>Try the search box above, or browse <a href="/companies/">all companies</a>.</p>' });
}
