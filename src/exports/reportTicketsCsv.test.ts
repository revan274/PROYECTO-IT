import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { TicketItem } from '../types/app';
import { buildReportTicketExportRows, downloadReportTicketsCsv } from './reportTicketsCsv';

let captured: Blob | null = null;
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;
const click = HTMLAnchorElement.prototype.click;

beforeEach(() => {
  captured = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    captured = blob;
    return 'blob:report-test';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  HTMLAnchorElement.prototype.click = click;
  vi.restoreAllMocks();
});

function ticket(id: number, description: string): TicketItem {
  return {
    id,
    activoTag: `POS-${id}`,
    descripcion: description,
    sucursal: 'TJ01',
    prioridad: 'ALTA',
    estado: 'Resuelto',
    fecha: '2026-09-21T15:30:00.000Z',
    fechaCreacion: '2026-09-21T15:30:00.000Z',
    fechaResolucion: '2026-09-21T17:30:00.000Z',
    fechaLimite: '2026-09-21T18:00:00.000Z',
    solicitadoPor: 'Iñaki Núñez',
    departamento: 'Operación',
    categoriaNombre: 'Impresión y comunicación',
    areaNombre: 'Línea de cajas',
  };
}

const context = {
  nowMs: Date.parse('2026-09-21T18:00:00.000Z'),
  formatTicketBranchFromCatalog: () => 'Sucursal Peñón',
};

describe('exportación filtrada de tickets', () => {
  test('el constructor conserva exactamente filas, números, fechas y caracteres UTF-8', () => {
    const rows = buildReportTicketExportRows({
      ...context,
      reportTickets: [ticket(17, 'á é í ó ú, niño')],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].ID).toBe(17);
    expect(rows[0]['Fecha creación']).toBe('2026-09-21T15:30:00.000Z');
    expect(rows[0].Solicitante).toBe('Iñaki Núñez');
    expect(rows[0].Descripción).toBe('á é í ó ú, niño');
  });

  test('CSV descarga solo el conjunto recibido y neutraliza fórmulas', async () => {
    downloadReportTicketsCsv({
      ...context,
      reportTickets: [ticket(17, 'á é í ó ú, niño'), ticket(18, '=HYPERLINK("https://evil.test")')],
      reportDateFrom: '2026-09-01',
      reportDateTo: '2026-09-30',
    });

    expect(captured).not.toBeNull();
    const content = await (captured as unknown as Blob).text();
    expect(content.split('\n')).toHaveLength(3);
    expect(content).toContain('Iñaki Núñez');
    expect(content).toContain('á é í ó ú, niño');
    expect(content).toContain("'=HYPERLINK");
  });
});
