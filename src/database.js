'use strict';

const Database = require('better-sqlite3');
const config = require('./config');

let db = null;

function getDb() {
  if (db) return db;

  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_cache (
      ticker      TEXT PRIMARY KEY,
      raw_json    TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      input_raw    TEXT NOT NULL,
      results_json TEXT NOT NULL
    );
  `);

  // Purge expired sessions on startup
  const { changes } = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  if (changes > 0) {
    console.log(`Purged ${changes} expired session(s)`);
  }

  return db;
}

module.exports = { getDb };
