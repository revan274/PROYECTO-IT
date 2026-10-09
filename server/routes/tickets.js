function readResolution(body) {
  const solucionAplicada = typeof body?.solucionAplicada === 'string' ? body.solucionAplicada.trim() : '';
  const diagnostico = typeof body?.diagnostico === 'string' ? body.diagnostico.trim() : '';
  if (!solucionAplicada || solucionAplicada.length > 8000 || diagnostico.length > 8000) {
    throw Object.assign(new Error('La solucion aplicada es obligatoria; solucion y diagnostico admiten hasta 8000 caracteres.'), { status: 400 });
  }
  return { solucionAplicada, diagnostico: diagnostico || null };
}

import { canTransitionTicket, isTicketReopening } from '../../shared/ticket-rules.js';
import { parseTicketWaitReason } from '../../shared/ticket-wait-policy.js';
import { assignSlaToCurrentCycle, recordTicketMilestones, recordTicketWaitTransition, syncTicketCycle } from '../domain/ticket-lifecycle.js';
function assertTicketMutable(ticket) {
  if (ticket.estado === 'Cancelado' || ticket.archivo) {
    throw Object.assign(new Error('El expediente cancelado o archivado conserva su estado y evidencias.'), { status: 409 });
  }
}

import { resolveAssetBranchCode } from '../../shared/asset-relations.js';
import { resolveTicketClassification } from '../../shared/ticket-classification.js';
import { ticketMatchesSearch } from '../../shared/ticket-search.js';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { updateDb, now, nextId } from '../store.js';
import { getRequestDb } from '../utils/helpers.js';
import { keepsAssetInFailureState, parseTicketPriority, parseTicketRequestType } from '../../shared/ticket-rules.js';
import { avisar, planDeAvisoAlCrear, planDeAvisoAlResolver, planDeAvisoDeComentario, MOTIVOS } from '../modules/ticket-notifications.js';
import { entregarNotificacion, NOTIFICATION_STATES } from '../modules/notification-ledger.js';
import {
  createTicketIdempotencyContext,
  findTicketCreationReplay,
  rememberTicketCreation,
} from '../modules/ticket-idempotency.js';

