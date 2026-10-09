import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkTicketAssets, resolveAssetBranchCode, ticketReferencesAsset } from '../shared/asset-relations.js';

test('legacy links migrate only when unique and remain stable after rename', () => {
  const db = { activos: [{ id: 1, tag: 'OLD' }], tickets: [{ id: 2, activoTag: 'old', historial: [{ comentario: 'OLD evidence' }] }] };
  linkTicketAssets(db);
  assert.equal(db.tickets[0].activoId, 1);
  db.activos[0].tag = 'NEW';
  linkTicketAssets(db);
  assert.equal(db.tickets[0].activoTag, 'NEW');
  assert.equal(db.tickets[0].historial[0].comentario, 'OLD evidence');
  assert.equal(ticketReferencesAsset(db.tickets[0], db.activos[0]), true);
});

test('missing IDs, orphan tags and ambiguous legacy tags are never guessed', () => {
  const db = { activos: [{ id: 1, tag: 'SAME' }, { id: 2, tag: 'SAME' }], tickets: [
    { activoTag: 'SAME' }, { activoId: 99, activoTag: 'SAME' }, { activoTag: 'MISSING' },
  ] };
  linkTicketAssets(db);
  assert.deepEqual(db.tickets.map((ticket) => ticket.activoId), [null, 99, null]);
  assert.ok(db.tickets.every((ticket) => ticket.activoReferenciaPendiente));
  db.activos.push({ id: 3, tag: 'MISSING' });
  linkTicketAssets(db);
  assert.equal(db.tickets[2].activoId, null);
});

test('branch matching requires an exact code, never a substring', () => {
  const codes = new Set(['TJ01', 'TJ02']);
  assert.equal(resolveAssetBranchCode({ departamento: 'tj01' }, codes), 'TJ01');
  assert.equal(resolveAssetBranchCode({ ubicacion: 'TJ02 | Caja 1' }, codes), 'TJ02');
  assert.equal(resolveAssetBranchCode({ ubicacion: 'TJ010 | Caja 1' }, codes), '');
  assert.equal(resolveAssetBranchCode({ ubicacion: 'Sin sucursal' }, codes), '');
});
