import express from 'express';
import { readDb, updateDb, nextId } from '../store.js';

export function createActivosRouter({
  requireAuth,
  summarizeAssetRisks,
  normalizeTextKey,
  asNonEmptyString,
  stripSensitiveAssetFields,
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  parseAssetLifeYears,
  parsePagination,
  paginateList,
  toInt,
  ensureCanEdit,
  getRequestActor,
  normalizeAssetPayload,
  finalizeAsset,
  buildAssetIndexes,
  findAssetConflicts,
  pushAuditWithContext,
  IMPORT_MAX_ROWS,
  importAssets,
  ensureAdmin,
  buildSignedAssetQrToken,
}) {
  const router = express.Router();

router.get('/riesgos', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar riesgos de activos.' });
    }
    const db = await readDb();
    res.json({
      ...summarizeAssetRisks(db.activos),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar inventario.' });
    }
    const db = await readDb();
    const role = req.authUser?.rol || '';
    const search = normalizeTextKey(req.query.search || '');
    const estado = asNonEmptyString(req.query.estado);
    const departamento = normalizeTextKey(req.query.departamento || '');
    const tipo = normalizeTextKey(req.query.tipo || '');
    const risk = asNonEmptyString(req.query.risk).toUpperCase();
    const withPagination = req.query.page !== undefined || req.query.pageSize !== undefined;

    let list = db.activos
      .map((asset) => stripSensitiveAssetFields(asset, role))
      .slice();

    if (estado) {
      list = list.filter((asset) => asNonEmptyString(asset.estado).toLowerCase() === estado.toLowerCase());
    }
    if (departamento) {
      list = list.filter((asset) => normalizeTextKey(asset.departamento || '') === departamento);
    }
    if (tipo) {
      list = list.filter((asset) => normalizeTextKey(asset.tipo || asset.equipo || '') === tipo);
    }
    if (search) {
      list = list.filter((asset) => {
        const fields = [
          asset.tag,
          asset.tipo,
          asset.marca,
          asset.modelo,
          asset.serial,
          asset.idInterno,
          asset.responsable,
          asset.departamento,
          asset.ubicacion,
          asset.ipAddress,
          asset.macAddress,
          asset.cpu,
          asset.ram,
          asset.disco,
        ];
        return fields.some((value) => normalizeTextKey(value || '').includes(search));
      });
    }

    if (risk) {
      const ipCount = new Map();
      const macCount = new Map();
      list.forEach((asset) => {
        const ip = asNonEmptyString(asset.ipAddress);
        const mac = asNonEmptyString(asset.macAddress).toLowerCase();
        if (ip) ipCount.set(ip, (ipCount.get(ip) || 0) + 1);
        if (mac) macCount.set(mac, (macCount.get(mac) || 0) + 1);
      });

      if (risk === 'SIN_IP') list = list.filter((asset) => assetRequiresNetworkIdentity(asset) && !asNonEmptyString(asset.ipAddress));
      if (risk === 'SIN_MAC') list = list.filter((asset) => assetRequiresNetworkIdentity(asset) && !asNonEmptyString(asset.macAddress));
      if (risk === 'SIN_RESP') list = list.filter((asset) => assetRequiresResponsible(asset) && !asNonEmptyString(asset.responsable));
      if (risk === 'VIDA_ALTA') list = list.filter((asset) => {
        const years = parseAssetLifeYears(asset.aniosVida);
        return years !== null && years >= 4;
      });
      if (risk === 'DUP_RED') {
        list = list.filter((asset) => {
          const ip = asNonEmptyString(asset.ipAddress);
          const mac = asNonEmptyString(asset.macAddress).toLowerCase();
          return (ip && (ipCount.get(ip) || 0) > 1) || (mac && (macCount.get(mac) || 0) > 1);
        });
      }
    }

    list.sort((left, right) => normalizeTextKey(left.tag).localeCompare(normalizeTextKey(right.tag)));

    if (!withPagination) {
      return res.json(list);
    }

    const { page, pageSize } = parsePagination(req.query);
    const paged = paginateList(list, page, pageSize);
    return res.json(paged);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/qr-token', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para generar QR de activos.' });
    }
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const db = await readDb();
    const asset = db.activos.find((item) => Number(item.id) === Number(id));
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado.' });

    const signed = buildSignedAssetQrToken(asset);
    return res.json({
      token: signed.token,
      scheme: signed.scheme,
      assetId: signed.payload.aid,
      issuedAt: new Date(signed.payload.iat * 1000).toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const { usuario } = getRequestActor(req);

    const parsed = normalizeAssetPayload(req.body, { mode: 'create' });
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.errors.join('. ') || 'Campos requeridos incompletos para activo.' });
    }
    const normalized = finalizeAsset(parsed.item);

    const created = await updateDb((db) => {
      const indexes = buildAssetIndexes(db.activos);
      const conflicts = findAssetConflicts(indexes, normalized, null);
      if (conflicts.length > 0) {
        return { ok: false, code: 'CONFLICT', fields: conflicts };
      }

      const nuevo = { id: nextId(db), ...normalized };
      db.activos.push(nuevo);
      pushAuditWithContext(db, req, {
        accion: 'Alta Activo',
        item: nuevo.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: nuevo.id,
        after: nuevo,
      });
      return { ok: true, item: nuevo };
    });

    if (!created?.ok && created?.code === 'CONFLICT') {
      return res.status(409).json({ error: `Activo duplicado por: ${created.fields.join(', ')}` });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo registrar el activo.' });
    }
    res.status(201).json(created.item);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const parsed = normalizeAssetPayload(req.body, { mode: 'create' });
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.errors.join('. ') || 'Campos requeridos incompletos para activo.' });
    }
    const normalized = finalizeAsset(parsed.item);

    const updated = await updateDb((db) => {
      const idx = db.activos.findIndex((item) => Number(item.id) === Number(id));
      if (idx < 0) return { ok: false, code: 'NOT_FOUND' };

      const indexes = buildAssetIndexes(db.activos);
      const conflicts = findAssetConflicts(indexes, normalized, id);
      if (conflicts.length > 0) {
        return { ok: false, code: 'CONFLICT', fields: conflicts };
      }

      const nextItem = { ...db.activos[idx], ...normalized, id };
      db.activos[idx] = nextItem;
      pushAuditWithContext(db, req, {
        accion: 'Edicion Activo',
        item: nextItem.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: nextItem.id,
        after: nextItem,
      });
      return { ok: true, item: nextItem };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Activo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'CONFLICT') {
      return res.status(409).json({ error: `Activo duplicado por: ${updated.fields.join(', ')}` });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el activo.' });
    }

    return res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

router.post('/import', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const { usuario } = getRequestActor(req);
    const fileName = asNonEmptyString(req.body?.fileName) || 'Importacion Excel';
    const dryRun = req.body?.dryRun === true;
    const upsert = req.body?.upsert !== false;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'No hay filas para importar.' });
    }
    if (items.length > IMPORT_MAX_ROWS) {
      return res.status(413).json({ error: `La importacion excede el maximo permitido (${IMPORT_MAX_ROWS} filas).` });
    }
    if (items.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      return res.status(400).json({ error: 'Formato de filas invalido para importacion.' });
    }

    if (dryRun) {
      const db = await readDb();
      const previewDb = JSON.parse(JSON.stringify(db));
      const report = importAssets(previewDb, {
        items,
        upsert,
        usuario,
        fileName,
        persist: false,
        auditReq: req,
      });
      return res.json({ ...report, dryRun: true });
    }

    const result = await updateDb((db) =>
      importAssets(db, {
        items,
        upsert,
        usuario,
        fileName,
        persist: true,
        auditReq: req,
      }),
    );

    return res.json({ ...result, dryRun: false });
  } catch (error) {
    next(error);
  }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const { usuario } = getRequestActor(req);

    const result = await updateDb((db) => {
      const removedCount = Array.isArray(db.activos) ? db.activos.length : 0;
      if (removedCount > 0) {
        db.activos = [];
        pushAuditWithContext(db, req, {
          accion: 'Borrado Masivo Activos',
          item: 'Inventario completo',
          cantidad: removedCount,
          usuario,
          modulo: 'activos',
          entidad: 'activo',
          meta: { removedCount },
        });
      }
      return { removedCount };
    });

    res.json({ ok: true, removedCount: Number(result?.removedCount || 0) });
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
      const idx = db.activos.findIndex((a) => a.id === id);
      if (idx < 0) return null;
      const [activo] = db.activos.splice(idx, 1);
      pushAuditWithContext(db, req, {
        accion: 'Baja Activo',
        item: activo.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: activo.id,
        before: activo,
      });
      return activo;
    });

    if (!removed) return res.status(404).json({ error: 'Activo no encontrado.' });
    res.json({ ok: true, removed });
  } catch (error) {
    next(error);
  }
});

  return router;
}
