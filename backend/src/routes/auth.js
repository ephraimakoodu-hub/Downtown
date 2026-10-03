import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { withTransaction } from '../config/db.js';
import { enqueue } from '../jobs/queue.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { COOKIE_NAME, cookieOptions, signSession, authenticate } from '../middleware/auth.js';
import { HttpError, unauthorized } from '../utils/httpError.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

// Compared against when the email is unknown so response time does not reveal valid accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export function authRouter(env, pool) {
  const r = Router();

  r.post('/register', authLimiter, async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const hash = await bcrypt.hash(body.password, 12);
      try {
        const { user } = await withTransaction(pool, async (conn) => {
          const [result] = await conn.execute(
            "INSERT INTO users (email, full_name, password_hash, role_id) SELECT ?, ?, ?, id FROM roles WHERE name = 'customer'",
            [body.email, body.fullName, hash],
          );
          const created = { id: result.insertId, role: 'customer' };
          const token = randomBytes(32).toString('hex');
          const tokenHash = createHash('sha256').update(token).digest('hex');
          await conn.execute('INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))', [created.id, tokenHash]);
          // Queued, not sent inline: the HTTP response does not wait on an email provider.
          await enqueue(conn, 'send_email', { to: body.email, subject: 'Verify your email', text: `Verification token: ${token}` });
          return { user: created };
        });
        res.cookie(COOKIE_NAME, signSession(env, user), cookieOptions(env));
        return res.status(201).json({ user: { id: user.id, email: body.email, fullName: body.fullName, role: 'customer' } });
      } catch (err) {
        if (err?.code === 'ER_DUP_ENTRY') {
          throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists. Try signing in instead.');
        }
        throw err;
      }
    } catch (err) { next(err); }
  });

  r.post('/login', authLimiter, async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const [rows] = await pool.execute(
        'SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1',
        [body.email],
      );
      const user = rows[0];
      const ok = await bcrypt.compare(body.password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok || !user.is_active) throw unauthorized('The email or password is not correct.');
      res.cookie(COOKIE_NAME, signSession(env, user), cookieOptions(env));
      res.json({ user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
    } catch (err) { next(err); }
  });

  r.post('/logout', (req, res) => {
    const { maxAge, ...opts } = cookieOptions(env);
    res.clearCookie(COOKIE_NAME, opts);
    res.status(204).end();
  });

  r.get('/me', authenticate(env, pool), async (req, res, next) => {
    try {
      const u = req.user;
      const [perms] = await pool.execute(
        'SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id JOIN roles r ON r.id = rp.role_id WHERE r.name = ?', [u.role]);
      const [[full]] = await pool.execute('SELECT email_verified_at FROM users WHERE id = ?', [u.id]);
      res.set('Cache-Control', 'no-store');
      res.json({ user: { id: u.id, email: u.email, fullName: u.full_name, role: u.role, permissions: perms.map((x) => x.code), emailVerified: Boolean(full.email_verified_at) } });
    } catch (err) { next(err); }
  });

  r.post('/change-password', authenticate(env, pool), authLimiter, async (req, res, next) => {
    try {
      const b = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) }).strict().parse(req.body);
      const [[row]] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (!(await bcrypt.compare(b.currentPassword, row.password_hash))) throw new HttpError(400, 'WRONG_PASSWORD', 'Your current password is not correct.');
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.newPassword, 12), req.user.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // Always answers the same way so it cannot be used to discover which emails have accounts.
  r.post('/forgot-password', authLimiter, async (req, res, next) => {
    try {
      const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict().parse(req.body);
      await withTransaction(pool, async (conn) => {
        const [[u]] = await conn.execute('SELECT id, is_active FROM users WHERE email = ?', [email]);
        if (u && u.is_active) {
          const token = randomBytes(32).toString('hex');
          const hash = createHash('sha256').update(token).digest('hex');
          await conn.execute('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))', [u.id, hash]);
          await enqueue(conn, 'send_email', { to: email, subject: 'Reset your password', text: `Reset token: ${token}` });
        }
      });
      res.json({ message: 'If an account exists for that email, reset instructions will be sent.' });
    } catch (err) { next(err); }
  });

  // Verifies the email address the token was issued for. Tokens are single use and expire after 24 hours.
  r.post('/verify-email', async (req, res, next) => {
    try {
      const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
      const hash = createHash('sha256').update(token).digest('hex');
      await withTransaction(pool, async (conn) => {
        const [[v]] = await conn.execute('SELECT id, user_id FROM email_verifications WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE', [hash]);
        if (!v) throw new HttpError(400, 'INVALID_TOKEN', 'This verification link is invalid or has expired. Request a new one.');
        await conn.execute('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [v.user_id]);
        await conn.execute('UPDATE email_verifications SET used_at = NOW() WHERE id = ?', [v.id]);
      });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // Re-sends a verification email for the signed in account. Always answers the same way to avoid
  // being usable to spam an arbitrary address, since it only acts on the current session's own account.
  r.post('/resend-verification', authenticate(env, pool), authLimiter, async (req, res, next) => {
    try {
      await withTransaction(pool, async (conn) => {
        const [[u]] = await conn.execute('SELECT email, email_verified_at FROM users WHERE id = ? FOR UPDATE', [req.user.id]);
        if (!u.email_verified_at) {
          const token = randomBytes(32).toString('hex');
          const tokenHash = createHash('sha256').update(token).digest('hex');
          await conn.execute('INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))', [req.user.id, tokenHash]);
          await enqueue(conn, 'send_email', { to: u.email, subject: 'Verify your email', text: `Verification token: ${token}` });
        }
      });
      res.json({ message: 'If your email is not yet verified, a new verification message will be sent.' });
    } catch (err) { next(err); }
  });

  r.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
      const b = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), newPassword: z.string().min(10).max(128) }).strict().parse(req.body);
      const hash = createHash('sha256').update(b.token).digest('hex');
      const [[t]] = await pool.execute('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [hash]);
      if (!t) throw new HttpError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired. Request a new one.');
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(b.newPassword, 12), t.user_id]);
      await pool.execute('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [t.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  });

  return r;
}
