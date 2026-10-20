// Builds the static site into dist/.
// Usage: node site/build.mjs [--data data] [--out dist] [--sample]
// --sample marks every page with a "SAMPLE DATA" banner and noindex; it is for
// local previews only and is refused when the config points at a real domain.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadDataset } from './lib/data.mjs';
import { loadSiteConfig } from './lib/config.mjs';
import { LANGS, setLang } from './lib/lang.mjs';
import { toCsv } from './lib/csv.mjs';
import { homePage } from './pages/home.mjs';
import { companyPage } from './pages/company.mjs';
import { basketPage, groupsIndex, industryPage } from './pages/groups.mjs';
import { reportingPage, monthlyReport, reportsIndex } from './pages/reporting.mjs';
import { methodologyPage, sourcesPage, aboutPage, pricingPage, accountPage, privacyPage, termsPage, companiesDirectory, searchPage, notFoundPage } from './pages/static.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const outDir = opt('--out', 'dist');
const sample = args.includes('--sample');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const siteConfig = loadSiteConfig();
// Preview hosting (e.g. Vercel) has no /api backend, and should stay out of search
// results so it never competes with the real domain later.
const apiEnabled = process.env.API_ENABLED !== 'false';
const noindex = process.env.NOINDEX === 'true';

const sampleFlag = fs.existsSync(path.join(dataDir, 'SAMPLE'));
if (sampleFlag && !sample) {
  console.error(`Refusing to build: ${dataDir} contains invented sample data. Use --sample for a local preview.`);
  process.exit(1);
}

const started = Date.now();
const ds = loadDataset(dataDir, { siteConfig });
// Content hash of the assets: pages only change when data or assets change, so
// unchanged pages are not re-uploaded on deploy.
const assetHash = crypto.createHash('sha256');
for (const f of fs.readdirSync(path.join(root, 'site/assets')).sort()) assetHash.update(fs.readFileSync(path.join(root, 'site/assets', f)));
const ctx = { ds, siteConfig, sample, noindex, apiEnabled, buildId: assetHash.digest('hex').slice(0, 10) };

fs.rmSync(outDir, { recursive: true, force: true });
let pages = 0;
const sitemap = [];
function write(urlPath, html, { inSitemap = true } = {}) {
  if (html == null) return;
  const file = urlPath.endsWith('/') ? path.join(outDir, urlPath, 'index.html') : path.join(outDir, urlPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  pages++;
  if (inSitemap && urlPath.endsWith('/')) sitemap.push(urlPath);
}

// Every page is rendered once per language: English at /, Chinese at /zh/.
for (const lang of LANGS) {
  setLang(lang);
  const at = (p) => (lang === 'zh' ? `/zh${p}` : p);
  write(at('/'), homePage(ctx));
  for (const code of ds.series.keys()) write(at(`/company/${encodeURIComponent(code)}/`), companyPage(ctx, code));
  if (ds.latestPeriod) {
    write(at('/groups/'), groupsIndex(ctx));
    for (const b of ds.baskets) write(at(`/groups/${b.slug}/`), basketPage(ctx, b));
    for (const ind of ds.industriesIndex()) write(at(`/industries/${ind.slug}/`), industryPage(ctx, ind));
    write(at('/reporting/'), reportingPage(ctx));
    write(at('/reports/'), reportsIndex(ctx));
    for (const p of ds.periods) write(at(`/reports/${p}/`), monthlyReport(ctx, p));
  }
  write(at('/companies/'), companiesDirectory(ctx));
  write(at('/methodology/'), methodologyPage(ctx));
  write(at('/sources/'), sourcesPage(ctx));
  write(at('/about/'), aboutPage(ctx));
  write(at('/pricing/'), pricingPage(ctx));
  write(at('/privacy/'), privacyPage(ctx));
  write(at('/terms/'), termsPage(ctx));
  write(at('/account/'), accountPage(ctx), { inSitemap: false });
  write(at('/search/'), searchPage(ctx), { inSitemap: false });
}
setLang('en');
write('/404.html', notFoundPage(ctx));

// Assets.
fs.cpSync(path.join(root, 'site/assets'), path.join(outDir, 'assets'), { recursive: true });

// Search index: code, English name, Chinese name (shared by both languages).
const index = [...ds.companies.values()].filter((c) => ds.series.has(c.code)).map((c) => [c.code, c.nameEn || c.nameZh || c.code, c.nameZh]);
fs.writeFileSync(path.join(outDir, 'assets/search-index.json'), JSON.stringify(index));

// Free download: the latest month.
if (ds.latestPeriod) {
  fs.mkdirSync(path.join(outDir, 'downloads'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'downloads/latest-month.csv'), toCsv(ds, [ds.latestPeriod]));
}

const base = siteConfig.siteUrl.replace(/\/$/, '');
fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `<url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(outDir, 'robots.txt'), sample || noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /account/\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);

// Assets are requested with ?v=<buildId>, so they can be cached for a long time.
fs.writeFileSync(path.join(outDir, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self' https://*.lemonsqueezy.com; base-uri 'self'; frame-ancestors 'none'
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);

console.log(`Built ${pages} pages into ${outDir}/ in ${((Date.now() - started) / 1000).toFixed(1)}s (${ds.companies.size} companies, ${ds.periods.length} months${sample ? ', SAMPLE DATA' : ''}).`);
const missing = ds.baskets.flatMap((b) => b.members.filter((m) => !ds.series.has(m.code)).map((m) => `${b.slug}:${m.code}`));
if (missing.length && ds.periods.length) console.log(`Note: group members with no data yet: ${missing.join(', ')}`);
