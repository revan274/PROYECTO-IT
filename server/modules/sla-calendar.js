// Resolución del calendario laboral usado para el SLA, a partir del entorno.
//
// Vive aquí y no en utils/helpers.js para que `store.js` pueda usarlo sin crear un ciclo
// de importación (helpers.js ya importa de store.js). Solo depende de `shared/`, que no
// importa nada del servidor.
import { DEFAULT_BUSINESS_CALENDAR, addBusinessHours } from '../../shared/business-calendar.js';
import { SLA_POLICY_HOURS } from '../../shared/ticket-rules.js';
import { createHash } from 'node:crypto';

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** `SLA_HOLIDAYS='2026-12-25,2027-01-01'` -> ['2026-12-25','2027-01-01']. */
export function parseHolidayList(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => ISO_DATE.test(value));
}

export function buildSlaCalendar(env = process.env) {
  return Object.freeze({
    ...DEFAULT_BUSINESS_CALENDAR,
    timeZone: String(env.SLA_TIMEZONE || DEFAULT_BUSINESS_CALENDAR.timeZone),
    holidays: Object.freeze(parseHolidayList(env.SLA_HOLIDAYS)),
  });
}

const SLA_CALENDAR = buildSlaCalendar();

function cloneSchedule(schedule) {
  return Object.fromEntries(
    Object.entries(schedule || {})
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([day, window]) => [day, Array.isArray(window) ? [...window] : window]),
  );
}

/**
 * Definición inmutable y versionada de la política efectiva del proceso.
 *
 * Si no se asigna SLA_POLICY_VERSION, la versión deriva de todas las reglas que
 * afectan el vencimiento. Así, cambiar zona, feriados, jornada u horas produce
 * una versión distinta sin depender de que alguien recuerde actualizarla.
 */
export function buildSlaPolicyDefinition(env = process.env) {
  const calendar = buildSlaCalendar(env);
  const definition = {
    horasPorPrioridad: { ...SLA_POLICY_HOURS },
    calendario: {
      zonaHoraria: calendar.timeZone,
      jornada: cloneSchedule(calendar.schedule),
      feriados: [...calendar.holidays],
    },
  };
  const configuredVersion = String(env.SLA_POLICY_VERSION || '').trim().slice(0, 80);
  const generatedVersion = createHash('sha256')
    .update(JSON.stringify(definition))
    .digest('hex')
    .slice(0, 16);
  return Object.freeze({
    version: configuredVersion || `sla-${generatedVersion}`,
    ...definition,
  });
}

const SLA_POLICY = buildSlaPolicyDefinition();

export function getSlaCalendar() {
  return SLA_CALENDAR;
}

export function getSlaPolicyDefinition() {
  return SLA_POLICY;
}

/** Crea la evidencia del compromiso SLA asignado a un ciclo. */
export function createSlaAssignment(
  prioridad,
  baseMs = Date.now(),
  assignedAt = new Date().toISOString(),
  policy = SLA_POLICY,
) {
  const selectedPriority = Object.hasOwn(policy.horasPorPrioridad, prioridad) ? prioridad : 'MEDIA';
  const hours = policy.horasPorPrioridad[selectedPriority];
  const start = Number.isFinite(baseMs) ? baseMs : Date.now();
  const calendar = {
    timeZone: policy.calendario.zonaHoraria,
    schedule: policy.calendario.jornada,
    holidays: policy.calendario.feriados,
  };
  return {
    versionPolitica: policy.version,
    prioridad: selectedPriority,
    horasAsignadas: hours,
    asignadoEn: new Date(assignedAt).toISOString(),
    inicioCiclo: new Date(start).toISOString(),
    fechaLimite: addBusinessHours(start, hours, calendar),
    calendario: structuredClone(policy.calendario),
  };
}

/**
 * Fecha límite del ticket según su prioridad, contando solo horas hábiles.
 * Fuente única: la usan tanto la creación de tickets como la normalización del store.
 */
export function calcSlaDueDate(prioridad, baseMs = Date.now()) {
  const hours = SLA_POLICY_HOURS[prioridad] || SLA_POLICY_HOURS.MEDIA;
  const base = Number.isFinite(baseMs) ? baseMs : Date.now();
  return addBusinessHours(base, hours, SLA_CALENDAR);
}
