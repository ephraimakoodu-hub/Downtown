import mysql from 'mysql2/promise';

export function createPool(env) {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_POOL_SIZE,
    queueLimit: 100,
    connectTimeout: 10000,
    charset: 'utf8mb4',
    decimalNumbers: false,
    // Strict, parameterized queries only: multipleStatements stays off.
  });
}

// Runs fn inside a transaction. Rolls back on any error.
export async function withTransaction(pool, fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* connection may be gone */ }
    throw err;
  } finally {
    conn.release();
  }
}
