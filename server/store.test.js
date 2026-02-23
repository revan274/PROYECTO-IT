import test from 'node:test';
import assert from 'node:assert/strict';

import { createUserPasswordHash, pushAudit, sanitizeUser, verifyUserPassword } from './store.js';

test('sanitizeUser removes password and preserves public fields', () => {
  const source = {
    id: 10,
    nombre: 'Operador',
    username: 'operador',
    password: 'secret',
    rol: 'tecnico',
    departamento: 'IT',
    activo: true,
  };

  const result = sanitizeUser(source);

  assert.deepEqual(result, {
    id: 10,
    nombre: 'Operador',
    username: 'operador',
    rol: 'tecnico',
    departamento: 'IT',
    activo: true,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'password'), false);
});

test('pushAudit prepends an entry and increments id from meta.nextId', () => {
  const db = {
    meta: { nextId: 100 },
    auditoria: [],
  };

  const entry = pushAudit(db, {
    accion: 'Entrada',
    item: 'Cable',
    cantidad: 5,
    usuario: 'Tecnico 1',
  });

  assert.equal(entry.id, 101);
  assert.equal(db.meta.nextId, 101);
  assert.equal(db.auditoria.length, 1);
  assert.equal(db.auditoria[0], entry);
  assert.equal(entry.usuario, 'Tecnico 1');
  assert.equal(entry.modulo, 'insumos');
});

test('pushAudit keeps explicit module when provided', () => {
  const db = {
    meta: { nextId: 50 },
    auditoria: [],
  };

  const entry = pushAudit(db, {
    accion: 'Movimiento Especial',
    item: 'BAS-010',
    cantidad: 1,
    usuario: 'Admin IT',
    modulo: 'tickets',
  });

  assert.equal(entry.modulo, 'tickets');
});

test('verifyUserPassword validates hashed password and rejects wrong values', () => {
  const user = {
    passwordHash: 'scrypt-v1$9656f5f7bd4c5ceecfdf17dfbc42f29b$6927845c432ba33c144883f2fa7630053c230591020350ae7b657b2b507ca22d4c1df0499309869a2581942e6f399e5818b30ed378e1aeeeb8519a3ba5bbe1b1',
  };

  assert.equal(verifyUserPassword(user, 'admin123'), true);
  assert.equal(verifyUserPassword(user, 'Admin123'), false);
  assert.equal(verifyUserPassword(user, ''), false);
});

test('createUserPasswordHash generates verifiable hashes', () => {
  const password = 'solicitante123';
  const hash = createUserPasswordHash(password);

  assert.equal(typeof hash, 'string');
  assert.equal(hash.startsWith('scrypt-v1$'), true);
  assert.equal(verifyUserPassword({ passwordHash: hash }, password), true);
  assert.equal(verifyUserPassword({ passwordHash: hash }, 'otro-password'), false);
});
