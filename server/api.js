// /api/* for Cloudflare Pages Functions (see functions/api/[[path]].js).
//
// Bindings and secrets (set in the Cloudflare dashboard or via wrangler):
//   DB                    D1 database (schema.sql)
//   EXPORTS               KV namespace holding gzipped full-history downloads
//   SITE_URL, SITE_NAME   e.g. https://taiwanmonthly.com, Taiwan Monthly
//   RESEND_API_KEY, EMAIL_FROM   email delivery ("Taiwan Monthly <alerts@yourdomain>")
//   LEMON_SQUEEZY_WEBHOOK_SECRET signing secret of the Lemon Squeezy webhook
//   NOTIFY_SECRET         shared secret used by the GitHub Action to trigger alerts
//   MAX_WATCHLIST         optional, default 50
//   EMAIL_DRY_RUN         "true" stores emails in the outbox table instead of sending

import { sendEmails, loginCodeEmail, alertEmail, summaryEmail } from './email.js';

const SESSION_COOKIE = 'tm_session';
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_CODE_ATTEMPTS = 5;
const ACTIVE_STATUSES = ['on_trial', 'active', 'past_due'];

const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});
const error = (status, message) => json({ error: message }, status);

const now = () => new Date().toISOString();
const isEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const normEmail = (e) => String(e || '').trim().toLowerCase();

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomCode() {
  // Rejection sampling for an unbiased 6-digit code.
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= 4294000000);
  return String(a[0] % 1000000).padStart(6, '0');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Cookie-authenticated writes must come from our own pages.
function sameOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // non-browser clients; SameSite=Lax still protects the cookie
  const allowed = new URL(request.url).origin;
  return origin === allowed || (env.SITE_URL && origin === new URL(env.SITE_URL).origin);
}

async function ensureUser(env, email) {
  await env.DB.prepare('INSERT OR IGNORE INTO users (email, created_at, alerts_enabled, unsubscribe_token) VALUES (?, ?, 1, ?)')
    .bind(email, now(), randomToken(18)).run();
}

async function currentUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare('SELECT email, expires_at FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).first();
  if (!row || row.expires_at < Date.now()) return null;
  return row.email;
}

export async function subscriptionFor(env, email) {
  const { results } = await env.DB.prepare('SELECT * FROM subscriptions WHERE email = ? ORDER BY updated_at DESC').bind(email).all();
  const t = now();
  const active = results.find((s) => ACTIVE_STATUSES.includes(s.status) || (s.status === 'cancelled' && s.ends_at && s.ends_at > t));
  return { pro: Boolean(active), current: active || results[0] || null };
}

// ---- Handlers ---------------------------------------------------------------

async function waitlist(request, env) {
  const body = await readJson(request);
  const email = normEmail(body?.email);
  if (!isEmail(email)) return error(400, 'Please enter a valid email address.');
  const interest = String(body?.interest || '').slice(0, 40);
  await env.DB.prepare('INSERT OR IGNORE INTO waitlist (email, interest, created_at) VALUES (?, ?, ?)').bind(email, interest, now()).run();
  return json({ ok: true });
}

async function authStart(request, env) {
  const body = await readJson(request);
  const email = normEmail(body?.email);
  if (!isEmail(email)) return error(400, 'Please enter a valid email address.');
  const t = Date.now();
  const row = await env.DB.prepare('SELECT sent_count, window_start FROM login_codes WHERE email = ?').bind(email).first();
  const inWindow = row && t - row.window_start < 3600 * 1000;
  if (inWindow && row.sent_count >= MAX_CODES_PER_HOUR) return error(429, 'Too many codes requested. Please wait an hour and try again.');
  const code = randomCode();
  const hash = await sha256Hex(`${email}:${code}`);
  await env.DB.prepare(`INSERT INTO login_codes (email, code_hash, expires_at, attempts, sent_count, window_start) VALUES (?, ?, ?, 0, 1, ?)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
      sent_count = CASE WHEN ? THEN login_codes.sent_count + 1 ELSE 1 END,
      window_start = CASE WHEN ? THEN login_codes.window_start ELSE excluded.window_start END`)
    .bind(email, hash, t + CODE_TTL_MS, t, inWindow ? 1 : 0, inWindow ? 1 : 0).run();
  const msg = loginCodeEmail(env.SITE_NAME || 'Taiwan Monthly', code);
  await sendEmails(env, [{ to: email, ...msg }]);
  return json({ ok: true });
}

