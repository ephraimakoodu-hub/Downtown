import { loadEnv } from './config/env.js';
import { createPool } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

let env;
try {
  env = loadEnv();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}

const pool = createPool(env);
const server = createApp(env, pool).listen(env.PORT, () => logger.info('server_started', { port: env.PORT, env: env.NODE_ENV }));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  logger.info('shutdown_started', { signal });
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(async () => {
    try { await pool.end(); } catch { /* already closed */ }
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// A truly unexpected fault leaves the process in an unknown state, so log and exit. The process manager restarts it.
process.on('uncaughtException', (err) => { logger.error('uncaught_exception', { message: err.message, stack: err.stack }); shutdown('uncaughtException'); });
process.on('unhandledRejection', (err) => { logger.error('unhandled_rejection', { message: String(err) }); });
