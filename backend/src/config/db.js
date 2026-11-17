const mysql = require('mysql2/promise');
require('dotenv').config();

const { cfEnv, isWorker } = require('./runtime');

// Two runtimes, one interface (`pool.query`):
//
// - Node (npm run dev): a normal mysql2 pool, reused across requests.
// - Cloudflare Workers: a Worker may not reuse a socket opened by another
//   request, so each query opens a short-lived connection through Hyperdrive.
//   Hyperdrive keeps the real connections to MySQL warm, so this is cheap.
let pool;

if (isWorker) {
  pool = {
    async query(sql, values) {
      const hd = cfEnv().HYPERDRIVE;
      if (!hd) throw new Error('HYPERDRIVE binding is missing — check wrangler.jsonc');
      const conn = await mysql.createConnection({
        host: hd.host,
        user: hd.user,
        password: hd.password,
        database: hd.database,
        port: hd.port,
        disableEval: true, // Workers forbid eval / new Function
        decimalNumbers: true,
      });
      try {
        return await conn.query(sql, values);
      } finally {
        conn.end().catch(() => {});
      }
    },
  };
} else {
  // A pooled connection is reused across requests instead of opening a
  // fresh MySQL connection per API call (much faster under load).
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true, // return DECIMAL columns (lat/lng/price) as JS numbers, not strings
  });
}

// Quick startup check so a bad .env fails loudly instead of on the first request.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
