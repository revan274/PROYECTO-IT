import { addBusinessMinutes, businessMinutesBetween } from '../../shared/business-calendar.js';
import { getSlaCalendar } from '../modules/sla-calendar.js';

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isoInstant(value) {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function inferHistoryEventType(action) {
  const key = String(action || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (key.includes('creado')) return 'creacion';
  if (key.includes('reabierto')) return 'reapertura';
  if (key.includes('resuelto')) return 'solucion';
  if (key.includes('cerrado')) return 'cierre';
  if (key.includes('cancelado')) return 'cancelacion';
  if (key.includes('archivado')) return 'archivo';
  if (key.includes('prioridad')) return 'prioridad';
  if (key.includes('asignacion')) return 'asignacion';
  if (key.includes('comentario')) return 'comentario';
  if (key.includes('adjunto')) return 'adjunto';
  if (key.includes('estado')) return 'estado';
  return 'actualizacion';
}

export function normalizeTicketDates(ticket) {
  const copy = { ...ticket };
  if (!copy.fechasVersion && copy.fechaCierre) {
    // The previous schema used this field for either resolution or closure.
    copy.fechaTerminalLegacy = copy.fechaCierre;
    copy.fechaCierre = null;
  }
  for (const field of ['fechaCreacion', 'fechaPrimeraAtencion', 'fechaResolucion', 'fechaCierre', 'fechaLimite']) {
    const normalized = isoInstant(copy[field]);
    if (copy[field] && !normalized) copy[`${field}Legacy`] = copy[field];
    copy[field] = normalized;
  }
  if (copy.fecha && !isoInstant(copy.fecha)) copy.fechaLegacy = copy.fecha;
  copy.fecha = copy.fechaCreacion;
  copy.historial = (Array.isArray(copy.historial) ? copy.historial : []).map((entry) => {
    const fecha = isoInstant(entry.fecha);
    const actorId = Number(entry.actorId);
    const usuario = String(entry.nombreMostrado || entry.usuario || 'Sistema').trim() || 'Sistema';
    return {
      ...entry,
      ...(entry.fecha && !fecha ? { fechaLegacy: entry.fecha } : {}),
      fecha,
      actorId: Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
      usuario,
      nombreMostrado: usuario,
      tipo: String(entry.tipo || inferHistoryEventType(entry.accion)),
      before: Object.hasOwn(entry, 'before') ? entry.before : null,
      after: Object.hasOwn(entry, 'after') ? entry.after : null,
    };
  });
  copy.fechasVersion = 1;
  return copy;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function legacySlaAssignment(ticket, cycle) {
  return {
    versionPolitica: null,
    prioridad: ticket.prioridad,
    horasAsignadas: null,
    asignadoEn: null,
    inicioCiclo: cycle.fechaInicio || ticket.fechaCreacion || null,
    fechaLimite: ticket.fechaLimite || null,
    calendario: null,
    reconstruccionLegacy: true,
    cicloId: cycle.id,
    cicloNumero: cycle.numero,
  };
}

function buildSlaResult(assignment, resolvedAt, legacy = false) {
  const resolutionMs = Date.parse(String(resolvedAt || ''));
  const dueMs = Date.parse(String(assignment?.fechaLimite || ''));
  if (!Number.isFinite(resolutionMs) || !Number.isFinite(dueMs)) return null;
  return {
    estado: resolutionMs <= dueMs ? 'CUMPLIDO' : 'INCUMPLIDO',
    evaluadoEn: new Date(resolutionMs).toISOString(),
    fechaResolucion: new Date(resolutionMs).toISOString(),
    fechaLimite: new Date(dueMs).toISOString(),
    versionPolitica: assignment?.versionPolitica || null,
    ...(legacy || assignment?.reconstruccionLegacy ? { reconstruccionLegacy: true } : {}),
  };
}

export function syncTicketCycle(ticket) {
  if (!Array.isArray(ticket.ciclos) || ticket.ciclos.length === 0) {
    ticket.ciclos = [{ id: `${ticket.id}:1`, numero: 1, fechaInicio: ticket.fechaCreacion || null,
      fechaPrimeraAtencion: ticket.fechaPrimeraAtencion || null, reconstruccionLegacy: true }];
  }
  const current = ticket.ciclos[ticket.ciclos.length - 1];
  Object.assign(current, {
    estado: ticket.estado, prioridad: ticket.prioridad,
    fechaResolucion: ticket.fechaResolucion || null, fechaCierre: ticket.fechaCierre || null,
    fechaLimite: ticket.fechaLimite || null, solucionAplicada: ticket.solucionAplicada || null,
    diagnostico: ticket.diagnostico || null, asignadoAId: ticket.asignadoAId || null,
    asignadoA: ticket.asignadoA || '',
  });
  if (ticket.slaActual) {
    current.slaAsignado = {
      ...clone(ticket.slaActual),
      cicloId: current.id,
      cicloNumero: current.numero,
    };
  } else if (!current.slaAsignado) {
    current.slaAsignado = legacySlaAssignment(ticket, current);
  }
  if (!ticket.slaActual && current.slaAsignado && !current.slaAsignado.reconstruccionLegacy) {
    ticket.slaActual = clone(current.slaAsignado);
  }
  if (ticket.fechaResolucion && !current.slaResultado) {
    current.slaResultado = buildSlaResult(current.slaAsignado, ticket.fechaResolucion, current.reconstruccionLegacy);
  }
  if (current.slaResultado) ticket.slaResultado = clone(current.slaResultado);
  ticket.cicloActualId = current.id;
  return current;
}

export function assignSlaToCurrentCycle(ticket, assignment, revision = null) {
  const current = syncTicketCycle(ticket);
  const previous = current.slaAsignado ? clone(current.slaAsignado) : null;
  const next = {
    ...clone(assignment),
    cicloId: current.id,
    cicloNumero: current.numero,
  };
  if (revision && previous) {
    current.slaRevisiones = Array.isArray(current.slaRevisiones) ? current.slaRevisiones : [];
    current.slaRevisiones.push({ ...clone(revision), anterior: previous, nuevo: clone(next) });
  }
  current.slaAsignado = next;
  ticket.slaActual = clone(next);
  ticket.fechaLimite = next.fechaLimite || null;
  current.fechaLimite = ticket.fechaLimite;
  current.prioridad = ticket.prioridad;
  return current;
}

function calendarForAssignment(assignment) {
  const snapshot = assignment?.calendario;
  if (!snapshot) return getSlaCalendar();
  return {
    timeZone: snapshot.zonaHoraria,
    schedule: snapshot.jornada,
    holidays: snapshot.feriados,
  };
}

/** Abre/cierra una espera y aplica la regla explícita de pausa del motivo seleccionado. */
export function recordTicketWaitTransition(ticket, previousState, timestamp, waitReason = null, actorId = null) {
  const current = syncTicketCycle(ticket);
  current.esperas = Array.isArray(current.esperas) ? current.esperas : [];

  if (ticket.estado === 'En Espera' && previousState !== 'En Espera') {
    const wait = {
      id: `${current.id}:espera:${current.esperas.length + 1}`,
      motivo: waitReason.value,
      etiqueta: waitReason.label,
      pausaSla: waitReason.pausaSla,
      fechaInicio: timestamp,
      fechaFin: null,
      actorId,
    };
    current.esperas.push(wait);
    ticket.esperaActual = clone(wait);
    return wait;
  }

  if (previousState !== 'En Espera' || ticket.estado === 'En Espera') return null;
  const wait = [...current.esperas].reverse().find((entry) => !entry.fechaFin)
    || (ticket.esperaActual ? clone(ticket.esperaActual) : null);
  if (!wait) {
    ticket.esperaActual = null;
    return null;
  }
  wait.fechaFin = timestamp;
  wait.minutosPausados = 0;
  if (wait.pausaSla && current.slaAsignado?.fechaLimite) {
    const calendar = calendarForAssignment(current.slaAsignado);
    const pausedMinutes = businessMinutesBetween(Date.parse(wait.fechaInicio), Date.parse(timestamp), calendar);
    wait.minutosPausados = pausedMinutes;
    if (pausedMinutes > 0) {
      const previousDueDate = current.slaAsignado.fechaLimite;
      const adjusted = {
        ...clone(current.slaAsignado),
        fechaLimite: addBusinessMinutes(Date.parse(previousDueDate), pausedMinutes, calendar),
      };
      assignSlaToCurrentCycle(ticket, adjusted, {
        fecha: timestamp,
        motivo: 'PAUSA_ESPERA',
        actorId,
        motivoEspera: wait.motivo,
        minutosPausados: pausedMinutes,
      });
      wait.fechaLimiteAnterior = previousDueDate;
      wait.fechaLimiteNueva = adjusted.fechaLimite;
    }
  }
  const storedWait = current.esperas.find((entry) => entry.id === wait.id);
  if (storedWait && storedWait !== wait) Object.assign(storedWait, wait);
  ticket.esperaActual = null;
  return wait;
}

export function recordTicketMilestones(ticket, previousState, timestamp, newSlaAssignment = null) {
  if (ticket.estado === previousState) { syncTicketCycle(ticket); return; }
  if (['Resuelto', 'Cerrado'].includes(previousState) && ['Abierto', 'En Proceso', 'En Espera'].includes(ticket.estado)) {
    // The previous cycle is frozen before new work starts. Never touch it again.
    if (!ticket.ciclos?.length) {
      const previous = { ...ticket, estado: previousState };
      syncTicketCycle(previous);
      ticket.ciclos = previous.ciclos;
    }
    const number = (ticket.ciclos?.length || 0) + 1;
    ticket.historial.unshift({ fecha: timestamp, actorId: null, usuario: 'Sistema', nombreMostrado: 'Sistema',
      tipo: 'ciclo', accion: 'Hitos del ciclo anterior', estado: previousState,
      before: { estado: previousState }, after: { fechaResolucion: ticket.fechaResolucion, fechaCierre: ticket.fechaCierre },
      fechaResolucion: ticket.fechaResolucion, fechaCierre: ticket.fechaCierre });
    ticket.ciclos = [...(ticket.ciclos || []), { id: `${ticket.id}:${number}`, numero: number,
      fechaInicio: timestamp, fechaPrimeraAtencion: null, reapertura: ticket.ultimaReapertura || null }];
    ticket.fechaResolucion = null;
    ticket.fechaCierre = null;
    ticket.solucionAplicada = null;
    ticket.diagnostico = null;
    ticket.slaResultado = null;
    ticket.slaActual = newSlaAssignment ? clone(newSlaAssignment) : null;
    ticket.fechaLimite = newSlaAssignment?.fechaLimite || (typeof newSlaAssignment === 'string' ? newSlaAssignment : null);
  }
  if (['En Proceso', 'Resuelto'].includes(ticket.estado) && !ticket.fechaPrimeraAtencion) ticket.fechaPrimeraAtencion = timestamp;
  if (ticket.estado === 'Resuelto') ticket.fechaResolucion = timestamp;
  if (ticket.estado === 'Cerrado') ticket.fechaCierre = timestamp;
  const current = syncTicketCycle(ticket);
  if (['En Proceso', 'Resuelto'].includes(ticket.estado) && !current.fechaPrimeraAtencion) current.fechaPrimeraAtencion = timestamp;
  if (ticket.estado === 'Resuelto' && !current.slaResultado) {
    current.slaResultado = buildSlaResult(current.slaAsignado, ticket.fechaResolucion, current.reconstruccionLegacy);
    ticket.slaResultado = clone(current.slaResultado);
  }
}
