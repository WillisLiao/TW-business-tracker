-- Cloudflare D1 schema for accounts, subscriptions, watchlists and alerts.
-- Apply with: npx wrangler d1 execute taiwan-monthly --remote --file schema.sql

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  alerts_enabled INTEGER NOT NULL DEFAULT 1,
  unsubscribe_token TEXT NOT NULL
);

-- One row per Lemon Squeezy subscription, kept in sync by the webhook.
CREATE TABLE IF NOT EXISTS subscriptions (
  ls_subscription_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  variant_name TEXT,
  renews_at TEXT,
  ends_at TEXT,
  trial_ends_at TEXT,
  portal_url TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_email ON subscriptions(email);

CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist (
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (email, code)
);

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  interest TEXT,
  created_at TEXT NOT NULL
);

-- Idempotency: never alert the same person twice about the same filing.
CREATE TABLE IF NOT EXISTS alerts_sent (
  email TEXT NOT NULL,
  period TEXT NOT NULL,
  code TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (email, period, code)
);

CREATE TABLE IF NOT EXISTS summaries_sent (
  period TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);

-- Emails are written here instead of sent when EMAIL_DRY_RUN=true (local testing).
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
