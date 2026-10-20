// Minimal Cloudflare D1 stand-in on node:sqlite, for unit-testing server/api.js.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const clean = (v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);

class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Stmt(this.db, this.sql, params.map(clean)); }
  async first(col) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return col ? row[col] : { ...row };
  }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })), success: true }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: r.changes } }; }
  runSync() { return this.db.prepare(this.sql).run(...this.params); }
}

export function createD1(schemaFile) {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(schemaFile, 'utf8'));
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => s.runSync());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

// KV stand-in: values are Buffers; get(name, { type: 'stream' }) returns a web stream.
export function createKV(files = {}) {
  return { async get(name) { return name in files ? new Blob([files[name]]).stream() : null; } };
}
