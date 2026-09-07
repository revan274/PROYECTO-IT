// Auditoría de integridad del estado de Mesa IT. Solo lectura: no modifica nada.
//
//   npm run integrity:check
//   railway run npm run integrity:check     (contra el entorno real)
//
// Sale con código 1 si encuentra hallazgos, para poder engancharlo a un monitoreo.
import 'dotenv/config';
import { existsSync, readdirSync } from 'node:fs';

import { readDb, getDataDirPath, getStorageBackend, closeStore } from '../store.js';
import { resolveAttachmentStorage, resolveAttachmentPath } from '../modules/attachment-storage.js';
import { auditIntegrity } from '../modules/integrity.js';
import { touchStorageMarker, STORAGE_MARKER_FILE } from '../modules/storage-marker.js';

const SEVERITY_LABEL = { alta: 'ALTA ', media: 'MEDIA' };

async function main() {
  const storage = resolveAttachmentStorage({
    attachmentsDir: process.env.ATTACHMENTS_DIR,
    dataDir: getDataDirPath(),
    storageBackend: getStorageBackend(),
  });

  const db = await readDb();

  const result = auditIntegrity(db, {
    attachmentExists: (storagePath) => {
      const absolute = resolveAttachmentPath(storagePath, storage.dir);
      return Boolean(absolute) && existsSync(absolute);
    },
    listStoredFiles: () => (existsSync(storage.dir)
      ? readdirSync(storage.dir).filter((name) => name !== STORAGE_MARKER_FILE)
      : []),
  });

  const marker = await touchStorageMarker(storage.dir);

  console.log('Auditoría de integridad — Mesa IT');
  console.log(`  Backend de estado : ${getStorageBackend()}`);
  console.log(`  Adjuntos          : ${storage.dir} (origen: ${storage.source})`);
  if (marker.error) {
    console.log(`  Persistencia      : no se pudo comprobar (${marker.error})`);
  } else {
    const veredicto = marker.survivedRestart
      ? 'sobrevivió a reinicios anteriores'
      : 'sin reinicios registrados todavía';
    console.log(`  Persistencia      : en uso desde ${marker.firstSeenAt}, arranque #${marker.bootCount} (${veredicto})`);
  }
  console.log(`  Tickets           : ${db.tickets?.length ?? 0}`);
  console.log(`  Activos           : ${db.activos?.length ?? 0}`);
  console.log(`  Usuarios          : ${db.users?.length ?? 0}`);
  if (storage.durabilityRisk) console.log(`\n  ADVERTENCIA: ${storage.warning}`);

  if (result.counts.total === 0) {
    console.log('\nSin hallazgos de integridad.');
    return 0;
  }

  console.log(`\n${result.counts.total} hallazgo(s):\n`);
  for (const [type, count] of Object.entries(result.counts.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${type}`);
  }

  console.log('\nDetalle:');
  for (const issue of result.issues) {
    const ticket = issue.ticketId ? `ticket #${issue.ticketId}` : 'global';
    console.log(`  [${SEVERITY_LABEL[issue.severity] || issue.severity}] ${ticket.padEnd(14)} ${issue.detail}`);
  }

  return 1;
}

main()
  .then(async (code) => {
    await closeStore().catch(() => undefined);
    process.exitCode = code;
  })
  .catch(async (error) => {
    console.error('La auditoría de integridad falló:', error);
    await closeStore().catch(() => undefined);
    process.exitCode = 2;
  });
