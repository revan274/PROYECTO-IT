import { describe, expect, test } from 'vitest';

import { buildCsvContent, neutralizeSpreadsheetFormula } from './csvDownload';

describe('neutralizeSpreadsheetFormula', () => {
  test.each([
    ['=2+2', "'=2+2"],
    [' +SUM(A1:A2)', "' +SUM(A1:A2)"],
    ['-10', "'-10"],
    ['@IMPORTXML(A1)', "'@IMPORTXML(A1)"],
    ['\t=CMD()', "'\t=CMD()"],
    ['\r+1', "'\r+1"],
  ])('neutraliza una celda potencialmente ejecutable: %s', (value, expected) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(expected);
  });

  test('preserva texto normal y valores que ya comienzan con apóstrofe', () => {
    expect(neutralizeSpreadsheetFormula('Equipo POS')).toBe('Equipo POS');
    expect(neutralizeSpreadsheetFormula("'=2+2")).toBe("'=2+2");
  });
});

describe('buildCsvContent', () => {
  test('aplica neutralización y escape CSV en encabezados y filas', () => {
    expect(buildCsvContent(['Campo'], [['=1+1'], ['Texto "seguro"']])).toBe(
      '"Campo"\n"\'=1+1"\n"Texto ""seguro"""',
    );
  });
});
