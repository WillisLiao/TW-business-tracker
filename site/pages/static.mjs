import { esc, int } from '../lib/format.mjs';
import { layout, siteName } from '../lib/layout.mjs';
import { SOURCES, MOPS_HOSTS } from '../../pipeline/sources.mjs';
import { marketLabel } from '../lib/data.mjs';
import { L, href, isZh } from '../lib/lang.mjs';
import { companyHref } from './shared.mjs';

const SOURCE_ZH = { TWSE: '臺灣證券交易所 OpenAPI', TPEx: '證券櫃檯買賣中心 OpenAPI' };

export function methodologyPage(ctx) {
  const name = esc(siteName(ctx.siteConfig));
  const en = `
<h1>Methodology</h1>
<p class="lede">How ${name} collects, checks and presents Taiwan's monthly revenue filings.</p>
<h2>Where the numbers come from</h2>
<p>Taiwan requires every company listed on the Taiwan Stock Exchange (TWSE) or the Taipei Exchange (TPEx, the OTC market) to report its revenue for each month by the 10th of the following month. The exchanges publish these filings as open data. We read the official feeds several times a day during the reporting window (1st–15th of each month) and daily otherwise. Full details are on the <a href="${href('/sources/')}">sources page</a>.</p>
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
<p>Spotted an error? Please <a href="${href('/about/')}">get in touch</a>. Corrections are published, never hidden.</p>`;
  const zh = `
<h1>計算方式</h1>
<p class="lede">${name}如何收集、檢查並呈現台股月營收申報資料。</p>
<h2>數字從哪裡來</h2>
<p>依規定，所有在臺灣證券交易所（上市）或證券櫃檯買賣中心（上櫃）掛牌的公司，都必須在每月10日前公布上個月的營收。交易所會把這些申報以開放資料公開。我們在申報期間（每月1日至15日）每天讀取官方資料數次，其他時間每天一次。詳細來源請見<a href="${href('/sources/')}">資料來源頁</a>。</p>
<h2>單位</h2>
<p>公司申報的單位是新台幣千元。中文版以萬元、億元或兆元顯示。我們不換算成美元，因為匯率波動會扭曲成長率。</p>
<h2>成長率</h2>
<ul>
<li><strong>年增率</strong>：當月營收除以去年同月營收，再減一。</li>
<li><strong>月增率</strong>：與上個月相比。許多公司有季節性，月增率波動常屬正常。</li>
<li><strong>累計年增率</strong>：今年1月至當月的累計營收，與去年同期相比。</li>
<li><strong>合計成長率</strong>（族群、產業或全體市場）以<em>同一批公司</em>計算：只加總兩個期間都有申報的公司，新上市或晚申報的公司不會扭曲比較。</li>
</ul>
<h2>發布前的檢查</h2>
<p>每次更新都會自動檢查。只要有任何一項檢查未通過，該來源的資料就不會發布，我們也會收到通知。</p>
<ul>
<li>我們自行計算的年增率與月增率，必須與交易所隨數字公布的百分比一致。若超過2%的公司不一致，代表欄位可能讀錯，該次更新會被擋下。</li>
<li>金額必須落在合理範圍內（例如台積電的單月營收必須介於100億元到10兆元之間），用來抓出單位錯誤。</li>
<li>日期必須正確，不接受未來的月份。</li>
<li>已發布的數字不會被刪除。公司若修正數字，我們會保留舊數值並標示修正時間。</li>
</ul>
<h2>創新高</h2>
<p>「創新高」是指該公司在本站收錄的歷史資料中單月營收最高，而且要累積至少24個月的資料才會顯示。我們的資料不一定涵蓋公司上市以來的全部歷史，因此代表「本站資料中最高」，不一定是歷史新高。</p>
<h2>供應鏈族群</h2>
<p>「AI伺服器代工」等族群由我們依供應鏈自行挑選，並非官方分類，成員也可能調整。產業別則採用交易所的官方分類。</p>
<h2>公司名稱</h2>
<p>英文名稱來自交易所公司基本資料中的英文簡稱，或公司常用的英文名稱。中英名稱並列，方便對照原始申報。</p>
<h2>限制</h2>
<ul>
<li>月營收由公司自行申報，未經會計師查核。</li>
<li>「首次出現」是數字第一次出現在我們讀取的開放資料中的時間，可能晚於公司實際申報時間。</li>
<li>營收不等於獲利。營收成長也可能伴隨毛利下降。</li>
</ul>
<p>發現錯誤嗎？請<a href="${href('/about/')}">與我們聯絡</a>。修正會公開，不會隱藏。</p>`;
  return layout(ctx, {
    title: L('Methodology', '計算方式'),
    description: L('How we collect, check and calculate Taiwan monthly revenue figures: sources, units, growth rates and validation.', '台股月營收的資料來源、單位、成長率計算方式與發布前檢查。'),
    path: '/methodology/',
    body: isZh() ? zh : en,
  });
}

