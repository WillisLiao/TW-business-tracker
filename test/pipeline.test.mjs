import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parsePeriod, addMonths, latestPossiblePeriod, toRoc } from '../pipeline/lib/period.mjs';
import { resolveFields, normaliseRevenueRows, parseNumber, FieldMappingError, normaliseProfileRows } from '../pipeline/lib/fields.mjs';
import { validateBatch } from '../pipeline/lib/validate.mjs';
import { mergeRecords, readPeriod, listPeriods } from '../pipeline/lib/store.mjs';
import { decodeMopsHtml, parseMopsSummary } from '../pipeline/lib/mops.mjs';

const fixtures = new URL('./fixtures/', import.meta.url).pathname;
const twse = JSON.parse(fs.readFileSync(path.join(fixtures, 'TWSE.json'), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'trt-'));
// The fixtures are for September 2026, so validate "as of" October 2026.
const OCT_2026 = new Date('2026-10-15T00:00:00Z');

test('parsePeriod handles ROC and Gregorian formats', () => {
  assert.equal(parsePeriod('11509'), '2026-09');
  assert.equal(parsePeriod('11512'), '2026-12');
  assert.equal(parsePeriod('9912'), '2010-12');
  assert.equal(parsePeriod('115/9'), '2026-09');
  assert.equal(parsePeriod('202609'), '2026-09');
  assert.equal(parsePeriod('2026-09'), '2026-09');
  assert.equal(parsePeriod('11513'), null);
  assert.equal(parsePeriod(''), null);
  assert.deepEqual(toRoc('2026-09'), { rocYear: 115, month: 9 });
});

test('month arithmetic and latest possible period (Taipei time)', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2025-12', 1), '2026-01');
  // 2026-10-31 20:00 UTC is already 1 November in Taipei.
  assert.equal(latestPossiblePeriod(new Date('2026-10-31T20:00:00Z')), '2026-10');
  assert.equal(latestPossiblePeriod(new Date('2026-10-15T00:00:00Z')), '2026-09');
});

test('parseNumber', () => {
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('-12.5'), -12.5);
  assert.equal(parseNumber('-'), null);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(' 42 '), 42);
});

test('resolveFields maps the documented TWSE Chinese keys', () => {
  const map = resolveFields(twse);
  assert.equal(map.rev, '營業收入-當月營收');
  assert.equal(map.ya, '營業收入-去年當月營收');
  assert.equal(map.yoyPct, '營業收入-去年同月增減(%)');
  assert.equal(map.ytd, '累計營業收入-當月累計營收');
  assert.equal(map.ytdPrev, '累計營業收入-去年累計營收');
  assert.equal(map.period, '資料年月');
});

test('resolveFields copes with plausible English keys', () => {
  const rows = [{ SecuritiesCompanyCode: '3000', CompanyName: 'X', DataYearMonth: '11509', Revenue_CurrentMonth: '100', Revenue_LastYearCurrentMonth: '80', Revenue_LastMonth: '90' }];
  const map = resolveFields(rows);
  assert.equal(map.code, 'SecuritiesCompanyCode');
  assert.equal(map.rev, 'Revenue_CurrentMonth');
  assert.equal(map.ya, 'Revenue_LastYearCurrentMonth');
  assert.equal(map.prev, 'Revenue_LastMonth');
});

test('missing required field throws with the received keys listed', () => {
  assert.throws(() => resolveFields([{ foo: 1, bar: 2 }]), (err) => err instanceof FieldMappingError && /foo/.test(err.message));
});

test('normaliseRevenueRows produces typed records', () => {
  const { records } = normaliseRevenueRows(twse, 'TWSE');
  const tsmc = records.find((r) => r.code === '2330');
  assert.equal(tsmc.period, '2026-09');
  assert.equal(tsmc.rev, 330000000);
  assert.equal(tsmc.ya, 250000000);
  assert.equal(tsmc.yoyPct, 32);
  assert.equal(tsmc.note, '');
  assert.equal(records.length, twse.length);
});

test('validateBatch accepts consistent data', () => {
  const { records } = normaliseRevenueRows(twse, 'TWSE');
  const { errors } = validateBatch(records, { market: 'TWSE', now: OCT_2026 });
  assert.deepEqual(errors, []);
});

test('validateBatch blocks swapped columns', () => {
  const { records } = normaliseRevenueRows(twse, 'TWSE');
  const swapped = records.map((r) => ({ ...r, ya: r.prev, prev: r.ya }));
  const { errors } = validateBatch(swapped, { market: 'TWSE', now: OCT_2026 });
  assert.ok(errors.some((e) => /YoY/.test(e)), errors.join('\n'));
});

test('validateBatch blocks wrong units and future periods', () => {
  const { records } = normaliseRevenueRows(twse, 'TWSE');
  const inDollars = records.map((r) => ({ ...r, rev: r.rev * 1000, ya: r.ya * 1000, prev: r.prev * 1000 }));
  assert.ok(validateBatch(inDollars, { market: 'TWSE', now: OCT_2026 }).errors.some((e) => /units/.test(e)));
  const future = records.map((r) => ({ ...r, period: '2027-01' }));
  assert.ok(validateBatch(future, { market: 'TWSE', now: OCT_2026 }).errors.some((e) => /future/.test(e)));
});

