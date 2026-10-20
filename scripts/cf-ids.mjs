// Prints the Cloudflare D1 database id and KV namespace id for wrangler.toml, as
// "<d1-id> <kv-id>". Used by the GitHub Actions (needs CLOUDFLARE_API_TOKEN).

import { execFileSync } from 'node:child_process';

// Tolerates banner lines around the JSON array that wrangler prints.
const run = (args) => {
  const out = execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out.slice(out.search(/^\s*\[/m), out.lastIndexOf(']') + 1));
};

const d1 = run(['d1', 'list', '--json']).find((d) => d.name === 'taiwan-monthly');
const kv = run(['kv', 'namespace', 'list']).find((n) => /taiwan-monthly-exports/.test(n.title));
if (!d1 || !kv) {
  console.error('Cloudflare resources not found. Run the "Set up Cloudflare" workflow first.');
  process.exit(1);
}
console.log(`${d1.uuid || d1.id || d1.database_id} ${kv.id}`);
