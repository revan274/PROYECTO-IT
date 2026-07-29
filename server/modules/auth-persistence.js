import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  getDataDirPath,
  getSharedPostgresPool,
  getStorageBackend,
} from '../store.js';

const PG_SESSION_TABLE = 'mesa_it_auth_sessions';
const PG_LOGIN_ATTEMPT_TABLE = 'mesa_it_login_attempts';
const FILE_NAME = 'auth-runtime.json';

function hashKey(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function createEmptyFileState() {
  return {
    sessions: Object.create(null),
    loginAttempts: Object.create(null),
  };
}

function normalizeSession(value) {
  const userId = Number(value?.userId);
  const username = String(value?.username || '').trim().toLowerCase();
  const issuedAt = Number(value?.issuedAt);
  const expiresAt = Number(value?.expiresAt);
  const authVersion = Math.max(0, Math.trunc(Number(value?.authVersion) || 0));
  const nombre = String(value?.nombre || '').trim();
  const rol = String(value?.rol || '').trim().toLowerCase();
  const departamento = String(value?.departamento || '').trim().toUpperCase();
  const validatedStateVersion = Math.max(
    0,
    Math.trunc(Number(value?.validatedStateVersion) || 0),
  );
  if (!Number.isFinite(userId) || !username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    return null;
  }
  return {
    userId: Math.trunc(userId),
    username,
    issuedAt: Math.trunc(issuedAt),
    expiresAt: Math.trunc(expiresAt),
    authVersion,
    nombre,
    rol,
    departamento,
    validatedStateVersion,
    user: {
      userId: Math.trunc(userId),
      id: Math.trunc(userId),
      nombre,
      username,
      rol,
      departamento,
      activo: true,
    },
  };
}

function normalizeAttempt(value) {
  const count = Math.max(0, Math.trunc(Number(value?.count) || 0));
  const windowStartedAt = Math.max(0, Math.trunc(Number(value?.windowStartedAt) || 0));
  const lastFailedAt = Math.max(0, Math.trunc(Number(value?.lastFailedAt) || 0));
  const lockedUntil = Math.max(0, Math.trunc(Number(value?.lockedUntil) || 0));
  if (!windowStartedAt) return null;
  return { count, windowStartedAt, lastFailedAt, lockedUntil };
}

function normalizeFileState(value) {
  const normalized = createEmptyFileState();
  const sessions = value?.sessions && typeof value.sessions === 'object' ? value.sessions : {};
  const loginAttempts = value?.loginAttempts && typeof value.loginAttempts === 'object'
    ? value.loginAttempts
    : {};

  for (const [key, session] of Object.entries(sessions)) {
    if (!/^[a-f0-9]{64}$/.test(key)) continue;
    const parsed = normalizeSession(session);
    if (parsed) normalized.sessions[key] = parsed;
  }
  for (const [key, attempt] of Object.entries(loginAttempts)) {
    if (!/^[a-f0-9]{64}$/.test(key)) continue;
    const parsed = normalizeAttempt(attempt);
    if (parsed) normalized.loginAttempts[key] = parsed;
  }

  return normalized;
}

function isAttemptExpired(item, nowTs, trackWindowMs) {
  if (!item) return true;
  if (item.lockedUntil > nowTs) return false;
  if (item.lockedUntil > 0) {
    return nowTs - item.lastFailedAt > trackWindowMs;
  }
  return nowTs - item.windowStartedAt > trackWindowMs;
}

function bumpAttempt(current, nowTs, options) {
  const windowExpired = !current
    || nowTs - Number(current.windowStartedAt || 0) > options.loginTrackWindowMs;
  const next = windowExpired
    ? { count: 1, windowStartedAt: nowTs, lastFailedAt: nowTs, lockedUntil: 0 }
    : {
        ...current,
        count: Number(current.count || 0) + 1,
        lastFailedAt: nowTs,
      };

  if (next.count >= options.loginMaxAttempts) {
    next.lockedUntil = nowTs + options.loginLockMs;
    next.count = 0;
    next.windowStartedAt = nowTs;
  }
  return next;
}

export function createAuthPersistence({
  backend = getStorageBackend(),
  dataDir = getDataDirPath(),
  postgresPoolProvider = getSharedPostgresPool,
  tokenTtlMs,
  loginMaxAttempts,
  loginLockMs,
  loginTrackWindowMs,
  gcIntervalMs,
} = {}) {
  const options = {
    tokenTtlMs: Math.max(1, Math.trunc(Number(tokenTtlMs) || 1)),
    loginMaxAttempts: Math.max(1, Math.trunc(Number(loginMaxAttempts) || 1)),
    loginLockMs: Math.max(1, Math.trunc(Number(loginLockMs) || 1)),
    loginTrackWindowMs: Math.max(1, Math.trunc(Number(loginTrackWindowMs) || 1)),
    gcIntervalMs: Math.max(1, Math.trunc(Number(gcIntervalMs) || 60_000)),
  };
  const usePostgres = backend === 'postgres';
  const filePath = path.join(dataDir, FILE_NAME);
  let fileQueue = Promise.resolve();
  let pgInitPromise = null;
  let lastPgGcAt = 0;

  async function ensurePostgresTables() {
    if (!usePostgres) return null;
    if (!pgInitPromise) {
      pgInitPromise = (async () => {
        const pool = await postgresPoolProvider();
        if (!pool) throw new Error('PostgreSQL no está disponible para persistir autenticación.');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ${PG_SESSION_TABLE} (
            token_hash CHAR(64) PRIMARY KEY,
            user_id BIGINT NOT NULL,
            username TEXT NOT NULL,
            issued_at BIGINT NOT NULL,
            expires_at BIGINT NOT NULL,
            auth_version BIGINT NOT NULL DEFAULT 0,
            display_name TEXT NOT NULL DEFAULT '',
            role_name TEXT NOT NULL DEFAULT '',
            department TEXT NOT NULL DEFAULT '',
            validated_state_version BIGINT NOT NULL DEFAULT 0
          )
        `);
        await pool.query(`
          ALTER TABLE ${PG_SESSION_TABLE}
          ADD COLUMN IF NOT EXISTS auth_version BIGINT NOT NULL DEFAULT 0
        `);
        await pool.query(`
          ALTER TABLE ${PG_SESSION_TABLE}
          ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS role_name TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS validated_state_version BIGINT NOT NULL DEFAULT 0
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS mesa_it_auth_sessions_user_id_idx
          ON ${PG_SESSION_TABLE} (user_id)
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS mesa_it_auth_sessions_expires_at_idx
          ON ${PG_SESSION_TABLE} (expires_at)
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ${PG_LOGIN_ATTEMPT_TABLE} (
            attempt_key CHAR(64) PRIMARY KEY,
            failure_count INTEGER NOT NULL DEFAULT 0,
            window_started_at BIGINT NOT NULL,
            last_failed_at BIGINT NOT NULL,
            locked_until BIGINT NOT NULL DEFAULT 0
          )
        `);
        return pool;
      })().catch((error) => {
        pgInitPromise = null;
        throw error;
      });
    }
    return pgInitPromise;
  }

  async function readFileState() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return normalizeFileState(JSON.parse(raw));
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) {
        return createEmptyFileState();
      }
      throw error;
    }
  }

  async function writeFileState(state) {
    await fs.mkdir(dataDir, { recursive: true });
    const temporaryFile = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryFile, filePath);
  }

  async function withFileState(mutator) {
    const job = fileQueue.then(async () => {
      const state = await readFileState();
      const outcome = await mutator(state);
      if (outcome?.changed) await writeFileState(state);
      return outcome?.value;
    });
    fileQueue = job.catch(() => undefined);
    return job;
  }

  async function gcPostgres(nowTs) {
    if (nowTs - lastPgGcAt < options.gcIntervalMs) return;
    const pool = await ensurePostgresTables();
    await Promise.all([
      pool.query(`DELETE FROM ${PG_SESSION_TABLE} WHERE expires_at <= $1`, [nowTs]),
      pool.query(
        `DELETE FROM ${PG_LOGIN_ATTEMPT_TABLE}
         WHERE locked_until <= $1
           AND (
             (locked_until > 0 AND $1 - last_failed_at > $2)
             OR (locked_until = 0 AND $1 - window_started_at > $2)
           )`,
        [nowTs, options.loginTrackWindowMs],
      ),
    ]);
    lastPgGcAt = nowTs;
  }

  async function createSession(token, user, nowTs = Date.now()) {
    const tokenHash = hashKey(token);
    const session = {
      userId: Math.trunc(Number(user.id)),
      username: String(user.username || '').trim().toLowerCase(),
      issuedAt: Math.trunc(nowTs),
      expiresAt: Math.trunc(nowTs + options.tokenTtlMs),
      authVersion: Math.max(0, Math.trunc(Number(user.authVersion) || 0)),
      nombre: String(user.nombre || '').trim(),
      rol: String(user.rol || '').trim().toLowerCase(),
      departamento: String(user.departamento || '').trim().toUpperCase(),
      validatedStateVersion: 0,
    };

    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await gcPostgres(nowTs);
      await pool.query(
        `INSERT INTO ${PG_SESSION_TABLE}
          (
            token_hash,
            user_id,
            username,
            issued_at,
            expires_at,
            auth_version,
            display_name,
            role_name,
            department,
            validated_state_version
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (token_hash) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             username = EXCLUDED.username,
             issued_at = EXCLUDED.issued_at,
             expires_at = EXCLUDED.expires_at,
             auth_version = EXCLUDED.auth_version,
             display_name = EXCLUDED.display_name,
             role_name = EXCLUDED.role_name,
             department = EXCLUDED.department,
             validated_state_version = EXCLUDED.validated_state_version`,
        [
          tokenHash,
          session.userId,
          session.username,
          session.issuedAt,
          session.expiresAt,
          session.authVersion,
          session.nombre,
          session.rol,
          session.departamento,
          session.validatedStateVersion,
        ],
      );
      return session;
    }

    return withFileState((state) => {
      state.sessions[tokenHash] = session;
      return { changed: true, value: session };
    });
  }

  async function getSession(token, nowTs = Date.now()) {
    const tokenHash = hashKey(token);
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await gcPostgres(nowTs);
      const result = await pool.query(
        `SELECT
           user_id,
           username,
           issued_at,
           expires_at,
           auth_version,
           display_name,
           role_name,
           department,
           validated_state_version
         FROM ${PG_SESSION_TABLE}
         WHERE token_hash = $1`,
        [tokenHash],
      );
      const row = result.rows[0];
      const session = normalizeSession(row && {
        userId: row.user_id,
        username: row.username,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        authVersion: row.auth_version,
        nombre: row.display_name,
        rol: row.role_name,
        departamento: row.department,
        validatedStateVersion: row.validated_state_version,
      });
      if (!session || session.expiresAt <= nowTs) {
        if (row) {
          await pool.query(`DELETE FROM ${PG_SESSION_TABLE} WHERE token_hash = $1`, [tokenHash]);
        }
        return null;
      }
      return session;
    }

    return withFileState((state) => {
      let changed = false;
      for (const [key, session] of Object.entries(state.sessions)) {
        if (session.expiresAt <= nowTs) {
          delete state.sessions[key];
          changed = true;
        }
      }
      return {
        changed,
        value: state.sessions[tokenHash] || null,
      };
    });
  }

  async function destroySession(token) {
    if (!token) return;
    const tokenHash = hashKey(token);
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await pool.query(`DELETE FROM ${PG_SESSION_TABLE} WHERE token_hash = $1`, [tokenHash]);
      return;
    }
    await withFileState((state) => {
      const changed = Object.prototype.hasOwnProperty.call(state.sessions, tokenHash);
      delete state.sessions[tokenHash];
      return { changed };
    });
  }

  async function updateSessionValidation(token, user, stateVersion) {
    const tokenHash = hashKey(token);
    const validation = {
      userId: Math.trunc(Number(user.id)),
      username: String(user.username || '').trim().toLowerCase(),
      authVersion: Math.max(0, Math.trunc(Number(user.authVersion) || 0)),
      nombre: String(user.nombre || '').trim(),
      rol: String(user.rol || '').trim().toLowerCase(),
      departamento: String(user.departamento || '').trim().toUpperCase(),
      validatedStateVersion: Math.max(0, Math.trunc(Number(stateVersion) || 0)),
    };

    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await pool.query(
        `UPDATE ${PG_SESSION_TABLE}
         SET user_id = $2,
             username = $3,
             auth_version = $4,
             display_name = $5,
             role_name = $6,
             department = $7,
             validated_state_version = $8
         WHERE token_hash = $1`,
        [
          tokenHash,
          validation.userId,
          validation.username,
          validation.authVersion,
          validation.nombre,
          validation.rol,
          validation.departamento,
          validation.validatedStateVersion,
        ],
      );
      return;
    }

    await withFileState((state) => {
      const session = state.sessions[tokenHash];
      if (!session) return { changed: false };
      state.sessions[tokenHash] = {
        ...session,
        ...validation,
      };
      return { changed: true };
    });
  }

  async function revokeSessionsByUserId(userId) {
    const normalizedUserId = Math.trunc(Number(userId));
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await pool.query(`DELETE FROM ${PG_SESSION_TABLE} WHERE user_id = $1`, [normalizedUserId]);
      return;
    }
    await withFileState((state) => {
      let changed = false;
      for (const [key, session] of Object.entries(state.sessions)) {
        if (Number(session.userId) === normalizedUserId) {
          delete state.sessions[key];
          changed = true;
        }
      }
      return { changed };
    });
  }

  function normalizeAttemptKeys(keys) {
    return Array.from(new Set(keys.map(hashKey))).sort((left, right) => left.localeCompare(right));
  }

  async function getLoginThrottle(keys, nowTs = Date.now()) {
    const attemptKeys = normalizeAttemptKeys(keys);
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await gcPostgres(nowTs);
      const result = await pool.query(
        `SELECT attempt_key, failure_count, window_started_at, last_failed_at, locked_until
         FROM ${PG_LOGIN_ATTEMPT_TABLE}
         WHERE attempt_key::text = ANY($1::text[])`,
        [attemptKeys],
      );
      let lockedUntil = 0;
      for (const row of result.rows) {
        lockedUntil = Math.max(lockedUntil, Number(row.locked_until) || 0);
      }
      return lockedUntil > nowTs
        ? {
            lockedUntil,
            retryAfterSec: Math.max(1, Math.ceil((lockedUntil - nowTs) / 1000)),
          }
        : null;
    }

    return withFileState((state) => {
      let changed = false;
      let lockedUntil = 0;
      for (const key of attemptKeys) {
        const item = state.loginAttempts[key];
        if (isAttemptExpired(item, nowTs, options.loginTrackWindowMs)) {
          if (item) {
            delete state.loginAttempts[key];
            changed = true;
          }
          continue;
        }
        lockedUntil = Math.max(lockedUntil, Number(item.lockedUntil) || 0);
      }
      return {
        changed,
        value: lockedUntil > nowTs
          ? {
              lockedUntil,
              retryAfterSec: Math.max(1, Math.ceil((lockedUntil - nowTs) / 1000)),
            }
          : null,
      };
    });
  }

  async function registerLoginFailure(keys, nowTs = Date.now()) {
    const attemptKeys = normalizeAttemptKeys(keys);
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const key of attemptKeys) {
          await client.query(
            `INSERT INTO ${PG_LOGIN_ATTEMPT_TABLE}
              (attempt_key, failure_count, window_started_at, last_failed_at, locked_until)
             VALUES ($1, 0, $2, $2, 0)
             ON CONFLICT (attempt_key) DO NOTHING`,
            [key, nowTs],
          );
        }
        const selected = await client.query(
          `SELECT attempt_key, failure_count, window_started_at, last_failed_at, locked_until
           FROM ${PG_LOGIN_ATTEMPT_TABLE}
           WHERE attempt_key::text = ANY($1::text[])
           ORDER BY attempt_key
           FOR UPDATE`,
          [attemptKeys],
        );

        let lockedUntil = 0;
        for (const row of selected.rows) {
          const next = bumpAttempt(normalizeAttempt({
            count: row.failure_count,
            windowStartedAt: row.window_started_at,
            lastFailedAt: row.last_failed_at,
            lockedUntil: row.locked_until,
          }), nowTs, options);
          await client.query(
            `UPDATE ${PG_LOGIN_ATTEMPT_TABLE}
             SET failure_count = $2,
                 window_started_at = $3,
                 last_failed_at = $4,
                 locked_until = $5
             WHERE attempt_key = $1`,
            [row.attempt_key, next.count, next.windowStartedAt, next.lastFailedAt, next.lockedUntil],
          );
          lockedUntil = Math.max(lockedUntil, next.lockedUntil);
        }
        await client.query('COMMIT');
        return {
          locked: lockedUntil > nowTs,
          retryAfterSec: lockedUntil > nowTs
            ? Math.max(1, Math.ceil((lockedUntil - nowTs) / 1000))
            : 0,
        };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    return withFileState((state) => {
      let lockedUntil = 0;
      for (const key of attemptKeys) {
        const current = state.loginAttempts[key];
        const next = bumpAttempt(current, nowTs, options);
        state.loginAttempts[key] = next;
        lockedUntil = Math.max(lockedUntil, next.lockedUntil);
      }
      return {
        changed: true,
        value: {
          locked: lockedUntil > nowTs,
          retryAfterSec: lockedUntil > nowTs
            ? Math.max(1, Math.ceil((lockedUntil - nowTs) / 1000))
            : 0,
        },
      };
    });
  }

  async function clearLoginFailures(keys) {
    const attemptKeys = normalizeAttemptKeys(keys);
    if (usePostgres) {
      const pool = await ensurePostgresTables();
      await pool.query(
        `DELETE FROM ${PG_LOGIN_ATTEMPT_TABLE} WHERE attempt_key::text = ANY($1::text[])`,
        [attemptKeys],
      );
      return;
    }
    await withFileState((state) => {
      let changed = false;
      for (const key of attemptKeys) {
        if (Object.prototype.hasOwnProperty.call(state.loginAttempts, key)) {
          delete state.loginAttempts[key];
          changed = true;
        }
      }
      return { changed };
    });
  }

  return {
    clearLoginFailures,
    createSession,
    destroySession,
    getLoginThrottle,
    getSession,
    registerLoginFailure,
    revokeSessionsByUserId,
    updateSessionValidation,
  };
}
