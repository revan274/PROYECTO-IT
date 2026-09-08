import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ensurePermission } from './utils/helpers.js';

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('autoriza cuando el rol tiene el permiso', () => {
  const res = fakeRes();
  assert.equal(ensurePermission({ authUser: { rol: 'tecnico' } }, res, 'activos.update'), true);
  assert.equal(res.statusCode, null, 'no debe responder si autoriza');
});

test('responde 403 cuando el rol no tiene el permiso', () => {
  const res = fakeRes();
  assert.equal(ensurePermission({ authUser: { rol: 'tecnico' } }, res, 'users.manage'), false);
  assert.equal(res.statusCode, 403);
});

test('conserva los mensajes de error originales por grupo de permiso', () => {
  const admin = fakeRes();
  ensurePermission({ authUser: { rol: 'tecnico' } }, admin, 'users.manage');
  assert.equal(admin.body.error, 'Solo administradores pueden ejecutar esta operación.');

  const editor = fakeRes();
  ensurePermission({ authUser: { rol: 'consulta' } }, editor, 'activos.update');
  assert.equal(editor.body.error, 'No autorizado para ejecutar esta operación.');

  const autor = fakeRes();
  ensurePermission({ authUser: { rol: 'consulta' } }, autor, 'tickets.create');
  assert.equal(autor.body.error, 'No autorizado para crear tickets.');
});

test('falla cerrado sin sesión o con permiso inexistente', () => {
  assert.equal(ensurePermission({}, fakeRes(), 'tickets.create'), false);
  assert.equal(ensurePermission({ authUser: { rol: 'admin' } }, fakeRes(), 'permiso.inventado'), false);
});
