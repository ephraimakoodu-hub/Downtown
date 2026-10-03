import jwt from 'jsonwebtoken';
import { unauthorized, forbidden } from '../utils/httpError.js';

export const COOKIE_NAME = 'ds_session';

export function cookieOptions(env) {
  return { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };
}

export function signSession(env, user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// Loads the session. Role is re-read from the database so revoked or changed roles apply immediately.
export function authenticate(env, pool) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) return next(unauthorized());
      let payload;
      try {
        payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        return next(unauthorized('Your session has expired. Please sign in again.'));
      }
      const [rows] = await pool.execute(
        'SELECT u.id, u.email, u.full_name, u.is_active, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1',
        [Number(payload.sub)],
      );
      const user = rows[0];
      if (!user || !user.is_active) return next(unauthorized('Your session has expired. Please sign in again.'));
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Server side permission check. Permissions come from the role_permissions table, never from the client.
export function requirePermission(pool, permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(unauthorized());
      const [rows] = await pool.execute(
        `SELECT 1 FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           JOIN roles r ON r.id = rp.role_id
          WHERE r.name = ? AND p.code = ? LIMIT 1`,
        [req.user.role, permission],
      );
      if (!rows.length) return next(forbidden());
      next();
    } catch (err) {
      next(err);
    }
  };
}
