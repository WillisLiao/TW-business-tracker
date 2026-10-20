// Maps the source APIs' field names onto our canonical names.
// The TWSE API uses Chinese keys such as "營業收入-當月營收"; the TPEx API may use
// the same Chinese keys or English ones. Each field is matched by exact aliases
// first, then by a pattern over the normalised key. If a required field cannot be
// resolved we throw with the keys we actually received, so a format change stops
// the publish with a clear message instead of publishing wrong numbers.

import { parsePeriod } from './period.mjs';

const norm = (k) => String(k).toLowerCase().replace(/[\s\-_()（）%％/.:：]/g, '');

const REVENUE_FIELDS = {
  code: {
    required: true,
    aliases: ['公司代號', 'SecuritiesCompanyCode', 'CompanyCode', 'Code', 'StockCode'],
  },
  name: {
    required: false,
    aliases: ['公司名稱', '公司簡稱', 'CompanyName', 'CompanyAbbreviation', 'Name'],
  },
  period: {
    required: true,
    aliases: ['資料年月', 'DataYearMonth', 'YearMonth', 'Date'],
  },
  industry: {
    required: false,
    aliases: ['產業別', 'Industry', 'IndustryName', 'SecuritiesIndustryCode'],
  },
  rev: {
    required: true,
    aliases: ['營業收入-當月營收', 'Revenue_CurrentMonth', 'CurrentMonthRevenue', 'MonthlyRevenue'],
    test: (k) => (k.includes('當月營收') && !k.includes('累計') && !k.includes('去年'))
      || (/currentmonth|thismonth/.test(k) && k.includes('revenue') && !/accum|cumul|lastyear|previousyear/.test(k)),
  },
  prev: {
    required: false,
    aliases: ['營業收入-上月營收', 'Revenue_LastMonth', 'LastMonthRevenue', 'PreviousMonthRevenue'],
    test: (k) => k.includes('上月營收')
      || (/lastmonth|previousmonth/.test(k) && k.includes('revenue') && !/compar|change|percent|ratio/.test(k)),
  },
  ya: {
    required: true,
    aliases: ['營業收入-去年當月營收', 'Revenue_LastYearCurrentMonth', 'LastYearMonthRevenue', 'SameMonthLastYearRevenue'],
    test: (k) => k.includes('去年當月營收')
      || (/lastyear|previousyear|sameperiod/.test(k) && k.includes('month') && k.includes('revenue') && !/accum|cumul|compar|change|percent/.test(k)),
  },
  momPct: {
    required: false,
    aliases: ['營業收入-上月比較增減(%)', 'Revenue_MoMChange', 'MoM'],
    test: (k) => k.includes('上月比較增減') || (/lastmonth|previousmonth|mom/.test(k) && /change|compar|percent|ratio/.test(k)),
  },
  yoyPct: {
    required: false,
    aliases: ['營業收入-去年同月增減(%)', 'Revenue_YoYChange', 'YoY'],
    test: (k) => k.includes('去年同月增減') || (/lastyear|previousyear|yoy/.test(k) && /change|compar|percent|ratio/.test(k) && !/accum|cumul/.test(k)),
  },
  ytd: {
    required: false,
    aliases: ['累計營業收入-當月累計營收', 'AccumulatedRevenue_CurrentYear', 'AccumulatedRevenue'],
    test: (k) => k.includes('當月累計營收') || (/accum|cumul/.test(k) && /current|thisyear/.test(k) && k.includes('revenue') && !/compar|change|percent/.test(k)),
  },
  ytdPrev: {
    required: false,
    aliases: ['累計營業收入-去年累計營收', 'AccumulatedRevenue_LastYear'],
    test: (k) => k.includes('去年累計營收') || (/accum|cumul/.test(k) && /lastyear|previousyear/.test(k) && k.includes('revenue') && !/compar|change|percent/.test(k)),
  },
  ytdPct: {
    required: false,
    aliases: ['累計營業收入-前期比較增減(%)', 'AccumulatedRevenue_Change'],
    test: (k) => k.includes('前期比較增減') || (/accum|cumul/.test(k) && /change|compar|percent/.test(k)),
  },
  note: {
    required: false,
    aliases: ['備註', 'Remark', 'Note', 'Notes'],
  },
  reportDate: {
    required: false,
    aliases: ['出表日期', 'ReportDate', 'Date_Report'],
  },
};

export class FieldMappingError extends Error {}

