import type { TicketItem } from '../../types/app';
import type { TicketScreenRow } from './TicketsScreen';

type SlaStatus = { label: string; className: string };
type SlaResolver = (ticket: TicketItem) => SlaStatus;

/**
 * Adapta un TicketItem del store a la fila que consume TicketsScreen.
 * No replica lógica de negocio: reutiliza el resolvedor de SLA existente
 * (getSlaStatusForCurrentTime) y el flag `slaVencido` calculado por el backend.
 */
export function adaptTicketToRow(ticket: TicketItem, getSlaStatus: SlaResolver): TicketScreenRow {
  const sla = getSlaStatus(ticket);
  const slaBreached = ticket.slaVencido === true || /vencid/i.test(sla.label);
  return {
    id: ticket.id,
    activoTag: String(ticket.activoTag ?? ''),
    descripcion: String(ticket.descripcion ?? ''),
    prioridad: String(ticket.prioridad ?? ''),
    estado: String(ticket.estado ?? ''),
    asignadoA: String(ticket.asignadoA ?? ''),
    sucursal: String(ticket.sucursal ?? ''),
    slaLabel: sla.label,
    slaBreached,
    fecha: String(ticket.fechaCreacion ?? ticket.fecha ?? ''),
  };
}

export function adaptTicketsForScreen(tickets: TicketItem[], getSlaStatus: SlaResolver): TicketScreenRow[] {
  return tickets.map((ticket) => adaptTicketToRow(ticket, getSlaStatus));
}
