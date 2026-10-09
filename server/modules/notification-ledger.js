import { randomUUID } from 'node:crypto';
import { withPgRetry } from './postgres-pool.js';

export const PG_LEDGER_TABLE = 'mesa_it_avisos_enviados';
export const NOTIFICATION_STATES = Object.freeze({ PENDING: 'pending', SENT: 'sent', FAILED: 'failed' });

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${PG_LEDGER_TABLE} (
  ticket_id INTEGER NOT NULL, tipo TEXT NOT NULL, enviado_en TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, lease_token TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), next_retry_at TIMESTAMPTZ,
  PRIMARY KEY (ticket_id, tipo)
);
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ${PG_LEDGER_TABLE} ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE ${PG_LEDGER_TABLE} ALTER COLUMN enviado_en DROP NOT NULL;
ALTER TABLE ${PG_LEDGER_TABLE} ALTER COLUMN enviado_en DROP DEFAULT;`;

const START_SQL = `INSERT INTO ${PG_LEDGER_TABLE}
  (ticket_id, tipo, status, attempts, lease_token, updated_at, next_retry_at)
 VALUES ($1, $2, 'pending', 1, $3, $4, $5)
 ON CONFLICT (ticket_id, tipo) DO UPDATE SET
   status = 'pending', attempts = ${PG_LEDGER_TABLE}.attempts + 1,
   lease_token = EXCLUDED.lease_token, updated_at = EXCLUDED.updated_at,
   next_retry_at = EXCLUDED.next_retry_at, last_error = NULL
 WHERE ${PG_LEDGER_TABLE}.attempts < $6 AND (
   (${PG_LEDGER_TABLE}.status = 'failed'
     AND (${PG_LEDGER_TABLE}.next_retry_at IS NULL OR ${PG_LEDGER_TABLE}.next_retry_at <= $4))
   OR (${PG_LEDGER_TABLE}.status = 'pending' AND ${PG_LEDGER_TABLE}.updated_at <= $7)
 )
 RETURNING status, attempts, lease_token`;

const SENT_SQL = `UPDATE ${PG_LEDGER_TABLE}
 SET status = 'sent', enviado_en = $4, updated_at = $4, next_retry_at = NULL, last_error = NULL
 WHERE ticket_id = $1 AND tipo = $2 AND status = 'pending' AND lease_token = $3`;
const FAILED_SQL = `UPDATE ${PG_LEDGER_TABLE}
 SET status = 'failed', last_error = $4, updated_at = $5, next_retry_at = $6
 WHERE ticket_id = $1 AND tipo = $2 AND status = 'pending' AND lease_token = $3`;
const GET_SQL = `SELECT ticket_id, tipo, status, attempts, last_error, enviado_en, updated_at, next_retry_at
 FROM ${PG_LEDGER_TABLE} WHERE ticket_id = $1 AND tipo = $2`;

const errorSummary = (value) => String(value?.reason || value?.code || value?.message || value || 'SEND_ERROR').slice(0, 300);

export function createNotificationLedger({ getPool, backend }) {
  const usaPostgres = backend === 'postgres';
  const memory = new Map();
  let schemaPromise = null;

  async function poolOrNull() {
    if (!usaPostgres) return null;
    return (await getPool()) || null;
  }

  async function ensureSchema() {
    const pool = await poolOrNull();
    if (!pool) return;
    if (!schemaPromise) {
      schemaPromise = pool.query(CREATE_TABLE_SQL).catch((error) => {
        schemaPromise = null;
        throw error;
      });
    }
    await schemaPromise;
  }

  return {
    ensureSchema,
    usaPostgres,

    async iniciar(ticketId, tipo, { maxAttempts = 3, retryDelayMs = 5 * 60_000,
      leaseTimeoutMs = 10 * 60_000, nowMs = Date.now() } = {}) {
      const id = Number(ticketId);
      const kind = String(tipo);
      const key = `${id}:${kind}`;
      const token = randomUUID();
      const nowIso = new Date(nowMs).toISOString();
      const nextRetryIso = new Date(nowMs + retryDelayMs).toISOString();
      const pool = await poolOrNull();
      if (!pool) {
        const current = memory.get(key);
        const canRetry = current?.attempts < maxAttempts && (
          (current.status === NOTIFICATION_STATES.FAILED && (!current.nextRetryAt || current.nextRetryAt <= nowMs))
          || (current.status === NOTIFICATION_STATES.PENDING && current.updatedAt + leaseTimeoutMs <= nowMs)
        );
        if (current && !canRetry) return { acquired: false, record: { ...current } };
        const record = { status: NOTIFICATION_STATES.PENDING, attempts: (current?.attempts || 0) + 1,
          leaseToken: token, updatedAt: nowMs, nextRetryAt: nowMs + retryDelayMs, lastError: null };
        memory.set(key, record);
        return { acquired: true, token, record: { ...record } };
      }
      await ensureSchema();
      const staleBeforeIso = new Date(nowMs - leaseTimeoutMs).toISOString();
      const result = await withPgRetry(() => pool.query(START_SQL,
        [id, kind, token, nowIso, nextRetryIso, maxAttempts, staleBeforeIso]));
      return { acquired: result.rowCount > 0, token: result.rowCount > 0 ? token : null, record: result.rows?.[0] || null };
    },

    async marcarEnviada(ticketId, tipo, token, { nowMs = Date.now() } = {}) {
      const id = Number(ticketId);
      const kind = String(tipo);
      const key = `${id}:${kind}`;
      const pool = await poolOrNull();
      if (!pool) {
        const current = memory.get(key);
        if (!current || current.status !== NOTIFICATION_STATES.PENDING || current.leaseToken !== token) return false;
        memory.set(key, { ...current, status: NOTIFICATION_STATES.SENT, sentAt: nowMs, updatedAt: nowMs, nextRetryAt: null });
        return true;
      }
      await ensureSchema();
      const result = await withPgRetry(() => pool.query(SENT_SQL, [id, kind, token, new Date(nowMs).toISOString()]));
      return result.rowCount > 0;
    },

    async marcarFallida(ticketId, tipo, token, error, { retryDelayMs = 5 * 60_000, nowMs = Date.now() } = {}) {
      const id = Number(ticketId);
      const kind = String(tipo);
      const key = `${id}:${kind}`;
      const summary = errorSummary(error);
      const pool = await poolOrNull();
      if (!pool) {
        const current = memory.get(key);
        if (!current || current.status !== NOTIFICATION_STATES.PENDING || current.leaseToken !== token) return false;
        memory.set(key, { ...current, status: NOTIFICATION_STATES.FAILED, lastError: summary,
          updatedAt: nowMs, nextRetryAt: nowMs + retryDelayMs });
        return true;
      }
      await ensureSchema();
      const result = await withPgRetry(() => pool.query(FAILED_SQL, [id, kind, token, summary,
        new Date(nowMs).toISOString(), new Date(nowMs + retryDelayMs).toISOString()]));
      return result.rowCount > 0;
    },

    async obtener(ticketId, tipo) {
      const id = Number(ticketId);
      const kind = String(tipo);
      const pool = await poolOrNull();
      if (!pool) return memory.has(`${id}:${kind}`) ? { ...memory.get(`${id}:${kind}`) } : null;
      await ensureSchema();
      const result = await withPgRetry(() => pool.query(GET_SQL, [id, kind]));
      return result.rows?.[0] || null;
    },
  };
}

export async function entregarNotificacion({ ledger, ticketId, tipo, enviar, maxAttempts = 3, retryDelayMs = 5 * 60_000, log = console.error }) {
  try {
    const started = await ledger.iniciar(ticketId, tipo, { maxAttempts, retryDelayMs });
    if (!started.acquired) return { sent: false, skipped: true, record: started.record };
    let result;
    try {
      result = await enviar();
    } catch (error) {
      result = { sent: false, reason: 'SEND_ERROR', error };
    }
    if (result?.sent === true) {
      await ledger.marcarEnviada(ticketId, tipo, started.token);
      return { ...result, status: NOTIFICATION_STATES.SENT };
    }
    await ledger.marcarFallida(ticketId, tipo, started.token, result, { retryDelayMs });
    return { ...result, sent: false, status: NOTIFICATION_STATES.FAILED };
  } catch (error) {
    log(`No se pudo procesar la notificación ${tipo} del ticket #${ticketId}:`, error);
    return { sent: false, status: NOTIFICATION_STATES.FAILED, error };
  }
}
