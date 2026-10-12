import { describe, expect, test } from 'vitest';

import { TRAVEL_REPORT_MIN_ROWS } from '../constants/app';
import type { TravelSheetData } from './travelSheetReport';
import { buildTravelSheetHtml } from './travelSheetReport';

function buildData(overrides: Partial<TravelSheetData> = {}): TravelSheetData {
  return {
    department: 'Sistemas',
    monthLabel: 'Octubre 2026',
    reporterName: 'Admin IT',
    authorizer: 'Mireya Sandoval',
    finance: 'Raquel Parra',
    fuelEfficiencyValue: 10,
    fuelLiters: 0.4,
    rows: [{
      ticketId: 101,
      createdAt: Date.parse('2026-10-01T10:00:00.000Z'),
      nombre: 'Admin IT',
      destinationCode: 'TJ02',
      destinationLabel: 'Tijuana 2',
      routeIndex: 2,
      kms: 4,
      fecha: '01/10/2026',
      motivo: 'Revisión de & equipo <crítico>',
    }],
    destinationRules: [{ code: 'TJ02', index: 2, label: 'Tijuana 2', kms: 4 }],
    suggestedTripsByCode: new Map([['TJ02', 1]]),
    totalTrips: 1,
    totalKms: 4,
    ...overrides,
  };
}

describe('formato mensual de movilidad', () => {
  test('usa una hoja horizontal compacta y conserva los bloques operativos', () => {
    const html = buildTravelSheetHtml(buildData());

    expect(html).toContain('@page { size: A4 landscape;');
    expect(html).toContain('Formato mensual de movilidad');
    expect(html).toContain('Resumen por ruta');
    expect(html).toContain('Validación');
    expect(html).toContain('Combustible estimado');
    expect(html).toContain('10 km/l');
    expect(html).not.toContain('font-size: 38px');
  });

  test('completa únicamente el mínimo de filas y escapa contenido de usuario', () => {
    const html = buildTravelSheetHtml(buildData());
    const blankRows = html.match(/<tr class="blank"/g) || [];

    expect(blankRows).toHaveLength(TRAVEL_REPORT_MIN_ROWS - 1);
    expect(html).toContain('Revisión de &amp; equipo &lt;crítico&gt;');
    expect(html).not.toContain('Revisión de & equipo <crítico>');
  });

  test('no agrega filas vacías cuando el detalle ya supera la capacidad base', () => {
    const row = buildData().rows[0];
    const rows = Array.from({ length: TRAVEL_REPORT_MIN_ROWS + 2 }, (_, index) => ({
      ...row,
      ticketId: row.ticketId + index,
    }));
    const html = buildTravelSheetHtml(buildData({ rows }));

    expect(html).not.toContain('<tr class="blank"');
  });
});
