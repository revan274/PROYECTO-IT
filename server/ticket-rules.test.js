import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_ASSET_TICKET_STATES,
  CLOSED_TICKET_STATES,
  SLA_POLICY_HOURS,
  parseTicketPriority,
  parseTicketRequestType,
  TICKET_STATES,
  isClosedTicketState,
  keepsAssetInFailureState,
} from '../shared/ticket-rules.js';

test('las reglas compartidas clasifican el ciclo de vida de tickets sin divergencias', () => {
  assert.deepEqual(TICKET_STATES, [
    'Abierto',
    'En Proceso',
    'En Espera',
    'Resuelto',
    'Cerrado',
    'Cancelado',
  ]);
  assert.deepEqual(CLOSED_TICKET_STATES, ['Resuelto', 'Cerrado', 'Cancelado']);
  assert.equal(isClosedTicketState('Abierto'), false);
  assert.equal(isClosedTicketState('En Espera'), false);
  assert.equal(isClosedTicketState('Resuelto'), true);
  assert.equal(isClosedTicketState('Cerrado'), true);
});

test('En Espera mantiene el activo en falla igual que los otros estados activos', () => {
  assert.deepEqual(ACTIVE_ASSET_TICKET_STATES, ['Abierto', 'En Proceso', 'En Espera']);
  assert.equal(keepsAssetInFailureState('Abierto'), true);
  assert.equal(keepsAssetInFailureState('En Proceso'), true);
  assert.equal(keepsAssetInFailureState('En Espera'), true);
  assert.equal(keepsAssetInFailureState('Resuelto'), false);
  assert.equal(keepsAssetInFailureState('Cerrado'), false);
});

test('la política SLA compartida conserva los valores vigentes', () => {
  assert.deepEqual(SLA_POLICY_HOURS, {
    MEDIA: 24,
    ALTA: 8,
    CRITICA: 2,
  });
});

test('la prioridad solo acepta valores exactos conocidos', () => {
  assert.equal(parseTicketPriority(' alta '), 'ALTA');
  assert.equal(parseTicketPriority('urgente'), null);
  assert.equal(parseTicketPriority(undefined), null);
});

test('el tipo de solicitud distingue incidentes y servicios', () => {
  assert.equal(parseTicketRequestType('incidente_activo'), 'INCIDENTE_ACTIVO');
  assert.equal(parseTicketRequestType('SOLICITUD_SERVICIO'), 'SOLICITUD_SERVICIO');
  assert.equal(parseTicketRequestType('otro'), null);
});
