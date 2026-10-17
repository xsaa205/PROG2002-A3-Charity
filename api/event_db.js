// ============================================================================
// event_db.js
// ----------------------------------------------------------------------------
// Central MySQL connection pool shared by every Express route in the A3 API.
//
// A3 schema changes reflected here:
//   * Database renamed from  charityevents_db  ->  charityevents_a3
//   * New table  registrations  (event registrations) is now part of the
//     schema. Routes can query it through the same shared pool, e.g.
//         db.query('SELECT * FROM registrations WHERE event_id = ?', [id])
//   * events now stores latitude / longitude (Open-Meteo weather lookup).
//
// Connection settings are read from environment variables so that credentials
// are NEVER hard-coded. On the SCU cPanel you configure these in the
// "Setup Node.js App" panel; for local development you may create an .env file
// (see .env.example).
// ============================================================================

// Load a local .env file if dotenv is installed. On cPanel the platform injects
// the variables directly, so dotenv is intentionally optional.
try {
  require('dotenv').config();
} catch (_) {
  // dotenv not installed -> silently rely on the real environment variables.
}

const mysql = require('mysql2/promise');

// ----------------------------------------------------------------------------
// Create the shared connection pool.
// ----------------------------------------------------------------------------
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  // No password is written in the source: it must come from DB_PASSWORD
  // (a local .env file, or the environment variables set in cPanel).
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'charityevents_a3',

  // Pool behaviour
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // Return DATE / DATETIME / TIME columns as plain strings so that the
  // client-side and admin-side pages can display them without timezone
  // conversion surprises (e.g. "2026-10-18", "2026-09-20 10:15:00").
  dateStrings: true
});

// ----------------------------------------------------------------------------
// Startup self-test: verify the database is reachable and that the new
// `registrations` table exists. Failures are logged but do not crash the
// process, so the server still starts and can return a helpful API error.
// ----------------------------------------------------------------------------
async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();

    // Confirm the pool is talking to the expected database.
    const [[dbInfo]] = await conn.query('SELECT DATABASE() AS db');
    console.log(`[event_db] Connected to MySQL database: ${dbInfo.db}`);

    // Confirm the A3 core tables are present.
    const [tables] = await conn.query(
      `SELECT TABLE_NAME
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('events', 'registrations')`
    );
    const found = tables.map((t) => t.TABLE_NAME);
    console.log(`[event_db] Schema check -> tables found: ${found.join(', ') || 'none'}`);

    if (!found.includes('registrations')) {
      console.warn('[event_db] WARNING: the "registrations" table is missing. Did you import charityevents_a3.sql?');
    }
  } catch (err) {
    console.error('[event_db] Failed to connect to MySQL:', err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Run the self-test once at module load.
testConnection();

// ----------------------------------------------------------------------------
// Exports
//   require('../event_db')                 -> the shared pool (db.query / db.execute)
//   require('../event_db').testConnection  -> the startup check (used by server.js)
// ----------------------------------------------------------------------------
module.exports = pool;
module.exports.testConnection = testConnection;
