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
  const [ticketSlaFilter, setTicketSlaFilter] = useState<'TODOS' | 'VENCIDO' | 'EN_TIEMPO' | 'CUMPLIDO' | 'INCUMPLIDO' | 'NO_EVALUABLE'>('TODOS');
  const [ticketTechnicianFilter, setTicketTechnicianFilter] = useState('TODOS');
  const [ticketBranchFilter, setTicketBranchFilter] = useState('TODAS');
  const [ticketAreaFilter, setTicketAreaFilter] = useState('TODAS');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('TODAS');
  const [ticketRequesterFilter, setTicketRequesterFilter] = useState('TODOS');
  const [ticketAssetFilter, setTicketAssetFilter] = useState('TODOS');
  const [ticketDateFrom, setTicketDateFrom] = useState('');
  const [ticketDateTo, setTicketDateTo] = useState('');
  const [ticketCommentDrafts, setTicketCommentDrafts] = useState<Record<number, string>>({});
  const [ticketCommentResponseRequests, setTicketCommentResponseRequests] = useState<Record<number, boolean>>({});
  const [ticketAttachmentLoadingId, setTicketAttachmentLoadingId] = useState<number | null>(null);

  return {
    ticketLifecycleFilter, setTicketLifecycleFilter,
    ticketStateFilter, setTicketStateFilter,
    ticketPriorityFilter, setTicketPriorityFilter,
    ticketAssignmentFilter, setTicketAssignmentFilter,
    ticketSlaFilter, setTicketSlaFilter,
    ticketTechnicianFilter, setTicketTechnicianFilter,
    ticketBranchFilter, setTicketBranchFilter,
    ticketAreaFilter, setTicketAreaFilter,
    ticketCategoryFilter, setTicketCategoryFilter,
    ticketRequesterFilter, setTicketRequesterFilter,
    ticketAssetFilter, setTicketAssetFilter,
    ticketDateFrom, setTicketDateFrom,
    ticketDateTo, setTicketDateTo,
    ticketCommentDrafts, setTicketCommentDrafts,
    ticketCommentResponseRequests, setTicketCommentResponseRequests,
    ticketAttachmentLoadingId, setTicketAttachmentLoadingId,
  };
}
