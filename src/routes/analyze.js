'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();

const { parseInput } = require('../services/tickerCleaner');
const { fetchFundamentals } = require('../services/eodhdClient');
const { analyze } = require('../services/pficCalculator');
const { createSemaphore } = require('../services/semaphore');
const { getDb } = require('../database');
const config = require('../config');

router.post('/api/analyze', async (req, res) => {
  const rawText = (req.body.tickers || '').trim();

  if (!rawText) {
    return res.redirect('/?error=empty');
  }

  const parsed = parseInput(rawText);

  if (parsed.unique.length === 0) {
    return res.redirect('/?error=no_valid_tickers');
  }

  const semaphore = createSemaphore(config.maxConcurrent);

  // Fetch all unique tickers in parallel, rate-limited by semaphore
  const fetchResults = await Promise.all(
    parsed.unique.map(ticker => fetchFundamentals(ticker, semaphore))
  );

  // Run PFIC analysis (pure, synchronous)
  const results = parsed.unique.map((ticker, i) => {
    const { data, fromCache, error } = fetchResults[i];
    return {
      ...analyze(ticker, data, error),
      fromCache: fromCache || false,
      fetchError: error || null,
    };
  });

  const summary = buildSummary(parsed, results);

  // Persist session
  const db = getDb();
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000
  ).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, created_at, expires_at, input_raw, results_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, now, expiresAt, rawText, JSON.stringify({ parsed, results, summary }));

  res.redirect(`/results/${sessionId}`);
});

function buildSummary(parsed, results) {
  const counts = {
    pfic_yes: 0,
    pfic_no: 0,
    unable_to_determine: 0,
    not_suitable: 0,
    manual_review: 0,
  };

  for (const r of results) {
    if (r.pficResult in counts) counts[r.pficResult]++;
  }

  return {
    totalPasted: parsed.totalPasted,
    duplicatesRemoved: parsed.duplicates.length,
    uniqueAnalyzed: parsed.unique.length,
    duplicates: parsed.duplicates,
    ...counts,
  };
}

module.exports = router;
