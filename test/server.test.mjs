import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handle } from '../server/api.js';
import zlib from 'node:zlib';
import { createD1, createKV } from './d1-shim.mjs';

const SITE = 'https://example.test';
const SECRET = 'whsec_test';

function makeEnv() {
  return {
    DB: createD1(new URL('../schema.sql', import.meta.url).pathname),
    EXPORTS: createKV({ 'full.csv.gz': zlib.gzipSync('period,code\n2026-09,2330\n') }),
    SITE_URL: SITE,
    SITE_NAME: 'Taiwan Monthly',
    EMAIL_DRY_RUN: 'true',
    LEMON_SQUEEZY_WEBHOOK_SECRET: SECRET,
    NOTIFY_SECRET: 'notify-secret',
    MAX_WATCHLIST: '3',
  };
}

const req = (path, { method = 'GET', body, cookie, headers = {} } = {}) => new Request(SITE + path, {
  method,
  headers: { 'Content-Type': 'application/json', Origin: SITE, ...(cookie ? { Cookie: cookie } : {}), ...headers },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});

const outbox = (env) => env.DB.raw.prepare('SELECT * FROM outbox ORDER BY id').all();

async function signIn(env, email) {
  assert.equal((await handle(req('/api/auth/start', { method: 'POST', body: { email } }), env)).status, 200);
  const mail = outbox(env).filter((m) => m.to_email === email).at(-1);
  const code = mail.subject.match(/^(\d{6})/)[1];
  const res = await handle(req('/api/auth/verify', { method: 'POST', body: { email, code } }), env);
  assert.equal(res.status, 200);
  return res.headers.get('Set-Cookie').split(';')[0];
}

function lsEvent(name, { id = '101', email = 'pro@example.com', status = 'on_trial', endsAt = null, updatedAt = '2026-10-01T00:00:00Z' } = {}) {
  return JSON.stringify({
    meta: { event_name: name },
    data: { type: 'subscriptions', id, attributes: { user_email: email, status, variant_name: 'Monthly', renews_at: '2026-11-01T00:00:00Z', ends_at: endsAt, trial_ends_at: null, updated_at: updatedAt, urls: { customer_portal: 'https://portal.test/x' } } },
  });
}
const sign = (body, secret = SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');
const webhook = (env, body, sig = sign(body)) => handle(req('/api/webhooks/lemonsqueezy', { method: 'POST', body, headers: { 'X-Signature': sig, Origin: '' } }), env);

test('waitlist validates and stores emails once', async () => {
  const env = makeEnv();
  assert.equal((await handle(req('/api/waitlist', { method: 'POST', body: { email: 'nope' } }), env)).status, 400);
  assert.equal((await handle(req('/api/waitlist', { method: 'POST', body: { email: 'A@Example.com', interest: '2330' } }), env)).status, 200);
  assert.equal((await handle(req('/api/waitlist', { method: 'POST', body: { email: 'a@example.com' } }), env)).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM waitlist').get().n, 1);
});

test('cross-origin writes are refused', async () => {
  const env = makeEnv();
  const res = await handle(req('/api/waitlist', { method: 'POST', body: { email: 'a@example.com' }, headers: { Origin: 'https://evil.test' } }), env);
  assert.equal(res.status, 403);
});

test('email-code sign-in: wrong code, attempts limit, then success', async () => {
  const env = makeEnv();
  await handle(req('/api/auth/start', { method: 'POST', body: { email: 'u@example.com' } }), env);
  const code = outbox(env)[0].subject.slice(0, 6);
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await handle(req('/api/auth/verify', { method: 'POST', body: { email: 'u@example.com', code: wrong } }), env)).status, 400);
  const ok = await handle(req('/api/auth/verify', { method: 'POST', body: { email: 'u@example.com', code } }), env);
  assert.equal(ok.status, 200);
  const cookie = ok.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  // Code is single-use.
  assert.equal((await handle(req('/api/auth/verify', { method: 'POST', body: { email: 'u@example.com', code } }), env)).status, 400);
  const meRes = await handle(req('/api/me', { cookie: cookie.split(';')[0] }), env);
  const meBody = await meRes.json();
  assert.equal(meBody.email, 'u@example.com');
  assert.equal(meBody.pro, false);
});

test('too many wrong codes locks the code', async () => {
  const env = makeEnv();
  await handle(req('/api/auth/start', { method: 'POST', body: { email: 'v@example.com' } }), env);
  const code = outbox(env)[0].subject.slice(0, 6);
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await handle(req('/api/auth/verify', { method: 'POST', body: { email: 'v@example.com', code: wrong } }), env);
  assert.equal((await handle(req('/api/auth/verify', { method: 'POST', body: { email: 'v@example.com', code } }), env)).status, 429);
});

test('code requests are rate limited per email', async () => {
  const env = makeEnv();
  for (let i = 0; i < 5; i++) assert.equal((await handle(req('/api/auth/start', { method: 'POST', body: { email: 'r@example.com' } }), env)).status, 200);
  assert.equal((await handle(req('/api/auth/start', { method: 'POST', body: { email: 'r@example.com' } }), env)).status, 429);
});

