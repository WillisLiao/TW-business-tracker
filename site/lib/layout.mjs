import { esc } from './format.mjs';
import { L, href, htmlLang, isZh, pathIn } from './lang.mjs';

export const siteName = (cfg) => L(cfg.siteName, cfg.siteNameZh || cfg.siteName);
export const tagline = (cfg) => L(cfg.tagline, cfg.taglineZh || cfg.tagline);

// pagePath is the language-neutral path ("/company/2330/"); the Chinese copy
// of every page lives at "/zh" + pagePath.
export function layout(ctx, { title, description, path: pagePath, body, noindex = false, jsonLd = null, wide = false }) {
  const { siteConfig: cfg, sample, buildId } = ctx;
  const base = cfg.siteUrl.replace(/\/$/, '');
  const name = siteName(cfg);
  const here = href(pagePath);
  const other = pathIn(isZh() ? 'en' : 'zh', pagePath);
  const fullTitle = pagePath === '/' ? `${name} \u2014 ${tagline(cfg)}` : `${title} | ${name}`;
  const proLink = cfg.pro.enabled ? `<a href="${href('/account/')}">${L('Account', '帳戶')}</a>` : '';
  return `<!doctype html>
<html lang="${htmlLang()}" data-build="${buildId}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(base + here)}">
<link rel="alternate" hreflang="en" href="${esc(base + pathIn('en', pagePath))}">
<link rel="alternate" hreflang="zh-Hant-TW" href="${esc(base + pathIn('zh', pagePath))}">
<link rel="alternate" hreflang="x-default" href="${esc(base + pathIn('en', pagePath))}">
${noindex || sample || ctx.noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(base + here)}">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:locale" content="${L('en_US', 'zh_TW')}">
<meta property="og:image" content="${esc(base)}/share/latest-groups.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/styles.css?v=${buildId}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
${sample ? `<div class="sample-banner" role="alert">${L('SAMPLE DATA \u2014 every number on this preview is invented for testing. Not real company revenue.', '範例資料：此預覽中的所有數字皆為測試用的虛構數字，並非真實營收。')}</div>` : ''}
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${href('/')}"><span class="brand-mark" aria-hidden="true"></span>${esc(name)}</a>
    <nav class="nav" aria-label="${L('Main', '主選單')}">
      <a href="${href('/groups/')}">${L('Groups', '供應鏈族群')}</a>
      <a href="${href('/reporting/')}">${L('Reporting now', '公布進度')}</a>
      <a href="${href('/reports/')}">${L('Monthly reports', '月報')}</a>
      <a href="${href('/pricing/')}">${cfg.pro.enabled ? 'Pro' : L('Alerts', '通知')}</a>
      ${proLink}
      <a class="lang-switch" href="${esc(other)}" hreflang="${isZh() ? 'en' : 'zh-Hant-TW'}" lang="${isZh() ? 'en' : 'zh-Hant-TW'}">${isZh() ? 'English' : '中文'}</a>
    </nav>
    <form class="search" role="search" action="${href('/search/')}" autocomplete="off">
      <label class="visually-hidden" for="q">${L('Search companies', '搜尋公司')}</label>
      <input id="q" name="q" type="search" placeholder="${L('Search 2330, Quanta, \u53f0\u7a4d\u96fb\u2026', '搜尋 2330、台積電、Quanta\u2026')}" data-search>
      <ul class="search-results" hidden></ul>
    </form>
  </div>
</header>
<main class="wrap${wide ? ' wide' : ''}">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p><strong>${esc(name)}</strong> \u2014 ${esc(tagline(cfg))}</p>
      <p class="muted small">${L('Data: Taiwan Stock Exchange and Taipei Exchange open data, under the Open Government Data License, version 1.0. Not investment advice.', '資料來源：臺灣證券交易所、證券櫃檯買賣中心開放資料，依政府資料開放授權條款第1版使用。本站內容不構成投資建議。')}</p>
    </div>
    <nav aria-label="${L('Footer', '頁尾')}">
      <a href="${href('/methodology/')}">${L('Methodology', '計算方式')}</a>
      <a href="${href('/sources/')}">${L('Sources &amp; licence', '資料來源與授權')}</a>
      <a href="${href('/about/')}">${L('About', '關於本站')}</a>
      <a href="${href('/privacy/')}">${L('Privacy', '隱私權')}</a>
      <a href="${href('/terms/')}">${L('Terms', '使用條款')}</a>
    </nav>
  </div>
</footer>
<div class="tooltip" role="status" hidden></div>
<script src="/assets/app.js?v=${buildId}" defer></script>
</body>
</html>
`;
}

export function statTile(label, value, { delta = '', deltaClass = '', note = '' } = {}) {
  return `<div class="tile"><div class="tile-label">${esc(label)}</div><div class="tile-value">${esc(value)}</div>${delta ? `<div class="tile-delta ${deltaClass}">${esc(delta)}</div>` : ''}${note ? `<div class="tile-note">${note}</div>` : ''}</div>`;
}

export function meter(share, label) {
  const p = Math.max(0, Math.min(1, share));
  return `<div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}" aria-label="${esc(label)}"><div class="meter-fill" style="width:${(p * 100).toFixed(1)}%"></div></div>`;
}

// items: [[languageNeutralPath, label], ...]; the last item is the current page.
export function breadcrumbs(items) {
  return `<nav class="crumbs" aria-label="${L('Breadcrumb', '導覽路徑')}">${items.map(([p, label], i) => (i < items.length - 1 ? `<a href="${esc(href(p))}">${esc(label)}</a><span aria-hidden="true">/</span>` : `<span>${esc(label)}</span>`)).join('')}</nav>`;
}

export function proCta(ctx, { heading, text, watch = '' } = {}) {
  const cfg = ctx.siteConfig;
  const h = heading || L('Get an email the day these numbers come out', '新數字公布當天，用 Email 通知你');
  if (cfg.pro.enabled) {
    const pitch = L(
      `Pro sends same-day alerts for up to ${cfg.pro.maxWatchlist} companies, plus full-history downloads. ${cfg.pro.trialDays}-day free trial, cancel any time.`,
      `Pro 會員可追蹤最多 ${cfg.pro.maxWatchlist} 家公司，公布當天收到通知，並可下載完整歷史資料。免費試用 ${cfg.pro.trialDays} 天，隨時可取消。`);
    return `<aside class="cta"><div><h2>${esc(h)}</h2><p>${esc(text || pitch)}</p></div><a class="button" href="${href('/pricing/')}${watch ? `?watch=${esc(watch)}` : ''}">${L('See Pro', '了解 Pro')}</a></aside>`;
  }
  if (ctx.apiEnabled === false) {
    return `<aside class="cta"><div><h2>${esc(h)}</h2><p>${L('Email alerts are coming soon.', 'Email 通知即將推出。')}</p></div></aside>`;
  }
  return `<aside class="cta"><div><h2>${esc(h)}</h2><p>${esc(text || L('Email alerts are coming soon. Leave your email and we will tell you once when they launch. No spam, no sharing.', 'Email 通知即將推出。留下 Email，上線時我們只通知你一次，不寄垃圾信，也不分享你的資料。'))}</p></div>
<form class="waitlist" data-waitlist><label class="visually-hidden" for="wl-${watch || 'x'}">Email</label><input id="wl-${watch || 'x'}" type="email" name="email" required placeholder="you@example.com"><input type="hidden" name="interest" value="${esc(watch)}"><button class="button" type="submit">${L('Notify me', '通知我')}</button><p class="form-msg small" role="status"></p></form></aside>`;
}
