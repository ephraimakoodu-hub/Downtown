
import jwt from 'jsonwebtoken';
import { unauthorized, forbidden } from '../utils/httpError.js';

export const COOKIE_NAME = 'ds_session';

export function cookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}

export function signSession(env, user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

/**
 * Loads and validates the current user session.
 *
 * Important:
 * - The client never decides the user's current role.
 * - The role is always loaded from the database.
 * - Disabled/deleted users are rejected.
 * - Invalid/expired sessions return 401 instead of crashing.
 * - Database failures are passed to the central error handler.
 */
export function authenticate(env, pool) {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.[COOKIE_NAME];

      if (!token) {
        return next(unauthorized('Please sign in to continue.'));
      }

      let payload;

      try {
        payload = jwt.verify(token, env.JWT_SECRET, {
          algorithms: ['HS256'],
        });
      } catch {
        return next(
          unauthorized('Your session has expired. Please sign in again.'),
        );
      }

      const userId = Number(payload?.sub);

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return next(
          unauthorized('Your session is invalid. Please sign in again.'),
        );
      }

      const [rows] = await pool.execute(
        `SELECT
           u.id,
           u.email,
           u.full_name,
           u.is_active,
           r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [userId],
      );

      const user = rows[0];

      if (!user || !user.is_active) {
        return next(
          unauthorized('Your session has expired. Please sign in again.'),
        );
      }

      req.user = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_active: Boolean(user.is_active),
        role: user.role,
      };

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Requires a specific server-side permission.
 *
 * Permissions are determined entirely by the database.
 * The browser cannot grant itself a permission.
 */
export function requirePermission(pool, permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(unauthorized('Please sign in to continue.'));
      }

      if (!permission || typeof permission !== 'string') {
        return next(forbidden());
      }

      const [rows] = await pool.execute(
        `SELECT 1
           FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           JOIN roles r ON r.id = rp.role_id
          WHERE r.name = ?
            AND p.code = ?
          LIMIT 1`,
        [req.user.role, permission],
      );

      if (!rows.length) {
        return next(forbidden());
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
