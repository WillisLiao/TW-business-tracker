import { esc } from './format.mjs';

export function layout(ctx, { title, description, path: pagePath, body, noindex = false, jsonLd = null, wide = false }) {
  const { siteConfig: cfg, sample, buildId } = ctx;
  const canonical = cfg.siteUrl.replace(/\/$/, '') + pagePath;
  const fullTitle = pagePath === '/' ? `${cfg.siteName} \u2014 ${cfg.tagline}` : `${title} | ${cfg.siteName}`;
  const proLink = cfg.pro.enabled ? '<a href="/account/">Account</a>' : '';
  return `<!doctype html>
<html lang="en" data-build="${buildId}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${noindex || sample ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:image" content="${esc(cfg.siteUrl.replace(/\/$/, ''))}/share/latest-groups.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/styles.css?v=${buildId}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
${sample ? '<div class="sample-banner" role="alert">SAMPLE DATA \u2014 every number on this preview is invented for testing. Not real company revenue.</div>' : ''}
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span>${esc(cfg.siteName)}</a>
    <nav class="nav" aria-label="Main">
      <a href="/groups/">Groups</a>
      <a href="/reporting/">Reporting now</a>
      <a href="/reports/">Monthly reports</a>
      <a href="/pricing/">${cfg.pro.enabled ? 'Pro' : 'Alerts'}</a>
      ${proLink}
    </nav>
    <form class="search" role="search" action="/search/" autocomplete="off">
      <label class="visually-hidden" for="q">Search companies</label>
      <input id="q" name="q" type="search" placeholder="Search 2330, Quanta, \u53f0\u7a4d\u96fb\u2026" data-search>
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
      <p><strong>${esc(cfg.siteName)}</strong> \u2014 ${esc(cfg.tagline)}</p>
      <p class="muted small">Data: Taiwan Stock Exchange and Taipei Exchange open data, under the Open Government Data License, version 1.0. Not investment advice.</p>
    </div>
    <nav aria-label="Footer">
      <a href="/methodology/">Methodology</a>
      <a href="/sources/">Sources &amp; licence</a>
      <a href="/about/">About</a>
      <a href="/privacy/">Privacy</a>
      <a href="/terms/">Terms</a>
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

export function breadcrumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([href, label], i) => (i < items.length - 1 ? `<a href="${esc(href)}">${esc(label)}</a><span aria-hidden="true">/</span>` : `<span>${esc(label)}</span>`)).join('')}</nav>`;
}

export function proCta(ctx, { heading, text, watch = '' } = {}) {
  const cfg = ctx.siteConfig;
  const h = heading || 'Get an email the day these numbers come out';
  if (cfg.pro.enabled) {
    return `<aside class="cta"><div><h2>${esc(h)}</h2><p>${esc(text || `Pro sends same-day alerts for up to ${cfg.pro.maxWatchlist} companies, plus full-history downloads. ${cfg.pro.trialDays}-day free trial, cancel any time.`)}</p></div><a class="button" href="/pricing/${watch ? `?watch=${esc(watch)}` : ''}">See Pro</a></aside>`;
  }
  return `<aside class="cta"><div><h2>${esc(h)}</h2><p>${esc(text || 'Email alerts are coming soon. Leave your email and we will tell you once when they launch. No spam, no sharing.')}</p></div>
<form class="waitlist" data-waitlist><label class="visually-hidden" for="wl-${watch || 'x'}">Email</label><input id="wl-${watch || 'x'}" type="email" name="email" required placeholder="you@example.com"><input type="hidden" name="interest" value="${esc(watch)}"><button class="button" type="submit">Notify me</button><p class="form-msg small" role="status"></p></form></aside>`;
}
