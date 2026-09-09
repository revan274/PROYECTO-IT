// Constancia de que un aviso ya salio, para no repetirlo en cada vuelta del vigilante.
//
// Vive en una TABLA PROPIA y no como un campo dentro del ticket, por una razon concreta:
// todo el dominio esta en un unico documento JSONB que se reescribe entero bajo un lock
// global (`SELECT ... FOR UPDATE`) en cada mutacion. Un temporizador de fondo escribiendo
// ahi competiria por ese lock con las peticiones de los usuarios, y marcar "ya avise"
// no vale ese precio. Es el mismo criterio que ya siguen los adjuntos.
//
// De paso resuelve gratis el caso de mas de una instancia: `INSERT ... ON CONFLICT
// DO NOTHING` hace que solo el proceso que gane la fila envie el correo. Y por ser una
// insercion idempotente entra dentro de lo que `withPgRetry` puede reintentar sin riesgo,
// a diferencia de las mutaciones de estado.
import { withPgRetry } from './postgres-pool.js';

export const PG_LEDGER_TABLE = 'mesa_it_avisos_enviados';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${PG_LEDGER_TABLE} (
  ticket_id   INTEGER NOT NULL,
  tipo        TEXT NOT NULL,
  enviado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, tipo)
)`;

// Devuelve fila solo si de verdad la inserto: eso es "yo gane, me toca enviar".
const CLAIM_SQL = `INSERT INTO ${PG_LEDGER_TABLE} (ticket_id, tipo)
   VALUES ($1, $2)
   ON CONFLICT (ticket_id, tipo) DO NOTHING
   RETURNING ticket_id`;

/**
 * @param {object} deps
 * @param {() => Promise<import('pg').Pool|null>} deps.getPool
 * @param {'postgres'|'file'} deps.backend
 */
export function createNotificationLedger({ getPool, backend }) {
  const usaPostgres = backend === 'postgres';
  // Sin Postgres (desarrollo con DB_FILE) la constancia es solo de este proceso: al
  // reiniciar se puede repetir un aviso. Es aceptable en local y no en produccion,
  // que siempre corre contra Neon.
  const enMemoria = new Set();
  let schemaPromise = null;

  async function poolOrNull() {
    if (!usaPostgres) return null;
    const pool = await getPool();
    return pool || null;
  }

  // Perezoso y memoizado, igual que en los adjuntos: si Neon esta dormida al arrancar,
  // un fallo de DDL no debe dejar los avisos rotos para siempre.
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

    /**
     * Reserva el aviso. `true` = te toca enviarlo; `false` = ya estaba enviado.
     * @returns {Promise<boolean>}
     */
    async reclamar(ticketId, tipo) {
      const clave = `${ticketId}:${tipo}`;
      const pool = await poolOrNull();
      if (!pool) {
        if (enMemoria.has(clave)) return false;
        enMemoria.add(clave);
        return true;
      }
      await ensureSchema();
      const resultado = await withPgRetry(() => pool.query(CLAIM_SQL, [Number(ticketId), String(tipo)]));
      return resultado.rowCount > 0;
    },
  };
}
