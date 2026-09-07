// Calendario laboral para el cálculo de SLA.
//
// El vencimiento de un ticket NO puede ser una suma plana de horas al reloj: un ticket
// ALTA (8 h) creado el viernes a las 15:00 vencería el sábado de madrugada, marcándose
// como incumplido sin que nadie hubiera podido atenderlo. Aquí las horas se consumen
// únicamente dentro de la jornada hábil configurada.
//
// La jornada se define POR DÍA porque no todos los días miden lo mismo: en Mesa IT el
// sábado es media jornada (09:00-12:00) frente a las 9 h de lunes a viernes.
//
// Módulo puro y sin estado: recibe el calendario por parámetro para que backend y
// frontend calculen idéntico y para que sea testeable sin depender del reloj del host.

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

/** Jornada de Mesa IT: L-V 08:00-17:00 y sábado 09:00-12:00. Domingo cerrado. */
export const DEFAULT_BUSINESS_CALENDAR = Object.freeze({
  timeZone: 'America/Mexico_City',
  // Clave = día de la semana (0 = domingo). Valor = [minuto de apertura, minuto de cierre].
  schedule: Object.freeze({
    1: Object.freeze([8 * 60, 17 * 60]),
    2: Object.freeze([8 * 60, 17 * 60]),
    3: Object.freeze([8 * 60, 17 * 60]),
    4: Object.freeze([8 * 60, 17 * 60]),
    5: Object.freeze([8 * 60, 17 * 60]),
    6: Object.freeze([9 * 60, 12 * 60]),
  }),
  holidays: Object.freeze([]), // fechas 'YYYY-MM-DD' en la zona del calendario
});

const partsFormatterCache = new Map();

function getPartsFormatter(timeZone) {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

// Instante UTC -> partes de reloj de pared en la zona del calendario.
function getZonedParts(ms, timeZone) {
  const parts = getPartsFormatter(timeZone).formatToParts(new Date(ms));
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    minuteOfDay: read('hour') * MINUTES_PER_HOUR + read('minute'),
  };
}

function getTimeZoneOffsetMs(ms, timeZone) {
  const { year, month, day, minuteOfDay } = getZonedParts(ms, timeZone);
  const asUtc = Date.UTC(year, month - 1, day) + minuteOfDay * MS_PER_MINUTE;
  return asUtc - ms;
}

// Partes de reloj de pared -> instante UTC. La conversión inversa no es directa porque el
// desplazamiento depende del instante que estamos calculando; se converge iterando sobre
// el desplazamiento observado. Dos pasadas bastan incluso en zonas con horario de verano.
function zonedPartsToMs({ year, month, day, minuteOfDay }, timeZone) {
  const naive = Date.UTC(year, month - 1, day) + minuteOfDay * MS_PER_MINUTE;
  let ms = naive;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = naive - getTimeZoneOffsetMs(ms, timeZone);
    if (next === ms) break;
    ms = next;
  }
  return ms;
}

function toDateKey({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekdayOf({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function nextDay({ year, month, day }) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

// Acepta la forma por día (`schedule`) y también la forma uniforme
// (`workDays` + `startMinute` + `endMinute`), más simple cuando todos los días miden igual.
function normalizeCalendar(calendar) {
  const source = calendar || DEFAULT_BUSINESS_CALENDAR;
  const timeZone = String(source.timeZone || DEFAULT_BUSINESS_CALENDAR.timeZone);
  const holidaySet = new Set(source.holidays || []);
  const schedule = new Map();

  const addWindow = (weekday, start, end) => {
    const day = Math.trunc(Number(weekday));
    const from = Math.max(0, Math.trunc(Number(start)));
    const to = Math.min(24 * 60, Math.trunc(Number(end)));
    if (!Number.isInteger(day) || day < 0 || day > 6 || !(to > from)) return;
    schedule.set(day, { start: from, end: to });
  };

  if (source.schedule && typeof source.schedule === 'object') {
    for (const [weekday, window] of Object.entries(source.schedule)) {
      if (Array.isArray(window)) addWindow(weekday, window[0], window[1]);
    }
  } else if (Array.isArray(source.workDays)) {
    for (const weekday of source.workDays) addWindow(weekday, source.startMinute, source.endMinute);
  }

  return { timeZone, schedule, holidaySet };
}

/**
 * Suma `hours` horas hábiles a un instante, respetando la jornada de cada día y los feriados.
 * Devuelve una fecha ISO en UTC.
 */
export function addBusinessHours(startMs, hours, calendar = DEFAULT_BUSINESS_CALENDAR) {
  const base = Number.isFinite(startMs) ? startMs : Date.now();
  const { timeZone, schedule, holidaySet } = normalizeCalendar(calendar);

  // Sin jornada configurada no hay forma de repartir las horas: se degrada al cálculo
  // continuo antes que devolver un vencimiento imposible o entrar en un bucle infinito.
  if (schedule.size === 0) {
    return new Date(base + hours * MINUTES_PER_HOUR * MS_PER_MINUTE).toISOString();
  }

  const windowFor = (parts) => (holidaySet.has(toDateKey(parts)) ? null : schedule.get(weekdayOf(parts)) || null);

  const advanceToNextWorkingDay = (parts) => {
    let cursor = parts;
    for (;;) {
      cursor = nextDay(cursor);
      const window = windowFor(cursor);
      if (window) return { parts: cursor, window };
    }
  };

  let parts = getZonedParts(base, timeZone);
  let window = windowFor(parts);
  let cursorMinute = parts.minuteOfDay;

  // Reubica el arranque dentro de la jornada: antes de abrir espera a la apertura;
  // después del cierre, en día no hábil o en feriado, salta al siguiente día laborable.
  if (!window || cursorMinute >= window.end) {
    ({ parts, window } = advanceToNextWorkingDay(parts));
    cursorMinute = window.start;
  } else if (cursorMinute < window.start) {
    cursorMinute = window.start;
  }

  let remaining = Math.max(0, Math.round(hours * MINUTES_PER_HOUR));

  for (;;) {
    const availableToday = window.end - cursorMinute;
    // El caso de igualdad vence al cierre del día, no en la apertura del siguiente.
    if (remaining <= availableToday) {
      const due = { ...parts, minuteOfDay: cursorMinute + remaining };
      return new Date(zonedPartsToMs(due, timeZone)).toISOString();
    }

    remaining -= availableToday;
    ({ parts, window } = advanceToNextWorkingDay(parts));
    cursorMinute = window.start;
  }
}
