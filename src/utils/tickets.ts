import { SLA_POLICY } from '../constants/app';
import type {
  PrioridadTicket,
  TicketAttentionType,
  TicketEstado,
  TicketItem,
} from '../types/app';
import { parseDateToTimestamp } from './format';

export function calculateSlaDeadline(prioridad: PrioridadTicket): string {
  const hours = SLA_POLICY[prioridad] || SLA_POLICY.MEDIA;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function isTicketClosed(ticket: Pick<TicketItem, 'estado'>): boolean {
  return ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado';
}

export function ticketAuditActionLabel(estado: TicketEstado): string {
  if (estado === 'Resuelto') return 'Ticket Resuelto';
  if (estado === 'Cerrado') return 'Ticket Cerrado';
  if (estado === 'En Proceso') return 'Ticket En Proceso';
  if (estado === 'En Espera') return 'Ticket En Espera';
  return 'Ticket Actualizado';
}

export function buildTicketHistoryEntry(
  accion: string,
  estado: TicketEstado,
  usuario: string,
  comentario = '',
): { fecha: string; usuario: string; accion: string; estado: TicketEstado; comentario?: string } {
  return {
    fecha: new Date().toISOString(),
    usuario,
    accion,
    estado,
    comentario,
  };
}

function getTicketSlaDueTimestamp(ticket: Pick<TicketItem, 'fechaLimite'>): number | null {
  return parseDateToTimestamp(ticket.fechaLimite || '');
}

export function getTicketSlaRemainingMinutes(ticket: TicketItem, nowMs = Date.now()): number | null {
  if (isTicketClosed(ticket)) return null;
  const dueTimestamp = getTicketSlaDueTimestamp(ticket);
  if (dueTimestamp !== null) {
    return Math.ceil((dueTimestamp - nowMs) / 60000);
  }
  return typeof ticket.slaRestanteMin === 'number' ? ticket.slaRestanteMin : null;
}

export function isTicketSlaExpired(ticket: TicketItem, nowMs = Date.now()): boolean {
  if (isTicketClosed(ticket)) return false;
  const dueTimestamp = getTicketSlaDueTimestamp(ticket);
  if (dueTimestamp !== null) return nowMs > dueTimestamp;
  const remaining = typeof ticket.slaRestanteMin === 'number' ? ticket.slaRestanteMin : null;
  return !!ticket.slaVencido || (typeof remaining === 'number' && remaining <= 0);
}

export function getSlaStatus(ticket: TicketItem, nowMs = Date.now()): { label: string; className: string } {
  if (isTicketClosed(ticket)) {
    return { label: 'SLA CERRADO', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  const remaining = getTicketSlaRemainingMinutes(ticket, nowMs);
  if (isTicketSlaExpired(ticket, nowMs) || (typeof remaining === 'number' && remaining <= 0)) {
    return { label: 'SLA VENCIDO', className: 'bg-red-50 text-red-600 border-red-200' };
  }
  if (typeof remaining === 'number' && remaining <= 60) {
    return { label: `SLA ${remaining} MIN`, className: 'bg-amber-50 text-amber-600 border-amber-200' };
  }
  if (typeof remaining === 'number') {
    const hours = Math.ceil(remaining / 60);
    return { label: `SLA ${hours} H`, className: 'bg-green-50 text-green-600 border-green-200' };
  }

  return { label: 'SLA N/D', className: 'bg-slate-100 text-slate-500 border-slate-200' };
}

export function normalizeTicketAttentionType(value: unknown): TicketAttentionType | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PRESENCIAL' || normalized === 'REMOTO') return normalized as TicketAttentionType;
  return null;
}

export function formatTicketAttentionType(value: unknown): string {
  const normalized = normalizeTicketAttentionType(value);
  if (!normalized) return 'Sin definir';
  return normalized === 'PRESENCIAL' ? 'Presencial' : 'Remoto';
}

export function buildTicketDescription(areaAfectada: string, descripcion: string): string {
  const area = String(areaAfectada || '').trim();
  const details = String(descripcion || '').trim();
  if (!area) return details;
  const areaLabel = `Área afectada: ${area}`;
  return details.startsWith(areaLabel) ? details : `${areaLabel} | ${details}`;
}
