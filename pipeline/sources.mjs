// Official open-data endpoints. All are free and need no API key.
// Data licence: Open Government Data License, version 1.0 (Taiwan) - commercial use
// allowed with attribution. See site page /sources/.

export const SOURCES = {
  TWSE: {
    label: 'Taiwan Stock Exchange (TWSE) OpenAPI',
    revenue: 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L',
    profile: 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',
    mopsMarket: 'sii',
  },
  TPEx: {
    label: 'Taipei Exchange (TPEx) OpenAPI',
    revenue: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O',
    profile: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O',
    mopsMarket: 'otc',
  },
};

// Static monthly summary pages on the Market Observation Post System (MOPS).
// Used for the one-time history backfill and as the "official source" link.
export const MOPS_HOSTS = ['https://mopsov.twse.com.tw', 'https://mops.twse.com.tw'];

// kind 0 = domestic companies, 1 = foreign (KY) companies.
export function mopsSummaryPath(mopsMarket, period, kind = 0) {
  const [y, m] = period.split('-').map(Number);
  return `/nas/t21/${mopsMarket}/t21sc03_${y - 1911}_${m}_${kind}.html`;
}

export function mopsSummaryUrl(market, period, nameZh = '') {
  const kind = /-KY$/i.test(nameZh) ? 1 : 0;
  return MOPS_HOSTS[0] + mopsSummaryPath(SOURCES[market].mopsMarket, period, kind);
}

export const USER_AGENT = 'TaiwanMonthlyBot/1.0 (open-data revenue tracker)';
