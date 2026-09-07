// Almacenamiento de los binarios adjuntos a tickets.
//
// Antes vivian en el sistema de archivos del contenedor, que en Railway es efimero salvo que
// haya un volumen montado: cada despliegue los borraba mientras la base conservaba los
// metadatos, dejando tickets que listan evidencia imposible de descargar.
//
// Con `DATABASE_URL` configurado los bytes van a PostgreSQL (Neon), donde ya vive el estado
// y hay respaldos. IMPORTANTE: van a una TABLA PROPIA, nunca al documento JSONB. Ese
// documento se reescribe entero bajo un lock global en cada mutacion, asi que meterle
// megabytes serializaria toda la aplicacion.
//
// La clave es `storage_path`, no el id del adjunto: ese id se asigna dentro de `updateDb`,
// mientras que la ruta se genera antes (incluye un UUID, asi que ya es unica). Manteniendo
// esa clave, el orden de operaciones de la subida y su rollback no cambian.
//
// Los metadatos siguen en el ticket exactamente igual que antes, asi que la forma de la API
// no cambia. La lectura cae a disco cuando no hay fila: los adjuntos anteriores a la
// migracion que aun sobrevivan se siguen descargando.
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveAttachmentPath } from './attachment-storage.js';

export const PG_ATTACHMENTS_TABLE = 'mesa_it_attachments';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ${PG_ATTACHMENTS_TABLE} (
  storage_path  TEXT PRIMARY KEY,
  ticket_id     INTEGER NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  content       BYTEA NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS ${PG_ATTACHMENTS_TABLE}_ticket_idx
  ON ${PG_ATTACHMENTS_TABLE} (ticket_id)`;

const INSERT_SQL = `INSERT INTO ${PG_ATTACHMENTS_TABLE}
     (storage_path, ticket_id, file_name, mime_type, size_bytes, content)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (storage_path) DO UPDATE
     SET file_name = EXCLUDED.file_name,
         mime_type = EXCLUDED.mime_type,
         size_bytes = EXCLUDED.size_bytes,
         content = EXCLUDED.content`;

const SELECT_SQL = `SELECT content FROM ${PG_ATTACHMENTS_TABLE} WHERE storage_path = $1`;
const DELETE_SQL = `DELETE FROM ${PG_ATTACHMENTS_TABLE} WHERE storage_path = $1`;
const EXISTS_SQL = `SELECT 1 FROM ${PG_ATTACHMENTS_TABLE} WHERE storage_path = $1`;
const LIST_PATHS_SQL = `SELECT storage_path FROM ${PG_ATTACHMENTS_TABLE}`;
const COUNT_SQL = `SELECT COUNT(*)::text AS total FROM ${PG_ATTACHMENTS_TABLE}`;

export function createAttachmentStore({ getPool, uploadDir, backend }) {
  // El pool se resuelve de forma perezosa: los routers se construyen de forma sincrona,
  // pero abrir la conexion es asincrono. El backend viene explicito porque el diagnostico
  // necesita saberlo sin esperar a la primera consulta.
  const usaPostgres = backend === 'postgres';
  const poolOrNull = async () => (usaPostgres ? getPool() : null);

  // Ruta fisica del adjunto en disco. Devuelve '' si intenta escapar del directorio.
  function legacyPath(storagePath) {
    return resolveAttachmentPath(storagePath, uploadDir);
  }

  async function readFromDisk(storagePath) {
    const absolute = legacyPath(storagePath);
    if (!absolute) return null;
    try {
      return await readFile(absolute);
    } catch {
      return null;
    }
  }

  return {
    backend,

    async ensureSchema() {
      const pool = await poolOrNull();
      if (!pool) return;
      await pool.query(CREATE_TABLE_SQL);
      await pool.query(CREATE_INDEX_SQL);
    },

    async save({ ticketId, fileName, mimeType, content, storagePath }) {
      const pool = await poolOrNull();
      if (!pool) {
        const absolute = legacyPath(storagePath);
        if (!absolute) throw new Error('Ruta de adjunto invalida.');
        await mkdir(path.dirname(absolute), { recursive: true });
        await writeFile(absolute, content);
        return;
      }

      await pool.query(INSERT_SQL, [
        storagePath,
        ticketId,
        fileName,
        mimeType,
        content.length,
        content,
      ]);
    },

    async read({ storagePath }) {
      const pool = await poolOrNull();
      if (pool) {
        const result = await pool.query(SELECT_SQL, [storagePath]);
        const fila = result.rows[0];
        if (fila?.content) return Buffer.from(fila.content);
      }
      // Sin fila: puede ser un adjunto anterior a la migracion que aun sobreviva en disco.
      return readFromDisk(storagePath);
    },

    /**
     * ¿El binario está realmente almacenado? Para la auditoría de integridad: comprobar
     * solo el disco daría todos los adjuntos por perdidos una vez migrados a la base.
     * No trae el contenido, que puede pesar megabytes.
     */
    async has({ storagePath }) {
      const pool = await poolOrNull();
      if (pool) {
        const result = await pool.query(EXISTS_SQL, [storagePath]);
        if (result.rowCount > 0) return true;
      }
      const absolute = legacyPath(storagePath);
      if (!absolute) return false;
      return existsSync(absolute);
    },

    async remove({ storagePath }) {
      const pool = await poolOrNull();
      if (pool) await pool.query(DELETE_SQL, [storagePath]);
      const absolute = legacyPath(storagePath);
      if (absolute) await unlink(absolute).catch(() => undefined);
    },

    /**
     * Todas las rutas almacenadas en la base, en UNA consulta. La auditoria de integridad
     * recorre miles de adjuntos: preguntar uno por uno seria una consulta por adjunto.
     */
    async listStoredPaths() {
      const pool = await poolOrNull();
      if (!pool) return [];
      const result = await pool.query(LIST_PATHS_SQL);
      return result.rows.map((fila) => fila.storage_path).filter(Boolean);
    },

    /** Cuantos adjuntos hay realmente almacenados. Para diagnostico e integridad. */
    async countStored() {
      const pool = await poolOrNull();
      if (!pool) return null;
      const result = await pool.query(COUNT_SQL);
      return Math.max(0, Math.trunc(Number(result.rows[0]?.total) || 0));
    },
  };
}
