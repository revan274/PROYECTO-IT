import { describe, expect, test } from 'vitest';

import type { Activo } from '../types/app';
import {
  buildSuggestedTicketIssues,
  buildTicketAssetContextSummary,
} from './tickets';

const VALID_BRANCH_CODES = new Set(['TJ01', 'TJ02', 'TJ03', 'TC01', 'CEDIS']);

function createAsset(overrides: Partial<Activo>): Activo {
  return {
    id: 1,
    tag: 'TAG-001',
    tipo: 'DSK',
    marca: 'GENERICA',
    ubicacion: 'TJ01 | TJ01',
    estado: 'Operativo',
    serial: 'SER-001',
    fechaCompra: '2026-01-01',
    ...overrides,
  };
}

describe('buildTicketAssetContextSummary', () => {
  test('detecta sucursal, lugar y area sugerida desde un activo de piso', () => {
    const asset = createAsset({
      tipo: 'BSC',
      equipo: 'BSC',
      ubicacion: 'CARN | TJ02',
      departamento: 'CARN',
    });

    expect(buildTicketAssetContextSummary(asset, VALID_BRANCH_CODES)).toMatchObject({
      branchCode: 'TJ02',
      locationLabel: 'CARN',
      typeCode: 'BSC',
      suggestedArea: 'Línea de cajas',
    });
  });

  test('prioriza el contexto de infraestructura cuando el activo esta en site', () => {
    const asset = createAsset({
      tipo: 'SVR',
      equipo: 'SVR',
      ubicacion: 'SIS | SITE01',
      departamento: 'SIS',
    });

    expect(buildTicketAssetContextSummary(asset, VALID_BRANCH_CODES)).toMatchObject({
      locationLabel: 'SIS',
      typeCode: 'SVR',
      suggestedArea: 'Mantenimiento',
    });
  });
});

describe('buildSuggestedTicketIssues', () => {
  test('combina fallas de impresora con el contexto real de sucursal', () => {
    const asset = createAsset({
      tipo: 'IMP',
      equipo: 'IMP',
      ubicacion: 'TJ01 | TJ01',
      departamento: 'TJ01',
    });

    const issues = buildSuggestedTicketIssues('', asset, VALID_BRANCH_CODES);

    expect(issues).toContain('Atasco de papel en impresora');
    expect(issues).toContain('Sin papel térmico');
    expect(issues).toContain('Impresora fuera de linea');
  });

  test('mantiene arriba el grupo elegido por el usuario y agrega extras contextuales', () => {
    const asset = createAsset({
      tipo: 'DSK',
      equipo: 'DSK',
      ubicacion: 'AYF | CORP',
      departamento: 'AYF',
    });

    const issues = buildSuggestedTicketIssues('Gerencia', asset, VALID_BRANCH_CODES);

    expect(issues[0]).toBe('No se genera reporte diario');
    expect(issues).toContain('Equipo no enciende');
    expect(issues).toContain('No acceso a carpetas o servidor remoto');
  });
});
