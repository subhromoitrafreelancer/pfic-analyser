'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { resultLabel } = require('../services/exportBuilder');

router.get('/', (req, res) => {
  const errorMessages = {
    empty: 'Please paste at least one ticker.',
    no_valid_tickers: 'No valid tickers found. Check your input and try again.',
    session_not_found: 'That results link has expired or does not exist.',
  };

  res.render('index.html', {
    error: errorMessages[req.query.error] || null,
  });
});

router.get('/results/:sessionId', (req, res) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT results_json FROM sessions
     WHERE id = ? AND expires_at > datetime('now')`
  ).get(req.params.sessionId);

  if (!row) {
    return res.status(404).redirect('/?error=session_not_found');
  }

  const data = JSON.parse(row.results_json);

  res.render('results.html', {
    ...data,
    sessionId: req.params.sessionId,
    resultLabel,          // pass helper to template
  });
});

module.exports = router;