export function createTicketsRouter({
  requireAuth,
  ensurePermission,
  asNonEmptyString,
  normalizePrioridad,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
  canEditByRole,
  getRequestActor,
  getBranchCodesFromCatalog,
  normalizeTicketBranch,
  findTicketAssignee,
  createSlaAssignment,
  pushAuditWithContext,
  serializeTicket,
  serializeTicketSummary,
  toInt,
  normalizeEstadoTicket,
  CLOSED_STATES,
  ticketAuditAction,
  ticketBelongsToUser,
  normalizeTextKey,
  toAbsoluteAttachmentPath,
  canAccessTicketByAuthUser,
  sanitizeUploadFileName,
  TICKET_ATTACHMENT_MAX_BYTES,
  attachmentStore,
  TICKET_ATTACHMENT_MAX_COUNT,
  buildTicketAttachmentResponse,
  filterTicketsForUser,
  isSlaBreached,
  parsePagination,
  paginateList,
  notifyTicketCreated = () => Promise.resolve(),
  notifyTicketAssigned = () => Promise.resolve(),
  notificationLedger = null,
}) {
  const router = express.Router();
  const SAFE_DOWNLOAD_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/octet-stream',
  ]);

  function historyEvent({ fecha = now(), actorId = null, actorName = 'Sistema', tipo, accion, estado,
    before = null, after = null, comentario = '', ...extra }) {
    const parsedActorId = Number(actorId);
    const nombreMostrado = asNonEmptyString(actorName) || 'Sistema';
    return {
      fecha,
      actorId: Number.isSafeInteger(parsedActorId) && parsedActorId > 0 ? parsedActorId : null,
      usuario: nombreMostrado,
      nombreMostrado,
      tipo,
      accion,
      estado,
      before,
      after,
      ...(comentario ? { comentario } : {}),
      ...extra,
    };
  }

  function avisarConfiablemente({ ticket, tipo, plan }) {
    if (!Array.isArray(plan?.destinatarios) || plan.destinatarios.length === 0) return;
    if (!notificationLedger) {
      void avisar({ ticket, ...plan });
      return;
    }
    let localAttempt = 0;
    const retryDelayMs = 30_000;
    const deliver = async () => {
      localAttempt += 1;
      const result = await entregarNotificacion({
        ledger: notificationLedger,
        ticketId: ticket.id,
        tipo,
        retryDelayMs,
        enviar: () => avisar({ ticket, ...plan }),
      });
      if (result.status === NOTIFICATION_STATES.FAILED && localAttempt < 3) {
        const timer = setTimeout(deliver, retryDelayMs + 100);
        timer.unref?.();
      }
    };
    void deliver();
  }

  function normalizeSupplyUsageInput(items, { allowZero = false } = {}) {
    const normalized = [];
    const seenIds = new Set();

    for (const item of items) {
      const insumoId = toInt(item?.insumoId);
      const cantidad = toInt(item?.cantidad);
      const minimumQuantity = allowZero ? 0 : 1;

      if (insumoId === null || insumoId <= 0 || cantidad === null || cantidad < minimumQuantity) {
        return { ok: false, code: 'INVALID_SUPPLY_USAGE' };
      }
      if (seenIds.has(insumoId)) {
        return { ok: false, code: 'DUPLICATE_SUPPLY_USAGE', insumoId };
      }

      seenIds.add(insumoId);
      normalized.push({ insumoId, cantidad });
    }

    return { ok: true, items: normalized };
  }

  function prepareSupplyUsage(db, requestedItems, currentItems = []) {
    const currentById = new Map();
    for (const item of currentItems) {
      const insumoId = toInt(item?.insumoId);
      const cantidad = toInt(item?.cantidad);
      if (insumoId === null || insumoId <= 0 || cantidad === null || cantidad < 0) continue;

      const existing = currentById.get(insumoId);
      currentById.set(insumoId, {
        insumoId,
        cantidad: (existing?.cantidad || 0) + cantidad,
        nombre: asNonEmptyString(item?.nombre || existing?.nombre),
      });
    }

    const operations = [];
    for (const requested of requestedItems) {
      const supply = db.insumos.find((item) => Number(item.id) === requested.insumoId);
      if (!supply) {
        return { ok: false, code: 'SUPPLY_NOT_FOUND', insumoId: requested.insumoId };
      }

      const previousQuantity = currentById.get(requested.insumoId)?.cantidad || 0;
      const stockDelta = requested.cantidad - previousQuantity;
      if (supply.activo === false && stockDelta > 0) {
        return { ok: false, code: 'SUPPLY_INACTIVE', insumoId: requested.insumoId };
      }

      const availableStock = Math.max(0, toInt(supply.stock) || 0);
      if (stockDelta > availableStock) {
        return {
          ok: false,
          code: 'INSUFFICIENT_STOCK',
          insumoId: requested.insumoId,
          requested: stockDelta,
          available: availableStock,
        };
      }

      currentById.set(requested.insumoId, {
        insumoId: requested.insumoId,
        cantidad: requested.cantidad,
        nombre: asNonEmptyString(supply.nombre),
      });
      operations.push({ supply, stockDelta });
    }

    return {
      ok: true,
      items: Array.from(currentById.values()),
      operations,
    };
  }

  function sendSupplyUsageError(res, result) {
    if (result?.code === 'SUPPLY_NOT_FOUND') {
      return res.status(400).json({ error: `El insumo ${result.insumoId} no existe.` });
    }
    if (result?.code === 'SUPPLY_INACTIVE') {
      return res.status(409).json({ error: `El insumo ${result.insumoId} está dado de baja.` });
    }
    if (result?.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        error: `Stock insuficiente para el insumo ${result.insumoId}. Disponible: ${result.available}.`,
      });
    }
    return null;
  }

  function syncAssetOperationalState(db, activoTag) {
    const tagKey = normalizeTextKey(activoTag);
    if (!tagKey) return;

    const activo = db.activos.find((item) => normalizeTextKey(item?.tag) === tagKey);
    if (!activo) return;

    const hasRelatedOpenTickets = db.tickets.some((item) => (
      normalizeTextKey(item?.activoTag) === tagKey
      && keepsAssetInFailureState(item.estado)
    ));
    activo.estado = hasRelatedOpenTickets ? 'Falla' : 'Operativo';
  }

  // Solo lo que hace falta para decidir destinatarios. Se extrae dentro del lock y se
  // usa fuera, para no retener una referencia al documento mientras se envia el correo.
  function snapshotUsuariosParaAviso(db) {
    return (Array.isArray(db?.users) ? db.users : []).map((user) => ({
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      activo: user.activo,
      email: user.email,
    }));
  }

  function snapshotPushSubscriptions(db) {
    return (Array.isArray(db?.pushSubscriptions) ? db.pushSubscriptions : []).map((subscription) => ({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userId: subscription.userId,
      username: subscription.username,
    }));
  }

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.create')) return;
    const idempotency = createTicketIdempotencyContext({
      key: req.get('Idempotency-Key'),
      actorId: req.authUser?.id,
      scope: 'ticket:create',
      payload: req.body,
    });
    const activoTag = asNonEmptyString(req.body?.activoTag);
    const tipoSolicitud = req.body?.tipoSolicitud === undefined
      ? 'INCIDENTE_ACTIVO'
      : parseTicketRequestType(req.body.tipoSolicitud);
    const descripcion = asNonEmptyString(req.body?.descripcion);
    const areaId = asNonEmptyString(req.body?.areaId);
    const categoriaId = asNonEmptyString(req.body?.categoriaId);
    const sucursalInput = req.body?.sucursal;
    const prioridad = req.body?.prioridad === undefined ? 'MEDIA' : parseTicketPriority(req.body.prioridad);
    const isEditorRole = canEditByRole(req.authUser?.rol);
    const atencionTipo = isEditorRole ? normalizeTicketAttentionType(req.body?.atencionTipo) : '';
    const hasTrasladoField = isEditorRole && req.body?.trasladoRequerido !== undefined;
    const trasladoRequerido = hasTrasladoField ? normalizeTicketTravelRequired(req.body?.trasladoRequerido) : undefined;
    const hasSupplyUsage = req.body?.insumosUsados !== undefined;
    const rawSupplyUsage = isEditorRole && Array.isArray(req.body?.insumosUsados) ? req.body.insumosUsados : [];
    const asignadoA = isEditorRole ? asNonEmptyString(req.body?.asignadoA) : '';
    const requestedRequesterUserId = req.body?.requesterUserId === undefined
      ? Number(req.authUser?.id)
      : toInt(req.body.requesterUserId);
    const { usuario } = getRequestActor(req);

    if (!isEditorRole && Array.isArray(req.body?.insumosUsados) && req.body.insumosUsados.length > 0) {
      return res.status(403).json({ error: 'No autorizado para registrar consumo de insumos.' });
    }
    if (isEditorRole && hasSupplyUsage && !Array.isArray(req.body?.insumosUsados)) {
      return res.status(400).json({ error: 'insumosUsados debe ser una lista.' });
    }
    if (!tipoSolicitud) return res.status(400).json({ error: 'Tipo de solicitud no válido.' });
    if ((tipoSolicitud === 'INCIDENTE_ACTIVO' && !activoTag) || !descripcion || !areaId || !categoriaId || !asNonEmptyString(sucursalInput) || (isEditorRole && !atencionTipo)) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para ticket.' });
    }
    if (!prioridad) return res.status(400).json({ error: 'Prioridad no válida.' });
    if (requestedRequesterUserId === null || requestedRequesterUserId <= 0) {
      return res.status(400).json({ error: 'Solicitante no válido.' });
    }
    if (!isEditorRole && requestedRequesterUserId !== Number(req.authUser?.id)) {
      return res.status(403).json({ error: 'No puedes registrar tickets a nombre de otro usuario.' });
    }
    if (hasTrasladoField && trasladoRequerido === undefined) {
      return res.status(400).json({ error: 'Indicador de traslado no válido.' });
    }
    const parsedSupplyUsage = normalizeSupplyUsageInput(rawSupplyUsage);
    if (!parsedSupplyUsage.ok) {
      const message = parsedSupplyUsage.code === 'DUPLICATE_SUPPLY_USAGE'
        ? `El insumo ${parsedSupplyUsage.insumoId} está repetido en insumosUsados.`
        : 'Insumo inválido en insumosUsados.';
      return res.status(400).json({ error: message });
    }

    const created = await updateDb((db) => {
      const replay = findTicketCreationReplay(db, idempotency);
      if (replay.status === 'conflict') return { ok: false, code: 'IDEMPOTENCY_CONFLICT' };
      if (replay.status === 'replay') return { ok: true, ticket: replay.ticket, replayed: true };
      const branchCodes = getBranchCodesFromCatalog(db);
      const sucursal = normalizeTicketBranch(sucursalInput, branchCodes);
      if (!sucursal) return { ok: false, code: 'INVALID_BRANCH' };
      const classification = resolveTicketClassification(db.catalogos, { areaId, categoriaId });
      if (!classification) return { ok: false, code: 'INVALID_CLASSIFICATION' };
      const activeArea = db.catalogos.areas.find((item) => item.id === classification.areaId)?.activo !== false;
      const activeCategory = db.catalogos.categorias.find((item) => item.id === classification.categoriaId)?.activo !== false;
      if (!activeArea || !activeCategory) return { ok: false, code: 'INACTIVE_CLASSIFICATION' };
      const requesterUser = db.users.find((item) => Number(item.id) === requestedRequesterUserId && item.activo !== false);
      if (!requesterUser) return { ok: false, code: 'REQUESTER_INVALID' };
      let assignedUser = null;
      if (asignadoA) {
        assignedUser = findTicketAssignee(db.users, asignadoA);
        if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
      }
      const asset = activoTag
        ? db.activos.find((item) => normalizeTextKey(item?.tag) === normalizeTextKey(activoTag))
        : null;
      if (tipoSolicitud === 'INCIDENTE_ACTIVO' && !asset) return { ok: false, code: 'ASSET_NOT_FOUND' };
      if (asset && resolveAssetBranchCode(asset, branchCodes) !== sucursal) return { ok: false, code: 'ASSET_BRANCH_MISMATCH' };

      const supplyUsage = prepareSupplyUsage(db, parsedSupplyUsage.items);
      if (!supplyUsage.ok) return supplyUsage;

      const createdAtIso = new Date().toISOString();
      const slaAssignment = createSlaAssignment(prioridad, Date.parse(createdAtIso), createdAtIso);
      const ticket = {
        id: nextId(db),
        tipoSolicitud,
        activoId: asset?.id || null,
        activoTag: asset?.tag || '',
        descripcion,
        ...classification,
        sucursal,
        prioridad,
        ...(atencionTipo ? { atencionTipo } : {}),
        ...(hasTrasladoField ? { trasladoRequerido } : {}),
        estado: 'Abierto',
        fecha: now(),
        fechasVersion: 1,
        fechaPrimeraAtencion: null,
        fechaResolucion: null,
        fechaCierre: null,
        fechaCreacion: createdAtIso,
        fechaLimite: slaAssignment.fechaLimite,
        slaActual: slaAssignment,
        asignadoA: assignedUser ? assignedUser.nombre : '',
        asignadoAId: assignedUser ? Number(assignedUser.id) : null,
        solicitadoPor: requesterUser.nombre,
        solicitadoPorId: Number(requesterUser.id),
        requesterUserId: Number(requesterUser.id),
        solicitadoPorUsername: asNonEmptyString(requesterUser.username).toLowerCase(),
        departamento: asNonEmptyString(requesterUser.departamento).toUpperCase(),
        createdByUserId: Number(req.authUser?.id) || null,
        createdBy: usuario,
        createdByUsername: asNonEmptyString(req.authUser?.username).toLowerCase(),
        insumosUsados: supplyUsage.items,
        attachments: [],
        historial: [historyEvent({
          actorId: req.authUser.id,
          actorName: usuario,
          tipo: 'creacion',
          accion: 'Ticket Creado',
          estado: 'Abierto',
          before: null,
          after: { estado: 'Abierto', prioridad, asignadoA: assignedUser?.nombre || '', asignadoAId: assignedUser?.id || null },
          comentario: 'Registro inicial',
        })],
      };
      syncTicketCycle(ticket).reconstruccionLegacy = Boolean(ticket.esHistorico);
      db.tickets.push(ticket);
      rememberTicketCreation(db, idempotency, ticket.id);

      if (supplyUsage.operations.length > 0) {
        for (const { supply, stockDelta } of supplyUsage.operations) {
          if (stockDelta > 0) {
            supply.stock -= stockDelta;
            pushAuditWithContext(db, req, {
              accion: 'Salida (Ticket)',
              item: supply.nombre,
              cantidad: stockDelta,
              usuario,
              modulo: 'insumos',
              entidad: 'insumo',
              entidadId: supply.id,
              after: supply,
              meta: { ticketId: ticket.id }
            });
          }
        }
      }

      // Solo roles editores (técnico/admin) pueden derivar el estado operativo del activo
      // desde un ticket; un solicitante no debe poder marcar activos como "Falla".
      if (asset && prioridad === 'CRITICA' && isEditorRole) {
        asset.estado = 'Falla';
      }

      pushAuditWithContext(db, req, {
        accion: 'Nuevo Ticket',
        item: `${asset?.tag || 'SERVICIO'} | ${sucursal} | ${atencionTipo || 'SIN DEFINIR'}${trasladoRequerido ? ' | TRASLADO' : ''}`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        after: ticket,
      });
      // Copia minima para decidir destinatarios fuera del lock. Se copia en vez de
      // devolver `db.users` para no dejar viva una referencia al documento.
      return {
        ok: true,
        ticket,
        assignedUser,
        usuariosParaAviso: snapshotUsuariosParaAviso(db),
        pushSubscriptions: snapshotPushSubscriptions(db),
      };
    });

    if (!created?.ok && created?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a inválido. Debe ser un técnico/admin activo.' });
    }
    if (!created?.ok && created?.code === 'IDEMPOTENCY_CONFLICT') {
      return res.status(409).json({ error: 'La misma Idempotency-Key ya se usó con datos distintos.' });
    }
    if (!created?.ok && created?.code === 'REQUESTER_INVALID') {
      return res.status(400).json({ error: 'El solicitante debe ser un usuario activo.' });
    }
    if (!created?.ok && created?.code === 'INVALID_BRANCH') {
      return res.status(400).json({ error: 'Sucursal inválida para el ticket.' });
    }
    if (!created?.ok && created?.code === 'ASSET_BRANCH_MISMATCH') {
      return res.status(400).json({ error: 'La sucursal del activo debe estar definida y coincidir con la del ticket.' });
    }
    if (!created?.ok && ['INVALID_CLASSIFICATION', 'INACTIVE_CLASSIFICATION'].includes(created?.code)) {
      return res.status(400).json({ error: 'Selecciona un área y una categoría activas y compatibles.' });
    }
    if (!created?.ok && created?.code === 'ASSET_NOT_FOUND') {
      return res.status(400).json({ error: 'El activo indicado no existe.' });
    }
    if (!created?.ok && sendSupplyUsageError(res, created)) return;
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo crear el ticket.' });
    }

    if (!created.replayed) {
      const plan = planDeAvisoAlCrear(created.ticket, created.usuariosParaAviso);
      avisarConfiablemente({ ticket: created.ticket, tipo: 'ticket-creado', plan });
      // Igual que el correo, el push nunca bloquea la creación del ticket.
      void notifyTicketCreated({
        ticket: created.ticket,
        users: created.usuariosParaAviso,
        subscriptions: created.pushSubscriptions,
      }).catch((error) => console.error(`No se pudo preparar el push del ticket #${created.ticket.id}:`, error));
    }
    res.set('Idempotency-Replayed', created.replayed ? 'true' : 'false');
    res.status(created.replayed ? 200 : 201).json(serializeTicket(created.ticket));
  } catch (error) {
    next(error);
  }
});

