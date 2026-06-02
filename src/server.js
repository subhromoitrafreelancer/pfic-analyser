'use strict';

const { createApp } = require('./app');
const { getDb } = require('./database');
const config = require('./config');

if (!config.eodhdApiKey) {
  console.error('FATAL: EODHD_API_KEY environment variable is not set.');
  console.error('Copy .env.example to .env and set your EODHD API key.');
  process.exit(1);
}

// Initialize DB (creates tables, purges expired sessions)
getDb();

const app = createApp();

app.listen(config.port, () => {
  console.log(`PFIC Report running on http://localhost:${config.port}`);
  console.log(`  DB:          ${config.databasePath}`);
  console.log(`  Cache TTL:   ${config.cacheTtlHours}h`);
  console.log(`  Concurrency: ${config.maxConcurrent}`);
  console.log(`  Env:         ${config.nodeEnv}`);
});
