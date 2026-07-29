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
    fechaCierre: isoAt(-8),
  }),
  ticket({
    id: 3,
    estado: 'Resuelto',
    fechaCreacion: isoAt(-20),
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
      reportSlaTotalCount: 3,
      reportSlaCompliantCount: 2,
      reportSlaCompliancePct: 67,
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
    expect(result.reportSlaComplianceTrend.label).toContain('-33 pts');
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

    expect(empty.reportSlaCompliancePct).toBe(100);
    expect(empty.reportAvgResolutionHours).toBeNull();
    expect(empty.reportMedianResolutionHours).toBeNull();
    expect(empty.reportP90ResolutionHours).toBeNull();
    expect(invalidClosure.reportAvgResolutionHours).toBeNull();
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
