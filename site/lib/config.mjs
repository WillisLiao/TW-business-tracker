// site.config.json plus environment overrides, shared by the build, share images
// and alert scripts so they all agree on the site's address.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

export function loadSiteConfig(env = process.env) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
  if (env.SITE_URL) cfg.siteUrl = env.SITE_URL;
  else if (env.VERCEL_PROJECT_PRODUCTION_URL) cfg.siteUrl = `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.PRO_ENABLED) cfg.pro.enabled = env.PRO_ENABLED === 'true';
  // Preview hosting (e.g. Vercel) has no /api backend.
  if (env.API_ENABLED === 'false') cfg.pro.enabled = false;
  return cfg;
}
