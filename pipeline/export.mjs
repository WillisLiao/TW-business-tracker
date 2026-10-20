// Writes the Pro full-history download to out/exports/full.csv.
// A gzipped copy (full.csv.gz) is what the GitHub Action uploads to the KV
// namespace that /api/download serves from.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadDataset } from '../site/lib/data.mjs';
import { toCsv } from '../site/lib/csv.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const dataDir = opt('--data', 'data');
const outDir = opt('--out', 'out');

const ds = loadDataset(dataDir);
fs.mkdirSync(path.join(outDir, 'exports'), { recursive: true });
const file = path.join(outDir, 'exports', 'full.csv');
const csv = toCsv(ds, ds.periods);
fs.writeFileSync(file, csv);
fs.writeFileSync(`${file}.gz`, zlib.gzipSync(csv, { level: 9 }));
console.log(`Wrote ${file} (${(csv.length / 1e6).toFixed(1)} MB, ${(fs.statSync(`${file}.gz`).size / 1e6).toFixed(1)} MB gzipped, ${ds.periods.length} months).`);