// Builds { canonical -> sourceKey } from a sample of records.
export function resolveFields(records, spec = REVENUE_FIELDS) {
  const keys = new Set();
  for (const r of records.slice(0, 50)) Object.keys(r).forEach((k) => keys.add(k));
  const byNorm = new Map([...keys].map((k) => [norm(k), k]));
  const used = new Set();
  const map = {};
  for (const [field, def] of Object.entries(spec)) {
    let found = null;
    for (const alias of def.aliases) {
      const k = byNorm.get(norm(alias));
      if (k && !used.has(k)) { found = k; break; }
    }
    if (!found && def.test) {
      found = [...keys].find((k) => !used.has(k) && def.test(norm(k))) ?? null;
    }
    if (found) { map[field] = found; used.add(found); }
    else if (def.required) {
      throw new FieldMappingError(
        `Could not find the "${field}" field in the source data. Keys received: ${JSON.stringify([...keys])}. ` +
        'Add the correct key to the aliases in pipeline/lib/fields.mjs.');
    }
  }
  return map;
}

// "1,234,567" -> 1234567; "", "-", "N/A" -> null.
export function parseNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[,\s]/g, '').replace(/^\+/, '');
  if (s === '' || s === '-' || s === '--' || /^n\/?a$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const clean = (v) => (v == null ? '' : String(v).trim());

// Turns raw source rows into normalised revenue records (amounts in thousand NT$).
export function normaliseRevenueRows(rows, market) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new FieldMappingError(`${market}: source returned no rows`);
  }
  const map = resolveFields(rows);
  const out = [];
  for (const row of rows) {
    const code = clean(row[map.code]);
    const period = parsePeriod(row[map.period]);
    if (!/^\d{4,6}[A-Z]?$/.test(code) || !period) continue;
    out.push({
      code,
      market,
      period,
      name: map.name ? clean(row[map.name]) : '',
      industry: map.industry ? clean(row[map.industry]) : '',
      rev: parseNumber(row[map.rev]),
      prev: map.prev ? parseNumber(row[map.prev]) : null,
      ya: parseNumber(row[map.ya]),
      momPct: map.momPct ? parseNumber(row[map.momPct]) : null,
      yoyPct: map.yoyPct ? parseNumber(row[map.yoyPct]) : null,
      ytd: map.ytd ? parseNumber(row[map.ytd]) : null,
      ytdPrev: map.ytdPrev ? parseNumber(row[map.ytdPrev]) : null,
      ytdPct: map.ytdPct ? parseNumber(row[map.ytdPct]) : null,
      note: map.note ? clean(row[map.note]).replace(/^-$/, '') : '',
    });
  }
  return { records: out, fieldMap: map };
}

const PROFILE_FIELDS = {
  code: { required: true, aliases: ['公司代號', 'SecuritiesCompanyCode', 'CompanyCode', 'Code'] },
  nameZh: { required: false, aliases: ['公司簡稱', 'CompanyAbbreviation', 'CompanyShortName'] },
  fullNameZh: { required: false, aliases: ['公司名稱', 'CompanyName'] },
  nameEn: {
    required: false,
    aliases: ['英文簡稱', 'EnglishAbbreviation', 'CompanyEnglishAbbreviation', 'EnglishShortName', 'AbbreviationOfEnglishName'],
    test: (k) => (k.includes('英文') && k.includes('簡稱')) || (k.includes('english') && /abbrev|short/.test(k)),
  },
  fullNameEn: {
    required: false,
    aliases: ['英文全名', 'EnglishName', 'CompanyEnglishName', 'EnglishFullName'],
    test: (k) => (k.includes('英文') && (k.includes('全名') || k.includes('名稱'))) || (k.includes('english') && k.includes('name')),
  },
  industry: { required: false, aliases: ['產業別', 'SecuritiesIndustryCode', 'Industry'] },
  website: { required: false, aliases: ['網址', 'WebAddress', 'Website', 'WebSite'] },
};

export function normaliseProfileRows(rows, market) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new FieldMappingError(`${market}: profile source returned no rows`);
  }
  const map = resolveFields(rows, PROFILE_FIELDS);
  const out = [];
  for (const row of rows) {
    const code = clean(row[map.code]);
    if (!/^\d{4,6}[A-Z]?$/.test(code)) continue;
    const get = (f) => (map[f] ? clean(row[map[f]]) : '');
    out.push({
      code,
      market,
      nameZh: get('nameZh') || get('fullNameZh'),
      nameEn: get('nameEn'),
      fullNameEn: get('fullNameEn'),
      industry: get('industry'),
      website: get('website'),
    });
  }
  return { records: out, fieldMap: map };
}
