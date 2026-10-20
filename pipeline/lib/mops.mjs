// Parser for the MOPS static monthly-revenue summary pages (t21sc03), used to
// backfill history. The pages are Big5-encoded HTML with one table per industry:
//
//   產業別：半導體業
//   公司代號 | 公司名稱 | 當月營收 | 上月營收 | 去年當月營收 | 上月比較增減(%) |
//   去年同月增減(%) | 當月累計營收 | 去年累計營收 | 前期比較增減(%) | 備註

import { parseNumber, FieldMappingError } from './fields.mjs';

const EXPECTED_HEADERS = ['當月營收', '上月營收', '去年當月營收', '上月比較增減', '去年同月增減', '當月累計營收', '去年累計營收', '前期比較增減'];

export function decodeMopsHtml(buffer) {
  const head = buffer.subarray(0, 2048).toString('latin1').toLowerCase();
  const encoding = /charset=["']?utf-?8/.test(head) ? 'utf-8' : 'big5';
  return new TextDecoder(encoding).decode(buffer);
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function cellText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseMopsSummary(html, { market, period }) {
  if (/查詢過於頻繁|頻繁/.test(html) && !/公司代號/.test(html)) {
    throw new Error('MOPS rate limit page returned; slow down and retry later.');
  }
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let industry = '';
  let headerOk = false;
  const records = [];
  for (const tr of rows) {
    const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
    if (!cells.length) continue;
    const joined = cells.join('|');
    const ind = joined.match(/產業別[：:]\s*([^|]+)/);
    if (ind) { industry = ind[1].trim(); continue; }
    if (EXPECTED_HEADERS.every((h) => joined.includes(h))) {
      const order = EXPECTED_HEADERS.map((h) => cells.findIndex((c) => c.includes(h)));
      headerOk = order.every((v, i) => i === 0 || v > order[i - 1]);
      continue;
    }
    const code = cells[0];
    if (!/^\d{4,6}[A-Z]?$/.test(code) || cells.length < 10) continue;
    if (!headerOk) throw new FieldMappingError(`MOPS ${market} ${period}: column headers not in the expected order.`);
    records.push({
      code,
      market,
      period,
      name: cells[1],
      industry,
      rev: parseNumber(cells[2]),
      prev: parseNumber(cells[3]),
      ya: parseNumber(cells[4]),
      momPct: parseNumber(cells[5]),
      yoyPct: parseNumber(cells[6]),
      ytd: parseNumber(cells[7]),
      ytdPrev: parseNumber(cells[8]),
      ytdPct: parseNumber(cells[9]),
      note: (cells[10] || '').replace(/^-$/, ''),
    });
  }
  return records;
}
