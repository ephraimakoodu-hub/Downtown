import { loadEnv } from '../config/env.js';
import { createPool } from '../config/db.js';
import { claimJobs, markDone, markFailed } from './queue.js';
import { runJob } from './handlers.js';
import { logger } from '../utils/logger.js';

// A standalone process: `node src/jobs/worker.js`. Runs separately from the web server so a slow
// job (an email, a report) never makes an HTTP request wait for it.
const env = loadEnv();
const pool = createPool(env);
const POLL_MS = 2000;
let stopping = false;

async function tick() {
  const jobs = await claimJobs(pool, 5);
  for (const job of jobs) {
    try {
      await runJob(job);
      await markDone(pool, job.id);
      logger.info('job_done', { id: job.id, type: job.type });
    } catch (err) {
      await markFailed(pool, job, err);
      logger.error('job_failed', { id: job.id, type: job.type, message: err.message });
    }
  }
}

async function loop() {
  while (!stopping) {
    try { await tick(); } catch (err) { logger.error('worker_tick_error', { message: err.message }); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
logger.info('worker_started', {});
loop();
