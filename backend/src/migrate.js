import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { loadEnv } from './config/env.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const env = loadEnv();

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  multipleStatements: true,
});

try {
  // Fail closed when pointed at a pre-existing database with no migration
  // history. Never assume that an untracked database is empty or disposable.
  const [[tracker]] = await conn.query(
    `SELECT COUNT(*) AS n
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'schema_migrations'`
  );

  if (Number(tracker.n) === 0) {
    const [existingTables] = await conn.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`
    );

    if (existingTables.length > 0) {
      const names = existingTables.map((row) => row.TABLE_NAME ?? row.table_name);
      throw new Error(
        [
          `REFUSING TO RUN MIGRATIONS: database "${env.DB_NAME}" already contains ${existingTables.length} table(s),`,
          'but has no schema_migrations history.',
          `Existing tables: ${names.join(', ')}`,
          'This is likely an existing phpMyAdmin database. Do not run migrations until its schema',
          'has been compared with the migration files and a reviewed baseline has been prepared.',
          'No application tables were changed by this safety check.',
        ].join(' ')
      );
    }

    await conn.query(
      `CREATE TABLE schema_migrations (
         name VARCHAR(120) PRIMARY KEY,
         applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`
    );
    process.stdout.write('Created schema_migrations for an empty database.\n');
  }

  const [done] = await conn.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((row) => row.name));

  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;

    process.stdout.write(`Applying ${file}\n`);
    await conn.query(await readFile(path.join(dir, file), 'utf8'));
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  }

  process.stdout.write('Migrations complete\n');
} finally {
  await conn.end();
}
