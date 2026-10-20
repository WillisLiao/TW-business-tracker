// Number and text formatting. Amounts arrive in thousand NT$.
// Chinese pages use Taiwan's conventions: 萬/億/兆 units and 2026年9月-style dates.

import { isZh } from './lang.mjs';

const MINUS = '−';
const group = (n, d) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// 5,118.6億元, 1.16兆元, 5,904萬元.
function ntdZh(v, digits) {
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : '';
  if (a >= 1e12) return `${sign}${group(a / 1e12, digits ?? 2)}兆元`;
  if (a >= 1e8) return `${sign}${group(a / 1e8, digits ?? 1)}億元`;
  if (a >= 1e4) return `${sign}${group(a / 1e4, digits ?? 0)}萬元`;
  return `${sign}${group(a, 0)}元`;
}

export function ntd(thousand, { digits } = {}) {
  if (thousand == null) return '—';
  if (isZh()) return ntdZh(thousand * 1000, digits);
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
  if (isZh()) {
    const sign = v < 0 ? MINUS : '';
    if (a >= 1e12) return `${sign}${group(a / 1e12, a % 1e12 ? 1 : 0)}兆`;
    if (a >= 1e8) return `${sign}${group(a / 1e8, 0)}億`;
    if (a >= 1e4) return `${sign}${group(a / 1e4, 0)}萬`;
    return `${sign}${group(a, 0)}`;
  }
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

// Taiwan has no daylight saving time, so Taipei time is always UTC+8.
const taipei = (iso) => new Date(Date.parse(iso) + 8 * 3600 * 1000);
const pad = (n) => String(n).padStart(2, '0');

export function dateTime(iso) {
  if (!iso) return '—';
  if (isZh()) {
    const t = taipei(iso);
    return `${t.getUTCFullYear()}年${t.getUTCMonth() + 1}月${t.getUTCDate()}日 ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}（台北時間）`;
  }
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { ...TPE, day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { ...TPE, hour: '2-digit', minute: '2-digit' })} Taipei`;
}

export function date(iso) {
  if (!iso) return '—';
  if (isZh()) {
    const t = taipei(iso);
    return `${t.getUTCFullYear()}年${t.getUTCMonth() + 1}月${t.getUTCDate()}日`;
  }
  return new Date(iso).toLocaleDateString('en-GB', { ...TPE, day: 'numeric', month: 'short', year: 'numeric' });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Sign class for colouring deltas in text (via text tokens, not series colours).
export const signClass = (ratio) => (ratio == null ? '' : ratio > 0.0005 ? 'up' : ratio < -0.0005 ? 'down' : '');
