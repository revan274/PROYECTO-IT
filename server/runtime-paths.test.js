import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { resolveRuntimePaths } from './modules/runtime-paths.js';

// Antes, si existia el directorio /var/data el runtime se mudaba ahi en silencio. Era una
// convencion de Render, plataforma que el proyecto dejo de usar. El unico control sobre
// donde vive el estado en disco debe ser DB_FILE, que es explicito y revisable.

const DATOS = path.resolve('/proyecto/server/data');
const CWD = path.resolve('/proyecto');

test('sin DB_FILE el estado vive dentro del proyecto', () => {
  const rutas = resolveRuntimePaths({ dbFile: '', defaultDataDir: DATOS, cwd: CWD });

  assert.equal(rutas.dbFile, path.join(DATOS, 'runtime', 'db.json'));
  assert.equal(rutas.dataDir, path.join(DATOS, 'runtime'));
  assert.equal(rutas.backupDir, path.join(DATOS, 'runtime', 'backups'));
});

test('un DB_FILE relativo se resuelve contra el directorio de trabajo', () => {
  const rutas = resolveRuntimePaths({ dbFile: 'datos/db.json', defaultDataDir: DATOS, cwd: CWD });

  assert.equal(rutas.dbFile, path.join(CWD, 'datos', 'db.json'));
  assert.equal(rutas.dataDir, path.join(CWD, 'datos'));
});

test('un DB_FILE absoluto se respeta tal cual: es el unico modo de mover el estado', () => {
  const volumen = path.resolve('/mnt/volumen/mesa-it/db.json');
  const rutas = resolveRuntimePaths({ dbFile: volumen, defaultDataDir: DATOS, cwd: CWD });

  assert.equal(rutas.dbFile, volumen);
  assert.equal(rutas.dataDir, path.dirname(volumen));
  assert.equal(rutas.backupDir, path.join(path.dirname(volumen), 'backups'));
});

test('la semilla no se mueve con DB_FILE: viaja con el codigo', () => {
  const conDbFile = resolveRuntimePaths({ dbFile: '/mnt/otro/db.json', defaultDataDir: DATOS, cwd: CWD });
  const sinDbFile = resolveRuntimePaths({ dbFile: '', defaultDataDir: DATOS, cwd: CWD });

  assert.equal(conDbFile.seedFile, path.join(DATOS, 'db.seed.json'));
  assert.equal(conDbFile.seedFile, sinDbFile.seedFile);
});

test('un DB_FILE en blanco no crea una ruta invalida', () => {
  for (const valor of ['', '   ', undefined, null]) {
    const rutas = resolveRuntimePaths({ dbFile: valor, defaultDataDir: DATOS, cwd: CWD });
    assert.equal(rutas.dbFile, path.join(DATOS, 'runtime', 'db.json'), JSON.stringify(valor));
  }
});
