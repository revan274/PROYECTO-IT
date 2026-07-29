import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { TicketItem } from '../types/app';
import {
  deriveReportTicketData,
  useReportTicketData,
} from './useReportTicketData';

function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

const TICKETS: TicketItem[] = [
  {
    id: 1,
    activoTag: 'PC-001',
    descripcion: 'Área afectada: Caja | Sin red',
    sucursal: 'TJ01',
    prioridad: 'MEDIA',
    estado: 'Abierto',
    atencionTipo: 'REMOTO',
    asignadoA: 'Ana Técnica',
    fecha: localIso(2026, 0, 10),
    fechaCreacion: localIso(2026, 0, 10),
  },
  {
    id: 2,
    activoTag: 'PC-002',
    descripcion: 'Área afectada: Recursos Humanos | Impresora',
    sucursal: 'ENS01',
    prioridad: 'ALTA',
    estado: 'En Proceso',
    atencionTipo: 'PRESENCIAL',
    asignadoA: '',
    fecha: localIso(2026, 0, 11),
    fechaCreacion: localIso(2026, 0, 11),
  },
  {
    id: 3,
    activoTag: 'PC-003',
    descripcion: 'Área afectada: Caja | Caso anterior',
    sucursal: 'TJ01',
    prioridad: 'MEDIA',
    estado: 'Abierto',
    atencionTipo: 'REMOTO',
    asignadoA: 'Ana Técnica',
    fecha: localIso(2026, 0, 9),
    fechaCreacion: localIso(2026, 0, 9),
  },
  {
    id: 4,
    activoTag: 'PC-004',
    descripcion: 'Área afectada: Caja | Fuera del periodo',
    sucursal: 'TJ01',
    prioridad: 'MEDIA',
    estado: 'Cerrado',
    atencionTipo: 'REMOTO',
    asignadoA: 'Bruno Técnico',
    fecha: localIso(2026, 0, 12),
    fechaCreacion: localIso(2026, 0, 12),
  },
];

const BASE_OPTIONS = {
  isReportsView: true,
  scopedTickets: TICKETS,
  reportDateFrom: '2026-01-10',
  reportDateTo: '2026-01-11',
  reportBranchFilter: 'TODAS',
  reportAreaFilter: 'TODAS',
  reportStateFilter: 'TODOS' as const,
  reportPriorityFilter: 'TODAS' as const,
  reportAttentionFilter: 'TODAS' as const,
  reportTechnicianFilter: 'TODOS',
};

describe('deriveReportTicketData', () => {
  test('construye opciones del periodo y separa el rango anterior', () => {
    const result = deriveReportTicketData(BASE_OPTIONS);

    expect(result.reportBranchOptions).toEqual(['ENS01', 'TJ01']);
    expect(result.reportAreaOptions).toEqual(['Caja', 'Recursos Humanos']);
    expect(result.reportTechnicianOptions).toEqual(['Ana Técnica']);
    expect(result.reportTickets.map((ticket) => ticket.id)).toEqual([2, 1]);
    expect(result.reportPreviousTickets.map((ticket) => ticket.id)).toEqual([3]);
    expect(result.reportComparisonWindow).not.toBeNull();
    expect(result.reportPreviousPeriodLabel).not.toBe('N/D');
  });

  test('aplica conjuntamente los filtros principales y de técnico', () => {
    const result = deriveReportTicketData({
      ...BASE_OPTIONS,
      reportBranchFilter: 'TJ01',
      reportAreaFilter: 'caja',
      reportStateFilter: 'Abierto',
      reportPriorityFilter: 'MEDIA',
      reportAttentionFilter: 'REMOTO',
      reportTechnicianFilter: 'Ana Técnica',
    });

    expect(result.matchesReportCoreFilters(TICKETS[0])).toBe(true);
    expect(result.matchesReportCoreFilters(TICKETS[1])).toBe(false);
    expect(result.reportTickets.map((ticket) => ticket.id)).toEqual([1]);
    expect(result.reportPreviousTickets.map((ticket) => ticket.id)).toEqual([3]);
  });

  test('admite el filtro sin asignar y desactiva datos fuera de la vista de reportes', () => {
    const unassigned = deriveReportTicketData({
      ...BASE_OPTIONS,
      reportTechnicianFilter: 'SIN_ASIGNAR',
    });
    const inactive = deriveReportTicketData({
      ...BASE_OPTIONS,
      isReportsView: false,
    });

    expect(unassigned.reportTickets.map((ticket) => ticket.id)).toEqual([2]);
    expect(inactive.reportBranchOptions).toEqual([]);
    expect(inactive.reportAreaOptions).toEqual([]);
    expect(inactive.reportScopedTicketsByFilters).toEqual([]);
    expect(inactive.reportTickets).toEqual([]);
    expect(inactive.reportPreviousTickets).toEqual([]);
  });

  test('trata fechas inválidas como un rango abierto sin comparación', () => {
    const result = deriveReportTicketData({
      ...BASE_OPTIONS,
      reportDateFrom: 'fecha-invalida',
      reportDateTo: '',
    });

    expect(result.reportStartMs).toBeNull();
    expect(result.reportEndMs).toBeNull();
    expect(result.reportComparisonWindow).toBeNull();
    expect(result.reportPreviousPeriodLabel).toBe('N/D');
    expect(result.reportTickets.map((ticket) => ticket.id)).toEqual([4, 2, 1, 3]);
  });

  test('recalcula el hook al cambiar el filtro de técnico', () => {
    const { result, rerender } = renderHook(
      ({ technician }) => useReportTicketData({
        ...BASE_OPTIONS,
        reportTechnicianFilter: technician,
      }),
      {
        initialProps: {
          technician: 'TODOS',
        },
      },
    );

    expect(result.current.reportTickets.map((ticket) => ticket.id)).toEqual([2, 1]);

    rerender({ technician: 'SIN_ASIGNAR' });

    expect(result.current.reportTickets.map((ticket) => ticket.id)).toEqual([2]);
  });
});