async function authVerify(request, env) {
  const body = await readJson(request);
  const email = normEmail(body?.email);
  const code = String(body?.code || '').trim();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) return error(400, 'Enter the 6-digit code from the email.');
  const row = await env.DB.prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || row.expires_at < Date.now()) return error(400, 'That code has expired. Request a new one.');
  if (row.attempts >= MAX_CODE_ATTEMPTS) return error(429, 'Too many attempts. Request a new code.');
  if (!timingSafeEqual(row.code_hash, await sha256Hex(`${email}:${code}`))) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    return error(400, 'That code is not right. Check the email and try again.');
  }
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 86400 * 1000;
  await env.DB.batch([
    env.DB.prepare('UPDATE login_codes SET expires_at = 0 WHERE email = ?').bind(email),
    env.DB.prepare('INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), email, expires),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
  ]);
  await ensureUser(env, email);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return json({ ok: true }, 200, { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}` });
}

async function signOut(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
}

async function me(request, env, email) {
  const sub = await subscriptionFor(env, email);
  const user = await env.DB.prepare('SELECT alerts_enabled FROM users WHERE email = ?').bind(email).first();
  const { results } = await env.DB.prepare('SELECT code FROM watchlist WHERE email = ? ORDER BY added_at').bind(email).all();
  return json({
    email,
    pro: sub.pro,
    status: sub.current?.status || null,
    renewsAt: sub.current?.renews_at || null,
    endsAt: sub.current?.ends_at || null,
    trialEndsAt: sub.current?.trial_ends_at || null,
    portalUrl: sub.current?.portal_url || null,
    alertsEnabled: user ? Boolean(user.alerts_enabled) : true,
    watchlist: results.map((r) => r.code),
    maxWatchlist: Number(env.MAX_WATCHLIST || 50),
  });
}

async function setWatchlist(request, env, email) {
  const sub = await subscriptionFor(env, email);
  if (!sub.pro) return error(403, 'Watchlists need an active Pro subscription.');
  const body = await readJson(request);
  const max = Number(env.MAX_WATCHLIST || 50);
  const codes = [...new Set((Array.isArray(body?.codes) ? body.codes : []).map((c) => String(c).trim().toUpperCase()))];
  if (codes.some((c) => !/^\d{4,6}[A-Z]?$/.test(c))) return error(400, 'Invalid company code.');
  if (codes.length > max) return error(400, `Your watchlist can hold up to ${max} companies.`);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM watchlist WHERE email = ?').bind(email),
    ...codes.map((c, i) => env.DB.prepare('INSERT INTO watchlist (email, code, added_at) VALUES (?, ?, ?)').bind(email, c, `${t}#${String(i).padStart(3, '0')}`)),
  ]);
  return json({ ok: true, watchlist: codes });
}

async function setSettings(request, env, email) {
  const body = await readJson(request);
  await ensureUser(env, email);
  await env.DB.prepare('UPDATE users SET alerts_enabled = ? WHERE email = ?').bind(body?.alertsEnabled ? 1 : 0, email).run();
  return json({ ok: true });
}