export function sourcesPage(ctx) {
  const name = esc(siteName(ctx.siteConfig));
  const list = Object.entries(SOURCES).map(([mk, s]) => (isZh()
    ? `<li><strong>${esc(marketLabel(mk))}公司</strong>：${SOURCE_ZH[mk]}，每月營業收入彙總表（<a href="${s.revenue}" rel="nofollow">${esc(s.revenue)}</a>）與公司基本資料（<a href="${s.profile}" rel="nofollow">${esc(s.profile)}</a>）。</li>`
    : `<li><strong>${esc(marketLabel(mk))}</strong>: ${esc(s.label)}, monthly revenue summary (<a href="${s.revenue}" rel="nofollow">${esc(s.revenue)}</a>) and company profiles (<a href="${s.profile}" rel="nofollow">${esc(s.profile)}</a>).</li>`)).join('\n');
  const en = `
<h1>Sources and licence</h1>
<p class="lede">All figures come from official Taiwanese open data.</p>
<h2>Data sources</h2>
<ul>
${list}
<li><strong>History</strong>: the Market Observation Post System (MOPS) monthly revenue summary pages (<a href="${MOPS_HOSTS[0]}" rel="nofollow">${esc(MOPS_HOSTS[0])}</a>).</li>
</ul>
<h2>Licence and attribution</h2>
<p>The source data is published by the Taiwan Stock Exchange Corporation and the Taipei Exchange under the <a href="https://data.gov.tw/license" rel="nofollow">Open Government Data License, version 1.0</a>, which permits commercial and non-commercial use with attribution. Translations, calculations, charts and groupings are by ${name}. The exchanges have not reviewed or endorsed this site.</p>`;
  const zh = `
<h1>資料來源與授權</h1>
<p class="lede">所有數字皆來自臺灣官方開放資料。</p>
<h2>資料來源</h2>
<ul>
${list}
<li><strong>歷史資料</strong>：公開資訊觀測站每月營收彙總表（<a href="${MOPS_HOSTS[0]}" rel="nofollow">${esc(MOPS_HOSTS[0])}</a>）。</li>
</ul>
<h2>授權與標示</h2>
<p>原始資料由臺灣證券交易所與證券櫃檯買賣中心依<a href="https://data.gov.tw/license" rel="nofollow">政府資料開放授權條款第1版</a>提供，允許在標示來源的前提下供商業及非商業使用。翻譯、計算、圖表與族群分類由${name}製作。交易所並未審閱或背書本站。</p>`;
  return layout(ctx, {
    title: L('Sources and licence', '資料來源與授權'),
    description: L('Official data sources for Taiwan monthly revenue and the open data licence.', '台股月營收的官方資料來源與開放資料授權。'),
    path: '/sources/',
    body: isZh() ? zh : en,
  });
}

