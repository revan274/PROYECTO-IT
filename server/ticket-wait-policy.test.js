import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTicketWaitReason, TICKET_WAIT_REASONS } from '../shared/ticket-wait-policy.js';

test('la política de espera declara explícitamente qué motivos pausan el SLA', () => {
  assert.deepEqual(
    Object.fromEntries(TICKET_WAIT_REASONS.map((reason) => [reason.value, reason.pausaSla])),
    { USUARIO: true, PROVEEDOR: true, REFACCION: true, AUTORIZACION: false },
  );
  assert.equal(parseTicketWaitReason(' usuario ')?.value, 'USUARIO');
  assert.equal(parseTicketWaitReason('otro'), null);
});
