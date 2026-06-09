import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getDataDirPath, getPgPool, getStorageBackend } from './store.js';
import { AUTH_TOKEN_TTL_MS, createAuthToken } from './utils/helpers.js';

// Almacén de sesiones persistente. Reemplaza el Map en memoria para que las
// sesiones sobrevivan reinicios del proceso. Usa el mismo backend que el estado
// principal: tabla Postgres cuando hay DATABASE_URL, o un archivo JSON local.

const USE_POSTGRES = getStorageBackend() === 'postgres';
const SESSIONS_TABLE = 'mesa_it_sessions';
const SESSIONS_FILE = path.join(getDataDirPath(), 'sessions.json');

function isExpired(issuedAt) {
  return Date.now() - Number(issuedAt || 0) > AUTH_TOKEN_TTL_MS;
}

// --- Backend Postgres ---

let pgInitPromise = null;

async function ensurePgSessions() {
  if (!pgInitPromise) {
    const pool = getPgPool();
    pgInitPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS ${SESSIONS_TABLE} (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        issued_at BIGINT NOT NULL
      )
    `).catch((error) => {
      pgInitPromise = null;
      throw error;
    });
  }
  await pgInitPromise;
}

const pg = {
  async create(user) {
    await ensurePgSessions();
    const pool = getPgPool();
    const token = createAuthToken();
    await pool.query(
      `INSERT INTO ${SESSIONS_TABLE} (token, user_id, username, issued_at) VALUES ($1, $2, $3, $4)`,
      [token, Number(user.id), String(user.username).toLowerCase(), Date.now()],
    );
    return token;
  },
  async get(token) {
    await ensurePgSessions();
    const pool = getPgPool();
    const result = await pool.query(
      `SELECT user_id, username, issued_at FROM ${SESSIONS_TABLE} WHERE token = $1`,
      [token],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (isExpired(row.issued_at)) {
      await pool.query(`DELETE FROM ${SESSIONS_TABLE} WHERE token = $1`, [token]);
      return null;
    }
    return { userId: Number(row.user_id), username: String(row.username), issuedAt: Number(row.issued_at) };
  },
  async remove(token) {
    await ensurePgSessions();
    await getPgPool().query(`DELETE FROM ${SESSIONS_TABLE} WHERE token = $1`, [token]);
  },
  async removeByUserId(userId) {
    await ensurePgSessions();
    await getPgPool().query(`DELETE FROM ${SESSIONS_TABLE} WHERE user_id = $1`, [Number(userId)]);
  },
};

// --- Backend de archivo (single-instance) ---

let cache = null; // Map<token, { userId, username, issuedAt }>
let loadPromise = null;
let writeQueue = Promise.resolve();

async function loadFileSessions() {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      const map = new Map();
      try {
        const raw = await fs.readFile(SESSIONS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            const token = String(entry?.token || '');
            const userId = Number(entry?.userId);
            const username = String(entry?.username || '').toLowerCase();
            const issuedAt = Number(entry?.issuedAt);
            if (token && Number.isFinite(userId) && username && Number.isFinite(issuedAt) && !isExpired(issuedAt)) {
              map.set(token, { userId, username, issuedAt });
            }
          });
        }
      } catch {
        // Sin archivo o corrupto: empezamos con sesiones vacías.
      }
      cache = map;
      return cache;
    })();
  }
  return loadPromise;
}

function persistFileSessions() {
  const snapshot = cache ? Array.from(cache.entries()).map(([token, value]) => ({ token, ...value })) : [];
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(snapshot), 'utf8');
  }).catch(() => undefined);
  return writeQueue;
}

const file = {
  async create(user) {
    const map = await loadFileSessions();
    const token = createAuthToken();
    map.set(token, { userId: Number(user.id), username: String(user.username).toLowerCase(), issuedAt: Date.now() });
    await persistFileSessions();
    return token;
  },
  async get(token) {
    const map = await loadFileSessions();
    const session = map.get(token);
    if (!session) return null;
    if (isExpired(session.issuedAt)) {
      map.delete(token);
      await persistFileSessions();
      return null;
    }
    return { ...session };
  },
  async remove(token) {
    const map = await loadFileSessions();
    if (map.delete(token)) await persistFileSessions();
  },
  async removeByUserId(userId) {
    const map = await loadFileSessions();
    let changed = false;
    for (const [token, session] of map.entries()) {
      if (Number(session.userId) === Number(userId)) {
        map.delete(token);
        changed = true;
      }
    }
    if (changed) await persistFileSessions();
  },
};

const backend = USE_POSTGRES ? pg : file;

export function createSession(user) {
  return backend.create(user);
}

export function getSession(token) {
  if (!token) return Promise.resolve(null);
  return backend.get(token);
}

export function deleteSession(token) {
  if (!token) return Promise.resolve();
  return backend.remove(token);
}

export function deleteSessionsByUserId(userId) {
  return backend.removeByUserId(userId);
}
