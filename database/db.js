const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");

/** @type {import("pg").PoolConfig} */
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

if (process.env.DATABASE_SSL === "true") {
  poolConfig.ssl = { rejectUnauthorized: true };
}

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("[PostgreSQL] Idle client error:", error.message);
});

/**
 * Execute a parameterized SQL query.
 * @param {string} text
 * @param {unknown[]} [values]
 * @returns {Promise<import("pg").QueryResult>}
 */
async function query(text, values = []) {
  return pool.query(text, values);
}

async function initializeDatabase() {
  const schemaPath = path.join(process.cwd(), "schema.sql");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Database schema not found: ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");

  await pool.query(schema);
  await pool.query("SELECT 1");

  console.log("[PostgreSQL] Connected and schema initialized.");
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  initializeDatabase,
  closeDatabase
};