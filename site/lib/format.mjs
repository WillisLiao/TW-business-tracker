// Number and text formatting. Amounts arrive in thousand NT$.

const MINUS = '−';

export function ntd(thousand, { digits } = {}) {
  if (thousand == null) return '—';
  const v = thousand * 1000;
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : '';
  const unit = a >= 1e12 ? ['T', 1e12] : a >= 1e9 ? ['B', 1e9] : a >= 1e6 ? ['M', 1e6] : a >= 1e3 ? ['K', 1e3] : ['', 1];
  const n = a / unit[1];
  const d = digits ?? (n >= 100 ? 1 : n >= 10 ? 2 : 2);
  return `${sign}NT$${n.toFixed(d)}${unit[0]}`;
}

// Compact axis label without currency: 330B, 1.2T.
export function compact(thousand) {
  const v = thousand * 1000;
  const a = Math.abs(v);
  const [s, d] = a >= 1e12 ? ['T', 1e12] : a >= 1e9 ? ['B', 1e9] : a >= 1e6 ? ['M', 1e6] : a >= 1e3 ? ['K', 1e3] : ['', 1];
  const n = a / d;
  const txt = (n >= 10 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '');
  return `${v < 0 ? MINUS : ''}${txt}${s}`;
}

// Ratio (0.32) -> "+32.0%".
export function pct(ratio, digits = 1) {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  const p = ratio * 100;
  if (Math.abs(p) >= 1000) return `${p > 0 ? '+' : MINUS}${Math.abs(p).toFixed(0)}%`;
  const s = Math.abs(p).toFixed(digits);
  if (Number(s) === 0) return `0.${'0'.repeat(digits)}%`;
  return `${p > 0 ? '+' : MINUS}${s}%`;
}

export function int(n) {
  return n == null ? '—' : n.toLocaleString('en-US');
}

const TPE = { timeZone: 'Asia/Taipei' };

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { ...TPE, day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { ...TPE, hour: '2-digit', minute: '2-digit' })} Taipei`;
}

export function date(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { ...TPE, day: 'numeric', month: 'short', year: 'numeric' });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Sign class for colouring deltas in text (via text tokens, not series colours).
export const signClass = (ratio) => (ratio == null ? '' : ratio > 0.0005 ? 'up' : ratio < -0.0005 ? 'down' : '');
