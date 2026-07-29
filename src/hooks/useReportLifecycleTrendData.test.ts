import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { TicketItem } from '../types/app';
import {
  deriveReportLifecycleTrendData,
  useReportLifecycleTrendData,
} from './useReportLifecycleTrendData';

function localTimestamp(
  year: number,
  monthIndex: number,
  day: number,
  hour = 12,
): number {
  return new Date(year, monthIndex, day, hour).getTime();
}

function ticket(
  id: number,
  createdAt: number,
  closedAt?: number,
): TicketItem {
  return {
    id,
    activoTag: `PC-${id}`,
    descripcion: `Ticket ${id}`,
    prioridad: 'MEDIA',
    estado: closedAt ? 'Cerrado' : 'Abierto',
    fecha: new Date(createdAt).toISOString(),
    fechaCreacion: new Date(createdAt).toISOString(),
    fechaCierre: closedAt ? new Date(closedAt).toISOString() : undefined,
  };
}

const DAILY_TICKETS: TicketItem[] = [
  ticket(1, localTimestamp(2026, 0, 1), localTimestamp(2026, 0, 2)),
  ticket(2, localTimestamp(2025, 11, 31), localTimestamp(2026, 0, 3)),
  ticket(3, localTimestamp(2026, 0, 2)),
  ticket(4, localTimestamp(2026, 0, 4), localTimestamp(2026, 0, 4)),
];

const DAILY_OPTIONS = {
  isReportsView: true,
  reportStartMs: new Date(2026, 0, 1).getTime(),
  reportEndMs: new Date(2026, 0, 3, 23, 59, 59, 999).getTime(),
  reportScopedTicketsByFilters: DAILY_TICKETS,
};

describe('deriveReportLifecycleTrendData', () => {
  test('agrupa diariamente aperturas y cierres dentro del periodo', () => {
    const result = deriveReportLifecycleTrendData(DAILY_OPTIONS);

    expect(result.reportTrendMode).toBe('DIARIA');
    expect(result.reportLifecycleTrend).toHaveLength(3);
    expect(result.reportLifecycleTrend.map(({ created, closed }) => ({
      created,
      closed,
    }))).toEqual([
      { created: 1, closed: 0 },
      { created: 1, closed: 1 },
      { created: 0, closed: 1 },
    ]);
    expect(result.reportCreatedInPeriodCount).toBe(2);
    expect(result.reportClosedInPeriodCount).toBe(2);
    expect(result.reportLifecycleTrendMax).toBe(1);
  });

  test('cambia a agrupación semanal cuando el rango supera 45 días', () => {
    const startMs = new Date(2026, 0, 1).getTime();
    const endMs = new Date(2026, 1, 20, 23, 59, 59, 999).getTime();
    const result = deriveReportLifecycleTrendData({
      isReportsView: true,
      reportStartMs: startMs,
      reportEndMs: endMs,
      reportScopedTicketsByFilters: [
        ticket(10, localTimestamp(2026, 0, 2), localTimestamp(2026, 1, 10)),
        ticket(11, localTimestamp(2026, 1, 15)),
      ],
    });

    expect(result.reportTrendMode).toBe('SEMANAL');
    expect(result.reportLifecycleTrend.length).toBeGreaterThan(1);
    expect(result.reportCreatedInPeriodCount).toBe(2);
    expect(result.reportClosedInPeriodCount).toBe(1);
  });

  test('mantiene el límite inclusivo de 45 días en modo diario', () => {
    const result = deriveReportLifecycleTrendData({
      isReportsView: true,
      reportStartMs: new Date(2026, 0, 1).getTime(),
      reportEndMs: new Date(2026, 1, 14, 23, 59, 59, 999).getTime(),
      reportScopedTicketsByFilters: [],
    });

    expect(result.reportTrendMode).toBe('DIARIA');
    expect(result.reportLifecycleTrend).toHaveLength(45);
  });

  test('devuelve una serie vacía para vista inactiva o rango inválido', () => {
    const inactive = deriveReportLifecycleTrendData({
      ...DAILY_OPTIONS,
      isReportsView: false,
    });
    const invalid = deriveReportLifecycleTrendData({
      ...DAILY_OPTIONS,
      reportEndMs: DAILY_OPTIONS.reportStartMs - 1,
    });

    expect(inactive.reportLifecycleTrend).toEqual([]);
    expect(invalid.reportLifecycleTrend).toEqual([]);
    expect(invalid.reportTrendMode).toBe('DIARIA');
    expect(invalid.reportLifecycleTrendMax).toBe(1);
    expect(invalid.reportCreatedInPeriodCount).toBe(0);
    expect(invalid.reportClosedInPeriodCount).toBe(0);
  });

  test('recalcula el hook cuando cambia el final del periodo', () => {
    const { result, rerender } = renderHook(
      ({ reportEndMs }) => useReportLifecycleTrendData({
        ...DAILY_OPTIONS,
        reportEndMs,
      }),
      {
        initialProps: {
          reportEndMs: DAILY_OPTIONS.reportEndMs,
        },
      },
    );

    expect(result.current.reportLifecycleTrend).toHaveLength(3);

    rerender({
      reportEndMs: new Date(2026, 0, 2, 23, 59, 59, 999).getTime(),
    });

    expect(result.current.reportLifecycleTrend).toHaveLength(2);
  });
});