export function aboutPage(ctx) {
  const cfg = ctx.siteConfig;
  const name = esc(siteName(cfg));
  const contact = cfg.contactEmail
    ? L(`Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>. Reports of errors are especially welcome.`, `Email：<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>。特別歡迎回報錯誤。`)
    : L('Contact details are coming soon.', '聯絡方式即將公布。');
  const en = `
<h1>About</h1>
<p class="lede">${cfg.ownerName ? `${name} is run by ${esc(cfg.ownerName)}, based in Taiwan.` : `${name} is an independent project run from Taiwan.`}</p>
<p>Taiwan's monthly revenue filings are one of the earliest signals of how global technology demand is moving: TSMC, Foxconn, Quanta and hundreds of their suppliers report every month, weeks before most US companies report their quarters. But the filings are published in Chinese, across several government websites, one company at a time.</p>
<p>${name} reads the official open data directly, checks it, translates it and presents it in one place. The free site covers every company. ${cfg.pro.enabled ? 'Pro subscribers get same-day email alerts and full-history downloads, which pays for running the site.' : ''}</p>
<p>We are not affiliated with the Taiwan Stock Exchange, the Taipei Exchange or any company listed here, and nothing on this site is investment advice.</p>
<h2>Contact</h2>
<p>${contact}</p>`;
  const zh = `
<h1>關於本站</h1>
<p class="lede">${cfg.ownerName ? `${name}由${esc(cfg.ownerName)}經營，位於台灣。` : `${name}是在台灣經營的獨立專案。`}</p>
<p>台灣的月營收申報是觀察全球科技需求最早的訊號之一：台積電、鴻海、廣達和數百家供應商每月公布營收，比多數美國公司公布季報早了好幾週。但這些資料分散在不同的政府網站，而且要一家一家查。</p>
<p>${name}直接讀取官方開放資料，經過檢查後整理在同一個地方，並提供中英對照。免費網站涵蓋每一家公司。${cfg.pro.enabled ? 'Pro 會員可在公布當天收到 Email 通知並下載完整歷史資料，這也是本站的營運來源。' : ''}</p>
<p>本站與臺灣證券交易所、證券櫃檯買賣中心及任何上市櫃公司皆無關係，所有內容皆不構成投資建議。</p>
<h2>聯絡我們</h2>
<p>${contact}</p>`;
  return layout(ctx, {
    title: L('About', '關於本站'),
    description: L(`About ${siteName(cfg)}: who runs it and why.`, `關於${siteName(cfg)}：誰在經營，以及為什麼。`),
    path: '/about/',
    body: isZh() ? zh : en,
  });
}

export function pricingPage(ctx) {
  const cfg = ctx.siteConfig;
  const p = cfg.pro;
  const buy = (url, text) => (url ? `<a class="button" data-checkout href="${esc(url)}">${esc(text)}</a>` : '');
  const action = p.enabled
    ? `<p style="display:flex;gap:8px;flex-wrap:wrap">${buy(p.checkoutUrlMonthly, L('Start free trial — monthly', '開始免費試用（月繳）'))}${buy(p.checkoutUrlYearly, L('Yearly', '年繳'))}</p><p class="small muted">${L(`Use the same email to <a href="${href('/account/')}">sign in</a> afterwards.`, `之後請用同一個 Email <a href="${href('/account/')}">登入</a>。`)}</p>`
    : ctx.apiEnabled === false
      ? `<p class="muted">${L('Coming soon.', '即將推出。')}</p>`
      : `<form class="waitlist" data-waitlist><label class="visually-hidden" for="wl-pricing">Email</label><input id="wl-pricing" type="email" name="email" required placeholder="you@example.com"><input type="hidden" name="interest" value="pricing"><button class="button" type="submit">${L('Tell me when it launches', '上線時通知我')}</button><p class="form-msg small" role="status"></p></form>`;
  const body = `
<h1>${p.enabled ? L('Pro: same-day alerts and full history', 'Pro：公布當天通知與完整歷史') : L('Email alerts', 'Email 通知')}</h1>
<p class="lede">${L('The site is free to read, for every company.', '所有公司的資料都可免費瀏覽。')} ${p.enabled ? L('Pro is for people who want the numbers delivered the day they come out.', 'Pro 適合想在公布當天就收到數字的人。') : L('Email alerts are coming soon.', 'Email 通知即將推出。')}</p>
<div class="plans">
<section class="plan"><h2 style="margin-top:0">${L('Free', '免費')}</h2><div class="price">$0</div><ul>
<li>${L('Every listed and OTC company, every month', '每家上市櫃公司、每個月')}</li><li>${L('Charts, 5-year history and official source links', '圖表、五年歷史與官方來源連結')}</li><li>${L('Supply-chain groups and industry pages', '供應鏈族群與產業頁面')}</li><li>${L('Monthly reports archive', '月報彙整')}</li><li>${L("This month's data as a CSV download", '當月資料 CSV 下載')}</li></ul></section>
<section class="plan featured"><h2 style="margin-top:0">Pro</h2><div class="price">US$${p.monthlyPriceUsd}<span class="small muted">${L('/month', '／月')}</span></div><p class="small muted">${L(`or US$${p.yearlyPriceUsd}/year`, `或 US$${p.yearlyPriceUsd}／年`)}</p><ul>
<li>${L(`<strong>Same-day email alerts</strong> for up to ${p.maxWatchlist} companies you choose`, `自選最多 ${p.maxWatchlist} 家公司，<strong>公布當天 Email 通知</strong>`)}</li><li>${L("Summary email when a month's reporting is complete", '當月公布完成時寄送摘要')}</li><li>${L('Full-history downloads (CSV) for every company', '所有公司的完整歷史資料下載（CSV）')}</li><li>${L(`${p.trialDays}-day free trial, cancel any time`, `免費試用 ${p.trialDays} 天，隨時可取消`)}</li></ul>
${action}
</section>
</div>
<h2>${L('Questions', '常見問題')}</h2>
<h3>${L('Who handles payment?', '誰負責收款？')}</h3>
<p>${L('Payments are processed by Lemon Squeezy, which acts as the merchant of record and handles receipts and sales tax. Your card details never reach this site.', '付款由 Lemon Squeezy 處理，由其擔任交易商（merchant of record），負責開立收據與處理各國稅務。你的信用卡資料不會經過本站。')}</p>
<h3>${L('Can I cancel?', '可以取消嗎？')}</h3>
<p>${L('Yes, any time, from the link in your receipt email or your account page. You keep access until the end of the period you paid for.', '可以，隨時都能從收據 Email 中的連結或帳戶頁面取消。已付款的期間結束前仍可繼續使用。')}</p>
<h3>${L('Refunds?', '可以退款嗎？')}</h3>
<p>${L('If you are not happy within 30 days of your first payment, email us and we will refund you in full.', '首次付款後30天內若不滿意，寄信給我們即可全額退款。')}</p>
<h3>${L('How fast are alerts?', '通知有多快？')}</h3>
<p>${L('We check the official data several times a day during the reporting window. Alerts go out within a few hours of a figure appearing in the official open data, usually the same day.', '申報期間我們每天檢查官方資料數次。數字出現在官方開放資料後數小時內就會寄出通知，通常是同一天。')}</p>
`;
  return layout(ctx, {
    title: p.enabled ? L('Pro pricing', 'Pro 方案') : L('Email alerts', 'Email 通知'),
    description: L('Same-day email alerts and full-history downloads for Taiwan monthly revenue filings.', '台股月營收公布當天的 Email 通知與完整歷史資料下載。'),
    path: '/pricing/',
    body,
  });
}

