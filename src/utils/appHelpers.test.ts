import { describe, expect, test } from 'vitest';

import type { TravelDestinationRule, TravelReportRow, UserItem } from '../types/app';
import {
  buildTravelReportRowsFromActualTrips,
  resolveTravelTechnicianScope,
} from './appHelpers';

function createRow(overrides: Partial<TravelReportRow>): TravelReportRow {
  return {
    ticketId: 1,
    createdAt: new Date(2026, 3, 6, 9, 0, 0, 0).getTime(),
    nombre: 'Tecnico Integracion',
    destinationCode: 'TJ01',
    destinationLabel: 'Sucursal Norte',
    routeIndex: 1,
    kms: 42,
    fecha: '06/04/2026',
    motivo: 'Revision general',
    ...overrides,
  };
}

describe('resolveTravelTechnicianScope', () => {
  test('usa un key estable por usuario cuando el tecnico existe', () => {
    const users: UserItem[] = [
      {
        id: 502,
        nombre: 'Tecnico Integracion',
        username: 'tecnico.integration',
        rol: 'tecnico',
        departamento: 'IT',
        activo: true,
      },
    ];

    expect(resolveTravelTechnicianScope('Tecnico Integracion', users)).toEqual({
      key: 'user:502',
      label: 'Tecnico Integracion',
    });
  });
});

describe('buildTravelReportRowsFromActualTrips', () => {
  const destinationRuleByCode = new Map<string, TravelDestinationRule>([
    ['TJ01', { code: 'TJ01', index: 1, label: 'Sucursal Norte', kms: 42 }],
    ['JIM01', { code: 'JIM01', index: 2, label: 'Jimenez', kms: 120 }],
  ]);

  test('fusiona tickets en menos viajes reales cuando el usuario lo indica', () => {
    const rows = [
      createRow({ ticketId: 11, motivo: 'Impresora fiscal' }),
      createRow({
        ticketId: 12,
        createdAt: new Date(2026, 3, 6, 12, 0, 0, 0).getTime(),
        motivo: 'Bascula sin conexion',
      }),
    ];

    const result = buildTravelReportRowsFromActualTrips(
      rows,
      new Map([['TJ01', 1]]),
      destinationRuleByCode,
      'Tecnico Integracion',
      { year: 2026, monthIndex: 3, startMs: new Date(2026, 3, 1).getTime(), endMs: new Date(2026, 4, 1).getTime() - 1 },
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      destinationCode: 'TJ01',
      fecha: '06/04/2026',
      motivo: 'Impresora fiscal / Bascula sin conexion',
    });
  });

  test('agrega viajes manuales extra cuando hubo mas traslados que tickets', () => {
    const rows = [
      createRow({
        ticketId: 21,
        destinationCode: 'JIM01',
        destinationLabel: 'Jimenez',
        routeIndex: 2,
        kms: 120,
        motivo: 'Servidor',
      }),
    ];

    const result = buildTravelReportRowsFromActualTrips(
      rows,
      new Map([['JIM01', 3]]),
      destinationRuleByCode,
      'Tecnico Integracion',
      { year: 2026, monthIndex: 3, startMs: new Date(2026, 3, 1).getTime(), endMs: new Date(2026, 4, 1).getTime() - 1 },
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      destinationCode: 'JIM01',
      motivo: 'Servidor',
    });
    expect(result[1]).toMatchObject({
      destinationCode: 'JIM01',
      fecha: 'MANUAL',
      motivo: 'Viaje adicional registrado manualmente',
    });
    expect(result[2]).toMatchObject({
      destinationCode: 'JIM01',
      fecha: 'MANUAL',
      motivo: 'Viaje adicional registrado manualmente',
    });
  });
});
