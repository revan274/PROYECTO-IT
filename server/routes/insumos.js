import express from 'express';
import { updateDb, nextId } from '../store.js';

export function createInsumosRouter({
  requireAuth,
  ensureCanEdit,
  asNonEmptyString,
  toInt,
  getRequestActor,
  isSupplyActive,
  normalizeTextKey,
  pushAuditWithContext,
}) {
  const router = express.Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const nombre = asNonEmptyString(req.body?.nombre);
    const unidad = asNonEmptyString(req.body?.unidad) || 'Piezas';
    const categoria = (asNonEmptyString(req.body?.categoria) || 'HARDWARE').toUpperCase();
    const stock = toInt(req.body?.stock);
    const min = toInt(req.body?.min);
    const ubicacion = asNonEmptyString(req.body?.ubicacion);
    const proveedor = asNonEmptyString(req.body?.proveedor);
    const { usuario } = getRequestActor(req);

    if (!nombre || stock === null || min === null) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para insumo.' });
    }
    if (stock < 0 || min < 0) {
      return res.status(400).json({ error: 'Stock y minimo deben ser mayores o iguales a 0.' });
    }
    if (min > stock) {
      return res.status(400).json({ error: 'El minimo no puede ser mayor al stock inicial.' });
    }

    const result = await updateDb((db) => {
      const exists = db.insumos.find(
        (item) =>
          isSupplyActive(item) &&
          normalizeTextKey(item.nombre) === normalizeTextKey(nombre) &&
          normalizeTextKey(item.categoria) === normalizeTextKey(categoria),
      );
      if (exists) {
        return { ok: false, code: 'DUPLICATE' };
      }

      const nuevo = {
        id: nextId(db),
        nombre,
        unidad,
        stock,
        min,
        categoria,
        ubicacion,
        proveedor,
        activo: true,
      };
      db.insumos.push(nuevo);
      pushAuditWithContext(db, req, {
        accion: 'Registro Nuevo',
        item: nombre,
        cantidad: stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: nuevo.id,
        after: nuevo,
      });
      return { ok: true, item: nuevo };
    });

    if (!result?.ok && result?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'Ya existe un insumo activo con ese nombre y categoria.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo registrar el insumo.' });
    }
    res.status(201).json(result.item);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const nombre = asNonEmptyString(req.body?.nombre);
    const unidad = asNonEmptyString(req.body?.unidad) || 'Piezas';
    const categoria = (asNonEmptyString(req.body?.categoria) || 'HARDWARE').toUpperCase();
    const stock = toInt(req.body?.stock);
    const min = toInt(req.body?.min);
    const ubicacion = asNonEmptyString(req.body?.ubicacion);
    const proveedor = asNonEmptyString(req.body?.proveedor);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    if (!nombre || stock === null || min === null) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para insumo.' });
    }
    if (stock < 0 || min < 0) {
      return res.status(400).json({ error: 'Stock y minimo deben ser mayores o iguales a 0.' });
    }
    if (min > stock) {
      return res.status(400).json({ error: 'El minimo no puede ser mayor al stock.' });
    }

    const updated = await updateDb((db) => {
      const idx = db.insumos.findIndex((item) => Number(item.id) === Number(id));
      if (idx < 0) return { ok: false, code: 'NOT_FOUND' };

      const current = db.insumos[idx];
      if (!isSupplyActive(current)) return { ok: false, code: 'INACTIVE' };

      const exists = db.insumos.find(
        (item) =>
          Number(item.id) !== Number(id) &&
          isSupplyActive(item) &&
          normalizeTextKey(item.nombre) === normalizeTextKey(nombre) &&
          normalizeTextKey(item.categoria) === normalizeTextKey(categoria),
      );
      if (exists) return { ok: false, code: 'DUPLICATE' };

      const before = { ...current };
      const nextItem = {
        ...current,
        nombre,
        unidad,
        stock,
        min,
        categoria,
        ubicacion,
        proveedor,
      };
      db.insumos[idx] = nextItem;
      pushAuditWithContext(db, req, {
        accion: 'Edicion Insumo',
        item: nextItem.nombre,
        cantidad: nextItem.stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: nextItem.id,
        before,
        after: nextItem,
      });
      return { ok: true, item: nextItem };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo esta dado de baja y no se puede editar.' });
    }
    if (!updated?.ok && updated?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'Ya existe un insumo activo con ese nombre y categoria.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el insumo.' });
    }
    return res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/stock', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const delta = toInt(req.body?.delta);
    const stockInput = toInt(req.body?.stock);
    const motivo = asNonEmptyString(req.body?.motivo);
    if (delta === null && stockInput === null) {
      return res.status(400).json({ error: 'Debes enviar delta o stock.' });
    }
    if (stockInput !== null && stockInput < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo.' });
    }

    const updated = await updateDb((db) => {
      const item = db.insumos.find((i) => i.id === id);
      if (!item) return { ok: false, code: 'NOT_FOUND' };
      if (!isSupplyActive(item)) return { ok: false, code: 'INACTIVE' };

      const current = item.stock;
      const nextStock = stockInput !== null ? Math.max(0, stockInput) : Math.max(0, current + delta);
      const diff = nextStock - current;
      if (diff === 0) return { ok: true, item };

      item.stock = nextStock;
      let accion = stockInput !== null
        ? diff > 0 ? 'Ajuste Entrada' : 'Ajuste Salida'
        : diff > 0 ? 'Entrada' : 'Salida';
      if (motivo) accion += ` (${motivo})`;
      pushAuditWithContext(db, req, {
        accion,
        item: item.nombre,
        cantidad: Math.abs(diff),
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: item.id,
        after: item,
        meta: { previousStock: current, nextStock },
      });
      return { ok: true, item };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo esta dado de baja y no se puede editar.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el stock.' });
    }
    res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const removed = await updateDb((db) => {
      const item = db.insumos.find((i) => i.id === id);
      if (!item) return { ok: false, code: 'NOT_FOUND' };
      if (!isSupplyActive(item)) return { ok: false, code: 'INACTIVE' };
      item.activo = false;
      pushAuditWithContext(db, req, {
        accion: 'Baja Logica',
        item: item.nombre,
        cantidad: item.stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: item.id,
        after: item,
      });
      return { ok: true, item };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo ya estaba dado de baja.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo dar de baja el insumo.' });
    }
    res.json({ ok: true, deactivated: removed.item });
  } catch (error) {
    next(error);
  }
});

  return router;
}
