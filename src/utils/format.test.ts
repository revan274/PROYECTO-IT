import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDateTimeCompact } from './format';

// Las aserciones evitan comparar cadenas literales: `toLocaleString` depende del
// idioma del entorno y la CI no corre con el mismo que esta maquina. Se comprueba
// el comportamiento (que aparezca o no el ano, que no haya segundos), no el texto.
describe('formatDateTimeCompact', () => {
  const EN_2026 = '2026-09-08T20:55:52.790Z';

  it('devuelve N/D cuando no hay valor', () => {
    expect(formatDateTimeCompact()).toBe('N/D');
    expect(formatDateTimeCompact('')).toBe('N/D');
  });

  it('devuelve el valor tal cual si no es una fecha', () => {
    expect(formatDateTimeCompact('pendiente')).toBe('pendiente');
  });

  it('omite el ano cuando la fecha cae en el ano en curso', () => {
    const salida = formatDateTimeCompact(EN_2026, Date.parse('2026-01-15T00:00:00.000Z'));
    expect(salida).not.toMatch(/2026/);
  });

  it('muestra el ano cuando la fecha es de otro ano', () => {
    const salida = formatDateTimeCompact(EN_2026, Date.parse('2027-01-15T00:00:00.000Z'));
    expect(salida).toMatch(/2026/);
  });

  it('no incluye segundos, a diferencia de formatDateTime', () => {
    expect(formatDateTimeCompact(EN_2026)).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(formatDateTime(EN_2026)).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });
});

describe('formatDateTime', () => {
  it('conserva el contrato que usan auditoria, Excel y los reportes impresos', () => {
    expect(formatDateTime()).toBe('N/D');
    expect(formatDateTime('pendiente')).toBe('pendiente');
    expect(formatDateTime('2026-09-08T20:55:52.790Z')).toBe(
      new Date('2026-09-08T20:55:52.790Z').toLocaleString(),
    );
  });
});
