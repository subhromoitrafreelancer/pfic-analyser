'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  eodhdApiKey: process.env.EODHD_API_KEY || '',
  databasePath: process.env.DATABASE_PATH || './pfic.db',
  cacheTtlHours: parseInt(process.env.CACHE_TTL_HOURS || '24', 10),
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '5', 10),
  sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS || '7', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config;
