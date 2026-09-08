import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { touchStorageMarker } from './modules/storage-marker.js';

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'mesa-it-marker-'));
}

test('en el primer arranque crea el marcador y no puede afirmar persistencia', async () => {
  const dir = await tempDir();
  try {
    const marker = await touchStorageMarker(dir, { now: () => 1000 });

    assert.equal(marker.firstSeenAt, new Date(1000).toISOString());
    assert.equal(marker.bootCount, 1);
    assert.equal(marker.survivedRestart, false);
    assert.equal(marker.error, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('un segundo arranque conserva la fecha original y cuenta el reinicio', async () => {
  const dir = await tempDir();
  try {
    await touchStorageMarker(dir, { now: () => 1000 });
    const marker = await touchStorageMarker(dir, { now: () => 99000 });

    assert.equal(marker.firstSeenAt, new Date(1000).toISOString(), 'la fecha original no se pierde');
    assert.equal(marker.bootCount, 2);
    assert.equal(marker.survivedRestart, true, 'sobrevivir a un reinicio es evidencia de persistencia');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('crea el directorio si no existe', async () => {
  const base = await tempDir();
  const dir = path.join(base, 'volumen', 'adjuntos');
  try {
    const marker = await touchStorageMarker(dir, { now: () => 1000 });
    assert.equal(marker.error, null);
    const raw = JSON.parse(await readFile(path.join(dir, '.storage-marker.json'), 'utf8'));
    assert.equal(raw.bootCount, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('un marcador corrupto se reinicia sin romper el arranque', async () => {
  const dir = await tempDir();
  try {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, '.storage-marker.json'), 'esto no es json', 'utf8');

    const marker = await touchStorageMarker(dir, { now: () => 5000 });

    assert.equal(marker.bootCount, 1);
    assert.equal(marker.firstSeenAt, new Date(5000).toISOString());
    assert.equal(marker.error, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('un directorio no escribible se reporta sin lanzar excepcion', async () => {
  const marker = await touchStorageMarker('\0ruta-invalida', { now: () => 1000 });

  assert.equal(marker.bootCount, null);
  assert.equal(typeof marker.error, 'string');
  assert.equal(marker.survivedRestart, false);
});
