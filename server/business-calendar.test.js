import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addBusinessHours } from '../shared/business-calendar.js';

// Jornada de referencia: L-V 09:00-18:00 (9 h hábiles/día), zona de México (UTC-6, sin DST).
// El 2026-09-16 (miércoles) es feriado: Independencia.
const CAL = Object.freeze({
  timeZone: 'America/Mexico_City',
  workDays: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 18 * 60,
  holidays: ['2026-09-16'],
});

const at = (iso) => new Date(iso).getTime();

test('CRITICA (2h) creada dentro de jornada vence el mismo día', () => {
  // martes 2026-09-08 10:00 local -> 12:00 local
  assert.equal(addBusinessHours(at('2026-09-08T16:00:00Z'), 2, CAL), '2026-09-08T18:00:00.000Z');
});

test('ALTA (8h) creada un viernes por la tarde vence el lunes, no el sábado', () => {
  // viernes 15:00 local: quedan 3h -> restan 5h -> lunes 09:00 + 5h = lunes 14:00 local
  assert.equal(addBusinessHours(at('2026-09-11T21:00:00Z'), 8, CAL), '2026-09-14T20:00:00.000Z');
});

test('ticket creado después del cierre arranca el siguiente día hábil a la apertura', () => {
  // martes 23:00 local -> arranca miércoles 09:00 local -> +2h = 11:00 local
  assert.equal(addBusinessHours(at('2026-09-09T05:00:00Z'), 2, CAL), '2026-09-09T17:00:00.000Z');
});

test('ticket creado en fin de semana arranca el lunes a la apertura', () => {
  // sábado 10:00 local -> lunes 09:00 + 2h = lunes 11:00 local
  assert.equal(addBusinessHours(at('2026-09-12T16:00:00Z'), 2, CAL), '2026-09-14T17:00:00.000Z');
});

test('ticket creado antes de la apertura arranca ese mismo día', () => {
  // martes 07:00 local -> arranca 09:00 + 2h = 11:00 local
  assert.equal(addBusinessHours(at('2026-09-08T13:00:00Z'), 2, CAL), '2026-09-08T17:00:00.000Z');
});

test('el cálculo salta los feriados configurados', () => {
  // martes 15 a las 15:00 local: 3h -> restan 5h; miércoles 16 es feriado -> jueves 17 09:00 + 5h
  assert.equal(addBusinessHours(at('2026-09-15T21:00:00Z'), 8, CAL), '2026-09-17T20:00:00.000Z');
});

test('consumir exactamente lo que resta del día vence al cierre, no al día siguiente', () => {
  // martes 10:00 local + 8h = 18:00 local del mismo día
  assert.equal(addBusinessHours(at('2026-09-08T16:00:00Z'), 8, CAL), '2026-09-09T00:00:00.000Z');
});

// --- Jornada real de Mesa IT: L-V 08:00-17:00 y sábado 09:00-12:00 ---
// El sábado tiene un horario distinto, así que la jornada se define por día.
const MESA_IT = Object.freeze({
  timeZone: 'America/Mexico_City',
  schedule: Object.freeze({
    1: [8 * 60, 17 * 60],
    2: [8 * 60, 17 * 60],
    3: [8 * 60, 17 * 60],
    4: [8 * 60, 17 * 60],
    5: [8 * 60, 17 * 60],
    6: [9 * 60, 12 * 60],
  }),
  holidays: Object.freeze([]),
});

test('ALTA (8h) del viernes por la tarde consume el sábado corto y termina el lunes', () => {
  // viernes 15:00 -> 2h; sábado 09:00-12:00 -> 3h; restan 3h -> lunes 08:00 + 3h = 11:00 local
  assert.equal(addBusinessHours(at('2026-09-11T21:00:00Z'), 8, MESA_IT), '2026-09-14T17:00:00.000Z');
});

test('CRITICA (2h) creada el sábado a las 11:00 se parte entre sábado y lunes', () => {
  // sábado 11:00 -> queda 1h hasta las 12:00; resta 1h -> lunes 08:00 + 1h = 09:00 local
  assert.equal(addBusinessHours(at('2026-09-12T17:00:00Z'), 2, MESA_IT), '2026-09-14T15:00:00.000Z');
});

test('el domingo no es día hábil: arranca el lunes a las 08:00', () => {
  assert.equal(addBusinessHours(at('2026-09-13T16:00:00Z'), 2, MESA_IT), '2026-09-14T16:00:00.000Z');
});

test('creado el sábado después del cierre corto arranca el lunes', () => {
  // sábado 14:00 (ya cerrado) -> lunes 08:00 + 2h = 10:00 local
  assert.equal(addBusinessHours(at('2026-09-12T20:00:00Z'), 2, MESA_IT), '2026-09-14T16:00:00.000Z');
});
