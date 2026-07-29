import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { Activo, InventoryRiskFilter } from '../types/app';
import { deriveAssetDirectoryData, useAssetDirectoryData } from './useAssetDirectoryData';

const ASSETS: Activo[] = [
  {
    id: 1,
    tag: 'PC-002',
    tipo: 'DSK',
    marca: 'Lenovo',
    ubicacion: 'Caja 2',
    estado: 'Operativo',
    serial: 'SER-2',
    fechaCompra: '',
    departamento: 'TIJUANA',
    responsable: 'Ana',
    ipAddress: '10.0.0.5',
    macAddress: 'AA:BB:CC:DD:EE:01',
    aniosVida: '2 años',
  },
  {
    id: 2,
    tag: 'PC-001',
    tipo: 'DSK',
    marca: 'Dell',
    ubicacion: 'Caja 1',
    estado: 'Falla',
    serial: 'SER-1',
    fechaCompra: '',
    departamento: 'TIJUANA',
    ipAddress: '10.0.0.5',
    macAddress: 'AA:BB:CC:DD:EE:02',
    aniosVida: '5 años',
  },
  {
    id: 3,
    tag: 'PC-003',
    tipo: 'LPT',
    marca: 'HP',
    ubicacion: 'Oficina',
    estado: 'Operativo',
    serial: 'SER-3',
    fechaCompra: '',
    departamento: 'ENSENADA',
    responsable: 'Bruno',
    macAddress: 'AA:BB:CC:DD:EE:03',
  },
  {
    id: 4,
    tag: 'MON-001',
    tipo: 'MON',
    marca: 'LG',
    ubicacion: 'Caja 1',
    estado: 'Operativo',
    serial: 'SER-4',
    fechaCompra: '',
    departamento: 'TIJUANA',
  },
];

const BASE_OPTIONS = {
  activos: ASSETS,
  searchTokens: [],
  departmentFilter: 'TODOS',
  equipmentFilter: 'TODOS',
  statusFilter: 'TODOS' as const,
  riskFilter: 'TODOS' as InventoryRiskFilter,
  sortField: 'tag' as const,
  sortDirection: 'asc' as const,
};

describe('deriveAssetDirectoryData', () => {
  test('calcula riesgos, opciones y orden sin mutar la colección original', () => {
    const originalOrder = ASSETS.map((asset) => asset.id);
    const result = deriveAssetDirectoryData(BASE_OPTIONS);

    expect(result.localRiskSummary).toMatchObject({
      totalActivos: 4,
      activosSinIp: 1,
      activosSinResponsable: 1,
      activosVidaAlta: 1,
      activosEnFalla: 1,
      duplicateIpCount: 1,
    });
    expect(result.departamentoOptions).toEqual(['ENSENADA', 'TIJUANA']);
    expect(result.equipoOptions).toEqual(['DSK', 'LPT', 'MON']);
    expect(result.sortedFilteredActivos.map((asset) => asset.tag)).toEqual([
      'MON-001',
      'PC-001',
      'PC-002',
      'PC-003',
    ]);
    expect(ASSETS.map((asset) => asset.id)).toEqual(originalOrder);
  });

  test('detecta activos con red duplicada usando el resumen compartido', () => {
    const result = deriveAssetDirectoryData({
      ...BASE_OPTIONS,
      riskFilter: 'DUP_RED',
    });

    expect(result.filteredActivos.map((asset) => asset.id)).toEqual([1, 2]);
  });

  test('combina riesgo, estado, departamento y búsqueda', () => {
    const result = deriveAssetDirectoryData({
      ...BASE_OPTIONS,
      searchTokens: ['dell', 'caja'],
      departmentFilter: 'tijuana',
      equipmentFilter: 'dsk',
      statusFilter: 'Falla',
      riskFilter: 'SIN_RESP',
    });

    expect(result.filteredActivos.map((asset) => asset.id)).toEqual([2]);
  });

  test('excluye de riesgos obligatorios a tipos exentos', () => {
    const withoutIp = deriveAssetDirectoryData({
      ...BASE_OPTIONS,
      riskFilter: 'SIN_IP',
    });
    const withoutResponsible = deriveAssetDirectoryData({
      ...BASE_OPTIONS,
      riskFilter: 'SIN_RESP',
    });

    expect(withoutIp.filteredActivos.map((asset) => asset.id)).toEqual([3]);
    expect(withoutResponsible.filteredActivos.map((asset) => asset.id)).toEqual([2]);
  });

  test('recalcula el hook cuando cambia el criterio de orden', () => {
    const { result, rerender } = renderHook(
      ({ sortField }) => useAssetDirectoryData({
        ...BASE_OPTIONS,
        sortField,
      }),
      {
        initialProps: {
          sortField: 'tag' as 'tag' | 'aniosVida',
        },
      },
    );

    expect(result.current.sortedFilteredActivos[0]?.tag).toBe('MON-001');

    rerender({ sortField: 'aniosVida' });

    expect(result.current.sortedFilteredActivos.map((asset) => asset.id)).toEqual([1, 2, 3, 4]);
  });
});
