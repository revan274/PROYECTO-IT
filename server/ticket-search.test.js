import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTicketSearchText,
  ticketMatchesSearch,
  tokenizeTicketSearchQuery,
} from '../shared/ticket-search.js';

const ticket = {
  id: 1042,
  solicitadoPor: 'José Núñez',
  solicitadoPorUsername: 'j.nunez',
  asignadoA: 'Técnica Álvarez',
  activoId: 8,
  activoTag: 'POS-TJ-08',
  descripcion: 'Impresión intermitente en caja principal',
  sucursal: 'TJ01',
  categoriaId: 'CAT_PERIFERICOS',
  categoriaNombre: 'Periféricos de caja',
};

const context = {
  branchLabel: 'Sucursal Tijuana Norte',
  asset: {
    id: 8,
    tag: 'POS-TJ-08',
    tipo: 'Terminal punto de venta',
    marca: 'IBM',
    modelo: 'SurePOS 500',
    serial: 'ÁGUILA-008',
  },
};

test('contrato compartido normaliza acentos y aplica todos los términos parciales', () => {
  assert.deepEqual(tokenizeTicketSearchQuery('  JOSÉ   perif  '), ['jose', 'perif']);
  assert.equal(ticketMatchesSearch(ticket, '1042 jose alva aguila norte perifer', context), true);
  assert.equal(ticketMatchesSearch(ticket, '1042 jose inexistente', context), false);
});

test('texto compartido incluye folio, solicitante, técnico, activo, descripción, sucursal y categoría', () => {
  const searchable = buildTicketSearchText(ticket, context);
  for (const expected of ['folio 1042', 'jose nunez', 'tecnica alvarez', 'pos-tj-08', 'surepos', 'impresion intermitente', 'tijuana norte', 'perifericos de caja']) {
    assert.equal(searchable.includes(expected), true, expected);
  }
});
