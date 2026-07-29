import {
  readDbSnapshot,
  readDbVersion,
  updateDb,
  sanitizeUser,
} from '../store.js';
import { createAuthPersistence } from '../modules/auth-persistence.js';
import {
  parseBearerToken,
  createAuthToken,
  getLoginAttemptKey,
  pushAuditWithContext,
  roleIsEnabledByCatalog,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_MS,
  LOGIN_TRACK_WINDOW_MS,
  LOGIN_ATTEMPT_GC_MS,
  AUTH_TOKEN_TTL_MS,
} from '../utils/helpers.js';

export function createAuthRuntime() {
  const authPersistence = createAuthPersistence({
    tokenTtlMs: AUTH_TOKEN_TTL_MS,
    loginMaxAttempts: LOGIN_MAX_ATTEMPTS,
    loginLockMs: LOGIN_LOCK_MS,
    loginTrackWindowMs: LOGIN_TRACK_WINDOW_MS,
    gcIntervalMs: LOGIN_ATTEMPT_GC_MS,
  });

  async function registerSession(user) {
    const token = createAuthToken();
    await authPersistence.createSession(token, user);
    return token;
  }

  async function getValidSession(token) {
    return authPersistence.getSession(token);
  }

  // Clave por-usuario independiente de la IP: evita el bypass del lockout
  // rotando X-Forwarded-For cuando hay un proxy de confianza.
  function getUsernameAttemptKey(username) {
    return `user::${String(username || '').trim().toLowerCase() || '*'}`;
  }

  async function getLoginThrottle(req, username) {
    const keys = [getLoginAttemptKey(req, username), getUsernameAttemptKey(username)];
    return authPersistence.getLoginThrottle(keys);
  }

  async function registerLoginFailure(req, username) {
    const keys = [getLoginAttemptKey(req, username), getUsernameAttemptKey(username)];
    return authPersistence.registerLoginFailure(keys);
  }

  async function clearLoginFailures(req, username) {
    const keys = [getLoginAttemptKey(req, username), getUsernameAttemptKey(username)];
    await authPersistence.clearLoginFailures(keys);
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

      const session = await getValidSession(token);
      if (!session) {
        return res.status(401).json({ error: 'Sesión inválida o expirada.' });
      }

      const isConditionalBootstrap = req.method === 'GET'
        && String(req.originalUrl || '').split('?')[0] === '/api/bootstrap'
        && Boolean(req.headers['if-none-match']);
      if (isConditionalBootstrap) {
        const currentVersion = await readDbVersion();
        if (
          currentVersion !== null
          && Number(session.validatedStateVersion) === currentVersion
          && session.user
        ) {
          req.authToken = token;
          req.authUser = sanitizeUser(session.user);
          req.appDbVersion = currentVersion;
          return next();
        }
      }

      const { db, version } = await readDbSnapshot();
      const user = db.users.find(
        (u) =>
          Number(u.id) === Number(session.userId) &&
          String(u.username).toLowerCase() === String(session.username).toLowerCase() &&
          Number(u.authVersion || 0) === Number(session.authVersion || 0) &&
          u.activo !== false,
      );

      if (!user) {
        await authPersistence.destroySession(token);
        return res.status(401).json({ error: 'Usuario no autorizado.' });
      }
      if (!roleIsEnabledByCatalog(db, user.rol)) {
        await authPersistence.destroySession(token);
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
      req.appDb = db;
      req.appDbVersion = version;
      if (Number(session.validatedStateVersion) !== Number(version)) {
        await authPersistence.updateSessionValidation(token, user, version);
      }
      next();
    } catch (error) {
      next(error);
    }
  }

  async function revokeSessionsByUserId(userId) {
    await authPersistence.revokeSessionsByUserId(userId);
  }

  async function destroySession(token) {
    if (!token) return;
    await authPersistence.destroySession(token);
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
