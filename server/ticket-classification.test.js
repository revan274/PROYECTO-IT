import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrateLegacyTicketClassification,
  normalizeTicketClassificationCatalogs,
  resolveTicketClassification,
} from '../shared/ticket-classification.js';

test('clasificación resuelve únicamente pares área/categoría compatibles', () => {
  const catalogs = normalizeTicketClassificationCatalogs();
  assert.deepEqual(resolveTicketClassification(catalogs, {
    areaId: 'AREA_CAJAS',
    categoriaId: 'CAT_POS',
  }), {
    areaId: 'AREA_CAJAS',
    areaNombre: 'Línea de cajas',
    categoriaId: 'CAT_POS',
    categoriaNombre: 'Punto de venta',
  });
  assert.equal(resolveTicketClassification(catalogs, {
    areaId: 'AREA_GERENCIA',
    categoriaId: 'CAT_POS',
  }), null);
});

test('migración legacy solo clasifica coincidencias inequívocas y marca el resto', () => {
  const catalogs = normalizeTicketClassificationCatalogs();
  const migrated = migrateLegacyTicketClassification({
    id: 1,
    descripcion: 'Área afectada: Línea de cajas | Punto de venta',
  }, catalogs);
  assert.equal(migrated.areaId, 'AREA_CAJAS');
  assert.equal(migrated.categoriaId, 'CAT_POS');
  assert.equal(migrated.descripcion, 'Punto de venta');
  assert.equal(migrated.clasificacionPendiente, undefined);

  const unknown = migrateLegacyTicketClassification({ id: 2, descripcion: 'Falla sin etiqueta histórica' }, catalogs);
  assert.equal(unknown.areaId, undefined);
  assert.equal(unknown.clasificacionPendiente, true);

  const partial = migrateLegacyTicketClassification({
    id: 3,
    descripcion: 'Área afectada: Línea de cajas | Texto libre no clasificable',
  }, catalogs);
  assert.equal(partial.areaId, 'AREA_CAJAS');
  assert.equal(partial.categoriaId, undefined);
  assert.equal(partial.clasificacionPendiente, true);
});
