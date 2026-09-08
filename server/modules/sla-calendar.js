// Resolución del calendario laboral usado para el SLA, a partir del entorno.
//
// Vive aquí y no en utils/helpers.js para que `store.js` pueda usarlo sin crear un ciclo
// de importación (helpers.js ya importa de store.js). Solo depende de `shared/`, que no
// importa nada del servidor.
import { DEFAULT_BUSINESS_CALENDAR, addBusinessHours } from '../../shared/business-calendar.js';
import { SLA_POLICY_HOURS } from '../../shared/ticket-rules.js';

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

export function getSlaCalendar() {
  return SLA_CALENDAR;
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