async function download(env, email, name) {
  const sub = await subscriptionFor(env, email);
  if (!sub.pro) return error(403, 'Downloads need an active Pro subscription.');
  if (!/^[a-z0-9-]+\.csv$/.test(name)) return error(404, 'Not found');
  // Stored gzipped (KV values are capped at 25 MB); decompressed on the way out.
  const stream = await env.EXPORTS.get(`${name}.gz`, { type: 'stream' });
  if (!stream) return error(404, 'This file has not been generated yet.');
  return new Response(stream.pipeThrough(new DecompressionStream('gzip')), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="taiwan-monthly-${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

async function lemonSqueezyWebhook(request, env) {
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) return error(500, 'Webhook secret not configured');
  const raw = await request.text();
  const signature = request.headers.get('X-Signature') || '';
  const expected = await hmacHex(env.LEMON_SQUEEZY_WEBHOOK_SECRET, raw);
  if (!timingSafeEqual(signature.toLowerCase(), expected)) return error(401, 'Invalid signature');
  let event;
  try { event = JSON.parse(raw); } catch { return error(400, 'Invalid JSON'); }
  const name = event?.meta?.event_name || '';
  const data = event?.data;
  if (!name.startsWith('subscription_') || data?.type !== 'subscriptions') return json({ ok: true, ignored: name });
  const a = data.attributes || {};
  const eventId = `${name}:${data.id}:${a.updated_at || ''}`;
  const seen = await env.DB.prepare('SELECT id FROM webhook_events WHERE id = ?').bind(eventId).first();
  if (seen) return json({ ok: true, duplicate: true });
  const email = normEmail(a.user_email);
  if (!isEmail(email)) return error(400, 'Subscription has no valid email');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO subscriptions (ls_subscription_id, email, status, variant_name, renews_at, ends_at, trial_ends_at, portal_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ls_subscription_id) DO UPDATE SET email = excluded.email, status = excluded.status, variant_name = excluded.variant_name,
        renews_at = excluded.renews_at, ends_at = excluded.ends_at, trial_ends_at = excluded.trial_ends_at,
        portal_url = excluded.portal_url, updated_at = excluded.updated_at`)
      .bind(String(data.id), email, String(a.status || 'unknown'), a.variant_name || null, a.renews_at || null, a.ends_at || null, a.trial_ends_at || null, a.urls?.customer_portal || null, now()),
    env.DB.prepare('INSERT INTO webhook_events (id, received_at) VALUES (?, ?)').bind(eventId, now()),
  ]);
  await ensureUser(env, email);
  return json({ ok: true });
}

// Called by the GitHub Action after a data update and deploy.
async function notify(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.NOTIFY_SECRET || !timingSafeEqual(auth, `Bearer ${env.NOTIFY_SECRET}`)) return error(401, 'Unauthorized');
  const body = await readJson(request);
  const siteUrl = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const siteName = env.SITE_NAME || 'Taiwan Monthly';
  const { results: recipients } = await env.DB.prepare(`SELECT DISTINCT u.email, u.unsubscribe_token FROM users u
    JOIN subscriptions s ON s.email = u.email
    WHERE u.alerts_enabled = 1 AND (s.status IN ('on_trial', 'active', 'past_due') OR (s.status = 'cancelled' AND s.ends_at > ?))`).bind(now()).all();
  const unsubscribeUrl = (r) => `${siteUrl}/api/unsubscribe?t=${encodeURIComponent(r.unsubscribe_token)}`;
  const listHeaders = (r) => ({ 'List-Unsubscribe': `<${unsubscribeUrl(r)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

  if (body?.type === 'filings') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return json({ ok: true, emails: 0 });
    const byCode = new Map(items.map((i) => [String(i.code), i]));
    const messages = [];
    const sentRows = [];
    for (const r of recipients) {
      const { results: wl } = await env.DB.prepare('SELECT code FROM watchlist WHERE email = ?').bind(r.email).all();
      const { results: already } = await env.DB.prepare(`SELECT period || ':' || code AS k FROM alerts_sent WHERE email = ? AND period IN (${items.map(() => '?').join(',')})`)
        .bind(r.email, ...items.map((i) => i.period)).all();
      const done = new Set(already.map((x) => x.k));
      const mine = wl.map((w) => byCode.get(w.code)).filter((i) => i && !done.has(`${i.period}:${i.code}`));
      if (!mine.length) continue;
      messages.push({ to: r.email, ...alertEmail({ siteName, siteUrl, items: mine, unsubscribeUrl: unsubscribeUrl(r) }), headers: listHeaders(r) });
      for (const i of mine) sentRows.push([r.email, i.period, i.code]);
    }
    const result = await sendEmails(env, messages);
    const t = now();
    for (let i = 0; i < sentRows.length; i += 50) {
      await env.DB.batch(sentRows.slice(i, i + 50).map(([e, p, c]) => env.DB.prepare('INSERT OR IGNORE INTO alerts_sent (email, period, code, sent_at) VALUES (?, ?, ?, ?)').bind(e, p, c, t)));
    }
    return json({ ok: true, emails: result.sent });
  }

  if (body?.type === 'summary') {
    const period = String(body.period || '');
    if (!/^\d{4}-\d{2}$/.test(period)) return error(400, 'Invalid period');
    const done = await env.DB.prepare('SELECT period FROM summaries_sent WHERE period = ?').bind(period).first();
    if (done) return json({ ok: true, emails: 0, alreadySent: true });
    const lines = (Array.isArray(body.lines) ? body.lines : []).map(String);
    const messages = recipients.map((r) => ({ to: r.email, ...summaryEmail({ siteName, siteUrl, period, periodLabel: String(body.periodLabel || period), lines, unsubscribeUrl: unsubscribeUrl(r) }), headers: listHeaders(r) }));
    const result = await sendEmails(env, messages);
    // Recorded only after a successful send, so a failed send is retried on the next run.
    await env.DB.prepare('INSERT OR IGNORE INTO summaries_sent (period, sent_at) VALUES (?, ?)').bind(period, now()).run();
    return json({ ok: true, emails: result.sent });
  }

  return error(400, 'Unknown notification type');
}

async function unsubscribe(request, env) {
  const t = new URL(request.url).searchParams.get('t') || '';
  if (t) await env.DB.prepare('UPDATE users SET alerts_enabled = 0 WHERE unsubscribe_token = ?').bind(t).run();
  if (request.method === 'POST') return json({ ok: true });
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alerts stopped</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px"><h1>Alert emails stopped</h1><p>You will not receive alert emails any more. You can turn them back on from <a href="/account/">your account</a>.</p></body>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// ---- Router -----------------------------------------------------------------

export async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  try {
    if (path === '/api/webhooks/lemonsqueezy' && method === 'POST') return await lemonSqueezyWebhook(request, env);
    if (path === '/api/notify' && method === 'POST') return await notify(request, env);
    if (path === '/api/unsubscribe' && (method === 'GET' || method === 'POST')) return await unsubscribe(request, env);

    if (method !== 'GET' && !sameOrigin(request, env)) return error(403, 'Cross-origin request refused');
    if (path === '/api/waitlist' && method === 'POST') return await waitlist(request, env);
    if (path === '/api/auth/start' && method === 'POST') return await authStart(request, env);
    if (path === '/api/auth/verify' && method === 'POST') return await authVerify(request, env);
    if (path === '/api/auth/signout' && method === 'POST') return await signOut(request, env);

    const email = await currentUser(request, env);
    if (!email) return error(401, 'Please sign in.');
    if (path === '/api/me' && method === 'GET') return await me(request, env, email);
    if (path === '/api/watchlist' && method === 'PUT') return await setWatchlist(request, env, email);
    if (path === '/api/settings' && method === 'PUT') return await setSettings(request, env, email);
    const dl = path.match(/^\/api\/download\/([^/]+)$/);
    if (dl && method === 'GET') return await download(env, email, dl[1]);
    return error(404, 'Not found');
  } catch (err) {
    console.error(err);
    return error(500, 'Something went wrong. Please try again.');
  }
}
