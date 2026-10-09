import { describe, expect, it } from 'vitest';
import type { Activo, TicketItem } from '../types/app';
import { buildAssetTicketHistory } from './assetTickets';

const asset = {
  id: 7,
  tag: 'POS-007',
  tipo: 'POS',
  marca: 'Marca',
  ubicacion: 'TJ01',
  estado: 'Operativo',
  serial: 'SER-7',
  fechaCompra: '2025-01-01',
} satisfies Activo;

function ticket(id: number, overrides: Partial<TicketItem> = {}): TicketItem {
  return {
    id,
    activoId: 7,
    activoTag: 'POS-007',
    descripcion: `Ticket ${id}`,
    prioridad: 'MEDIA',
    estado: 'Abierto',
    fecha: '2026-09-01T12:00:00.000Z',
    fechaCreacion: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildAssetTicketHistory', () => {
  it('usa el ID estable, admite legado inequívoco y no enlaza un ID ajeno por tag', () => {
    const result = buildAssetTicketHistory(asset, [
      ticket(1),
      ticket(2, { activoId: null, activoTag: 'pos-007' }),
      ticket(3, { activoId: 99, activoTag: 'POS-007' }),
      ticket(4, { activoId: null, activoTag: 'POS-007', activoReferenciaPendiente: true }),
    ], Date.parse('2026-10-01T00:00:00.000Z'));

    expect(result.tickets.map((item) => item.id)).toEqual([2, 1]);
  });

  it('ordena por fecha y cuenta solo incidencias de los últimos 90 días', () => {
    const now = Date.parse('2026-10-01T00:00:00.000Z');
    const result = buildAssetTicketHistory(asset, [
      ticket(1, { fechaCreacion: '2026-09-30T00:00:00.000Z' }),
      ticket(2, { fechaCreacion: '2026-09-29T00:00:00.000Z', tipoSolicitud: 'SOLICITUD_SERVICIO' }),
      ticket(3, { fechaCreacion: '2026-06-01T00:00:00.000Z' }),
    ], now);

    expect(result.tickets.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(result.incidentsLast90Days).toBe(1);
  });
});
