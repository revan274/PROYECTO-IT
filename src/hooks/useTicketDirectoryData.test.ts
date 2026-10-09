import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { Activo, TicketItem, UserItem, UserSession } from '../types/app';
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

const USERS: UserItem[] = [
  { ...REQUESTER, activo: true },
  { id: 20, nombre: 'Otra Solicitante', username: 'otra', rol: 'solicitante', activo: true },
  { id: 201, nombre: 'Técnico Uno', username: 'tecnico.uno', rol: 'tecnico', activo: true },
  { id: 202, nombre: 'Técnico Dos', username: 'tecnico.dos', rol: 'tecnico', activo: true },
];

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
    areaId: 'AREA_CAJAS',
    areaNombre: 'Línea de cajas',
    categoriaId: 'CAT_CONECTIVIDAD',
    categoriaNombre: 'Conectividad e impresión',
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
    asignadoAId: 201,
    activoId: 102,
    fecha: '2026-01-10T10:00:00.000Z',
    fechaLimite: '2026-01-10T14:00:00.000Z',
    solicitadoPorId: 10,
    areaId: 'AREA_TIENDA',
    areaNombre: 'Tienda',
    categoriaId: 'CAT_OPERACION_TIENDA',
    categoriaNombre: 'Operación de tienda',
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

const ASSETS: Activo[] = [
  {
    id: 101,
    tag: 'PC-001',
    tipo: 'Terminal de venta',
    marca: 'IBM',
    modelo: 'SurePOS',
    ubicacion: 'Caja principal',
    estado: 'Operativo',
    serial: 'SERIE-ÁGUILA-01',
    fechaCompra: '2025-01-01',
  },
  {
    id: 102,
    tag: 'PC-002',
    tipo: 'Laptop',
    marca: 'Lenovo',
    ubicacion: 'Piso de venta',
    estado: 'Operativo',
    serial: 'LEN-002',
    fechaCompra: '2025-02-01',
  },
];

const BASE_OPTIONS = {
  tickets: TICKETS,
  activos: ASSETS,
  users: USERS,
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
  technicianFilter: 'TODOS',
  branchFilter: 'TODAS',
  areaFilter: 'TODAS',
  categoryFilter: 'TODAS',
  requesterFilter: 'TODOS',
  assetFilter: 'TODOS',
  dateFrom: '',
  dateTo: '',
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

  test('comparte búsqueda AND parcial y sin acentos por folio, solicitante, activo y categoría', () => {
    const result = deriveTicketDirectoryData({
      ...BASE_OPTIONS,
      isRequesterOnlyUser: false,
      searchTokens: ['#1', 'solici', 'aguila', 'impres', 'norte'],
    });

    expect(result.filteredTickets.map((ticket) => ticket.id)).toEqual([1]);
  });

  test('combina técnico, sucursal, área, categoría, solicitante, activo, fecha y SLA', () => {
    const result = deriveTicketDirectoryData({
      ...BASE_OPTIONS,
      isRequesterOnlyUser: false,
      stateFilter: 'En Proceso',
      priorityFilter: 'MEDIA',
      technicianFilter: '201',
      branchFilter: 'ENS01',
      areaFilter: 'AREA_TIENDA',
      categoryFilter: 'CAT_OPERACION_TIENDA',
      requesterFilter: '10',
      assetFilter: '102',
      dateFrom: '2026-01-10',
      dateTo: '2026-01-10',
      slaFilter: 'EN_TIEMPO',
    });

    expect(result.filteredTickets.map((ticket) => ticket.id)).toEqual([2]);
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
