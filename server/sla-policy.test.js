import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSlaPolicyDefinition, createSlaAssignment } from './modules/sla-calendar.js';

test('la versión derivada cambia cuando cambia el calendario', () => {
  const base = buildSlaPolicyDefinition({ SLA_TIMEZONE: 'UTC', SLA_HOLIDAYS: '' });
  const changed = buildSlaPolicyDefinition({ SLA_TIMEZONE: 'UTC', SLA_HOLIDAYS: '2026-01-06' });
  assert.notEqual(base.version, changed.version);
  assert.deepEqual(changed.calendario.feriados, ['2026-01-06']);
});

test('la asignación conserva horas, calendario, versión y vencimiento', () => {
  const policy = buildSlaPolicyDefinition({
    SLA_TIMEZONE: 'UTC',
    SLA_HOLIDAYS: '',
    SLA_POLICY_VERSION: 'mesa-it-2026.1',
  });
  const assignment = createSlaAssignment(
    'CRITICA',
    Date.parse('2026-01-05T08:00:00.000Z'),
    '2026-01-05T08:01:00.000Z',
    policy,
  );
  assert.equal(assignment.versionPolitica, 'mesa-it-2026.1');
  assert.equal(assignment.prioridad, 'CRITICA');
  assert.equal(assignment.horasAsignadas, 2);
  assert.equal(assignment.fechaLimite, '2026-01-05T10:00:00.000Z');
  assert.equal(assignment.calendario.zonaHoraria, 'UTC');
  assert.deepEqual(assignment.calendario.jornada['1'], [480, 1020]);
});