test('Lemon Squeezy webhook: signature checked, Pro granted and revoked', async () => {
  const env = makeEnv();
  const body = lsEvent('subscription_created');
  assert.equal((await webhook(env, body, sign(body, 'wrong'))).status, 401);
  assert.equal((await webhook(env, body)).status, 200);
  assert.equal((await (await webhook(env, body)).json()).duplicate, true);
  const cookie = await signIn(env, 'pro@example.com');
  let me = await (await handle(req('/api/me', { cookie }), env)).json();
  assert.equal(me.pro, true);
  assert.equal(me.portalUrl, 'https://portal.test/x');
  // Cancelled but paid until the future: still Pro.
  await webhook(env, lsEvent('subscription_cancelled', { status: 'cancelled', endsAt: '2999-01-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' }));
  me = await (await handle(req('/api/me', { cookie }), env)).json();
  assert.equal(me.pro, true);
  await webhook(env, lsEvent('subscription_expired', { status: 'expired', endsAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-03T00:00:00Z' }));
  me = await (await handle(req('/api/me', { cookie }), env)).json();
  assert.equal(me.pro, false);
});

test('watchlist and downloads require Pro; limits enforced', async () => {
  const env = makeEnv();
  const free = await signIn(env, 'free@example.com');
  assert.equal((await handle(req('/api/watchlist', { method: 'PUT', body: { codes: ['2330'] }, cookie: free }), env)).status, 403);
  assert.equal((await handle(req('/api/download/full.csv', { cookie: free }), env)).status, 403);
  await webhook(env, lsEvent('subscription_created'));
  const pro = await signIn(env, 'pro@example.com');
  assert.equal((await handle(req('/api/watchlist', { method: 'PUT', body: { codes: ['2330', 'DROP TABLE'] }, cookie: pro }), env)).status, 400);
  assert.equal((await handle(req('/api/watchlist', { method: 'PUT', body: { codes: ['1', '2', '3', '4'].map((x) => `233${x}`) }, cookie: pro }), env)).status, 400);
  const ok = await handle(req('/api/watchlist', { method: 'PUT', body: { codes: ['2330', '2382', '2330'] }, cookie: pro }), env);
  assert.deepEqual((await ok.json()).watchlist, ['2330', '2382']);
  const dl = await handle(req('/api/download/full.csv', { cookie: pro }), env);
  assert.equal(dl.status, 200);
  assert.match(await dl.text(), /2330/);
  assert.equal((await handle(req('/api/download/..%2Fsecret', { cookie: pro }), env)).status, 404);
});

test('alerts: only watched companies, once per filing, unsubscribe works', async () => {
  const env = makeEnv();
  await webhook(env, lsEvent('subscription_created'));
  const pro = await signIn(env, 'pro@example.com');
  await handle(req('/api/watchlist', { method: 'PUT', body: { codes: ['2330'] }, cookie: pro }), env);
  const items = [
    { code: '2330', name: 'TSMC', nameZh: '台積電', period: '2026-09', periodLabel: 'September 2026', rev: 'NT$330.00B', yoy: '+32.0%', mom: '+3.1%', url: `${SITE}/company/2330/` },
    { code: '2382', name: 'Quanta Computer', nameZh: '廣達', period: '2026-09', periodLabel: 'September 2026', rev: 'NT$190.00B', yoy: '+90.0%', mom: '+11.8%', url: `${SITE}/company/2382/` },
  ];
  const call = (body, auth = 'Bearer notify-secret') => handle(req('/api/notify', { method: 'POST', body, headers: { Authorization: auth } }), env);
  assert.equal((await call({ type: 'filings', items }, 'Bearer wrong')).status, 401);
  const before = outbox(env).length;
  assert.equal((await (await call({ type: 'filings', items })).json()).emails, 1);
  const mail = outbox(env).at(-1);
  assert.equal(mail.to_email, 'pro@example.com');
  assert.match(mail.subject, /TSMC reported September 2026 revenue/);
  assert.doesNotMatch(mail.body, /Quanta/);
  assert.equal(outbox(env).length, before + 1);
  assert.equal((await (await call({ type: 'filings', items })).json()).emails, 0, 'no duplicate alert');

  assert.equal((await (await call({ type: 'summary', period: '2026-09', periodLabel: 'September 2026', lines: ['All companies +17.0% YoY'] })).json()).emails, 1);
  assert.equal((await (await call({ type: 'summary', period: '2026-09', lines: [] })).json()).alreadySent, true);

  const token = env.DB.raw.prepare('SELECT unsubscribe_token t FROM users WHERE email = ?').get('pro@example.com').t;
  assert.equal((await handle(req(`/api/unsubscribe?t=${encodeURIComponent(token)}`), env)).status, 200);
  const next = [{ ...items[0], period: '2026-10', periodLabel: 'October 2026' }];
  assert.equal((await (await call({ type: 'filings', items: next })).json()).emails, 0, 'unsubscribed');
});

test('unauthenticated API calls get 401, unknown routes 404', async () => {
  const env = makeEnv();
  assert.equal((await handle(req('/api/me'), env)).status, 401);
  const cookie = await signIn(env, 'x@example.com');
  assert.equal((await handle(req('/api/nope', { cookie }), env)).status, 404);
});
