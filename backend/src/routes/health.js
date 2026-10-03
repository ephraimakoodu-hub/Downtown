import { Router } from 'express';

export function healthRouter(pool) {
  const r = Router();
  // Liveness: the process is running.
  r.get('/live', (req, res) => res.json({ status: 'ok' }));
  // Readiness: the database is reachable.
  r.get('/ready', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });
  return r;
}
