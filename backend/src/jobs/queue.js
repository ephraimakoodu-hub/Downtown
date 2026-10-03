// Durable job queue backed by the `jobs` table. A row is only claimed once, using SELECT ... FOR UPDATE
// SKIP LOCKED under a transaction, so multiple worker processes cannot pick up the same job twice.
export async function enqueue(conn, type, payload, { runAfter } = {}) {
  const [r] = await conn.execute(
    'INSERT INTO jobs (type, payload, run_after) VALUES (?, ?, ?)',
    [type, JSON.stringify(payload), runAfter || new Date()],
  );
  return r.insertId;
}

// Claims up to `limit` due jobs for this worker to run now, marking them processing.

export async function claimJobs(pool, limit = 5) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Lock pending jobs while this worker claims them.
    const [rows] = await conn.query(
      "SELECT id FROM jobs WHERE status = 'pending' AND run_after <= NOW() ORDER BY id LIMIT ? FOR UPDATE",
      [limit],
    );

    if (!rows.length) {
      await conn.commit();
      return [];
    }

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    await conn.query(
      `UPDATE jobs SET status = 'processing', attempts = attempts + 1 WHERE id IN (${placeholders})`,
      ids,
    );

    const [jobs] = await conn.query(
      `SELECT * FROM jobs WHERE id IN (${placeholders})`,
      ids,
    );

    await conn.commit();

    return jobs.map((job) => ({
      ...job,
      payload:
        typeof job.payload === 'string'
          ? JSON.parse(job.payload)
          : job.payload,
    }));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function markDone(pool, id) {
  await pool.execute("UPDATE jobs SET status = 'done' WHERE id = ?", [id]);
}

// Failed jobs back off with a short delay and retry up to max_attempts, then stay failed (a dead letter).
// This is not an infinite retry loop: attempts is capped and checked before rescheduling.
export async function markFailed(pool, job, error) {
  const message = String(error?.message || error).slice(0, 500);
  const [[row]] = await pool.execute('SELECT attempts, max_attempts FROM jobs WHERE id = ?', [job.id]);
  if (row.attempts >= row.max_attempts) {
    await pool.execute("UPDATE jobs SET status = 'failed', last_error = ? WHERE id = ?", [message, job.id]);
  } else {
    const delaySeconds = Math.min(300, 5 * 2 ** row.attempts);
    await pool.execute("UPDATE jobs SET status = 'pending', last_error = ?, run_after = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?", [message, delaySeconds, job.id]);
  }
}
