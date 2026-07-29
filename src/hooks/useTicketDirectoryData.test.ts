import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { TicketItem, UserSession } from '../types/app';
import {
  deriveTicketDirectoryData,
  useTicketDirectoryData,
} from './useTicketDirectoryData';

const NOW = Date.parse('2026-01-10T12:00:00.000Z');

const REQUESTER: UserSession = {
  id: 10,
  nombre: 'Ana Solicitante',
  username: 'ana',
  rol: 'solicitante',
};

const TICKETS: TicketItem[] = [
  {
    id: 1,
    activoTag: 'PC-001',
    descripcion: 'Sin red en caja',
    sucursal: 'TJ01',
    prioridad: 'CRITICA',
    estado: 'Abierto',
    atencionTipo: 'REMOTO',
    asignadoA: '',
    fecha: '2026-01-10T11:00:00.000Z',
    fechaLimite: '2026-01-10T10:00:00.000Z',
    solicitadoPorId: 10,
    solicitadoPor: 'Ana Solicitante',
    solicitadoPorUsername: 'ana',
  },
  {
    id: 2,
    activoTag: 'PC-002',
    descripcion: 'Actualización pendiente',
    sucursal: 'ENS01',
    prioridad: 'MEDIA',
    estado: 'En Proceso',
    atencionTipo: 'PRESENCIAL',
    asignadoA: 'Técnico Uno',
    fecha: '2026-01-10T10:00:00.000Z',
    fechaLimite: '2026-01-10T14:00:00.000Z',
    solicitadoPorId: 10,
  },
  {
    id: 3,
    activoTag: 'PC-003',
    descripcion: 'Falla de impresora',
    sucursal: 'TJ01',
    prioridad: 'ALTA',
    estado: 'Abierto',
    asignadoA: '',
    fecha: '2026-01-10T11:30:00.000Z',
    fechaLimite: '2026-01-10T15:00:00.000Z',
    solicitadoPorId: 20,
  },
  {
    id: 4,
    activoTag: 'PC-004',
    descripcion: 'Caso finalizado',
    sucursal: 'TJ01',
    prioridad: 'ALTA',
    estado: 'Resuelto',
    asignadoA: 'Técnico Dos',
    fecha: '2026-01-09T09:00:00.000Z',
    fechaLimite: '2026-01-09T10:00:00.000Z',
    solicitadoPorId: 10,
  },
];

const BASE_OPTIONS = {
  tickets: TICKETS,
  sessionUser: REQUESTER,
  isRequesterOnlyUser: true,
  canEdit: false,
  liveNow: NOW,
  searchTokens: [],
  lifecycleFilter: 'TODOS' as const,
  stateFilter: 'TODOS' as const,
  priorityFilter: 'TODAS' as const,
  assignmentFilter: 'TODOS' as const,
  slaFilter: 'TODOS' as const,
  formatTicketBranch: (branchCode?: string) =>
    branchCode === 'TJ01' ? 'Sucursal Tijuana Norte' : String(branchCode || ''),
};

describe('deriveTicketDirectoryData', () => {
  test('limita al solicitante y calcula indicadores solo con sus tickets abiertos', () => {
    const result = deriveTicketDirectoryData(BASE_OPTIONS);

    expect(result.scopedTickets.map((ticket) => ticket.id)).toEqual([1, 2, 4]);
    expect(result.openTicketsCount).toBe(2);
    expect(result.slaExpiredCount).toBe(1);
    expect(result.criticalTicketsCount).toBe(1);
    expect(result.unassignedTicketsCount).toBe(1);
  });

  test('conserva la política de borrado para solicitantes y editores', () => {
    const requesterResult = deriveTicketDirectoryData(BASE_OPTIONS);
    const editorResult = deriveTicketDirectoryData({
      ...BASE_OPTIONS,
      canEdit: true,
    });

    expect(requesterResult.canDeleteTicket(TICKETS[0])).toBe(true);
    expect(requesterResult.canDeleteTicket(TICKETS[1])).toBe(false);
    expect(requesterResult.canDeleteTicket(TICKETS[2])).toBe(false);
    expect(editorResult.canDeleteTicket(TICKETS[2])).toBe(true);
  });

  test('combina filtros y búsqueda usando etiquetas de sucursal y atención', () => {
    const byBranchAndAttention = deriveTicketDirectoryData({
      ...BASE_OPTIONS,
      isRequesterOnlyUser: false,
      searchTokens: ['tijuana', 'remoto'],
      lifecycleFilter: 'ABIERTOS',
      priorityFilter: 'CRITICA',
      assignmentFilter: 'SIN_ASIGNAR',
      slaFilter: 'VENCIDO',
    });

    expect(byBranchAndAttention.filteredTickets.map((ticket) => ticket.id)).toEqual([1]);
  });

  test('ordena primero los vencidos y después por fecha descendente', () => {
    const result = deriveTicketDirectoryData({
      ...BASE_OPTIONS,
      isRequesterOnlyUser: false,
    });

    expect(result.filteredTickets.map((ticket) => ticket.id)).toEqual([1, 3, 2, 4]);
    expect(result.getSlaStatusForCurrentTime(TICKETS[0]).label).toBe('SLA VENCIDO');
  });

  test('recalcula el hook al cambiar el ciclo de vida', () => {
    const { result, rerender } = renderHook(
      ({ lifecycleFilter }) => useTicketDirectoryData({
        ...BASE_OPTIONS,
        lifecycleFilter,
      }),
      {
        initialProps: {
          lifecycleFilter: 'TODOS' as 'TODOS' | 'ABIERTOS' | 'CERRADOS',
        },
      },
    );

    expect(result.current.filteredTickets.map((ticket) => ticket.id)).toEqual([1, 2, 4]);

    rerender({ lifecycleFilter: 'CERRADOS' });

    expect(result.current.filteredTickets.map((ticket) => ticket.id)).toEqual([4]);
  });
});
