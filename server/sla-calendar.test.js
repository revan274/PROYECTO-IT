import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseHolidayList, buildSlaCalendar } from './modules/sla-calendar.js';

test('parseHolidayList acepta fechas ISO separadas por coma y descarta basura', () => {
  assert.deepEqual(
    parseHolidayList(' 2026-12-25 , no-es-fecha, 2027-01-01 ,, 2026-13-99 '),
    ['2026-12-25', '2027-01-01'],
  );
});

test('parseHolidayList devuelve lista vacía cuando no hay configuración', () => {
  assert.deepEqual(parseHolidayList(undefined), []);
  assert.deepEqual(parseHolidayList(''), []);
});

test('buildSlaCalendar conserva la jornada de Mesa IT y aplica los feriados del entorno', () => {
  const calendar = buildSlaCalendar({ SLA_HOLIDAYS: '2026-12-25' });

  assert.deepEqual(calendar.schedule[1], [8 * 60, 17 * 60], 'lunes 08:00-17:00');
  assert.deepEqual(calendar.schedule[6], [9 * 60, 12 * 60], 'sábado 09:00-12:00');
  assert.equal(calendar.schedule[0], undefined, 'domingo cerrado');
  assert.deepEqual(calendar.holidays, ['2026-12-25']);
});

test('buildSlaCalendar permite sobreescribir la zona horaria', () => {
  assert.equal(buildSlaCalendar({}).timeZone, 'America/Mexico_City');
  assert.equal(buildSlaCalendar({ SLA_TIMEZONE: 'America/Tijuana' }).timeZone, 'America/Tijuana');
});