test('mergeRecords adds, ignores repeats, keeps revisions and never deletes', () => {
  const dir = tmp();
  const { records } = normaliseRevenueRows(twse, 'TWSE');
  const first = mergeRecords(dir, records, { now: '2026-10-08T00:00:00Z', source: 'TWSE' });
  assert.equal(first.added.length, records.length);
  const again = mergeRecords(dir, records, { now: '2026-10-08T02:00:00Z', source: 'TWSE' });
  assert.equal(again.added.length, 0);
  assert.equal(again.touched.length, 0);
  const corrected = records.map((r) => (r.code === '2330' ? { ...r, rev: r.rev + 1000 } : r));
  const third = mergeRecords(dir, corrected.slice(0, 5), { now: '2026-10-09T00:00:00Z', source: 'TWSE' });
  assert.equal(third.revised.length, 1);
  const file = readPeriod(dir, '2026-09');
  assert.equal(Object.keys(file.companies).length, records.length, 'smaller snapshot must not delete');
  assert.equal(file.companies['2330'].rev, 330001000);
  assert.equal(file.companies['2330'].revisions[0].rev, 330000000);
  assert.equal(file.companies['2330'].firstSeen, '2026-10-08T00:00:00Z');
  assert.deepEqual(listPeriods(dir), ['2026-09']);
});

test('MOPS Big5 summary page parses with industries and skips total rows', () => {
  const html = decodeMopsHtml(fs.readFileSync(path.join(fixtures, 'mops_sii_115_9_0.html')));
  const recs = parseMopsSummary(html, { market: 'TWSE', period: '2026-09' });
  assert.equal(recs.length, 3);
  const tsmc = recs.find((r) => r.code === '2330');
  assert.equal(tsmc.industry, '半導體業');
  assert.equal(tsmc.name, '台積電');
  assert.equal(tsmc.rev, 330000000);
  assert.equal(recs.find((r) => r.code === '1101').industry, '水泥工業');
  assert.equal(validateBatch(recs, { market: 'TWSE', now: OCT_2026 }).errors.length, 0);
});

test('profile rows pick up English names', () => {
  const { records } = normaliseProfileRows([{ 公司代號: '2330', 公司簡稱: '台積電', 英文簡稱: 'TSMC', 產業別: '24' }], 'TWSE');
  assert.equal(records[0].nameEn, 'TSMC');
  assert.equal(records[0].industry, '24');
});

test('TPEx profile rows (real field names) pick up the English name from Symbol', () => {
  const rows = [
    { Date: '1151020', SecuritiesCompanyCode: '5347', CompanyName: '世界先進積體電路股份有限公司', CompanyAbbreviation: '世界', SecuritiesIndustryCode: '24', Symbol: 'VIS', WebAddress: 'www.vis.com.tw' },
    { Date: '1151020', SecuritiesCompanyCode: '9999', CompanyName: '測試', CompanyAbbreviation: '測試', SecuritiesIndustryCode: '20', Symbol: '9999', WebAddress: '' },
  ];
  const { records } = normaliseProfileRows(rows, 'TPEx');
  assert.equal(records[0].nameEn, 'VIS');
  assert.equal(records[0].nameZh, '世界');
  assert.equal(records[0].industry, '24');
  assert.equal(records[1].nameEn, '', 'a numeric value is never used as a name');
});

test('update.mjs end-to-end on fixtures', () => {
  const dir = tmp();
  const out = tmp();
  const run = () => spawnSync(process.execPath, ['pipeline/update.mjs', '--data', dir, '--out', out, '--fixtures', fixtures], { encoding: 'utf8' });
  const r1 = run();
  // The fixture period (Sep 2026) may be "stale" relative to today, which is only a warning.
  assert.equal(r1.status, 0, r1.stdout + r1.stderr);
  const changes = JSON.parse(fs.readFileSync(path.join(out, 'changes.json'), 'utf8'));
  assert.equal(changes.added.length, 102);
  const r2 = run();
  assert.equal(r2.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'changes.json'), 'utf8')).added.length, 0);
  const companies = JSON.parse(fs.readFileSync(path.join(dir, 'companies.json'), 'utf8'));
  assert.equal(companies['2330'].nameZh, '台積電');
});

test('update.mjs blocks a broken source and exits non-zero', () => {
  const dir = tmp();
  const fx = tmp();
  fs.writeFileSync(path.join(fx, 'TWSE.json'), JSON.stringify([{ unexpected: 'shape' }]));
  fs.writeFileSync(path.join(fx, 'TPEx.json'), JSON.stringify([{ unexpected: 'shape' }]));
  const r = spawnSync(process.execPath, ['pipeline/update.mjs', '--data', dir, '--out', tmp(), '--fixtures', fx], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /Could not find/);
  assert.equal(listPeriods(dir).length, 0, 'nothing may be written');
});
