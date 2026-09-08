import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { RegistroAuditoria } from '../types/app';
import { downloadAuditCsv } from './auditCsv';

// La exportación de auditoría es el rastro que se entrega ante una revisión: si las columnas
// se desalinean o una celda queda ejecutable, el archivo entregado es incorrecto.
// El test recorre la ruta real (downloadAuditCsv -> downloadCsv -> buildCsvContent ->
// downloadTextFile) y solo sustituye la frontera del navegador, capturando el Blob generado.

let capturado: Blob | null = null;
let nombreArchivo = '';
const createObjectURL = URL.createObjectURL;
const revokeObjectURL = URL.revokeObjectURL;
const click = HTMLAnchorElement.prototype.click;

beforeEach(() => {
  capturado = null;
  nombreArchivo = '';
  URL.createObjectURL = vi.fn((blob: Blob) => {
    capturado = blob;
    return 'blob:prueba';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = function capturarNombre(this: HTMLAnchorElement) {
    nombreArchivo = this.download;
  };
});

afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  HTMLAnchorElement.prototype.click = click;
  vi.restoreAllMocks();
});

function registro(overrides: Partial<RegistroAuditoria> = {}): RegistroAuditoria {
  return {
    id: 1,
    fecha: '2026-09-07 09:00',
    usuario: 'admin.it',
    accion: 'Ticket Creado',
    item: 'POS-001',
    cantidad: 1,
    modulo: 'tickets',
    resultado: 'ok',
    ...overrides,
  } as RegistroAuditoria;
}

async function contenido(): Promise<string> {
  expect(capturado, 'debió generarse un archivo').not.toBeNull();
  return (capturado as unknown as Blob).text();
}

describe('downloadAuditCsv', () => {
  test('escribe la cabecera y una fila alineada con ella', async () => {
    downloadAuditCsv([registro()]);

    const lineas = (await contenido()).split('\n');
    expect(lineas[0]).toBe('"Módulo","Fecha","Usuario","Acción","Item","Cantidad","Resultado","Entidad","RequestId"');
    expect(lineas[1]).toBe('"Tickets","2026-09-07 09:00","admin.it","Ticket Creado","POS-001","1","ok","",""');
    expect(lineas[0].split(',')).toHaveLength(lineas[1].split(',').length);
  });

  test('completa los campos opcionales ausentes en lugar de descuadrar columnas', async () => {
    downloadAuditCsv([registro({ resultado: undefined, entidad: undefined, requestId: undefined })]);

    const fila = (await contenido()).split('\n')[1];
    expect(fila.endsWith('"ok","",""')).toBe(true);
  });

  test('neutraliza una celda que Excel ejecutaría como fórmula', async () => {
    downloadAuditCsv([registro({ item: '=HYPERLINK("http://malo","clic")' })]);

    expect(await contenido()).toContain('"\'=HYPERLINK(""http://malo"",""clic"")"');
  });

  test('el nombre del archivo distingue el módulo exportado del general', async () => {
    downloadAuditCsv([registro()], 'tickets');
    expect(nombreArchivo).toMatch(/^auditoria_it_tickets_\d{4}-\d{2}-\d{2}\.csv$/);

    downloadAuditCsv([registro()]);
    expect(nombreArchivo).toMatch(/^auditoria_it_general_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('exporta solo las filas recibidas, sin inventar ni perder registros', async () => {
    downloadAuditCsv([registro({ id: 1 }), registro({ id: 2, item: 'BAS-010' })]);

    const lineas = (await contenido()).split('\n');
    expect(lineas).toHaveLength(3); // cabecera + 2 filas
    expect(lineas[2]).toContain('"BAS-010"');
  });
});
