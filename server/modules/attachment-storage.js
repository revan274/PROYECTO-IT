// Resolución del directorio de adjuntos de tickets.
//
// Contexto: el estado de la aplicación vive en PostgreSQL, pero los binarios adjuntos
// se escriben en disco. Históricamente el destino se derivaba del directorio de `DB_FILE`,
// una variable que en modo Postgres NO tiene ningún otro efecto: un operador que use
// PostgreSQL no tiene motivo para definirla, y los adjuntos caen en el disco efímero del
// contenedor sin ninguna señal. `ATTACHMENTS_DIR` desacopla ese destino y lo hace explícito.
import path from 'node:path';

export function resolveAttachmentStorage({ attachmentsDir, dataDir, storageBackend }) {
  const configured = String(attachmentsDir || '').trim();
  const dir = configured
    ? path.resolve(configured)
    : path.join(dataDir, 'uploads');
  const source = configured ? 'ATTACHMENTS_DIR' : 'dataDir';

  // Solo hay divergencia de durabilidad cuando el estado persiste fuera del disco
  // (Postgres) y el destino de los binarios quedó implícito. Con backend de archivo,
  // db.json y los adjuntos comparten volumen: si uno sobrevive, el otro también.
  const durabilityRisk = storageBackend === 'postgres' && source === 'dataDir';
  const warning = durabilityRisk
    ? `Los adjuntos de tickets se guardan en "${dir}", derivado del directorio de datos. `
      + 'El estado persiste en PostgreSQL, pero estos binarios no: si ese directorio no es un '
      + 'volumen persistente, se pierden en cada despliegue y los tickets quedarán con adjuntos '
      + 'listados pero no descargables. Define ATTACHMENTS_DIR apuntando a un volumen persistente.'
    : '';

  return { dir, source, durabilityRisk, warning };
}

// Prefijo con el que se guardó históricamente `storagePath` ('uploads/<archivo>'), cuando el
// destino era siempre un subdirectorio del árbol de datos. Se conserva por compatibilidad:
// los adjuntos ya registrados siguen ese formato.
const LEGACY_PREFIX = /^uploads\//i;

/**
 * Ruta física de un adjunto a partir del `storagePath` almacenado.
 *
 * La ruta se resuelve SIEMPRE contra el directorio de adjuntos vigente, nunca contra el
 * directorio de datos: si se resolviera contra este último y luego se validara la contención
 * dentro del primero, configurar ATTACHMENTS_DIR fuera del árbol de datos bloquearía todos
 * los adjuntos. Devuelve '' cuando la ruta intenta escapar del directorio.
 */
export function resolveAttachmentPath(storagePath, uploadDir) {
  const normalized = String(storagePath || '').trim().replace(/\\/g, '/').replace(LEGACY_PREFIX, '');
  if (!normalized || path.isAbsolute(normalized)) return '';

  const root = path.resolve(uploadDir);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return absolute;
}