export function accountPage(ctx) {
  const cfg = ctx.siteConfig;
  const body = `
<h1>${L('Your account', '我的帳戶')}</h1>
<div id="account" data-max="${cfg.pro.maxWatchlist}" data-checkout="${esc(cfg.pro.checkoutUrlMonthly)}">
<section class="card" data-view="signin">
<h2 style="margin-top:0">${L('Sign in', '登入')}</h2>
<p>${L('Enter the email you used to subscribe. We will send you a 6-digit code. No password needed.', '輸入你訂閱時使用的 Email，我們會寄給你6位數驗證碼，不需要密碼。')}</p>
<form data-signin style="display:flex;gap:8px;flex-wrap:wrap"><label class="visually-hidden" for="email">Email</label><input id="email" type="email" name="email" required placeholder="you@example.com"><button class="button" type="submit">${L('Send code', '寄送驗證碼')}</button></form>
<form data-verify hidden style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><label class="visually-hidden" for="code">${L('Code', '驗證碼')}</label><input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="123456"><button class="button" type="submit">${L('Sign in', '登入')}</button></form>
<p class="form-msg small" role="status"></p>
</section>
<section data-view="dashboard" hidden>
<section class="card"><h2 style="margin-top:0">${L('Subscription', '訂閱')}</h2><p data-status></p><p data-manage></p><p><button class="button secondary" data-signout type="button">${L('Sign out', '登出')}</button></p></section>
<section class="card" data-pro-only><h2 style="margin-top:0">${L('Watchlist', '追蹤清單')}</h2>
<p class="small muted">${L(`You get one email when any of these companies reports, plus a summary when the month is complete. Up to ${cfg.pro.maxWatchlist} companies.`, `清單中的公司公布營收時，你會收到一封 Email；當月公布完成時另寄摘要。最多 ${cfg.pro.maxWatchlist} 家公司。`)}</p>
<form data-add style="display:flex;gap:8px;flex-wrap:wrap;position:relative"><label class="visually-hidden" for="add">${L('Add company', '新增公司')}</label><input id="add" type="text" placeholder="${L('Add a company: 2330, Quanta…', '新增公司：2330、台積電…')}" autocomplete="off" style="flex:1 1 220px"><button class="button" type="submit">${L('Add', '新增')}</button><ul class="search-results" hidden></ul></form>
<ul data-watchlist class="link-list" style="margin-top:12px"></ul>
<p><label><input type="checkbox" data-alerts> ${L('Send me alert emails', '寄送通知 Email 給我')}</label></p>
<p class="form-msg small" role="status" data-watch-msg></p>
</section>
<section class="card" data-pro-only><h2 style="margin-top:0">${L('Downloads', '下載')}</h2><p><a data-download="full" href="#">${L('Full history, all companies (CSV)', '所有公司完整歷史（CSV）')}</a></p><p class="small muted">${L('Updated after every data change. UTF-8 CSV; amounts in thousand NT$ as filed.', '每次資料更新後同步更新。UTF-8 CSV；金額單位為申報時的新台幣千元。')}</p></section>
</section>
</div>
<script src="/assets/account.js?v=${ctx.buildId}" defer></script>
`;
  return layout(ctx, { title: L('Account', '我的帳戶'), description: L('Manage your alerts and downloads.', '管理你的通知與下載。'), path: '/account/', body, noindex: true });
}

