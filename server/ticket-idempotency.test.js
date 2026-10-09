import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTicketIdempotencyContext,
  findTicketCreationReplay,
  rememberTicketCreation,
} from './modules/ticket-idempotency.js';

function fixture() {
  return { meta: { nextId: 10 }, tickets: [{ id: 7, descripcion: 'Persistido' }] };
}

test('la huella es estable aunque cambie el orden de las propiedades', () => {
  const first = createTicketIdempotencyContext({ key: 'intent-123', actorId: 4, scope: 'ticket', payload: { b: 2, a: { y: 2, x: 1 } } });
  const second = createTicketIdempotencyContext({ key: 'intent-123', actorId: 4, scope: 'ticket', payload: { a: { x: 1, y: 2 }, b: 2 } });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.storageKey, second.storageKey);
});

test('la misma intención devuelve el ticket original y un payload distinto entra en conflicto', () => {
  const db = fixture();
  const context = createTicketIdempotencyContext({ key: 'intent-456', actorId: 4, scope: 'ticket', payload: { descripcion: 'Persistido' } });
  rememberTicketCreation(db, context, 7, { nowMs: 1_000, retentionMs: 10_000 });
  assert.equal(findTicketCreationReplay(db, context, { nowMs: 2_000 }).ticket.id, 7);

  const changed = createTicketIdempotencyContext({ key: 'intent-456', actorId: 4, scope: 'ticket', payload: { descripcion: 'Cambiado' } });
  assert.equal(findTicketCreationReplay(db, changed, { nowMs: 2_000 }).status, 'conflict');
});

test('una clave expirada o sin ticket deja de bloquear una creación legítima', () => {
  const db = fixture();
  const context = createTicketIdempotencyContext({ key: 'intent-789', actorId: 4, scope: 'ticket', payload: {} });
  rememberTicketCreation(db, context, 7, { nowMs: 1_000, retentionMs: 10 });
  assert.equal(findTicketCreationReplay(db, context, { nowMs: 2_000 }).status, 'new');
  rememberTicketCreation(db, context, 999, { nowMs: 3_000, retentionMs: 10_000 });
  assert.equal(findTicketCreationReplay(db, context, { nowMs: 4_000 }).status, 'new');
});

test('rechaza claves débiles o con caracteres fuera del contrato', () => {
  assert.throws(() => createTicketIdempotencyContext({ key: 'corta', actorId: 4, scope: 'ticket', payload: {} }), /8 y 128/);
  assert.throws(() => createTicketIdempotencyContext({ key: 'intent con espacios', actorId: 4, scope: 'ticket', payload: {} }), /8 y 128/);
});
