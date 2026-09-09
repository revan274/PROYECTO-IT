import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_BUSINESS_CALENDAR, isWithinBusinessHours } from '../shared/business-calendar.js';
import {
  MINUTOS_DE_AVISO_POR_DEFECTO,
  TIPO_AVISO_SLA,
  leerMinutosDeAviso,
  revisarSlaUnaVez,
  ticketsPorVencer,
} from './modules/sla-watcher.js';
import { MOTIVOS } from './modules/ticket-notifications.js';

const MINUTO = 60_000;
// Miercoles 9 de septiembre de 2026, 10:00 en America/Mexico_City (UTC-6).
const MIERCOLES_10H = Date.parse('2026-09-09T16:00:00.000Z');
// Mismo dia, 03:00 local: fuera de jornada.
const MIERCOLES_3H = Date.parse('2026-09-09T09:00:00.000Z');

function ticket(extra = {}) {
  return {
    id: 1,
    estado: 'Abierto',
    prioridad: 'ALTA',
    asignadoA: '',
    fechaLimite: new Date(MIERCOLES_10H + 30 * MINUTO).toISOString(),
    ...extra,
  };
}

function ledgerQueSiempreConcede() {
  const reclamados = [];
  return {
    reclamados,
    async reclamar(id, tipo) { reclamados.push(`${id}:${tipo}`); return true; },
  };
}

test('avisa solo dentro de la ventana: ni vencido, ni demasiado pronto', () => {
  const tickets = [
    ticket({ id: 1, fechaLimite: new Date(MIERCOLES_10H + 30 * MINUTO).toISOString() }),
    ticket({ id: 2, fechaLimite: new Date(MIERCOLES_10H - 5 * MINUTO).toISOString() }),
    ticket({ id: 3, fechaLimite: new Date(MIERCOLES_10H + 8 * 60 * MINUTO).toISOString() }),
  ];

  const elegidos = ticketsPorVencer(tickets, MIERCOLES_10H, 60).map((t) => t.id);

  assert.deepEqual(elegidos, [1]);
});

test('un ticket cerrado o sin fecha limite nunca entra', () => {
  const tickets = [
    ticket({ id: 10, estado: 'Cerrado' }),
    ticket({ id: 11, estado: 'Resuelto' }),
    ticket({ id: 12, fechaLimite: '' }),
    ticket({ id: 13, fechaLimite: 'no es una fecha' }),
  ];

  assert.deepEqual(ticketsPorVencer(tickets, MIERCOLES_10H, 60), []);
});

test('una lista ausente no rompe la revision', () => {
  assert.deepEqual(ticketsPorVencer(undefined, MIERCOLES_10H, 60), []);
  assert.deepEqual(ticketsPorVencer([null, undefined], MIERCOLES_10H, 60), []);
});

test('el margen de aviso se limita a valores utiles', () => {
  assert.equal(leerMinutosDeAviso('90'), 90);
  assert.equal(leerMinutosDeAviso(''), MINUTOS_DE_AVISO_POR_DEFECTO);
  assert.equal(leerMinutosDeAviso('cero'), MINUTOS_DE_AVISO_POR_DEFECTO);
  assert.equal(leerMinutosDeAviso('-5'), MINUTOS_DE_AVISO_POR_DEFECTO);
  // Un margen mayor a una jornada haria que todo ticket naciera "por vencer".
  assert.equal(leerMinutosDeAviso('99999'), 12 * 60);
});

test('fuera de jornada no se avisa: un correo de madrugada no lo lee nadie', async () => {
  const enviados = [];
  const resumen = await revisarSlaUnaVez({
    leerDb: async () => ({ tickets: [ticket()], users: [] }),
    ledger: ledgerQueSiempreConcede(),
    ahoraMs: MIERCOLES_3H,
    enviar: (aviso) => enviados.push(aviso),
  });

  assert.equal(resumen.motivo, 'fuera-de-jornada');
  assert.equal(enviados.length, 0);
});

