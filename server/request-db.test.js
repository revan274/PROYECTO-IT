import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getRequestDb } from './utils/helpers.js';

// requireAuth ya carga y normaliza el documento completo para validar la sesión y lo deja
// en req.appDb. Releerlo en el handler duplica el costo dominante de cada petición.

test('reutiliza el documento que requireAuth ya cargó, sin volver a leerlo', async () => {
  const cargado = { tickets: [{ id: 1 }] };
  let lecturas = 0;
  const loadDb = async () => { lecturas += 1; return { tickets: [] }; };

  const db = await getRequestDb({ appDb: cargado }, loadDb);

  assert.equal(db, cargado, 'debe devolver exactamente el objeto ya cargado');
  assert.equal(lecturas, 0, 'no debe releer el documento');
});

test('lee el documento cuando requireAuth tomó el atajo condicional y no lo cargó', async () => {
  const desdeDisco = { tickets: [{ id: 2 }] };
  let lecturas = 0;
  const loadDb = async () => { lecturas += 1; return desdeDisco; };

  const db = await getRequestDb({}, loadDb);

  assert.equal(db, desdeDisco);
  assert.equal(lecturas, 1);
});

test('no confunde un appDb ausente con uno vacío', async () => {
  let lecturas = 0;
  const loadDb = async () => { lecturas += 1; return { tickets: [] }; };

  await getRequestDb({ appDb: undefined }, loadDb);
  await getRequestDb({ appDb: null }, loadDb);

  assert.equal(lecturas, 2);
});
