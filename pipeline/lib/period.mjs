// Period helpers. Periods are stored as "YYYY-MM" (Gregorian).
// Taiwan sources use ROC years: ROC year + 1911 = Gregorian year (115 -> 2026).

export const ROC_OFFSET = 1911;

// Accepts "11509", "1150", "115/09", "115-9", "202609", "2026-09", "2026/9".
export function parsePeriod(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  let y, m;
  let match = s.match(/^(\d{2,4})\D+(\d{1,2})$/);
  if (match) {
    y = Number(match[1]);
    m = Number(match[2]);
  } else if (/^\d{6}$/.test(s) && /^(19|20)/.test(s)) {
    y = Number(s.slice(0, 4));
    m = Number(s.slice(4));
  } else if (/^\d{4,5}$/.test(s)) {
    y = Number(s.slice(0, -2));
    m = Number(s.slice(-2));
  } else {
    return null;
  }
  if (y < 1000) y += ROC_OFFSET;
  if (!(m >= 1 && m <= 12) || y < 1990 || y > 2200) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function toRoc(period) {
  const [y, m] = period.split('-').map(Number);
  return { rocYear: y - ROC_OFFSET, month: m };
}

export function addMonths(period, delta) {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function monthsBetween(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}

// The latest period that can have been reported as of `date` (always the previous month).
export function latestPossiblePeriod(date = new Date()) {
  const taipei = new Date(date.getTime() + 8 * 3600 * 1000);
  const current = `${taipei.getUTCFullYear()}-${String(taipei.getUTCMonth() + 1).padStart(2, '0')}`;
  return addMonths(current, -1);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function periodLabel(period, long = false) {
  const [y, m] = period.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}
