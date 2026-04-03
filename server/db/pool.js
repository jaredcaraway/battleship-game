const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
  connectTimeout: 10000,
  waitForConnections: true,
  queueLimit: 0,
};

if (process.env.DATABASE_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: true };
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
