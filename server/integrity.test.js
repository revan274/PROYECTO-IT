import assert from 'node:assert/strict';
import { test } from 'node:test';

import { auditIntegrity } from './modules/integrity.js';

function buildDb(overrides = {}) {
  return {
    catalogos: { sucursales: [{ code: 'TJ01', name: 'Estrella', activo: true }] },
    users: [{ id: 1, nombre: 'Carlos Ruiz', username: 'cruiz', activo: true }],
    activos: [{ id: 10, tag: 'POS-001' }],
    insumos: [],
    tickets: [{
      id: 100,
      activoTag: 'POS-001',
      sucursal: 'TJ01',
      asignadoA: 'Carlos Ruiz',
      attachments: [],
    }],
    ...overrides,
  };
}

const types = (result) => result.issues.map((issue) => issue.type).sort();

test('un documento consistente no reporta hallazgos', () => {
  const result = auditIntegrity(buildDb());
  assert.deepEqual(result.issues, []);
  assert.equal(result.counts.total, 0);
});

test('detecta un ticket que apunta a un activo inexistente', () => {
  const db = buildDb();
  db.tickets[0].activoTag = 'POS-999';
  const result = auditIntegrity(db);
  assert.deepEqual(types(result), ['TICKET_ACTIVO_INEXISTENTE']);
  assert.equal(result.issues[0].ticketId, 100);
});

test('detecta un ticket asignado a un usuario que ya no existe', () => {
  const db = buildDb();
  db.tickets[0].asignadoA = 'Fulano Borrado';
  assert.deepEqual(types(auditIntegrity(db)), ['TICKET_ASIGNADO_INEXISTENTE']);
});

test('un ticket sin asignar NO es un hallazgo', () => {
  const db = buildDb();
  db.tickets[0].asignadoA = '';
  assert.deepEqual(auditIntegrity(db).issues, []);
});

test('detecta una sucursal fuera del catálogo', () => {
  const db = buildDb();
  db.tickets[0].sucursal = 'ZZ99';
  assert.deepEqual(types(auditIntegrity(db)), ['TICKET_SUCURSAL_FUERA_CATALOGO']);
});

test('detecta adjuntos cuyo archivo ya no está en disco', () => {
  const db = buildDb();
  db.tickets[0].attachments = [
    { id: 1, fileName: 'evidencia.png', storagePath: 'uploads/a.png' },
    { id: 2, fileName: 'perdido.png', storagePath: 'uploads/b.png' },
  ];
  const result = auditIntegrity(db, { attachmentExists: (p) => p === 'uploads/a.png' });
  assert.deepEqual(types(result), ['ADJUNTO_SIN_ARCHIVO']);
  assert.equal(result.issues[0].detail.includes('perdido.png'), true);
});

test('detecta ids duplicados dentro de una colección', () => {
  const db = buildDb();
  db.tickets.push({ ...db.tickets[0] });
  assert.deepEqual(types(auditIntegrity(db)), ['ID_DUPLICADO']);
});

test('agrupa los hallazgos por tipo en el resumen', () => {
  const db = buildDb();
  db.tickets[0].activoTag = 'POS-999';
  db.tickets[0].sucursal = 'ZZ99';
  const result = auditIntegrity(db);
  assert.equal(result.counts.total, 2);
  assert.equal(result.counts.byType.TICKET_ACTIVO_INEXISTENTE, 1);
  assert.equal(result.counts.byType.TICKET_SUCURSAL_FUERA_CATALOGO, 1);
});

test('detecta archivos en disco que ningún ticket referencia', () => {
  const db = buildDb();
  db.tickets[0].attachments = [{ id: 1, fileName: 'usado.png', storagePath: 'uploads/usado.png' }];
  const result = auditIntegrity(db, {
    attachmentExists: () => true,
    listStoredFiles: () => ['usado.png', 'huerfano.png'],
  });
  assert.deepEqual(types(result), ['ARCHIVO_SIN_REFERENCIA']);
  assert.equal(result.issues[0].detail.includes('huerfano.png'), true);
});

test('sin listStoredFiles no inventa hallazgos de archivos sueltos', () => {
  const db = buildDb();
  db.tickets[0].attachments = [{ id: 1, fileName: 'usado.png', storagePath: 'uploads/usado.png' }];
  assert.deepEqual(auditIntegrity(db).issues, []);
});