export function privacyPage(ctx) {
  const cfg = ctx.siteConfig;
  const mail = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : '';
  const en = `
<h1>Privacy</h1>
<p class="lede">We collect as little as possible.</p>
<ul>
<li><strong>Reading the site</strong> needs no account. We do not use advertising or tracking cookies. Our host keeps standard server logs for security.</li>
<li><strong>If you leave your email</strong> (waitlist or sign-in), we store it to send you what you asked for: the launch notice, sign-in codes and, for Pro, your alerts. We never sell or share it.</li>
<li><strong>Pro subscribers</strong>: payment is handled by Lemon Squeezy, which tells us your email and subscription status; we never see card details. We store your watchlist and alert settings.</li>
<li><strong>Emails</strong> are delivered through Resend. A sign-in cookie keeps you logged in for 30 days; it is used for nothing else.</li>
<li><strong>Deleting your data</strong>: ${mail ? `email ${mail}` : 'contact us'} and we will delete your email, watchlist and sign-in records.</li>
</ul>`;
  const zh = `
<h1>隱私權</h1>
<p class="lede">我們盡可能少收集資料。</p>
<ul>
<li><strong>瀏覽網站</strong>不需要帳號。我們不使用廣告或追蹤 Cookie。主機商會為了安全保留一般伺服器紀錄。</li>
<li><strong>如果你留下 Email</strong>（等候名單或登入），我們只會用來寄送你要求的內容：上線通知、登入驗證碼，以及 Pro 會員的營收通知。我們絕不販售或分享你的 Email。</li>
<li><strong>Pro 會員</strong>：付款由 Lemon Squeezy 處理，他們只會告訴我們你的 Email 與訂閱狀態，我們看不到信用卡資料。我們會儲存你的追蹤清單與通知設定。</li>
<li><strong>Email</strong> 透過 Resend 寄送。登入 Cookie 會讓你保持登入30天，不做其他用途。</li>
<li><strong>刪除資料</strong>：${mail ? `寄信至${mail}` : '與我們聯絡'}，我們會刪除你的 Email、追蹤清單與登入紀錄。</li>
</ul>`;
  return layout(ctx, { title: L('Privacy', '隱私權'), description: L('What data we collect and why.', '我們收集哪些資料，以及原因。'), path: '/privacy/', body: isZh() ? zh : en });
}