test('con responsable el aviso es personal; sin responsable se difunde', async () => {
  const users = [
    { nombre: 'Tono Tecnico', rol: 'tecnico', activo: true, email: 'tono@losgigantes.mx' },
    { nombre: 'Ana Admin', rol: 'admin', activo: true, email: 'ana@losgigantes.mx' },
  ];
  const enviados = [];
  await revisarSlaUnaVez({
    leerDb: async () => ({
      tickets: [ticket({ id: 1, asignadoA: 'Tono Tecnico' }), ticket({ id: 2, asignadoA: '' })],
      users,
    }),
    ledger: ledgerQueSiempreConcede(),
    ahoraMs: MIERCOLES_10H,
    enviar: (aviso) => enviados.push(aviso),
  });

  assert.equal(enviados.length, 2);
  assert.deepEqual(enviados[0].destinatarios, ['tono@losgigantes.mx']);
  assert.equal(enviados[0].motivo, MOTIVOS.POR_VENCER);
  assert.deepEqual(enviados[1].destinatarios.sort(), ['ana@losgigantes.mx', 'tono@losgigantes.mx']);
});

test('si el registro dice que ya se aviso, no se repite', async () => {
  const enviados = [];
  const resumen = await revisarSlaUnaVez({
    leerDb: async () => ({ tickets: [ticket()], users: [] }),
    ledger: { async reclamar() { return false; } },
    ahoraMs: MIERCOLES_10H,
    enviar: (aviso) => enviados.push(aviso),
  });

  assert.equal(resumen.revisados, 1);
  assert.equal(resumen.avisados, 0);
  assert.equal(enviados.length, 0);
});

test('si no se puede dejar constancia NO se envia: mejor perder un aviso que repetirlo cada vuelta', async () => {
  const enviados = [];
  const registrados = [];
  const resumen = await revisarSlaUnaVez({
    leerDb: async () => ({ tickets: [ticket()], users: [] }),
    ledger: { async reclamar() { throw new Error('Neon dormida'); } },
    ahoraMs: MIERCOLES_10H,
    enviar: (aviso) => enviados.push(aviso),
    log: (...args) => registrados.push(args),
  });

  assert.equal(enviados.length, 0);
  assert.equal(resumen.avisados, 0);
  assert.equal(registrados.length, 1, 'el fallo debe quedar registrado');
});

test('un fallo al leer la base no tumba el proceso', async () => {
  const registrados = [];
  const resumen = await revisarSlaUnaVez({
    leerDb: async () => { throw new Error('sin conexion'); },
    ledger: ledgerQueSiempreConcede(),
    ahoraMs: MIERCOLES_10H,
    log: (...args) => registrados.push(args),
  });

  assert.ok(resumen.error, 'el resumen debe reportar el fallo');
  assert.equal(resumen.avisados, 0);
  assert.equal(registrados.length, 1);
});

test('el aviso se reserva con el tipo esperado', async () => {
  const ledger = ledgerQueSiempreConcede();
  await revisarSlaUnaVez({
    leerDb: async () => ({ tickets: [ticket({ id: 77 })], users: [] }),
    ledger,
    ahoraMs: MIERCOLES_10H,
    enviar: () => {},
  });

  assert.deepEqual(ledger.reclamados, [`77:${TIPO_AVISO_SLA}`]);
});

test('la jornada se respeta: sabado medio dia, domingo cerrado', () => {
  const cal = DEFAULT_BUSINESS_CALENDAR;
  // Sabado 12 de septiembre de 2026: jornada 09:00-12:00 local.
  assert.equal(isWithinBusinessHours(Date.parse('2026-09-12T16:00:00.000Z'), cal), true, 'sabado 10:00');
  assert.equal(isWithinBusinessHours(Date.parse('2026-09-12T19:00:00.000Z'), cal), false, 'sabado 13:00');
  // Domingo 13 de septiembre: cerrado todo el dia.
  assert.equal(isWithinBusinessHours(Date.parse('2026-09-13T17:00:00.000Z'), cal), false, 'domingo 11:00');
  // Miercoles dentro y fuera.
  assert.equal(isWithinBusinessHours(MIERCOLES_10H, cal), true, 'miercoles 10:00');
  assert.equal(isWithinBusinessHours(MIERCOLES_3H, cal), false, 'miercoles 03:00');
});

test('un feriado cargado apaga la jornada de ese dia', () => {
  const conFeriado = { ...DEFAULT_BUSINESS_CALENDAR, holidays: ['2026-09-09'] };
  assert.equal(isWithinBusinessHours(MIERCOLES_10H, conFeriado), false);
});
