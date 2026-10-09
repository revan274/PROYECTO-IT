import { describe, expect, test } from 'vitest';
import type { TicketItem } from '../types/app';
import { evaluateTicketHistoricalSla, formatTicketSlaResult, summarizeHistoricalSla } from './sla';

function ticket(overrides: Partial<TicketItem>): TicketItem {
  return {
    id: 1,
    activoTag: 'PC-1',
    descripcion: 'Prueba',
    prioridad: 'MEDIA',
    estado: 'Resuelto',
    fecha: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('SLA histórico', () => {
  test('un resuelto tarde es incumplido aunque ya esté cerrado', () => {
    const late = ticket({
      estado: 'Cerrado',
      fechaLimite: '2026-01-01T10:00:00.000Z',
      fechaResolucion: '2026-01-01T12:00:00.000Z',
      fechaCierre: '2026-01-01T13:00:00.000Z',
    });
    expect(evaluateTicketHistoricalSla(late)).toBe('INCUMPLIDO');
    expect(formatTicketSlaResult(late, Date.parse('2026-01-02T00:00:00.000Z'))).toBe('INCUMPLIDO');
  });

  test('solo resoluciones con límite y fecha válidos entran al denominador', () => {
    const onTime = ticket({
      fechaLimite: '2026-01-01T12:00:00.000Z',
      fechaResolucion: '2026-01-01T11:00:00.000Z',
    });
    const late = ticket({
      id: 2,
      fechaLimite: '2026-01-01T12:00:00.000Z',
      fechaResolucion: '2026-01-01T13:00:00.000Z',
    });
    const unknown = ticket({ id: 3, fechaResolucion: null, fechaLimite: null });
    const open = ticket({ id: 4, estado: 'Abierto', fechaLimite: '2026-01-01T09:00:00.000Z' });
    expect(summarizeHistoricalSla([onTime, late, unknown, open])).toEqual({
      compliant: 1,
      nonCompliant: 1,
      unavailable: 2,
      total: 2,
      percentage: 50,
    });
    expect(formatTicketSlaResult(unknown, Date.now())).toBe('N/D');
  });

  test('sin casos evaluables el porcentaje es N/D', () => {
    expect(summarizeHistoricalSla([ticket({ estado: 'Abierto' })]).percentage).toBeNull();
  });

  test('el resultado congelado del ciclo prevalece sobre cambios posteriores en fechas visibles', () => {
    const frozen = ticket({
      fechaLimite: '2030-01-01T10:00:00.000Z',
      fechaResolucion: '2030-01-01T09:00:00.000Z',
      cicloActualId: '1:1',
      slaResultado: {
        estado: 'INCUMPLIDO',
        evaluadoEn: '2026-01-01T12:00:00.000Z',
        fechaResolucion: '2026-01-01T12:00:00.000Z',
        fechaLimite: '2026-01-01T10:00:00.000Z',
        versionPolitica: 'sla-vigente-al-resolver',
      },
    });
    expect(evaluateTicketHistoricalSla(frozen)).toBe('INCUMPLIDO');
  });
});
