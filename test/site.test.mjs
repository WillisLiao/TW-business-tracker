import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setLang } from '../site/lib/lang.mjs';
import { ntd, compact, date, dateTime } from '../site/lib/format.mjs';

test('Chinese number and date formats follow Taiwan conventions', () => {
  setLang('zh');
  try {
    assert.equal(ntd(511857399), '5,118.6億元');
    assert.equal(ntd(1158633235), '1.16兆元');
    assert.equal(ntd(59037), '5,904萬元');
    assert.equal(ntd(1000000, { digits: 0 }), '10億元');
    assert.equal(compact(400000000), '4,000億');
    assert.equal(date('2026-10-20T03:39:00Z'), '2026年10月20日');
    assert.equal(dateTime('2026-10-20T03:39:00Z'), '2026年10月20日 11:39（台北時間）');
  } finally {
    setLang('en');
  }
  assert.equal(ntd(511857399), 'NT$511.9B');
});

test('site builds in English and Chinese with matching pages', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trt-site-'));
  const data = path.join(tmp, 'data');
  const out = path.join(tmp, 'dist');
  const gen = spawnSync(process.execPath, ['test/make-sample-data.mjs', data], { encoding: 'utf8' });
  assert.equal(gen.status, 0, gen.stderr);
  const build = spawnSync(process.execPath, ['site/build.mjs', '--data', data, '--out', out, '--sample'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const en = fs.readFileSync(path.join(out, 'company/2330/index.html'), 'utf8');
  const zh = fs.readFileSync(path.join(out, 'zh/company/2330/index.html'), 'utf8');
  assert.match(en, /<html lang="en"/);
  assert.match(en, /NT\$/);
  assert.match(en, /href="\/zh\/company\/2330\/"[^>]*>中文</);
  assert.match(zh, /<html lang="zh-Hant-TW"/);
  assert.match(zh, /月營收/);
  assert.match(zh, /億元/);
  assert.match(zh, /年增率/);
  assert.match(zh, /href="\/company\/2330\/"[^>]*>English</);
  assert.match(zh, /hreflang="zh-Hant-TW" href="[^"]*\/zh\/company\/2330\/"/);
  // Internal links on Chinese pages stay in Chinese.
  const internal = [...zh.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('/assets/'));
  const english = internal.filter((h) => !h.startsWith('/zh/') && h !== '/company/2330/');
  assert.deepEqual(english, [], 'Chinese page links to English pages');
  // Every Chinese page has an English twin and vice versa.
  const list = (d) => fs.readdirSync(d, { recursive: true }).filter((f) => f.endsWith('index.html'));
  const enPages = new Set(list(out).filter((f) => !f.startsWith('zh')));
  const zhPages = new Set(list(path.join(out, 'zh')));
  assert.deepEqual([...zhPages].sort(), [...enPages].sort());
  const sitemap = fs.readFileSync(path.join(out, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /\/zh\/company\/2330\//);
});
