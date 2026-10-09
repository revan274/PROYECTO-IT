import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { TicketItem } from '../types/app';
import {
  deriveReportKpiData,
  useReportKpiData,
} from './useReportKpiData';

const NOW = new Date(2026, 0, 20, 12).getTime();

function isoAt(hoursFromNow: number): string {
  return new Date(NOW + (hoursFromNow * 60 * 60 * 1000)).toISOString();
}

function ticket(overrides: Partial<TicketItem> & Pick<TicketItem, 'id'>): TicketItem {
  return {
    activoTag: `PC-${overrides.id}`,
    descripcion: `Ticket ${overrides.id}`,
    prioridad: 'MEDIA',
    estado: 'Abierto',
    fecha: isoAt(-24),
    fechaCreacion: isoAt(-24),
    ...overrides,
  };
}

const CURRENT_TICKETS: TicketItem[] = [
  ticket({
    id: 1,
    prioridad: 'CRITICA',
    fechaLimite: isoAt(-1),
  }),
  ticket({
    id: 2,
    estado: 'Cerrado',
    fechaCreacion: isoAt(-10),
    fechaLimite: isoAt(-9),
    fechaResolucion: isoAt(-8),
    fechaCierre: isoAt(-8),
  }),
  ticket({
    id: 3,
    estado: 'Resuelto',
    fechaCreacion: isoAt(-20),
    fechaLimite: isoAt(-15),
    fechaResolucion: isoAt(-16),
    fechaCierre: isoAt(-16),
  }),
];

const PREVIOUS_TICKETS: TicketItem[] = [
  ticket({
    id: 10,
    fechaLimite: isoAt(2),
  }),
  ticket({
    id: 11,
    estado: 'Cerrado',
    fechaCreacion: isoAt(-30),
    fechaLimite: isoAt(-23),
    fechaResolucion: isoAt(-24),
    fechaCierre: isoAt(-24),
  }),
];

const BASE_OPTIONS = {
  reportTickets: CURRENT_TICKETS,
  reportPreviousTickets: PREVIOUS_TICKETS,
  hasComparisonWindow: true,
  liveNow: NOW,
};

