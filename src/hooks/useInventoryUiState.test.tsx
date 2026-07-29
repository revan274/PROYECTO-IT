import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { useInventoryUiState } from './useInventoryUiState';

describe('useInventoryUiState', () => {
  test('permite guardar un insumo cuyo stock está por debajo del mínimo', () => {
    const { result } = renderHook(() => useInventoryUiState({ insumos: [] }));

    act(() => {
      result.current.setFormData({
        nombre: 'Papel térmico',
        unidad: 'Rollos',
        stock: '3',
        min: '12',
        categoria: 'CONSUMIBLES',
      });
    });

    expect(result.current.insumoFormValidation).toMatchObject({
      stock: 3,
      min: 12,
      errors: {},
      firstError: '',
      isValid: true,
    });
  });
});
