import { readDb, updateDb, sanitizeUser } from '../store.js';
import {
  createSession,
  deleteSession,
  deleteSessionsByUserId,
  getSession,
} from '../sessionStore.js';
import {
  parseBearerToken,
  getLoginAttemptKey,
  isDemoPasswordUser,
  pushAuditWithContext,
  roleIsEnabledByCatalog,
  asNonEmptyString,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_MS,
  LOGIN_TRACK_WINDOW_MS,
  LOGIN_ATTEMPT_GC_MS,
} from '../utils/helpers.js';

export function createAuthRuntime() {
  const loginAttempts = new Map();
  let lastLoginAttemptGcAt = 0;

  function gcLoginAttempts() {
    const nowTs = Date.now();
    if (nowTs - lastLoginAttemptGcAt < LOGIN_ATTEMPT_GC_MS) return;
    for (const [key, item] of loginAttempts.entries()) {
      const expired = !item
        || (item.lockedUntil && item.lockedUntil <= nowTs && nowTs - item.lastFailedAt > LOGIN_TRACK_WINDOW_MS)
        || (!item.lockedUntil && nowTs - item.windowStartedAt > LOGIN_TRACK_WINDOW_MS);
      if (expired) loginAttempts.delete(key);
    }
    lastLoginAttemptGcAt = nowTs;
  }

  function registerSession(user) {
    return createSession(user);
  }

  function getLoginThrottle(req, username) {
    gcLoginAttempts();
    const key = getLoginAttemptKey(req, username);
    const item = loginAttempts.get(key);
    if (!item) return null;
    if (item.lockedUntil && item.lockedUntil > Date.now()) {
      return {
        key,
        lockedUntil: item.lockedUntil,
        retryAfterSec: Math.max(1, Math.ceil((item.lockedUntil - Date.now()) / 1000)),
      };
    }
    return null;
  }

  function registerLoginFailure(req, username) {
    gcLoginAttempts();
    const key = getLoginAttemptKey(req, username);
    const nowTs = Date.now();
    const current = loginAttempts.get(key);
    const windowExpired = !current || nowTs - Number(current.windowStartedAt || 0) > LOGIN_TRACK_WINDOW_MS;

    const next = windowExpired
      ? { count: 1, windowStartedAt: nowTs, lastFailedAt: nowTs, lockedUntil: 0 }
      : {
          ...current,
          count: Number(current.count || 0) + 1,
          lastFailedAt: nowTs,
        };

    if (next.count >= LOGIN_MAX_ATTEMPTS) {
      next.lockedUntil = nowTs + LOGIN_LOCK_MS;
      next.count = 0;
      next.windowStartedAt = nowTs;
    }

    loginAttempts.set(key, next);
    return {
      locked: next.lockedUntil > nowTs,
      retryAfterSec: next.lockedUntil > nowTs ? Math.max(1, Math.ceil((next.lockedUntil - nowTs) / 1000)) : 0,
    };
  }

  function clearLoginFailures(req, username) {
    const key = getLoginAttemptKey(req, username);
    loginAttempts.delete(key);
  }

  async function writeSecurityAudit(req, payload) {
    try {
      await updateDb((db) =>
        pushAuditWithContext(db, req, {
          modulo: 'otros',
          entidad: 'sesión',
          ...payload,
        }));
    } catch {
      // No interrumpir el flujo de autenticación por fallas de auditoría.
    }
  }

  async function requireAuth(req, res, next) {
    try {
      const token = parseBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: 'Sesión requerida.' });
      }

      const session = await getSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Sesión inválida o expirada.' });
      }

      const db = await readDb();
      const user = db.users.find(
        (u) =>
          Number(u.id) === Number(session.userId) &&
          String(u.username).toLowerCase() === String(session.username).toLowerCase() &&
          u.activo !== false,
      );

      if (!user) {
        await deleteSession(token);
        return res.status(401).json({ error: 'Usuario no autorizado.' });
      }
      if (!roleIsEnabledByCatalog(db, user.rol)) {
        await deleteSession(token);
        await writeSecurityAudit(req, {
          accion: 'Sesión Rechazada',
          item: session.username || user.username || 'N/A',
          cantidad: 1,
          resultado: 'error',
          motivo: 'Rol deshabilitado',
          userId: user.id,
          username: user.username,
          rol: user.rol,
          departamento: user.departamento,
        });
        return res.status(403).json({ error: 'Tu rol está deshabilitado en catálogo.' });
      }

      req.authToken = token;
      req.authUser = sanitizeUser(user);
      next();
    } catch (error) {
      next(error);
    }
  }

  function revokeSessionsByUserId(userId) {
    return deleteSessionsByUserId(userId);
  }

  function destroySession(token) {
    return deleteSession(token);
  }

  return {
    clearLoginFailures,
    destroySession,
    getLoginThrottle,
    registerLoginFailure,
    registerSession,
    requireAuth,
    revokeSessionsByUserId,
    writeSecurityAudit,
  };
}
