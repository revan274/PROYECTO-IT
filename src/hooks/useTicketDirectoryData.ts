import { useMemo } from 'react';

import type {
  Activo,
  PrioridadTicket,
  TicketEstado,
  TicketItem,
  UserItem,
  UserSession,
} from '../types/app';
import { normalizeForCompare, parseDateToTimestamp } from '../utils/format';
import { ticketMatchesSearch } from '../../shared/ticket-search.js';
import { formatTicketSlaResult } from '../utils/sla';
import {
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
export type TicketSlaFilter = 'TODOS' | 'VENCIDO' | 'EN_TIEMPO' | 'CUMPLIDO' | 'INCUMPLIDO' | 'NO_EVALUABLE';

interface TicketDirectoryDataOptions {
  tickets: TicketItem[];
  activos: Activo[];
  users: UserItem[];
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
  technicianFilter: string;
  branchFilter: string;
  areaFilter: string;
  categoryFilter: string;
  requesterFilter: string;
  assetFilter: string;
  dateFrom: string;
  dateTo: string;
  formatTicketBranch: (branchCode?: string) => string;
}

export function deriveTicketDirectoryData({
  tickets,
  activos,
  users,
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
  technicianFilter,
  branchFilter,
  areaFilter,
  categoryFilter,
  requesterFilter,
  assetFilter,
  dateFrom,
  dateTo,
  formatTicketBranch,
}: TicketDirectoryDataOptions) {
  const canAccessTicketBySession = (ticket: TicketItem): boolean =>
    ticketBelongsToSessionUser(ticket, sessionUser);

  const canDeleteTicket = (ticket: TicketItem): boolean => {
    if (ticket.archivo) return false;
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
  const assetsById = new Map(activos.map((asset) => [asset.id, asset]));
  const assetsByTag = new Map(activos.map((asset) => [normalizeForCompare(asset.tag), asset]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const fromTimestamp = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toTimestamp = dateTo ? (() => {
    const end = new Date(`${dateTo}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return end.getTime();
  })() : null;
  const isTicketOpen = (ticket: TicketItem): boolean => !isTicketClosed(ticket);
  const openTickets = scopedTickets.filter(isTicketOpen);

  const filteredTickets = scopedTickets.filter((ticket) => {
    if (lifecycleFilter === 'ABIERTOS' && !isTicketOpen(ticket)) return false;
    if (lifecycleFilter === 'CERRADOS' && isTicketOpen(ticket)) return false;
    if (stateFilter !== 'TODOS' && ticket.estado !== stateFilter) return false;
    if (priorityFilter !== 'TODAS' && ticket.prioridad !== priorityFilter) return false;
    if (assignmentFilter === 'ASIGNADOS' && !(ticket.asignadoA || '').trim()) return false;
    if (assignmentFilter === 'SIN_ASIGNAR' && (ticket.asignadoA || '').trim()) return false;
    if (technicianFilter === 'SIN_ASIGNAR' && (ticket.asignadoA || '').trim()) return false;
    if (technicianFilter !== 'TODOS' && technicianFilter !== 'SIN_ASIGNAR') {
      const technicianId = Number(technicianFilter);
      const technician = usersById.get(technicianId);
      const matchesId = Number(ticket.asignadoAId) === technicianId;
      const matchesLegacyName = !ticket.asignadoAId
        && technician
        && normalizeForCompare(ticket.asignadoA || '') === normalizeForCompare(technician.nombre);
      if (!matchesId && !matchesLegacyName) return false;
    }
    if (branchFilter !== 'TODAS' && normalizeForCompare(ticket.sucursal || '') !== normalizeForCompare(branchFilter)) return false;
    if (areaFilter !== 'TODAS' && ticket.areaId !== areaFilter) return false;
    if (categoryFilter !== 'TODAS' && ticket.categoriaId !== categoryFilter) return false;
    if (requesterFilter !== 'TODOS') {
      const requesterId = Number(requesterFilter);
      const requester = usersById.get(requesterId);
      const rawTicketRequesterId = ticket.requesterUserId ?? ticket.solicitadoPorId;
      const hasTicketRequesterId = rawTicketRequesterId !== null
        && rawTicketRequesterId !== undefined
        && Number.isFinite(Number(rawTicketRequesterId));
      const matchesId = hasTicketRequesterId && Number(rawTicketRequesterId) === requesterId;
      const matchesLegacyIdentity = !hasTicketRequesterId
        && requester
        && [ticket.solicitadoPor, ticket.solicitadoPorUsername]
          .some((value) => [requester.nombre, requester.username]
            .some((candidate) => normalizeForCompare(value || '') === normalizeForCompare(candidate || '')));
      if (!matchesId && !matchesLegacyIdentity) return false;
    }
    if (assetFilter === 'SIN_ACTIVO' && (ticket.activoId || ticket.activoTag)) return false;
    if (assetFilter !== 'TODOS' && assetFilter !== 'SIN_ACTIVO') {
      const assetId = Number(assetFilter);
      const asset = assetsById.get(assetId);
      const matchesId = Number(ticket.activoId) === assetId;
      const matchesLegacyTag = !ticket.activoId
        && asset
        && normalizeForCompare(ticket.activoTag) === normalizeForCompare(asset.tag);
      if (!matchesId && !matchesLegacyTag) return false;
    }
    if (fromTimestamp !== null || toTimestamp !== null) {
      const createdAt = parseDateToTimestamp(ticket.fechaCreacion || ticket.fecha);
      if (createdAt === null) return false;
      if (fromTimestamp !== null && createdAt < fromTimestamp) return false;
      if (toTimestamp !== null && createdAt >= toTimestamp) return false;
    }
    if (slaFilter !== 'TODOS') {
      const slaResult = formatTicketSlaResult(ticket, liveNow);
      if (slaFilter === 'NO_EVALUABLE') {
        if (slaResult !== 'N/D' && slaResult !== 'NO APLICA') return false;
      } else if (slaFilter === 'EN_TIEMPO') {
        if (slaResult !== 'EN TIEMPO') return false;
      } else if (slaResult !== slaFilter) return false;
    }

    if (searchTokens.length === 0) return true;
    const asset = (ticket.activoId ? assetsById.get(ticket.activoId) : undefined)
      || assetsByTag.get(normalizeForCompare(ticket.activoTag));
    return ticketMatchesSearch(ticket, searchTokens, {
      asset,
      branchLabel: formatTicketBranch(ticket.sucursal),
    });
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
    activos,
    users,
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
    technicianFilter,
    branchFilter,
    areaFilter,
    categoryFilter,
    requesterFilter,
    assetFilter,
    dateFrom,
    dateTo,
    formatTicketBranch,
  } = options;

  return useMemo(
    () => deriveTicketDirectoryData({
      tickets,
      activos,
      users,
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
      technicianFilter,
      branchFilter,
      areaFilter,
      categoryFilter,
      requesterFilter,
      assetFilter,
      dateFrom,
      dateTo,
      formatTicketBranch,
    }),
    [
      activos,
      assignmentFilter,
      assetFilter,
      areaFilter,
      branchFilter,
      canEdit,
      categoryFilter,
      dateFrom,
      dateTo,
      formatTicketBranch,
      isRequesterOnlyUser,
      lifecycleFilter,
      liveNow,
      priorityFilter,
      searchTokens,
      sessionUser,
      slaFilter,
      stateFilter,
      technicianFilter,
      tickets,
      requesterFilter,
      users,
    ],
  );
}