describe('deriveReportKpiData', () => {
  test('calcula conteos, cumplimiento SLA y tiempos de resolución', () => {
    const result = deriveReportKpiData(BASE_OPTIONS);

    expect(result).toMatchObject({
      reportOpenCount: 1,
      reportClosedCount: 2,
      reportCriticalCount: 1,
      reportSlaExpiredCount: 1,
      reportSlaTotalCount: 2,
      reportSlaCompliantCount: 1,
      reportSlaCompliancePct: 50,
      reportPreviousOpenCount: 1,
      reportPreviousSlaCompliancePct: 100,
      reportAvgResolutionHours: 3,
      reportMedianResolutionHours: 3,
      reportP90ResolutionHours: 3.8,
      reportPreviousAvgResolutionHours: 6,
      reportPreviousMedianResolutionHours: 6,
      reportPreviousP90ResolutionHours: 6,
    });
  });

  test('aplica el sentido correcto a cada tendencia comparativa', () => {
    const result = deriveReportKpiData(BASE_OPTIONS);

    expect(result.reportTicketsTrend).toMatchObject({
      toneClass: 'text-red-500',
    });
    expect(result.reportOpenTrend).toMatchObject({
      toneClass: 'text-slate-400',
    });
    expect(result.reportSlaComplianceTrend).toMatchObject({
      toneClass: 'text-red-500',
    });
    expect(result.reportSlaComplianceTrend.label).toContain('-50 pts');
    expect(result.reportMttrMedianTrend).toMatchObject({
      toneClass: 'text-green-500',
    });
    expect(result.reportP90ResolutionTrend).toMatchObject({
      toneClass: 'text-green-500',
    });
  });

  test('oculta tendencias cuando no existe una ventana comparable', () => {
    const result = deriveReportKpiData({
      ...BASE_OPTIONS,
      hasComparisonWindow: false,
    });

    [
      result.reportTicketsTrend,
      result.reportOpenTrend,
      result.reportSlaComplianceTrend,
      result.reportMttrMedianTrend,
      result.reportP90ResolutionTrend,
      result.reportFirstResponseMedianTrend,
    ].forEach((trend) => {
      expect(trend).toEqual({
        label: 'Comparativo no disponible',
        toneClass: 'text-slate-400',
      });
    });
  });

  test('usa valores seguros cuando no hay tickets o cierres válidos', () => {
    const empty = deriveReportKpiData({
      reportTickets: [],
      reportPreviousTickets: [],
      hasComparisonWindow: true,
      liveNow: NOW,
    });
    const invalidClosure = deriveReportKpiData({
      reportTickets: [
        ticket({
          id: 20,
          estado: 'Cerrado',
          fechaCreacion: isoAt(-2),
          fechaCierre: isoAt(-3),
        }),
      ],
      reportPreviousTickets: [],
      hasComparisonWindow: true,
      liveNow: NOW,
    });

    expect(empty.reportSlaCompliancePct).toBeNull();
    expect(empty.reportAvgResolutionHours).toBeNull();
    expect(empty.reportMedianResolutionHours).toBeNull();
    expect(empty.reportP90ResolutionHours).toBeNull();
    expect(empty.reportAvgFirstResponseHours).toBeNull();
    expect(empty.reportMedianFirstResponseHours).toBeNull();
    expect(empty.reportP90FirstResponseHours).toBeNull();
    expect(invalidClosure.reportAvgResolutionHours).toBeNull();
  });

  test('calcula primera respuesta desde creación sin confundir resolución o cierre', () => {
    const reportTickets = [
      ticket({ id: 40, fechaCreacion: isoAt(-12), fechaPrimeraAtencion: isoAt(-11), fechaResolucion: isoAt(-1) }),
      ticket({ id: 41, fechaCreacion: isoAt(-12), fechaPrimeraAtencion: isoAt(-9), fechaCierre: isoAt(-2) }),
      ticket({ id: 42, fechaCreacion: isoAt(-12), fechaPrimeraAtencion: isoAt(-2) }),
      ticket({ id: 43, fechaCreacion: isoAt(-2), fechaPrimeraAtencion: isoAt(-3) }),
      ticket({ id: 44, fechaCreacion: isoAt(-2), fechaPrimeraAtencion: null }),
    ];
    const previous = [ticket({ id: 45, fechaCreacion: isoAt(-12), fechaPrimeraAtencion: isoAt(-6) })];
    const result = deriveReportKpiData({ reportTickets, reportPreviousTickets: previous, hasComparisonWindow: true, liveNow: NOW });

    expect(result.reportAvgFirstResponseHours).toBe(4.7);
    expect(result.reportMedianFirstResponseHours).toBe(3);
    expect(result.reportP90FirstResponseHours).toBe(8.6);
    expect(result.reportPreviousMedianFirstResponseHours).toBe(6);
    expect(result.reportFirstResponseMedianTrend.toneClass).toBe('text-green-500');
  });

  test('calcula MTTR por cada ciclo resuelto y nunca usa el cierre como sustituto', () => {
    const reportTickets = [
      ticket({
        id: 50,
        ciclos: [
          {
            id: '50:1',
            numero: 1,
            fechaInicio: isoAt(-20),
            fechaPrimeraAtencion: null,
            fechaResolucion: isoAt(-16),
            estado: 'Resuelto',
            prioridad: 'MEDIA',
          },
          {
            id: '50:2',
            numero: 2,
            fechaInicio: isoAt(-10),
            fechaPrimeraAtencion: null,
            fechaResolucion: isoAt(-8),
            estado: 'Resuelto',
            prioridad: 'MEDIA',
          },
        ],
      }),
      ticket({
        id: 51,
        estado: 'Cerrado',
        fechaCreacion: isoAt(-10),
        fechaResolucion: isoAt(-7),
        fechaCierre: isoAt(-1),
      }),
      ticket({
        id: 52,
        estado: 'Cerrado',
        fechaCreacion: isoAt(-12),
        fechaCierre: isoAt(-2),
      }),
    ];
    const result = deriveReportKpiData({
      reportTickets,
      reportPreviousTickets: [],
      hasComparisonWindow: false,
      liveNow: NOW,
    });

    expect(result.reportAvgResolutionHours).toBe(3);
    expect(result.reportMedianResolutionHours).toBe(3);
    expect(result.reportP90ResolutionHours).toBe(3.8);
  });

  test('recalcula el hook cuando avanza el reloj del SLA', () => {
    const dueSoon = ticket({
      id: 30,
      fechaLimite: isoAt(1),
    });
    const { result, rerender } = renderHook(
      ({ liveNow }) => useReportKpiData({
        reportTickets: [dueSoon],
        reportPreviousTickets: [],
        hasComparisonWindow: true,
        liveNow,
      }),
      {
        initialProps: {
          liveNow: NOW,
        },
      },
    );

    expect(result.current.reportSlaExpiredCount).toBe(0);

    rerender({ liveNow: NOW + (2 * 60 * 60 * 1000) });

    expect(result.current.reportSlaExpiredCount).toBe(1);
  });
});

 test('cancelados no se cuentan como resueltos ni como SLA cumplido', () => {
   const result = deriveReportKpiData({ ...BASE_OPTIONS, reportTickets: [ticket({ id: 100, estado: 'Cancelado', fechaLimite: isoAt(-1) })] });
   expect(result.reportOpenCount).toBe(0);
   expect(result.reportClosedCount).toBe(0);
   expect(result.reportSlaTotalCount).toBe(0);
   expect(result.reportSlaCompliantCount).toBe(0);
 });
