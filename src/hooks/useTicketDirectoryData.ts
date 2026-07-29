import { useMemo } from 'react';

import type {
  PrioridadTicket,
  TicketEstado,
  TicketItem,
  UserSession,
} from '../types/app';
import {
  includesAllSearchTokens,
  normalizeForCompare,
} from '../utils/format';
import {
  formatTicketAttentionType,
  getSlaStatus,
  isTicketClosed,
  isTicketSlaExpired,
} from '../utils/tickets';
import {
  ticketBelongsToSessionUser,
  ticketTimestamp,
} from '../utils/appHelpers';
import { isRequesterOnlyRole } from '../utils/roles';

export type TicketLifecycleFilter = 'TODOS' | 'ABIERTOS' | 'CERRADOS';
export type TicketAssignmentFilter = 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR';
export type TicketSlaFilter = 'TODOS' | 'VENCIDO';

interface TicketDirectoryDataOptions {
  tickets: TicketItem[];
  sessionUser: UserSession | null;
  isRequesterOnlyUser: boolean;
  canEdit: boolean;
  liveNow: number;
  searchTokens: string[];
  lifecycleFilter: TicketLifecycleFilter;
  stateFilter: TicketEstado | 'TODOS';
  priorityFilter: PrioridadTicket | 'TODAS';
  assignmentFilter: TicketAssignmentFilter;
  slaFilter: TicketSlaFilter;
  formatTicketBranch: (branchCode?: string) => string;
}

export function deriveTicketDirectoryData({
  tickets,
  sessionUser,
  isRequesterOnlyUser,
  canEdit,
  liveNow,
  searchTokens,
  lifecycleFilter,
  stateFilter,
  priorityFilter,
  assignmentFilter,
  slaFilter,
  formatTicketBranch,
}: TicketDirectoryDataOptions) {
  const canAccessTicketBySession = (ticket: TicketItem): boolean =>
    ticketBelongsToSessionUser(ticket, sessionUser);

  const canDeleteTicket = (ticket: TicketItem): boolean => {
    if (canEdit) return true;
    if (!isRequesterOnlyRole(sessionUser?.rol)) return false;
    if (!canAccessTicketBySession(ticket)) return false;
    return ticket.estado === 'Abierto';
  };

  const getSlaStatusForCurrentTime = (ticket: TicketItem) =>
    getSlaStatus(ticket, liveNow);

  const scopedTickets = isRequesterOnlyUser
    ? tickets.filter(canAccessTicketBySession)
    : tickets;
  const isTicketOpen = (ticket: TicketItem): boolean => !isTicketClosed(ticket);
  const openTickets = scopedTickets.filter(isTicketOpen);

  const filteredTickets = scopedTickets.filter((ticket) => {
    if (lifecycleFilter === 'ABIERTOS' && !isTicketOpen(ticket)) return false;
    if (lifecycleFilter === 'CERRADOS' && isTicketOpen(ticket)) return false;
    if (stateFilter !== 'TODOS' && ticket.estado !== stateFilter) return false;
    if (priorityFilter !== 'TODAS' && ticket.prioridad !== priorityFilter) return false;
    if (assignmentFilter === 'ASIGNADOS' && !(ticket.asignadoA || '').trim()) return false;
    if (assignmentFilter === 'SIN_ASIGNAR' && (ticket.asignadoA || '').trim()) return false;
    if (slaFilter === 'VENCIDO' && !isTicketSlaExpired(ticket, liveNow)) return false;

    if (searchTokens.length === 0) return true;
    const searchable = normalizeForCompare([
      ticket.activoTag,
      ticket.descripcion,
      ticket.asignadoA || '',
      formatTicketBranch(ticket.sucursal),
      formatTicketAttentionType(ticket.atencionTipo),
    ].join(' '));
    return includesAllSearchTokens(searchable, searchTokens);
  });

  filteredTickets.sort((left, right) => {
    const leftExpired = isTicketSlaExpired(left, liveNow) ? 1 : 0;
    const rightExpired = isTicketSlaExpired(right, liveNow) ? 1 : 0;
    if (leftExpired !== rightExpired) return rightExpired - leftExpired;
    return ticketTimestamp(right) - ticketTimestamp(left);
  });

  return {
    canDeleteTicket,
    getSlaStatusForCurrentTime,
    scopedTickets,
    openTicketsCount: openTickets.length,
    slaExpiredCount: openTickets.filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length,
    criticalTicketsCount: openTickets.filter((ticket) => ticket.prioridad === 'CRITICA').length,
    unassignedTicketsCount: openTickets.filter((ticket) => !(ticket.asignadoA || '').trim()).length,
    filteredTickets,
  };
}

export function useTicketDirectoryData(options: TicketDirectoryDataOptions) {
  const {
    tickets,
    sessionUser,
    isRequesterOnlyUser,
    canEdit,
    liveNow,
    searchTokens,
    lifecycleFilter,
    stateFilter,
    priorityFilter,
    assignmentFilter,
    slaFilter,
    formatTicketBranch,
  } = options;

  return useMemo(
    () => deriveTicketDirectoryData({
      tickets,
      sessionUser,
      isRequesterOnlyUser,
      canEdit,
      liveNow,
      searchTokens,
      lifecycleFilter,
      stateFilter,
      priorityFilter,
      assignmentFilter,
      slaFilter,
      formatTicketBranch,
    }),
    [
      assignmentFilter,
      canEdit,
      formatTicketBranch,
      isRequesterOnlyUser,
      lifecycleFilter,
      liveNow,
      priorityFilter,
      searchTokens,
      sessionUser,
      slaFilter,
      stateFilter,
      tickets,
    ],
  );
}
