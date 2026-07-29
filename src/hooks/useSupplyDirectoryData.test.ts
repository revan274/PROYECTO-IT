import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { Insumo, SupplyStatusFilter } from '../types/app';
import { deriveSupplyDirectoryData, useSupplyDirectoryData } from './useSupplyDirectoryData';

const SUPPLIES: Insumo[] = [
  {
    id: 1,
    nombre: 'Tóner negro',
    unidad: 'Piezas',
    stock: 0,
    min: 5,
    categoria: 'CONSUMIBLES',
  },
  {
    id: 2,
    nombre: 'Cable de red',
    unidad: 'Metros',
    stock: 3,
    min: 10,
    categoria: 'REDES',
  },
  {
    id: 3,
    nombre: 'Conector de red',
    unidad: 'Piezas',
    stock: 5,
    min: 20,
    categoria: 'REDES',
  },
  {
    id: 4,
    nombre: 'Etiqueta especial',
    unidad: 'Rollos',
    stock: 10,
    min: 5,
    categoria: 'CUSTOM',
  },
];

const BASE_OPTIONS = {
  insumos: SUPPLIES,
  searchTokens: [],
  categoryFilter: 'TODAS',
  statusFilter: 'TODOS' as SupplyStatusFilter,
};

describe('deriveSupplyDirectoryData', () => {
  test('resume existencias y ordena primero agotados y bajo mínimo', () => {
    const result = deriveSupplyDirectoryData(BASE_OPTIONS);

    expect(result.supplySummary).toEqual({
      totalInsumos: 4,
      agotados: 1,
      bajoMinimo: 2,
      ok: 1,
      totalUnidades: 18,
    });
    expect(result.filteredSupplies.map((item) => item.id)).toEqual([1, 3, 2, 4]);
  });

  test('combina categorías base y personalizadas sin duplicados', () => {
    const result = deriveSupplyDirectoryData(BASE_OPTIONS);

    expect(result.supplyCategoryOptions).toEqual([
      'CONSUMIBLES',
      'CUSTOM',
      'HARDWARE',
      'PERIFERICOS',
      'REDES',
    ]);
  });

  test('combina categoría, estado y términos de búsqueda', () => {
    const result = deriveSupplyDirectoryData({
      ...BASE_OPTIONS,
      searchTokens: ['conector', 'piezas'],
      categoryFilter: 'REDES',
      statusFilter: 'BAJO',
    });

    expect(result.filteredSupplies.map((item) => item.id)).toEqual([3]);
  });

  test('recalcula el hook cuando cambia el estado seleccionado', () => {
    const { result, rerender } = renderHook(
      ({ statusFilter }) => useSupplyDirectoryData({
        ...BASE_OPTIONS,
        statusFilter,
      }),
      {
        initialProps: {
          statusFilter: 'TODOS' as SupplyStatusFilter,
        },
      },
    );

    expect(result.current.filteredSupplies).toHaveLength(4);

    rerender({ statusFilter: 'AGOTADO' });

    expect(result.current.filteredSupplies.map((item) => item.id)).toEqual([1]);
  });
});
