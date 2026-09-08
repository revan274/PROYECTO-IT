import { describe, expect, test } from 'vitest';

import {
  auditModuleLabel,
  getAuditRowTimestampMs,
  inferAuditModule,
  normalizeAuditModule,
  parseAuditBoundaryDate,
  resolveAuditModule,
} from './audit';

// La clasificación de un registro decide en qué módulo aparece al filtrar la auditoría.
// Si se clasifica mal, el registro no desaparece de la base pero sí de la vista de quien
// audita, que es tan grave como perderlo.

describe('normalizeAuditModule', () => {
  test('acepta los cuatro módulos conocidos sin distinguir mayúsculas ni acentos', () => {
    expect(normalizeAuditModule('activos')).toBe('activos');
    expect(normalizeAuditModule('INSUMOS')).toBe('insumos');
    expect(normalizeAuditModule(' Tickets ')).toBe('tickets');
    expect(normalizeAuditModule('otros')).toBe('otros');
  });

  test('rechaza lo desconocido en lugar de inventar un módulo', () => {
    expect(normalizeAuditModule('finanzas')).toBeNull();
    expect(normalizeAuditModule('')).toBeNull();
    expect(normalizeAuditModule(undefined)).toBeNull();
  });
});

describe('inferAuditModule', () => {
  test.each([
    ['Ticket Creado', '', 'tickets'],
    ['Asignación de técnico', '', 'tickets'],
    ['SLA vencido', '', 'tickets'],
    ['Acción cualquiera', 'TK-1042', 'tickets'],
    ['Activo actualizado', '', 'activos'],
    ['Importación de inventario', '', 'activos'],
    ['Equipo dado de baja', '', 'activos'],
    ['Salida de insumo', '', 'insumos'],
    ['Ajuste de stock', '', 'insumos'],
    ['Entrada', '', 'insumos'],
  ])('clasifica "%s" / "%s" como %s', (accion, item, esperado) => {
    expect(inferAuditModule(accion, item)).toBe(esperado);
  });

  test('cae en "otros" cuando nada coincide, en lugar de elegir al azar', () => {
    expect(inferAuditModule('Sesión Rechazada')).toBe('otros');
    expect(inferAuditModule('')).toBe('otros');
  });
});

describe('resolveAuditModule', () => {
  test('el módulo explícito del registro gana sobre la inferencia', () => {
    // La acción parece de tickets, pero el registro dice explícitamente "insumos".
    expect(resolveAuditModule({ accion: 'Ticket Creado', item: '', modulo: 'insumos' })).toBe('insumos');
  });

  test('infiere solo cuando el registro no trae módulo o trae uno inválido', () => {
    expect(resolveAuditModule({ accion: 'Ajuste de stock', item: '', modulo: undefined })).toBe('insumos');
    expect(resolveAuditModule({ accion: 'Activo actualizado', item: '', modulo: 'finanzas' as never })).toBe('activos');
  });
});

describe('auditModuleLabel', () => {
  test('traduce cada módulo a su etiqueta visible', () => {
    expect(auditModuleLabel('activos')).toBe('Activos IT');
    expect(auditModuleLabel('insumos')).toBe('Insumos');
    expect(auditModuleLabel('tickets')).toBe('Tickets');
    expect(auditModuleLabel('otros')).toBe('Otros');
  });
});

describe('parseAuditBoundaryDate', () => {
  // Las aserciones son relativas para no depender de la zona horaria del entorno:
  // CI corre en UTC y el equipo del usuario en America/Mexico_City.
  test('el límite superior cubre el día completo, no su primer instante', () => {
    const inicio = parseAuditBoundaryDate('2026-09-07');
    const fin = parseAuditBoundaryDate('2026-09-07', true);

    expect(inicio).not.toBeNull();
    expect(fin).not.toBeNull();
    // Un día menos un milisegundo: si el fin fuese medianoche, filtrar "hasta el 7"
    // dejaría fuera todo lo ocurrido ese día.
    expect((fin as number) - (inicio as number)).toBe(86_399_999);
  });

  test('acepta una fecha con hora y descarta lo que no es fecha', () => {
    expect(parseAuditBoundaryDate('2026-09-07T10:30:00.000Z')).toBe(Date.parse('2026-09-07T10:30:00.000Z'));
    expect(parseAuditBoundaryDate('no es fecha')).toBeNull();
    expect(parseAuditBoundaryDate('')).toBeNull();
    expect(parseAuditBoundaryDate(undefined)).toBeNull();
  });
});

describe('getAuditRowTimestampMs', () => {
  test('prefiere el timestamp ISO sobre la fecha legible', () => {
    const ms = getAuditRowTimestampMs({
      timestamp: '2026-09-07T15:00:00.000Z',
      fecha: '2026-01-01 00:00',
    });
    expect(ms).toBe(Date.parse('2026-09-07T15:00:00.000Z'));
  });

  test('usa la fecha legible cuando no hay timestamp', () => {
    const ms = getAuditRowTimestampMs({ timestamp: undefined, fecha: '2026-09-07 09:00' });
    expect(ms).not.toBeNull();
    expect(Number.isFinite(ms as number)).toBe(true);
  });

  test('devuelve null si ninguna fecha es utilizable, en vez de un instante falso', () => {
    expect(getAuditRowTimestampMs({ timestamp: '', fecha: '' })).toBeNull();
    expect(getAuditRowTimestampMs({ timestamp: 'basura', fecha: 'basura' })).toBeNull();
  });
});