export function termsPage(ctx) {
  const name = esc(siteName(ctx.siteConfig));
  const en = `
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
<p>To the extent the law allows, ${name} is not liable for losses arising from use of the site or its data.</p>`;
  const zh = `
<h1>使用條款</h1>
<h2>不構成投資建議</h2>
<p>${name}轉載並整理公開的公司申報資料。本站及我們寄出的 Email 中的任何內容，都不是買賣任何有價證券的建議。請自行研究判斷。</p>
<h2>正確性</h2>
<p>我們會盡力完整呈現官方數字並自動檢查，但資料以「現況」提供。公司可能修正數字，也可能出現錯誤。重要數字請務必與連結的官方來源核對。</p>
<h2>訂閱</h2>
<p>Pro 訂閱會自動續訂，直到你取消為止。你可隨時取消，並在已付款期間結束前繼續使用。首次付款後30天內若不滿意，提出申請即可全額退款。</p>
<h2>合理使用</h2>
<p>請勿轉售我們的下載檔案，或大量轉寄通知 Email。歡迎引用數字並附上本站連結。</p>
<h2>責任</h2>
<p>在法律允許的範圍內，${name}對於使用本站或其資料所造成的損失不負賠償責任。</p>`;
  return layout(ctx, { title: L('Terms of use', '使用條款'), description: L('Terms of use, including our not-investment-advice notice.', '使用條款，包含不構成投資建議的聲明。'), path: '/terms/', body: isZh() ? zh : en });
}

export function companiesDirectory(ctx) {
  const { ds } = ctx;
  const list = [...ds.companies.values()].filter((c) => ds.series.has(c.code));
  const body = `
<h1>${L(`All companies (${int(list.length)})`, `全部公司（${int(list.length)}家）`)}</h1>
<p class="lede">${L('Every Taiwan-listed and OTC company with monthly revenue on file.', '所有有月營收資料的上市櫃公司。')}</p>
<div class="table-wrap"><table><thead><tr><th>${L('Code', '代號')}</th><th>${L('Company', '公司')}</th><th>${L('Industry', '產業')}</th><th>${L('Market', '市場')}</th></tr></thead><tbody>
${list.map((c) => `<tr><td>${esc(c.code)}</td><td class="name"><a href="${companyHref(c.code)}">${esc(c.display)}</a>${c.altName && c.altName !== c.display ? ` <span class="zh">${esc(c.altName)}</span>` : ''}</td><td><a href="${href(`/industries/${c.industrySlug}/`)}">${esc(c.industry)}</a></td><td>${esc(marketLabel(c.market))}</td></tr>`).join('\n')}
</tbody></table></div>`;
  return layout(ctx, {
    title: L('All companies', '全部公司'),
    description: L('Directory of every Taiwan-listed and OTC company with monthly revenue history in English.', '所有上市櫃公司的月營收歷史目錄，中英對照。'),
    path: '/companies/',
    body,
  });
}

export function searchPage(ctx) {
  const body = `
<h1>${L('Search', '搜尋')}</h1>
<form action="${href('/search/')}" style="display:flex;gap:8px;flex-wrap:wrap"><label class="visually-hidden" for="q2">${L('Company name or code', '公司名稱或代號')}</label><input id="q2" name="q" type="text" placeholder="${L('Company name or code', '公司名稱或代號')}" style="flex:1 1 240px"><button class="button" type="submit">${L('Search', '搜尋')}</button></form>
<ul id="search-page-results" class="link-list" style="margin-top:16px"></ul>
<noscript><p>${L(`Search needs JavaScript. Browse the <a href="${href('/companies/')}">full company list</a> instead.`, `搜尋需要 JavaScript。請改為瀏覽<a href="${href('/companies/')}">全部公司列表</a>。`)}</p></noscript>
<p class="small muted">${L(`Or browse <a href="${href('/companies/')}">all companies</a>.`, `或瀏覽<a href="${href('/companies/')}">全部公司</a>。`)}</p>`;
  return layout(ctx, { title: L('Search', '搜尋'), description: L('Search Taiwan-listed companies by name or stock code.', '用公司名稱或股票代號搜尋上市櫃公司。'), path: '/search/', body, noindex: true });
}

// One 404 page serves both languages, so it is bilingual.
export function notFoundPage(ctx) {
  return layout(ctx, {
    title: 'Page not found · 找不到頁面',
    description: 'Page not found.',
    path: '/404',
    noindex: true,
    body: `<h1>Page not found · 找不到頁面</h1><p>Try the search box above, or browse <a href="/companies/">all companies</a>.</p><p lang="zh-Hant">請使用上方的搜尋，或瀏覽<a href="/zh/companies/">全部公司</a>。</p>`,
  });
}
