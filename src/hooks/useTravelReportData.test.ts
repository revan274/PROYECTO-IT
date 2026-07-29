import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type {
  CatalogBranch,
  TicketItem,
  UserItem,
  UserSession,
} from '../types/app';
import {
  deriveTravelReportData,
  useTravelReportData,
} from './useTravelReportData';

const BRANCHES: CatalogBranch[] = [
  { code: 'TJ01', name: 'Sucursal Estrella', activo: true },
  { code: 'ENS01', name: 'Sucursal Ensenada', activo: true },
];

const USERS: UserItem[] = [
  {
    id: 7,
    nombre: 'Técnico Uno',
    username: 'tecnico.uno',
    rol: 'tecnico',
    activo: true,
  },
];

const SESSION_USER: UserSession = {
  id: 1,
  nombre: 'Administradora',
  username: 'admin',
  rol: 'admin',
};

const TICKETS: TicketItem[] = [
  {
    id: 1,
    activoTag: 'PC-001',
    descripcion: 'Área afectada: Caja | Sin red',
    sucursal: 'TJ01',
    prioridad: 'MEDIA',
    estado: 'Abierto',
    fecha: '2026-01-10T12:00:00.000Z',
    fechaCreacion: '2026-01-10T12:00:00.000Z',
    asignadoA: 'Técnico Uno',
    trasladoRequerido: true,
  },
  {
    id: 2,
    activoTag: 'PC-002',
    descripcion: 'Revisión en sucursal',
    sucursal: 'ENS01',
    prioridad: 'MEDIA',
    estado: 'En Proceso',
    fecha: '2026-01-11T12:00:00.000Z',
    fechaCreacion: '2026-01-11T12:00:00.000Z',
    asignadoA: '',
    trasladoRequerido: true,
  },
  {
    id: 3,
    activoTag: 'PC-003',
    descripcion: 'Visita fuera del periodo',
    sucursal: 'TJ01',
    prioridad: 'MEDIA',
    estado: 'Cerrado',
    fecha: '2026-02-01T12:00:00.000Z',
    fechaCreacion: '2026-02-01T12:00:00.000Z',
    asignadoA: 'Técnico Uno',
    trasladoRequerido: true,
  },
  {
    id: 4,
    activoTag: 'PC-004',
    descripcion: 'Excluido por filtro principal',
    sucursal: 'TJ01',
    prioridad: 'ALTA',
    estado: 'Abierto',
    fecha: '2026-01-12T12:00:00.000Z',
    fechaCreacion: '2026-01-12T12:00:00.000Z',
    asignadoA: 'Técnico Dos',
    trasladoRequerido: true,
  },
];

const BASE_OPTIONS = {
  isReportsView: true,
  scopedTickets: TICKETS,
  matchesReportCoreFilters: (ticket: TicketItem) => ticket.prioridad === 'MEDIA',
  activeTicketBranches: BRANCHES,
  activeTicketBranchCodes: new Set(BRANCHES.map((branch) => branch.code)),
  travelReportMonth: '2026-01',
  travelReportTechnician: 'TODOS',
  travelReportName: '',
  travelReportFuelEfficiency: '8',
  users: USERS,
  sessionUser: SESSION_USER,
};

describe('deriveTravelReportData', () => {
  test('genera reglas, filas y totales sin incluir otros meses o filtros', () => {
    const result = deriveTravelReportData(BASE_OPTIONS);

    expect(result.travelTechnicianOptions).toEqual(['Técnico Uno']);
    expect(result.travelDestinationRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TJ01', index: 1, kms: 4 }),
      expect.objectContaining({ code: 'ENS01', index: 6, label: 'ENSENADA', kms: 0 }),
    ]));
    expect(result.travelReportRows.map((row) => row.ticketId)).toEqual([1, 2]);
    expect(result.travelReportRows[0]).toMatchObject({
      nombre: 'Administradora',
      destinationCode: 'TJ01',
      motivo: 'Sin red',
    });
    expect(Array.from(result.travelSuggestedTripsByCode.entries())).toEqual([
      ['TJ01', 1],
      ['ENS01', 1],
    ]);
    expect(result.travelTotalTrips).toBe(2);
    expect(result.travelTotalKms).toBe(4);
    expect(result.travelFuelEfficiencyValue).toBe(8);
    expect(result.travelFuelLiters).toBe(0.5);
    expect(result.travelMonthLabel).not.toBe('N/D');
  });

  test('filtra por técnico y prioriza el nombre manual del reporte', () => {
    const result = deriveTravelReportData({
      ...BASE_OPTIONS,
      travelReportTechnician: 'Técnico Uno',
      travelReportName: 'Responsable Manual',
    });

    expect(result.travelReportRows.map((row) => row.ticketId)).toEqual([1]);
    expect(result.effectiveTravelReporterName).toBe('Responsable Manual');
  });

  test('maneja mes inválido, vista inactiva y rendimiento no válido de forma segura', () => {
    const invalidMonth = deriveTravelReportData({
      ...BASE_OPTIONS,
      travelReportMonth: '2026-13',
      travelReportFuelEfficiency: '-2',
    });
    const inactiveView = deriveTravelReportData({
      ...BASE_OPTIONS,
      isReportsView: false,
    });

    expect(invalidMonth.travelMonthRange).toBeNull();
    expect(invalidMonth.travelReportRows).toEqual([]);
    expect(invalidMonth.travelMonthLabel).toBe('N/D');
    expect(invalidMonth.travelFuelEfficiencyValue).toBe(10);
    expect(inactiveView.travelTechnicianOptions).toEqual([]);
    expect(inactiveView.travelTotalTrips).toBe(0);
    expect(inactiveView.travelFuelLiters).toBe(0);
  });

  test('recalcula el hook cuando cambia el alcance del técnico', () => {
    const { result, rerender } = renderHook(
      ({ technician }) => useTravelReportData({
        ...BASE_OPTIONS,
        travelReportTechnician: technician,
      }),
      {
        initialProps: {
          technician: 'TODOS',
        },
      },
    );

    expect(result.current.travelReportRows.map((row) => row.ticketId)).toEqual([1, 2]);

    rerender({ technician: 'SIN_ASIGNAR' });

    expect(result.current.travelReportRows.map((row) => row.ticketId)).toEqual([2]);
  });
});