// Registro de tickets pasados (histórico). Solo admin.
router.post('/historical', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.historical')) return;
    const idempotency = createTicketIdempotencyContext({
      key: req.get('Idempotency-Key'),
      actorId: req.authUser?.id,
      scope: 'ticket:historical',
      payload: req.body,
    });

    const parseDate = (value) => {
      const text = asNonEmptyString(value);
      if (!text) return null;
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const activoTag = asNonEmptyString(req.body?.activoTag);
    const tipoSolicitud = req.body?.tipoSolicitud === undefined
      ? 'INCIDENTE_ACTIVO'
      : parseTicketRequestType(req.body.tipoSolicitud);
    const descripcion = asNonEmptyString(req.body?.descripcion);
    const areaId = asNonEmptyString(req.body?.areaId);
    const categoriaId = asNonEmptyString(req.body?.categoriaId);
    const sucursalInput = req.body?.sucursal;
    const prioridad = req.body?.prioridad === undefined ? 'MEDIA' : parseTicketPriority(req.body.prioridad);
    const atencionTipo = normalizeTicketAttentionType(req.body?.atencionTipo);
    const hasTrasladoField = req.body?.trasladoRequerido !== undefined;
    const trasladoRequerido = hasTrasladoField ? normalizeTicketTravelRequired(req.body?.trasladoRequerido) : undefined;
    const asignadoA = asNonEmptyString(req.body?.asignadoA);
    const requestedRequesterUserId = req.body?.requesterUserId === undefined
      ? Number(req.authUser?.id)
      : toInt(req.body.requesterUserId);
    const estado = normalizeEstadoTicket(req.body?.estado) || 'Cerrado';
    const comentarioResolucion = asNonEmptyString(req.body?.comentarioResolucion);
    const { usuario } = getRequestActor(req);

    const fechaCreacion = parseDate(req.body?.fechaCreacion);
    const fechaCierreInput = parseDate(estado === 'Resuelto' ? (req.body?.fechaResolucion || req.body?.fechaCierre) : req.body?.fechaCierre);
    const nowMs = Date.now();
    if (estado === 'Cancelado') return res.status(400).json({ error: 'Registra el ticket y utiliza Cancelar con motivo.' });
    const isClosedState = CLOSED_STATES.has(estado);

    if (!tipoSolicitud) return res.status(400).json({ error: 'Tipo de solicitud no válido.' });
    if ((tipoSolicitud === 'INCIDENTE_ACTIVO' && !activoTag) || !descripcion || !areaId || !categoriaId || !asNonEmptyString(sucursalInput) || !atencionTipo) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para ticket.' });
    }
    if (!prioridad) return res.status(400).json({ error: 'Prioridad no válida.' });
    if (requestedRequesterUserId === null || requestedRequesterUserId <= 0) {
      return res.status(400).json({ error: 'Solicitante no válido.' });
    }
    if (hasTrasladoField && trasladoRequerido === undefined) {
      return res.status(400).json({ error: 'Indicador de traslado no válido.' });
    }
    if (req.body?.estado && !normalizeEstadoTicket(req.body?.estado)) {
      return res.status(400).json({ error: 'Estado de ticket no válido.' });
    }
    if (!fechaCreacion) {
      return res.status(400).json({ error: 'Fecha de creación inválida.' });
    }
    if (fechaCreacion.getTime() > nowMs) {
      return res.status(400).json({ error: 'La fecha de creación no puede ser futura.' });
    }
    if (isClosedState) {
      if (!fechaCierreInput) {
        return res.status(400).json({ error: 'La fecha de cierre es requerida para tickets resueltos o cerrados.' });
      }
      if (fechaCierreInput.getTime() > nowMs) {
        return res.status(400).json({ error: 'La fecha de cierre no puede ser futura.' });
      }
      if (fechaCierreInput.getTime() < fechaCreacion.getTime()) {
        return res.status(400).json({ error: 'La fecha de cierre no puede ser anterior a la de creación.' });
      }
    }

    const historicalResolution = isClosedState ? readResolution({ ...req.body, solucionAplicada: req.body?.solucionAplicada || comentarioResolucion }) : {};
    const createdAtIso = fechaCreacion.toISOString();
    const closedAtIso = isClosedState ? fechaCierreInput.toISOString() : null;

    const created = await updateDb((db) => {
      const replay = findTicketCreationReplay(db, idempotency);
      if (replay.status === 'conflict') return { ok: false, code: 'IDEMPOTENCY_CONFLICT' };
      if (replay.status === 'replay') return { ok: true, ticket: replay.ticket, replayed: true };
      const branchCodes = getBranchCodesFromCatalog(db);
      const sucursal = normalizeTicketBranch(sucursalInput, branchCodes);
      if (!sucursal) return { ok: false, code: 'INVALID_BRANCH' };
      const classification = resolveTicketClassification(db.catalogos, { areaId, categoriaId });
      if (!classification) return { ok: false, code: 'INVALID_CLASSIFICATION' };
      const activeArea = db.catalogos.areas.find((item) => item.id === classification.areaId)?.activo !== false;
      const activeCategory = db.catalogos.categorias.find((item) => item.id === classification.categoriaId)?.activo !== false;
      if (!activeArea || !activeCategory) return { ok: false, code: 'INACTIVE_CLASSIFICATION' };
      const requesterUser = db.users.find((item) => Number(item.id) === requestedRequesterUserId && item.activo !== false);
      if (!requesterUser) return { ok: false, code: 'REQUESTER_INVALID' };
      let assignedUser = null;
      if (asignadoA) {
        assignedUser = findTicketAssignee(db.users, asignadoA);
        if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
      }
      const asset = activoTag
        ? db.activos.find((item) => normalizeTextKey(item?.tag) === normalizeTextKey(activoTag))
        : null;
      if (tipoSolicitud === 'INCIDENTE_ACTIVO' && !asset) return { ok: false, code: 'ASSET_NOT_FOUND' };
      if (asset && resolveAssetBranchCode(asset, branchCodes) !== sucursal) return { ok: false, code: 'ASSET_BRANCH_MISMATCH' };

      const historial = [historyEvent({
        fecha: createdAtIso,
        actorId: req.authUser.id,
        actorName: usuario,
        tipo: 'creacion',
        accion: 'Ticket Creado',
        estado: 'Abierto',
        before: null,
        after: { estado: 'Abierto', prioridad, asignadoA: assignedUser?.nombre || '', asignadoAId: assignedUser?.id || null },
        comentario: 'Registro histórico',
      })];
      if (estado !== 'Abierto') {
        historial.unshift(historyEvent({
          fecha: closedAtIso,
          actorId: req.authUser.id,
          actorName: usuario,
          tipo: estado === 'Cerrado' ? 'cierre' : 'solucion',
          accion: ticketAuditAction(estado),
          estado,
          before: { estado: 'Abierto' },
          after: { estado, ...(historicalResolution || {}) },
          comentario: comentarioResolucion || 'Registro histórico',
          ...(historicalResolution || {}),
        }));
      }

      const slaAssignment = createSlaAssignment(prioridad, fechaCreacion.getTime(), createdAtIso);
      const ticket = {
        id: nextId(db),
        tipoSolicitud,
        activoId: asset?.id || null,
        activoTag: asset?.tag || '',
        descripcion,
        ...classification,
        sucursal,
        prioridad,
        atencionTipo,
        ...(hasTrasladoField ? { trasladoRequerido } : {}),
        estado,
        fecha: createdAtIso,
        fechasVersion: 1,
        fechaPrimeraAtencion: null,
        fechaResolucion: null,
        fechaCierre: null,
        fechaCreacion: createdAtIso,
        fechaLimite: slaAssignment.fechaLimite,
        slaActual: slaAssignment,
        ...(closedAtIso ? (estado === 'Resuelto' ? { fechaResolucion: closedAtIso } : { fechaCierre: closedAtIso }) : {}),
        asignadoA: assignedUser ? assignedUser.nombre : '',
        asignadoAId: assignedUser ? Number(assignedUser.id) : null,
        solicitadoPor: requesterUser.nombre,
        solicitadoPorId: Number(requesterUser.id),
        requesterUserId: Number(requesterUser.id),
        solicitadoPorUsername: asNonEmptyString(requesterUser.username).toLowerCase(),
        departamento: asNonEmptyString(requesterUser.departamento).toUpperCase(),
        createdByUserId: Number(req.authUser?.id) || null,
        createdBy: usuario,
        createdByUsername: asNonEmptyString(req.authUser?.username).toLowerCase(),
        esHistorico: true,
        ...historicalResolution,
        insumosUsados: [],
        attachments: [],
        historial,
      };
      syncTicketCycle(ticket).reconstruccionLegacy = Boolean(ticket.esHistorico);
      db.tickets.push(ticket);
      rememberTicketCreation(db, idempotency, ticket.id);

      // Solo recalculamos el estado del activo si el ticket histórico queda activo;
      // un histórico cerrado no debe sobrescribir el estado operativo actual del activo.
      if (asset && keepsAssetInFailureState(estado)) {
        syncAssetOperationalState(db, asset.tag);
      }

      pushAuditWithContext(db, req, {
        accion: 'Ticket Histórico',
        item: `${asset?.tag || 'SERVICIO'} | ${sucursal} | ${estado}`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        after: ticket,
      });
      return { ok: true, ticket };
    });

    if (!created?.ok && created?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a inválido. Debe ser un técnico/admin activo.' });
    }
    if (!created?.ok && created?.code === 'IDEMPOTENCY_CONFLICT') {
      return res.status(409).json({ error: 'La misma Idempotency-Key ya se usó con datos distintos.' });
    }
    if (!created?.ok && created?.code === 'REQUESTER_INVALID') {
      return res.status(400).json({ error: 'El solicitante debe ser un usuario activo.' });
    }
    if (!created?.ok && created?.code === 'INVALID_BRANCH') {
      return res.status(400).json({ error: 'Sucursal inválida para el ticket.' });
    }
    if (!created?.ok && created?.code === 'ASSET_BRANCH_MISMATCH') {
      return res.status(400).json({ error: 'La sucursal del activo debe estar definida y coincidir con la del ticket.' });
    }
    if (!created?.ok && ['INVALID_CLASSIFICATION', 'INACTIVE_CLASSIFICATION'].includes(created?.code)) {
      return res.status(400).json({ error: 'Selecciona un área y una categoría activas y compatibles.' });
    }
    if (!created?.ok && created?.code === 'ASSET_NOT_FOUND') {
      return res.status(400).json({ error: 'El activo indicado no existe.' });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo registrar el ticket histórico.' });
    }

    res.set('Idempotency-Replayed', created.replayed ? 'true' : 'false');
    res.status(created.replayed ? 200 : 201).json(serializeTicket(created.ticket));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.update')) return;
    const id = toInt(req.params.id);
    const estado = req.body?.estado ? normalizeEstadoTicket(req.body?.estado) : null;
    if (estado === 'Cancelado') return res.status(400).json({ error: 'Utiliza Cancelar con un motivo.' });
    const asignadoA = req.body?.asignadoA !== undefined ? asNonEmptyString(req.body?.asignadoA) : undefined;
    const hasAtencionTipoUpdate = req.body?.atencionTipo !== undefined;
    const atencionTipo = hasAtencionTipoUpdate ? normalizeTicketAttentionType(req.body?.atencionTipo) : '';
    const hasTrasladoUpdate = req.body?.trasladoRequerido !== undefined;
    const trasladoRequerido = hasTrasladoUpdate ? normalizeTicketTravelRequired(req.body?.trasladoRequerido) : undefined;
    const hasPriorityUpdate = req.body?.prioridad !== undefined;
    const prioridad = hasPriorityUpdate ? parseTicketPriority(req.body.prioridad) : null;
    const waitReason = req.body?.motivoEspera === undefined ? null : parseTicketWaitReason(req.body.motivoEspera);
    const hasInsumosUpdate = req.body?.insumosUsados !== undefined;
    if (hasInsumosUpdate && !Array.isArray(req.body?.insumosUsados)) {
      return res.status(400).json({ error: 'insumosUsados debe ser una lista.' });
    }
    const parsedSupplyUsage = normalizeSupplyUsageInput(
      Array.isArray(req.body?.insumosUsados) ? req.body.insumosUsados : [],
      { allowZero: true },
    );
    const comentario = asNonEmptyString(req.body?.comentario);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID inválido.' });
    if (!estado && asignadoA === undefined && !comentario && !hasAtencionTipoUpdate && !hasTrasladoUpdate && !hasPriorityUpdate && !hasInsumosUpdate) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }
    if (req.body?.estado !== undefined && !estado) {
      return res.status(400).json({ error: 'Estado de ticket no válido.' });
    }
    if (hasAtencionTipoUpdate && !atencionTipo) {
      return res.status(400).json({ error: 'Tipo de atención no válido.' });
    }
    if (hasTrasladoUpdate && trasladoRequerido === undefined) {
      return res.status(400).json({ error: 'Indicador de traslado no válido.' });
    }
    if (hasPriorityUpdate && !prioridad) {
      return res.status(400).json({ error: 'Prioridad no válida.' });
    }
    if (!parsedSupplyUsage.ok) {
      const message = parsedSupplyUsage.code === 'DUPLICATE_SUPPLY_USAGE'
        ? `El insumo ${parsedSupplyUsage.insumoId} está repetido en insumosUsados.`
        : 'Insumo inválido en insumosUsados.';
      return res.status(400).json({ error: message });
    }

    const updated = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      assertTicketMutable(ticket);

      const reopening = isTicketReopening(ticket.estado, estado);
      if (estado && !canTransitionTicket(ticket.estado, estado)) {
        throw Object.assign(new Error('Transicion no permitida. Reabre formalmente los tickets terminados.'), { status: 409 });
      }
      if (estado === 'En Espera' && ticket.estado !== 'En Espera' && !waitReason) {
        throw Object.assign(new Error('Selecciona un motivo de espera válido para aplicar su regla de SLA.'), { status: 400 });
      }
      if (ticket.estado === 'Cerrado' && !reopening) {
        throw Object.assign(new Error('El ticket cerrado requiere reapertura antes de editarse.'), { status: 409 });
      }
      if (hasPriorityUpdate && CLOSED_STATES.has(ticket.estado) && !reopening) {
        throw Object.assign(new Error('Reabre el ticket antes de reclasificar su prioridad.'), { status: 409 });
      }
      const motivoReapertura = asNonEmptyString(req.body?.motivoReapertura);
      if (reopening && (!motivoReapertura || motivoReapertura.length > 2000)) {
        throw Object.assign(new Error('La reapertura requiere un motivo de 1 a 2000 caracteres.'), { status: 400 });
      }
      const reopeningMetadata = reopening ? { motivo: motivoReapertura, usuarioId: req.authUser.id,
        usuario, fecha: new Date().toISOString(), estadoAnterior: ticket.estado } : null;

      const resolution = estado === 'Resuelto' ? readResolution(req.body) : null;
      let nextAssignee;
      let nextAssigneeId;
      let correoDelNuevoResponsable = '';
      let assignedUserId = null;
      const responsablePrevio = String(ticket.asignadoA || '').trim();
      const responsablePrevioId = Number(ticket.asignadoAId) || null;
      if (asignadoA !== undefined) {
        if (!asignadoA) {
          nextAssignee = '';
          nextAssigneeId = null;
        } else {
          const assignedUser = findTicketAssignee(db.users, asignadoA);
          if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
          nextAssignee = assignedUser.nombre;
          nextAssigneeId = Number(assignedUser.id);
          correoDelNuevoResponsable = assignedUser.email || '';
          assignedUserId = assignedUser.id;
        }
      }

      const supplyUsage = hasInsumosUpdate
        ? prepareSupplyUsage(db, parsedSupplyUsage.items, ticket.insumosUsados)
        : null;
      if (supplyUsage && !supplyUsage.ok) return supplyUsage;

      if (reopeningMetadata) ticket.ultimaReapertura = reopeningMetadata;
      const previousState = ticket.estado;
      const previousPriority = ticket.prioridad;
      const previousDueDate = ticket.fechaLimite || null;
      const previousAttentionType = normalizeTicketAttentionType(ticket.atencionTipo);
      const previousTravelRequired = ticket.trasladoRequerido === true;
      if (resolution) Object.assign(ticket, resolution);
      if (estado) ticket.estado = estado;
      if (nextAssignee !== undefined) ticket.asignadoA = nextAssignee;
      if (nextAssigneeId !== undefined) ticket.asignadoAId = nextAssigneeId;
      if (hasAtencionTipoUpdate) ticket.atencionTipo = atencionTipo;
      if (hasTrasladoUpdate) ticket.trasladoRequerido = trasladoRequerido;
      if (hasPriorityUpdate) ticket.prioridad = prioridad;
      const attentionChanged = hasAtencionTipoUpdate && atencionTipo !== previousAttentionType;
      const travelChanged = hasTrasladoUpdate && trasladoRequerido !== previousTravelRequired;
      const priorityChanged = hasPriorityUpdate && prioridad !== previousPriority;
      const assigneeChanged = nextAssignee !== undefined
        && (nextAssigneeId !== responsablePrevioId || nextAssignee !== responsablePrevio);

      if (priorityChanged && !reopening) {
        const currentCycle = syncTicketCycle(ticket);
        const cycleStartedAt = Date.parse(currentCycle.fechaInicio || ticket.fechaCreacion || '');
        const changedAt = new Date().toISOString();
        const slaAssignment = createSlaAssignment(
          ticket.prioridad,
          Number.isFinite(cycleStartedAt) ? cycleStartedAt : Date.now(),
          changedAt,
        );
        assignSlaToCurrentCycle(ticket, slaAssignment, {
          fecha: changedAt,
          motivo: 'CAMBIO_PRIORIDAD',
          actorId: Number(req.authUser.id),
          prioridadAnterior: previousPriority,
          prioridadNueva: prioridad,
        });
      }

      const stateChanged = !!estado && estado !== previousState;
      const milestoneAt = new Date().toISOString();
      const reopeningSla = isTicketReopening(previousState, ticket.estado)
        ? createSlaAssignment(ticket.prioridad, Date.parse(milestoneAt), milestoneAt)
        : null;
      const waitEvent = stateChanged && (previousState === 'En Espera' || ticket.estado === 'En Espera')
        ? recordTicketWaitTransition(ticket, previousState, milestoneAt, waitReason, Number(req.authUser.id))
        : null;
      recordTicketMilestones(ticket, previousState, milestoneAt, reopeningSla);

      if (stateChanged) {
        syncAssetOperationalState(db, ticket.activoTag);
      }

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      const historyEvents = [];
      if (priorityChanged) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: 'prioridad', accion: 'Prioridad Ticket', estado: ticket.estado,
          before: { prioridad: previousPriority, fechaLimite: previousDueDate },
          after: { prioridad, fechaLimite: ticket.fechaLimite },
          prioridadAnterior: previousPriority, prioridadNueva: prioridad,
          fechaLimiteAnterior: previousDueDate, fechaLimiteNueva: ticket.fechaLimite,
        }));
      }
      if (assigneeChanged) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario,
          tipo: responsablePrevio ? 'reasignacion' : 'asignacion', accion: responsablePrevio ? 'Ticket Reasignado' : 'Ticket Asignado',
          estado: ticket.estado,
          before: { asignadoA: responsablePrevio, asignadoAId: responsablePrevioId },
          after: { asignadoA: ticket.asignadoA, asignadoAId: ticket.asignadoAId },
        }));
      }
      if (stateChanged) {
        const eventType = reopening ? 'reapertura'
          : ticket.estado === 'Resuelto' ? 'solucion'
          : ticket.estado === 'Cerrado' ? 'cierre'
          : 'estado';
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: eventType,
          accion: reopening ? 'Ticket Reabierto' : ticketAuditAction(ticket.estado), estado: ticket.estado,
          before: { estado: previousState },
          after: { estado: ticket.estado, ...(resolution || {}) },
          comentario: resolution?.solucionAplicada || comentario || motivoReapertura || '',
          ...(reopeningMetadata ? { anterior: previousState, nuevo: estado, motivo: motivoReapertura } : {}),
          ...(waitEvent ? { espera: waitEvent } : {}),
          ...(resolution || {}),
        }));
      }
      if (attentionChanged) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: 'atencion', accion: 'Tipo Atención Ticket', estado: ticket.estado,
          before: { atencionTipo: previousAttentionType || null }, after: { atencionTipo },
        }));
      }
      if (travelChanged) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: 'traslado', accion: 'Traslado Ticket', estado: ticket.estado,
          before: { trasladoRequerido: previousTravelRequired }, after: { trasladoRequerido },
        }));
      }
      if (comentario && !resolution) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: 'comentario', accion: 'Comentario', estado: ticket.estado,
          comentario,
        }));
      }
      if (historyEvents.length === 0) {
        historyEvents.push(historyEvent({
          actorId: req.authUser.id, actorName: usuario, tipo: 'actualizacion', accion: 'Ticket Actualizado', estado: ticket.estado,
          before: null, after: null,
        }));
      }
      ticket.historial.unshift(...historyEvents);

      if (estado && estado !== previousState) {
        pushAuditWithContext(db, req, {
          accion: ticketAuditAction(estado),
          item: ticket.activoTag,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (asignadoA !== undefined) {
        pushAuditWithContext(db, req, {
          accion: 'Asignación Ticket',
          item: ticket.activoTag,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (attentionChanged) {
        pushAuditWithContext(db, req, {
          accion: 'Tipo Atención Ticket',
          item: `${ticket.activoTag} | ${atencionTipo}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (travelChanged) {
        pushAuditWithContext(db, req, {
          accion: 'Traslado Ticket',
          item: `${ticket.activoTag} | ${trasladoRequerido ? 'SI' : 'NO'}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (priorityChanged) {
        pushAuditWithContext(db, req, {
          accion: 'Prioridad Ticket',
          item: `${ticket.activoTag} | ${previousPriority} -> ${prioridad}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
          meta: { prioridadAnterior: previousPriority, prioridadNueva: prioridad,
            fechaLimiteAnterior: previousDueDate, fechaLimiteNueva: ticket.fechaLimite },
        });
      }

      if (hasInsumosUpdate) {
        ticket.insumosUsados = supplyUsage.items;
        for (const { supply, stockDelta } of supplyUsage.operations) {
          if (stockDelta === 0) continue;
          supply.stock -= stockDelta;
          pushAuditWithContext(db, req, {
            accion: stockDelta > 0 ? 'Salida (Ticket)' : 'Ajuste Entrada (Ticket)',
            item: supply.nombre,
            cantidad: Math.abs(stockDelta),
            usuario,
            modulo: 'insumos',
            entidad: 'insumo',
            entidadId: supply.id,
            after: supply,
            meta: { ticketId: ticket.id }
          });
        }
      }

      // Solo cuando la asignacion cambia de verdad y hay un responsable nuevo: reasignar
      // al mismo tecnico, o dejar el ticket sin asignar, no genera aviso.
      const cambioDeResponsable = assigneeChanged
        && Boolean(nextAssignee);

      return {
        ok: true,
        ticket,
        avisarAsignacionA: cambioDeResponsable ? correoDelNuevoResponsable : '',
        usuariosParaAvisoResolucion: stateChanged && ticket.estado === 'Resuelto'
          ? snapshotUsuariosParaAviso(db)
          : [],
        pushAssigneeId: cambioDeResponsable ? assignedUserId : null,
        pushSubscriptions: cambioDeResponsable ? snapshotPushSubscriptions(db) : [],
      };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a inválido. Debe ser un técnico/admin activo.' });
    }
    if (!updated?.ok && sendSupplyUsageError(res, updated)) return;
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el ticket.' });
    }

    if (updated.avisarAsignacionA) {
      const assignmentEvent = updated.ticket.historial.find((event) => ['asignacion', 'reasignacion'].includes(event.tipo));
      avisarConfiablemente({
        ticket: updated.ticket,
        tipo: `asignacion:${updated.ticket.asignadoAId || 'sin-id'}:${assignmentEvent?.fecha || 'actual'}`,
        plan: { destinatarios: [updated.avisarAsignacionA], motivo: MOTIVOS.ASIGNADO },
      });
    }
    if (updated.usuariosParaAvisoResolucion.length > 0) {
      avisarConfiablemente({
        ticket: updated.ticket,
        tipo: `resuelto:${updated.ticket.cicloActualId || updated.ticket.fechaResolucion || 'legacy'}`,
        plan: planDeAvisoAlResolver(updated.ticket, updated.usuariosParaAvisoResolucion),
      });
    }
    // Una asignación ocurre después de crear el ticket y, a diferencia del correo,
    // necesita el id interno para ubicar solo los dispositivos del nuevo responsable.
    if (updated.pushAssigneeId) {
      void notifyTicketAssigned({
        ticket: updated.ticket,
        assigneeId: updated.pushAssigneeId,
        subscriptions: updated.pushSubscriptions,
      }).catch((error) => console.error(`No se pudo preparar el push de asignación del ticket #${updated.ticket.id}:`, error));
    }
    res.json(serializeTicket(updated.ticket));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.resolve')) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    const comentario = asNonEmptyString(req.body?.solucionAplicada);
    if (id === null) return res.status(400).json({ error: 'ID inválido.' });

    const resolved = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return null;
      assertTicketMutable(ticket);

      const previousState = ticket.estado;
      if (!canTransitionTicket(previousState, 'Resuelto')) throw Object.assign(new Error('Reabre el ticket antes de resolverlo.'), { status: 409 });
      const resolution = readResolution(req.body);
      Object.assign(ticket, resolution);
      ticket.estado = 'Resuelto';
      const resolvedAt = new Date().toISOString();
      recordTicketWaitTransition(ticket, previousState, resolvedAt, null, Number(req.authUser.id));
      recordTicketMilestones(ticket, previousState, resolvedAt);
      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift(historyEvent({
        fecha: resolvedAt,
        actorId: req.authUser.id,
        actorName: usuario,
        tipo: 'solucion',
        accion: 'Ticket Resuelto',
        estado: 'Resuelto',
        before: { estado: previousState },
        after: { estado: 'Resuelto', ...resolution },
        comentario,
        ...resolution,
      }));

      syncAssetOperationalState(db, ticket.activoTag);
      pushAuditWithContext(db, req, {
        accion: 'Ticket Resuelto',
        item: ticket.activoTag,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        after: ticket,
      });
      return { ticket, usuariosParaAviso: snapshotUsuariosParaAviso(db) };
    });

    if (!resolved) return res.status(404).json({ error: 'Ticket no encontrado.' });
    avisarConfiablemente({
      ticket: resolved.ticket,
      tipo: `resuelto:${resolved.ticket.cicloActualId || resolved.ticket.fechaResolucion || 'legacy'}`,
      plan: planDeAvisoAlResolver(resolved.ticket, resolved.usuariosParaAviso),
    });
    res.json(serializeTicket(resolved.ticket));
  } catch (error) {
    next(error);
  }
});

// Physical purge is disabled until an approved administrative retention policy exists.
router.delete('/:id', requireAuth, (_req, res) => res.status(403).json({
  error: 'La purga de expedientes esta deshabilitada. Utiliza cancelar o archivar con motivo.',
}));

router.post('/:id/retention', requireAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const motivo = asNonEmptyString(req.body?.motivo);
    const accion = req.body?.accion;
    if (id === null || !motivo || motivo.length > 2000 || !['cancelar', 'archivar'].includes(accion)) {
      return res.status(400).json({ error: 'Indica una accion y un motivo de 1 a 2000 caracteres.' });
    }
    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => item.id === id);
      if (!ticket) return { status: 404, error: 'Ticket no encontrado.' };
      const editor = canEditByRole(req.authUser.rol);
      const owner = req.authUser.rol === 'solicitante' && ticketBelongsToUser(ticket, req.authUser);
      if (!editor && !(owner && accion === 'cancelar' && ticket.estado === 'Abierto')) {
        return { status: 403, error: 'No autorizado para esta accion.' };
      }
      if (ticket.archivo || (accion === 'cancelar' && CLOSED_STATES.has(ticket.estado))
        || (accion === 'archivar' && !CLOSED_STATES.has(ticket.estado))) {
        return { status: 409, error: 'Solo se cancelan pendientes y se archivan expedientes terminados.' };
      }
      const fecha = new Date().toISOString();
      const metadata = { motivo, usuarioId: req.authUser.id, usuario: req.authUser.nombre, fecha, estadoAnterior: ticket.estado };
      if (accion === 'cancelar') {
        ticket.cancelacion = metadata;
        ticket.estado = 'Cancelado';
      } else ticket.archivo = metadata;
      syncTicketCycle(ticket);
      const label = accion === 'cancelar' ? 'Ticket Cancelado' : 'Ticket Archivado';
      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift(historyEvent({ fecha, actorId: metadata.usuarioId, actorName: metadata.usuario,
        tipo: accion === 'cancelar' ? 'cancelacion' : 'archivo', accion: label, estado: ticket.estado,
        before: { estado: metadata.estadoAnterior }, after: { estado: ticket.estado },
        anterior: metadata.estadoAnterior, nuevo: ticket.estado, comentario: motivo }));
      syncAssetOperationalState(db, ticket.activoTag);
      pushAuditWithContext(db, req, { accion: label, item: ticket.activoTag, cantidad: 1,
        usuario: metadata.usuario, modulo: 'tickets', entidad: 'ticket', entidadId: id, meta: metadata });
      return { status: 200, ticket };
    });
    return res.status(result.status).json(result.error ? { error: result.error } : result.ticket);
  } catch (error) { next(error); }
});

router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.comment')) return;
    const id = toInt(req.params.id);
    const comentario = asNonEmptyString(req.body?.comentario);
    const requiereRespuesta = req.body?.requiereRespuesta === true;
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID inválido.' });
    if (!comentario) return res.status(400).json({ error: 'Comentario requerido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      if (!canAccessTicketByAuthUser(req, ticket)) return { ok: false, code: 'FORBIDDEN' };

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      const fecha = new Date().toISOString();
      ticket.historial.unshift(historyEvent({
        fecha,
        actorId: req.authUser.id,
        actorName: usuario,
        tipo: 'comentario',
        accion: 'Comentario',
        estado: ticket.estado,
        comentario,
        requiereRespuesta,
      }));

      pushAuditWithContext(db, req, {
        accion: 'Comentario Ticket',
        item: ticket.activoTag,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        meta: { comentario, requiereRespuesta },
      });
      return {
        ok: true,
        ticket,
        fecha,
        usuariosParaAviso: requiereRespuesta ? snapshotUsuariosParaAviso(db) : [],
      };
    });

    if (!result?.ok && result?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!result?.ok && result?.code === 'FORBIDDEN') {
      return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo guardar el comentario.' });
    }
    if (requiereRespuesta) {
      avisarConfiablemente({
        ticket: {
          ...result.ticket,
          comentarioRelevante: comentario,
          comentarioAutor: usuario,
          comentarioFecha: result.fecha,
        },
        tipo: `comentario:${result.fecha}:${req.authUser.id}`,
        plan: planDeAvisoDeComentario(result.ticket, result.usuariosParaAviso, req.authUser),
      });
    }
    res.status(201).json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/attachments', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.attach')) return;
    const id = toInt(req.params.id);
    const fileName = sanitizeUploadFileName(req.body?.fileName);
    const mimeType = asNonEmptyString(req.body?.mimeType || req.body?.contentType) || 'application/octet-stream';
    const contentBase64 = asNonEmptyString(req.body?.contentBase64);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID inválido.' });
    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: 'fileName y contentBase64 son requeridos.' });
    }

    let contentBuffer;
    try {
      contentBuffer = Buffer.from(contentBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Adjunto en base64 inválido.' });
    }
    if (!contentBuffer || contentBuffer.length === 0) {
      return res.status(400).json({ error: 'Adjunto vacío.' });
    }
    if (contentBuffer.length > TICKET_ATTACHMENT_MAX_BYTES) {
      return res.status(413).json({ error: `Adjunto excede limite de ${Math.round(TICKET_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB.` });
    }

    const storedName = `tk_${id}_${Date.now()}_${randomUUID()}_${fileName}`;
    const storagePath = path.join('uploads', storedName).replace(/\\/g, '/');
    if (!toAbsoluteAttachmentPath(storagePath)) {
      return res.status(500).json({ error: 'No se pudo preparar almacenamiento del adjunto.' });
    }

    let fileSaved = false;
    let persisted = false;
    try {
      // Con Neon configurado los bytes van a la tabla de adjuntos, no al disco del contenedor.
      await attachmentStore.save({
        ticketId: id,
        fileName,
        mimeType,
        content: contentBuffer,
        storagePath,
      });
      fileSaved = true;

      const result = await updateDb((db) => {
        const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
        if (!ticket) return { ok: false, code: 'NOT_FOUND' };
        if (!canAccessTicketByAuthUser(req, ticket)) return { ok: false, code: 'FORBIDDEN' };

        ticket.attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
        if (ticket.attachments.length >= TICKET_ATTACHMENT_MAX_COUNT) {
          return { ok: false, code: 'MAX_ATTACHMENTS' };
        }

        const attachmentId = nextId(db);
        const attachment = {
          id: attachmentId,
          fileName,
          storagePath,
          mimeType,
          size: contentBuffer.length,
          uploadedAt: new Date().toISOString(),
          uploadedBy: usuario,
        };

        ticket.attachments.unshift(attachment);
        ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
        ticket.historial.unshift(historyEvent({
          actorId: req.authUser.id,
          actorName: usuario,
          tipo: 'adjunto',
          accion: 'Adjunto agregado',
          estado: ticket.estado,
          before: null,
          after: { attachmentId, fileName, mimeType, size: contentBuffer.length },
          comentario: fileName,
        }));

        pushAuditWithContext(db, req, {
          accion: 'Adjunto Ticket',
          item: `${ticket.activoTag} | ${fileName}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          meta: { attachmentName: fileName, size: contentBuffer.length },
        });

        return { ok: true, ticket, attachment };
      });

      if (!result?.ok && result?.code === 'NOT_FOUND') {
        if (fileSaved) await attachmentStore.remove({ storagePath }).catch(() => undefined);
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }
      if (!result?.ok && result?.code === 'FORBIDDEN') {
        if (fileSaved) await attachmentStore.remove({ storagePath }).catch(() => undefined);
        return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
      }
      if (!result?.ok && result?.code === 'MAX_ATTACHMENTS') {
        if (fileSaved) await attachmentStore.remove({ storagePath }).catch(() => undefined);
        return res.status(409).json({ error: `Limite de ${TICKET_ATTACHMENT_MAX_COUNT} adjuntos por ticket alcanzado.` });
      }
      if (!result?.ok) {
        if (fileSaved) await attachmentStore.remove({ storagePath }).catch(() => undefined);
        return res.status(500).json({ error: 'No se pudo guardar el adjunto.' });
      }

      persisted = true;
      return res.status(201).json({
        attachment: buildTicketAttachmentResponse(result.attachment),
        ticket: serializeTicket(result.ticket),
      });
    } catch (error) {
      if (fileSaved && !persisted) {
        await attachmentStore.remove({ storagePath }).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.get('/:id/attachments/:attachmentId/download', requireAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID inválido.' });

    const db = await getRequestDb(req);
    const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!canAccessTicketByAuthUser(req, ticket)) {
      return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
    }
    const attachment = Array.isArray(ticket.attachments)
      ? ticket.attachments.find((item) => Number(item.id) === Number(attachmentId))
      : null;
    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado.' });

    // Busca primero en la base; cae a disco para los adjuntos anteriores a la migración.
    const content = await attachmentStore.read({ storagePath: attachment.storagePath });
    if (!content) return res.status(404).json({ error: 'Archivo adjunto no disponible.' });

    const fileName = sanitizeUploadFileName(attachment.fileName || `adjunto_${attachmentId}`);
    const rawMime = asNonEmptyString(attachment.mimeType).toLowerCase();
    const safeMime = SAFE_DOWNLOAD_MIME_TYPES.has(rawMime) ? rawMime : 'application/octet-stream';
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Length', String(content.length));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/attachments/:attachmentId', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'tickets.attachments.delete')) return;
    const id = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    const { usuario } = getRequestActor(req);
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID inválido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      assertTicketMutable(ticket);
      ticket.attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
      const index = ticket.attachments.findIndex((item) => Number(item.id) === Number(attachmentId));
      if (index < 0) return { ok: false, code: 'ATTACHMENT_NOT_FOUND' };

      const [attachment] = ticket.attachments.splice(index, 1);

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift(historyEvent({
        actorId: req.authUser.id,
        actorName: usuario,
        tipo: 'adjunto',
        accion: 'Adjunto eliminado',
        estado: ticket.estado,
        before: { attachmentId: attachment.id, fileName: attachment.fileName, mimeType: attachment.mimeType, size: attachment.size },
        after: null,
        comentario: attachment.fileName,
      }));

      pushAuditWithContext(db, req, {
        accion: 'Adjunto Ticket',
        item: `${ticket.activoTag} | ${attachment.fileName} | eliminado`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        meta: { attachmentName: attachment.fileName, removed: true },
      });
      return { ok: true, ticket, removedStoragePath: attachment.storagePath };
    });

    if (!result?.ok && result?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!result?.ok && result?.code === 'ATTACHMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Adjunto no encontrado.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el adjunto.' });
    }
    await attachmentStore.remove({ storagePath: result.removedStoragePath }).catch(() => undefined);
    res.json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = await getRequestDb(req);
    const id = toInt(req.params.id);
    const ticket = db.tickets.find((item) => item.id === id);
    if (!ticket || filterTicketsForUser([ticket], req.authUser).length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(serializeTicket(ticket));
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = await getRequestDb(req);
    const estado = req.query.estado ? normalizeEstadoTicket(req.query.estado) : null;
    const prioridad = req.query.prioridad ? normalizePrioridad(req.query.prioridad) : null;
    const atencionTipo = req.query.atencion !== undefined ? normalizeTicketAttentionType(req.query.atencion) : '';
    const onlyOpen = req.query.open === '1';
    const onlySla = req.query.sla === 'vencido';
    const lifecycle = asNonEmptyString(req.query.lifecycle).toUpperCase();
    const sucursal = asNonEmptyString(req.query.sucursal).toUpperCase();
    const assignee = asNonEmptyString(req.query.assignee);
    const search = asNonEmptyString(req.query.search);
    const withPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    if (req.query.atencion !== undefined && !atencionTipo) {
      return res.status(400).json({ error: 'Filtro de atención inválido.' });
    }

    let list = filterTicketsForUser(db.tickets.slice(), req.authUser);
    if (estado) list = list.filter((t) => t.estado === estado);
    if (prioridad) list = list.filter((t) => t.prioridad === prioridad);
    if (atencionTipo) list = list.filter((t) => normalizeTicketAttentionType(t.atencionTipo) === atencionTipo);
    if (onlyOpen) list = list.filter((t) => !CLOSED_STATES.has(t.estado));
    if (onlySla) list = list.filter((t) => isSlaBreached(t));
    if (lifecycle === 'ABIERTOS') list = list.filter((t) => !CLOSED_STATES.has(t.estado));
    if (lifecycle === 'CERRADOS') list = list.filter((t) => CLOSED_STATES.has(t.estado));
    if (sucursal) list = list.filter((t) => asNonEmptyString(t.sucursal).toUpperCase() === sucursal);
    if (assignee === '__NONE__') list = list.filter((t) => !asNonEmptyString(t.asignadoA));
    if (assignee && assignee !== '__NONE__') {
      const key = normalizeTextKey(assignee);
      list = list.filter((t) => normalizeTextKey(t.asignadoA || '') === key);
    }
    if (search) {
      const branchesByCode = new Map(
        (db.catalogos?.sucursales || []).map((branch) => [asNonEmptyString(branch?.code).toUpperCase(), branch]),
      );
      const assetsById = new Map((db.activos || []).map((asset) => [Number(asset?.id), asset]));
      const assetsByTag = new Map((db.activos || []).map((asset) => [normalizeTextKey(asset?.tag), asset]));
      list = list.filter((ticket) => {
        const asset = (ticket.activoId ? assetsById.get(Number(ticket.activoId)) : undefined)
          || assetsByTag.get(normalizeTextKey(ticket.activoTag));
        const branch = branchesByCode.get(asNonEmptyString(ticket.sucursal).toUpperCase());
        return ticketMatchesSearch(ticket, search, {
          asset,
          branchLabel: branch?.name || branch?.nombre || '',
        });
      });
    }

    list.sort((a, b) => {
      const leftTs = new Date(a.fechaCreacion || a.fecha || 0).getTime() || 0;
      const rightTs = new Date(b.fechaCreacion || b.fecha || 0).getTime() || 0;
      return rightTs - leftTs;
    });

    if (!withPagination) {
      return res.json(list.map(serializeTicketSummary));
    }

    const { page, pageSize } = parsePagination(req.query);
    const paged = paginateList(list, page, pageSize);

    res.json({
      ...paged,
      items: paged.items.map(serializeTicketSummary),
    });
  } catch (error) {
    next(error);
  }
});

  return router;
}
