'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { buildCsv } = require('../services/exportBuilder');

router.post('/api/export/:sessionId', (req, res) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT results_json FROM sessions
     WHERE id = ? AND expires_at > datetime('now')`
  ).get(req.params.sessionId);

  if (!row) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const { results } = JSON.parse(row.results_json);
  const {
    filter = 'all',
    exportType = 'full',
    manualFields = {},
  } = req.body;

  const csv = buildCsv(results, manualFields, filter, exportType);

  const filterSlug = filter === 'all' ? 'all' : filter.replace(/_/g, '-');
  const filename = `pfic-${filterSlug}-${req.params.sessionId.slice(0, 8)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

module.exports = router;
