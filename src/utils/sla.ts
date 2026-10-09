import type { TicketItem } from '../types/app';
import { isTicketSlaExpired } from './tickets';

export type HistoricalSlaStatus = 'CUMPLIDO' | 'INCUMPLIDO' | 'NO_EVALUABLE';

export function evaluateTicketHistoricalSla(ticket: TicketItem): HistoricalSlaStatus {
  if (ticket.estado !== 'Resuelto' && ticket.estado !== 'Cerrado') return 'NO_EVALUABLE';
  const currentCycle = ticket.ciclos?.find((cycle) => cycle.id === ticket.cicloActualId)
    || ticket.ciclos?.[ticket.ciclos.length - 1];
  const storedResult = ticket.slaResultado || currentCycle?.slaResultado;
  if (storedResult?.estado === 'CUMPLIDO' || storedResult?.estado === 'INCUMPLIDO') {
    return storedResult.estado;
  }
  const resolvedAt = Date.parse(String(ticket.fechaResolucion || ''));
  const dueAt = Date.parse(String(ticket.fechaLimite || ''));
  if (!Number.isFinite(resolvedAt) || !Number.isFinite(dueAt)) return 'NO_EVALUABLE';
  return resolvedAt <= dueAt ? 'CUMPLIDO' : 'INCUMPLIDO';
}

export function summarizeHistoricalSla(tickets: readonly TicketItem[]) {
  let compliant = 0;
  let nonCompliant = 0;
  let unavailable = 0;
  for (const ticket of tickets) {
    const status = evaluateTicketHistoricalSla(ticket);
    if (status === 'CUMPLIDO') compliant += 1;
    else if (status === 'INCUMPLIDO') nonCompliant += 1;
    else unavailable += 1;
  }
  const total = compliant + nonCompliant;
  return {
    compliant,
    nonCompliant,
    unavailable,
    total,
    percentage: total > 0 ? Math.round((compliant / total) * 100) : null,
  };
}

export function formatTicketSlaResult(ticket: TicketItem, nowMs: number): string {
  if (ticket.estado === 'Cancelado') return 'NO APLICA';
  const historical = evaluateTicketHistoricalSla(ticket);
  if (historical === 'CUMPLIDO') return 'CUMPLIDO';
  if (historical === 'INCUMPLIDO') return 'INCUMPLIDO';
  if (ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado') return 'N/D';
  return isTicketSlaExpired(ticket, nowMs) ? 'VENCIDO' : 'EN TIEMPO';
}
