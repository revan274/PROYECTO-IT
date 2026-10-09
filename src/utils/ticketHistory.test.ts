import { describe, expect, test } from 'vitest';

import type { TicketHistoryEntry } from '../types/app';
import { formatHistoryValue, historyChangeValues, sortTicketHistory } from './ticketHistory';

function event(overrides: Partial<TicketHistoryEntry>): TicketHistoryEntry {
  return { fecha: null, usuario: 'Sistema', accion: 'Evento', estado: 'Abierto', ...overrides };
}

describe('timeline de ticket', () => {
  test('ordena todos los eventos por fecha ISO sin perder los legacy', () => {
    const legacy = event({ fechaLegacy: '21/9/2026 10:00' });
    const sorted = sortTicketHistory([
      event({ fecha: '2026-09-21T10:00:00.000Z', accion: 'Primero' }),
      legacy,
      event({ fecha: '2026-09-21T12:00:00.000Z', accion: 'Último' }),
    ]);

    expect(sorted.map((entry) => entry.accion)).toEqual(['Último', 'Primero', 'Evento']);
    expect(sorted).toContain(legacy);
  });

  test('presenta before/after estructurados y recupera cambios legacy', () => {
    expect(formatHistoryValue({ estado: 'Abierto', trasladoRequerido: true })).toBe('Estado: Abierto · Traslado: Sí');
    expect(historyChangeValues(event({ prioridadAnterior: 'MEDIA', prioridadNueva: 'ALTA' }))).toEqual({
      before: { prioridad: 'MEDIA', fechaLimite: undefined },
      after: { prioridad: 'ALTA', fechaLimite: undefined },
    });
  });
});
