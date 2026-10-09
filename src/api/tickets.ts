import { apiRequest } from '../utils/api';
import type { TicketItem } from '../types/app';

export function retainTicket(id: number, accion: 'cancelar' | 'archivar', motivo: string) {
  return apiRequest<TicketItem>(`/tickets/${id}/retention`, {
    method: 'POST',
    body: JSON.stringify({ accion, motivo }),
  });
}

export function fetchTicketDetail(id: number) {
  return apiRequest<TicketItem>(`/tickets/${id}`);
}
