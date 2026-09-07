import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { resolveAttachmentStorage, resolveAttachmentPath } from './modules/attachment-storage.js';

const DATA_DIR = path.resolve('/srv/mesa-it/server/data/runtime');
const VOLUME_DIR = path.resolve('/mnt/volumen/adjuntos');

test('ATTACHMENTS_DIR explícito gana sobre la ruta derivada del directorio de datos', () => {
  const storage = resolveAttachmentStorage({
    attachmentsDir: '/mnt/volumen/adjuntos',
    dataDir: DATA_DIR,
    storageBackend: 'postgres',
  });

  assert.equal(storage.dir, VOLUME_DIR);
  assert.equal(storage.source, 'ATTACHMENTS_DIR');
});

test('sin ATTACHMENTS_DIR conserva la ruta histórica <dataDir>/uploads', () => {
  const storage = resolveAttachmentStorage({
    attachmentsDir: '',
    dataDir: DATA_DIR,
    storageBackend: 'postgres',
  });

  assert.equal(storage.dir, path.join(DATA_DIR, 'uploads'));
  assert.equal(storage.source, 'dataDir');
});

test('Postgres sin ruta explícita se marca como riesgo de pérdida de adjuntos', () => {
  const storage = resolveAttachmentStorage({
    attachmentsDir: '',
    dataDir: DATA_DIR,
    storageBackend: 'postgres',
  });

  assert.equal(storage.durabilityRisk, true);
  assert.match(storage.warning, /adjuntos/i);
  assert.match(storage.warning, /ATTACHMENTS_DIR/);
});

test('Postgres con ruta explícita no reporta riesgo', () => {
  const storage = resolveAttachmentStorage({
    attachmentsDir: '/mnt/volumen/adjuntos',
    dataDir: DATA_DIR,
    storageBackend: 'postgres',
  });

  assert.equal(storage.dir, VOLUME_DIR);
  assert.equal(storage.source, 'ATTACHMENTS_DIR');
  assert.equal(storage.durabilityRisk, false);
  assert.equal(storage.warning, '');
});

test('backend de archivo no reporta riesgo: estado y adjuntos comparten destino', () => {
  const storage = resolveAttachmentStorage({
    attachmentsDir: '',
    dataDir: DATA_DIR,
    storageBackend: 'file',
  });

  assert.equal(storage.dir, path.join(DATA_DIR, 'uploads'));
  assert.equal(storage.source, 'dataDir');
  assert.equal(storage.durabilityRisk, false);
  assert.equal(storage.warning, '');
});

// --- Resolución de la ruta física del adjunto ---
// Regresión: la ruta se resolvía contra el directorio de datos pero se validaba la
// contención contra el directorio de adjuntos. Al configurar ATTACHMENTS_DIR fuera del
// árbol de datos, ambos divergían y TODA subida/descarga quedaba bloqueada.

const UPLOAD_DIR = path.resolve('/mnt/volumen/adjuntos');

test('resuelve un adjunto dentro del directorio configurado aunque esté fuera del árbol de datos', () => {
  assert.equal(
    resolveAttachmentPath('uploads/abc123.png', UPLOAD_DIR),
    path.join(UPLOAD_DIR, 'abc123.png'),
  );
});

test('acepta la ruta sin el prefijo histórico uploads/', () => {
  assert.equal(resolveAttachmentPath('abc123.png', UPLOAD_DIR), path.join(UPLOAD_DIR, 'abc123.png'));
});

test('bloquea el escape del directorio de adjuntos', () => {
  assert.equal(resolveAttachmentPath('../../etc/passwd', UPLOAD_DIR), '');
  assert.equal(resolveAttachmentPath('uploads/../../../etc/passwd', UPLOAD_DIR), '');
});

test('bloquea rutas absolutas y vacías', () => {
  assert.equal(resolveAttachmentPath('/etc/passwd', UPLOAD_DIR), '');
  assert.equal(resolveAttachmentPath('', UPLOAD_DIR), '');
});

test('normaliza separadores de Windows en la ruta almacenada', () => {
  assert.equal(resolveAttachmentPath('uploads\\abc123.png', UPLOAD_DIR), path.join(UPLOAD_DIR, 'abc123.png'));
});
