import { useState } from 'react';
import type { 
  PrioridadTicket, 
  TicketEstado 
} from '../types/app';

export function useTicketUiState() {
  const [ticketLifecycleFilter, setTicketLifecycleFilter] = useState<'TODOS' | 'ABIERTOS' | 'CERRADOS'>('TODOS');
  const [ticketStateFilter, setTicketStateFilter] = useState<TicketEstado | 'TODOS'>('TODOS');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<PrioridadTicket | 'TODAS'>('TODAS');
  const [ticketAssignmentFilter, setTicketAssignmentFilter] = useState<'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR'>('TODOS');
  const [ticketSlaFilter, setTicketSlaFilter] = useState<'TODOS' | 'VENCIDO'>('TODOS');
  const [ticketCommentDrafts, setTicketCommentDrafts] = useState<Record<number, string>>({});
  const [ticketAttachmentLoadingId, setTicketAttachmentLoadingId] = useState<number | null>(null);

  return {
    ticketLifecycleFilter, setTicketLifecycleFilter,
    ticketStateFilter, setTicketStateFilter,
    ticketPriorityFilter, setTicketPriorityFilter,
    ticketAssignmentFilter, setTicketAssignmentFilter,
    ticketSlaFilter, setTicketSlaFilter,
    ticketCommentDrafts, setTicketCommentDrafts,
    ticketAttachmentLoadingId, setTicketAttachmentLoadingId,
  };
}
