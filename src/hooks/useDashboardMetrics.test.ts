import { describe, expect, test } from 'vitest';
import type { TicketItem } from '../types/app';
import { deriveDashboardMetrics } from './useDashboardMetrics';

const NOW = Date.parse('2026-10-08T18:00:00.000Z');
const isoDaysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function ticket(id: number, overrides: Partial<TicketItem>): TicketItem {
  return {
    id,
    activoTag: `PC-${id}`,
    descripcion: `Ticket ${id}`,
    prioridad: 'MEDIA',
    estado: 'Abierto',
    fecha: isoDaysAgo(1),
    fechaCreacion: isoDaysAgo(1),
    ...overrides,
  };
}

describe('deriveDashboardMetrics', () => {
  test('el backlog incluye pendientes antiguos y el período usa la fecha de cada hito', () => {
    const oldOpen = ticket(1, {
      prioridad: 'CRITICA',
      asignadoA: 'Técnico Uno',
      fecha: isoDaysAgo(180),
      fechaCreacion: isoDaysAgo(180),
      fechaLimite: isoDaysAgo(170),
    });
    const newOpen = ticket(2, { asignadoA: '', fechaLimite: isoDaysAgo(-1) });
    const oldCreatedResolvedNow = ticket(3, {
      estado: 'Resuelto',
      fecha: isoDaysAgo(120),
      fechaCreacion: isoDaysAgo(120),
      fechaLimite: isoDaysAgo(2),
      fechaResolucion: isoDaysAgo(1),
      slaResultado: {
        estado: 'INCUMPLIDO', evaluadoEn: isoDaysAgo(1), fechaResolucion: isoDaysAgo(1),
        fechaLimite: isoDaysAgo(2), versionPolitica: 'prueba',
      },
    });
    const closedNow = ticket(4, {
      estado: 'Cerrado',
      fechaCreacion: isoDaysAgo(10),
      fechaLimite: isoDaysAgo(3),
      fechaResolucion: isoDaysAgo(2),
      fechaCierre: isoDaysAgo(1),
      slaResultado: {
        estado: 'CUMPLIDO', evaluadoEn: isoDaysAgo(2), fechaResolucion: isoDaysAgo(2),
        fechaLimite: isoDaysAgo(3), versionPolitica: 'prueba',
      },
    });

    const result = deriveDashboardMetrics({
      scopedTickets: [oldOpen, newOpen, oldCreatedResolvedNow, closedNow],
      dashboardRange: '30D',
      liveNow: NOW,
      isDashboardView: true,
      formatTicketBranch: (value) => String(value || 'N/D'),
    });

    expect(result.dashboardBacklogTickets.map((item) => item.id)).toEqual([1, 2]);
    expect(result.dashboardBacklogCriticalTickets.map((item) => item.id)).toEqual([1]);
    expect(result.dashboardBacklogSlaExpiredCount).toBe(1);
    expect(result.dashboardUnassignedCount).toBe(1);
    expect(result.dashboardTopOwners).toEqual([['Técnico Uno', 1]]);
    expect(result.dashboardCreatedCount).toBe(2);
    expect(result.dashboardResolvedCount).toBe(2);
    expect(result.dashboardClosedCount).toBe(1);
    expect(result.dashboardSlaCompliancePct).toBe(50);
  });

  test('fuera de la vista dashboard evita calcular colecciones costosas', () => {
    const result = deriveDashboardMetrics({
      scopedTickets: [ticket(1, {})], dashboardRange: '30D', liveNow: NOW,
      isDashboardView: false, formatTicketBranch: String,
    });
    expect(result.dashboardBacklogTickets).toEqual([]);
    expect(result.dashboardCreatedCount).toBe(0);
  });
});
