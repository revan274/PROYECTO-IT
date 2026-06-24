import { describe, expect, test } from 'vitest';

import type { Activo } from '../types/app';
import {
  buildAssetDisplayOptions,
  expandStationCode,
  extractStationFromTag,
  humanizeAssetType,
} from './assets';

function asset(overrides: Partial<Activo>): Activo {
  return {
    id: 1,
    tag: 'TJ01-TJ01-DSK-CJ1-1',
    tipo: 'DSK',
    marca: 'HP',
    ubicacion: 'TJ01 | TJ01',
    estado: 'Operativo',
    serial: 'SN1',
    fechaCompra: '',
    ...overrides,
  };
}

describe('humanizeAssetType', () => {
  test('traduce siglas conocidas', () => {
    expect(humanizeAssetType({ tipo: 'IMP' })).toBe('IMPRESORA');
    expect(humanizeAssetType({ tipo: 'DSK' })).toBe('COMPUTADORA');
    expect(humanizeAssetType({ tipo: 'BSC' })).toBe('BASCULA');
  });
  test('usa el código tal cual si no hay traducción', () => {
    expect(humanizeAssetType({ tipo: 'XYZ' })).toBe('XYZ');
  });
});

describe('expandStationCode / extractStationFromTag', () => {
  test('expande CJ1 -> CAJA 1', () => {
    expect(expandStationCode('CJ1')).toBe('CAJA 1');
    expect(expandStationCode('cj07')).toBe('CAJA 7');
  });
  test('devuelve null si no es un puesto reconocido', () => {
    expect(expandStationCode('GEL')).toBeNull();
    expect(expandStationCode('')).toBeNull();
  });
  test('extrae el puesto del folio', () => {
    expect(extractStationFromTag('TJ01-TJ01-IMP-CJ2-43')).toBe('CAJA 2');
    expect(extractStationFromTag('CD1-CD1-DSK-GEL-1')).toBeNull();
  });
});

describe('buildAssetDisplayOptions', () => {
  test('combina puesto del folio con tipo legible', () => {
    const options = buildAssetDisplayOptions([
      asset({ tag: 'TJ01-TJ01-IMP-CJ1-40', tipo: 'IMP' }),
      asset({ tag: 'TJ01-TJ01-DSK-CJ1-39', tipo: 'DSK' }),
      asset({ tag: 'TJ01-TJ01-IMP-CJ2-43', tipo: 'IMP' }),
    ]);
    const byTag = Object.fromEntries(options.map((o) => [o.tag, o.displayName]));
    expect(byTag['TJ01-TJ01-IMP-CJ1-40']).toBe('CAJA 1 - IMPRESORA');
    expect(byTag['TJ01-TJ01-DSK-CJ1-39']).toBe('CAJA 1 - COMPUTADORA');
    expect(byTag['TJ01-TJ01-IMP-CJ2-43']).toBe('CAJA 2 - IMPRESORA');
  });

  test('nombreVisible tiene prioridad sobre el autogenerado', () => {
    const [option] = buildAssetDisplayOptions([
      asset({ tag: 'TJ01-TJ01-DSK-CJ1-39', tipo: 'DSK', nombreVisible: 'Caja principal' }),
    ]);
    expect(option.displayName).toBe('CAJA PRINCIPAL');
    expect(option.custom).toBe(true);
  });

  test('numera repetidos sin puesto reconocido', () => {
    const options = buildAssetDisplayOptions([
      asset({ tag: 'CD1-CD1-DSK-GEL-1', tipo: 'DSK', ubicacion: 'CD1 | CD1' }),
      asset({ tag: 'CD1-CD1-DSK-GEL-4', tipo: 'DSK', ubicacion: 'CD1 | CD1' }),
      asset({ tag: 'CD1-CD1-IMP-GEL-2', tipo: 'IMP', ubicacion: 'CD1 | CD1' }),
    ]);
    const names = options.map((o) => o.displayName);
    expect(names).toContain('COMPUTADORA 1');
    expect(names).toContain('COMPUTADORA 2');
    expect(names).toContain('IMPRESORA');
  });
});
