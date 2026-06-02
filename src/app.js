'use strict';

const express = require('express');
const path = require('path');
const nunjucks = require('nunjucks');
const config = require('./config');

const pagesRouter = require('./routes/pages');
const analyzeRouter = require('./routes/analyze');
const exportRouter = require('./routes/export');

function createApp() {
  const app = express();

  // Parse URL-encoded form bodies and JSON
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Static assets
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Nunjucks templating
  const njkEnv = nunjucks.configure(path.join(__dirname, 'views'), {
    autoescape: true,
    express: app,
    noCache: config.nodeEnv !== 'production',
  });

  // Format large financial numbers: 391035000000 → 391.04B
  njkEnv.addFilter('numFmt', function (val) {
    if (val === null || val === undefined || val === '') return '—';
    const n = parseFloat(val);
    if (isNaN(n)) return String(val);
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(3) + 'T';
    if (abs >= 1e9)  return (n / 1e9).toFixed(3) + 'B';
    if (abs >= 1e6)  return (n / 1e6).toFixed(3) + 'M';
    if (abs >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  });

  // Format a ratio as percentage string
  njkEnv.addFilter('pct', function (val) {
    if (val === null || val === undefined) return '—';
    return (parseFloat(val) * 100).toFixed(2) + '%';
  });

  // Routes
  app.use(pagesRouter);
  app.use(analyzeRouter);
  app.use(exportRouter);

  // Health check for Railway
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Generic error handler
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
