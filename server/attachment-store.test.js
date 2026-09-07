import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createAttachmentStore } from './modules/attachment-store.js';

// Pool falso con la semantica minima que usa el store (misma tecnica que postgres-state.test.js).
function createFakePool() {
  const filas = new Map();
  return {
    filas,
    async query(sql, params = []) {
      const s = String(sql).trim();
      if (s.startsWith('CREATE TABLE') || s.startsWith('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (s.startsWith('INSERT')) {
        const [storagePath, ticketId, fileName, mimeType, size, content] = params;
        filas.set(storagePath, { ticketId, fileName, mimeType, size, content });
        return { rows: [], rowCount: 1 };
      }
      if (s.startsWith('SELECT storage_path')) {
        return { rows: [...filas.keys()].map((storage_path) => ({ storage_path })), rowCount: filas.size };
      }
      if (s.startsWith('SELECT 1')) {
        const existe = filas.has(params[0]);
        return { rows: existe ? [{ '?column?': 1 }] : [], rowCount: existe ? 1 : 0 };
      }
      if (s.startsWith('SELECT content')) {
        const fila = filas.get(params[0]);
        return { rows: fila ? [{ content: fila.content }] : [], rowCount: fila ? 1 : 0 };
      }
      if (s.startsWith('SELECT COUNT')) {
        return { rows: [{ total: String(filas.size) }], rowCount: 1 };
      }
      if (s.startsWith('DELETE')) {
        const existia = filas.delete(params[0]);
        return { rows: [], rowCount: existia ? 1 : 0 };
      }
      throw new Error(`sentencia no soportada por el pool falso: ${s}`);
    },
  };
}

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'mesa-it-adj-'));
}

const CONTENIDO = Buffer.from('evidencia de la falla del POS', 'utf8');

// La clave es `storagePath`: se genera antes de conocer el id del adjunto (que se asigna
// dentro de updateDb) y ya es unico porque incluye un UUID. Asi el orden de operaciones
// de la subida, con su rollback, no cambia.
const META = {
  ticketId: 701,
  fileName: 'evidencia.txt',
  mimeType: 'text/plain',
  storagePath: 'uploads/tk_701_evidencia.txt',
};

test('con Neon configurado el backend es postgres y los bytes NO tocan el disco', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });
    assert.equal(store.backend, 'postgres');

    await store.ensureSchema();
    await store.save({ ...META, content: CONTENIDO });

    assert.deepEqual(await store.read(META), CONTENIDO);
    assert.deepEqual(await readdir(dir), [], 'el disco efimero debe quedar vacio');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('lee de disco cuando el adjunto es anterior a la migracion', async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, 'tk_701_evidencia.txt'), CONTENIDO);
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });

    assert.deepEqual(await store.read(META), CONTENIDO, 'debe caer a disco si no hay fila');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sin Neon el backend es file y guarda en disco', async () => {
  const dir = await tempDir();
  try {
    const store = createAttachmentStore({ getPool: async () => null, uploadDir: dir, backend: 'file' });
    assert.equal(store.backend, 'file');

    await store.ensureSchema();
    await store.save({ ...META, content: CONTENIDO });

    assert.deepEqual(await store.read(META), CONTENIDO);
    assert.deepEqual(await readdir(dir), ['tk_701_evidencia.txt']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('remove borra la fila y tambien el archivo heredado', async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, 'tk_701_evidencia.txt'), CONTENIDO);
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });
    await store.save({ ...META, content: CONTENIDO });

    await store.remove(META);

    assert.equal(pool.filas.size, 0);
    assert.deepEqual(await readdir(dir), []);
    assert.equal(await store.read(META), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read devuelve null cuando el adjunto no esta en ningun sitio', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });
    assert.equal(await store.read(META), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rechaza una ruta heredada que intente escapar del directorio', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });
    assert.equal(await store.read({ ...META, storagePath: '../../etc/passwd' }), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('countStored informa cuantos adjuntos hay en la base', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });
    assert.equal(await store.countStored(), 0);

    await store.save({ ...META, content: CONTENIDO });
    await store.save({ ...META, storagePath: 'uploads/otro.txt', content: CONTENIDO });

    assert.equal(await store.countStored(), 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('has() consulta la base y cae a disco, sin traer el contenido', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });

    assert.equal(await store.has(META), false, 'no existe en ningun sitio');

    await store.save({ ...META, content: CONTENIDO });
    assert.equal(await store.has(META), true, 'existe en la base');

    // Un adjunto anterior a la migracion sigue contando como presente si el archivo esta.
    await writeFile(path.join(dir, 'heredado.txt'), CONTENIDO);
    assert.equal(await store.has({ storagePath: 'uploads/heredado.txt' }), true);
    assert.equal(await store.has({ storagePath: 'uploads/inexistente.txt' }), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listStoredPaths trae todas las rutas en una sola consulta', async () => {
  const dir = await tempDir();
  try {
    const pool = createFakePool();
    const store = createAttachmentStore({ getPool: async () => pool, uploadDir: dir, backend: 'postgres' });

    assert.deepEqual(await store.listStoredPaths(), []);

    await store.save({ ...META, content: CONTENIDO });
    await store.save({ ...META, storagePath: 'uploads/otro.txt', content: CONTENIDO });

    assert.deepEqual(
      (await store.listStoredPaths()).sort(),
      ['uploads/otro.txt', 'uploads/tk_701_evidencia.txt'],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('listStoredPaths devuelve lista vacia sin Neon', async () => {
  const store = createAttachmentStore({ getPool: async () => null, uploadDir: '.', backend: 'file' });
  assert.deepEqual(await store.listStoredPaths(), []);
});
