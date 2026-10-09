import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTicketDates, recordTicketMilestones, recordTicketWaitTransition, syncTicketCycle } from './domain/ticket-lifecycle.js';
import { parseTicketWaitReason } from '../shared/ticket-wait-policy.js';

test('missing and ambiguous legacy dates stay unknown and migration is idempotent', () => {
  const ticket = { estado: 'Cerrado', fecha: '21/9/2026 10:00', fechaCierre: '2026-09-21T15:00:00.000Z',
    historial: [{ fecha: '9/10/2026 10:00', usuario: 'Legacy' }] };
  const normalized = normalizeTicketDates(ticket);
  for (const field of ['fechaCreacion', 'fechaPrimeraAtencion', 'fechaResolucion', 'fechaCierre', 'fechaLimite']) {
    assert.equal(normalized[field], null, field);
  }
  assert.equal(normalized.fechaLegacy, ticket.fecha);
  assert.equal(normalized.fechaTerminalLegacy, ticket.fechaCierre);
  assert.equal(normalized.historial[0].fecha, null);
  assert.equal(normalized.historial[0].fechaLegacy, ticket.historial[0].fecha);
  assert.deepEqual(normalizeTicketDates(normalized), normalized);
  assert.equal(ticket.fechaCierre, '2026-09-21T15:00:00.000Z', 'migration does not mutate input');
});

test('service, resolution and closure are independent, stable milestones', () => {
  const ticket = normalizeTicketDates({ fechasVersion: 1, estado: 'Abierto', fechaCreacion: '2026-09-21T09:00:00-06:00' });
  assert.equal(ticket.fechaCreacion, '2026-09-21T15:00:00.000Z');
  ticket.estado = 'En Proceso';
  recordTicketMilestones(ticket, 'Abierto', '2026-09-21T15:01:00.000Z');
  ticket.estado = 'Resuelto';
  recordTicketMilestones(ticket, 'En Proceso', '2026-09-21T15:02:00.000Z');
  assert.equal(ticket.fechaPrimeraAtencion, '2026-09-21T15:01:00.000Z');
  assert.equal(ticket.fechaResolucion, '2026-09-21T15:02:00.000Z');
  assert.equal(ticket.fechaCierre, null);
  recordTicketMilestones(ticket, 'Resuelto', '2026-09-21T15:03:00.000Z');
  assert.equal(ticket.fechaResolucion, '2026-09-21T15:02:00.000Z');
  ticket.estado = 'Cerrado';
  recordTicketMilestones(ticket, 'Resuelto', '2026-09-21T15:04:00.000Z');
  assert.equal(ticket.fechaCierre, '2026-09-21T15:04:00.000Z');
  ticket.estado = 'Abierto';
  recordTicketMilestones(ticket, 'Cerrado', '2026-09-21T15:05:00.000Z');
  assert.equal(ticket.fechaPrimeraAtencion, '2026-09-21T15:01:00.000Z');
  assert.equal(ticket.fechaResolucion, null);
  assert.equal(ticket.historial[0].fechaResolucion, '2026-09-21T15:02:00.000Z');
  assert.equal(ticket.historial[0].fechaCierre, '2026-09-21T15:04:00.000Z');
});

test('una espera con pausa desplaza el compromiso solo por tiempo hábil', () => {
  const ticket = {
    id: 80,
    estado: 'En Proceso',
    prioridad: 'ALTA',
    fechaCreacion: '2026-01-05T08:00:00.000Z',
    fechaLimite: '2026-01-05T16:00:00.000Z',
    slaActual: {
      versionPolitica: 'prueba', prioridad: 'ALTA', horasAsignadas: 8,
      asignadoEn: '2026-01-05T08:00:00.000Z', inicioCiclo: '2026-01-05T08:00:00.000Z',
      fechaLimite: '2026-01-05T16:00:00.000Z',
      calendario: { zonaHoraria: 'UTC', jornada: {
        1: [480, 1020], 2: [480, 1020], 3: [480, 1020], 4: [480, 1020], 5: [480, 1020],
      }, feriados: [] },
    },
  };
  syncTicketCycle(ticket);
  ticket.estado = 'En Espera';
  recordTicketWaitTransition(ticket, 'En Proceso', '2026-01-05T09:00:00.000Z', parseTicketWaitReason('USUARIO'), 1);
  ticket.estado = 'En Proceso';
  const closedWait = recordTicketWaitTransition(ticket, 'En Espera', '2026-01-05T10:30:00.000Z', null, 1);
  assert.equal(closedWait.minutosPausados, 90);
  assert.equal(ticket.fechaLimite, '2026-01-06T08:30:00.000Z');
  assert.equal(ticket.ciclos[0].slaRevisiones.at(-1).motivo, 'PAUSA_ESPERA');
});

test('esperar autorización conserva el vencimiento', () => {
  const ticket = { id: 81, estado: 'En Proceso', prioridad: 'MEDIA', fechaCreacion: '2026-01-05T08:00:00.000Z',
    fechaLimite: '2026-01-07T14:00:00.000Z' };
  syncTicketCycle(ticket);
  ticket.estado = 'En Espera';
  recordTicketWaitTransition(ticket, 'En Proceso', '2026-01-05T09:00:00.000Z', parseTicketWaitReason('AUTORIZACION'), 1);
  ticket.estado = 'En Proceso';
  const closedWait = recordTicketWaitTransition(ticket, 'En Espera', '2026-01-05T12:00:00.000Z', null, 1);
  assert.equal(closedWait.minutosPausados, 0);
  assert.equal(ticket.fechaLimite, '2026-01-07T14:00:00.000Z');
});
