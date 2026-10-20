import { USER_AGENT } from '../sources.mjs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with timeout and exponential backoff (2s, 4s, 8s, 16s).
export async function fetchWithRetry(url, { as = 'json', retries = 4, timeoutMs = 45000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: as === 'json' ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 404) throw Object.assign(new Error(`404 Not Found: ${url}`), { permanent: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      if (as === 'json') {
        const text = await res.text();
        try {
          return JSON.parse(text.replace(/^﻿/, ''));
        } catch {
          throw new Error(`Response from ${url} was not JSON (starts with: ${JSON.stringify(text.slice(0, 120))})`);
        }
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (err.permanent) break;
    }
  }
  throw lastError;
}
