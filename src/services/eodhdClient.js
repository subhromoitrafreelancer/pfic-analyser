'use strict';

const config = require('../config');
const { getDb } = require('../database');

const EODHD_BASE = 'https://eodhd.com/api/fundamentals';

async function fetchFundamentals(ticker, semaphore) {
  const db = getDb();

  // Check cache first — no semaphore slot needed for a cache hit
  if (config.cacheTtlHours > 0) {
    const cached = db.prepare(
      `SELECT raw_json FROM api_cache
       WHERE ticker = ? AND fetched_at > datetime('now', ? || ' hours')`
    ).get(ticker, String(-config.cacheTtlHours));

    if (cached) {
      return { data: JSON.parse(cached.raw_json), fromCache: true, error: null };
    }
  }

  // Cache miss — fetch under semaphore to respect MAX_CONCURRENT
  return semaphore(async () => {
    const url =
      `${EODHD_BASE}/${encodeURIComponent(ticker)}` +
      `?api_token=${config.eodhdApiKey}&fmt=json`;

    let data;
    try {
      const res = await fetch(url);

      if (res.status === 404) {
        return { data: null, fromCache: false, error: 'Ticker not found on EODHD' };
      }
      if (!res.ok) {
        return { data: null, fromCache: false, error: `EODHD API error: HTTP ${res.status}` };
      }

      data = await res.json();
    } catch (err) {
      return { data: null, fromCache: false, error: `Network error: ${err.message}` };
    }

    // Empty / invalid response guard
    if (!data || typeof data !== 'object' || !data.General) {
      return { data: null, fromCache: false, error: 'EODHD returned unexpected response format' };
    }

    db.prepare(
      `INSERT OR REPLACE INTO api_cache (ticker, raw_json, fetched_at)
       VALUES (?, ?, datetime('now'))`
    ).run(ticker, JSON.stringify(data));

    return { data, fromCache: false, error: null };
  });
}

module.exports = { fetchFundamentals };
