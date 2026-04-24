import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { readDb, updateDb, now, nextId } from '../store.js';

export function createTicketsRouter({
  requireAuth,
  ensureCanCreateTickets,
  asNonEmptyString,
  normalizePrioridad,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
  canEditByRole,
  getRequestActor,
  getBranchCodesFromCatalog,
  normalizeTicketBranch,
  findTicketAssignee,
  calcDueDate,
  pushAuditWithContext,
  serializeTicket,
  ensureCanEdit,
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
  ensureUploadDir,
  TICKET_ATTACHMENT_MAX_COUNT,
  buildTicketAttachmentResponse,
  filterTicketsForUser,
  isSlaBreached,
  parsePagination,
  paginateList,
}) {
  const router = express.Router();
  const ACTIVE_ASSET_TICKET_STATES = new Set(['Abierto', 'En Proceso']);

  function syncAssetOperationalState(db, activoTag) {
    const tagKey = normalizeTextKey(activoTag);
    if (!tagKey) return;

    const activo = db.activos.find((item) => normalizeTextKey(item?.tag) === tagKey);
    if (!activo) return;

    const hasRelatedOpenTickets = db.tickets.some((item) => (
      normalizeTextKey(item?.activoTag) === tagKey
      && ACTIVE_ASSET_TICKET_STATES.has(item.estado)
    ));
    activo.estado = hasRelatedOpenTickets ? 'Falla' : 'Operativo';
  }

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const activoTag = asNonEmptyString(req.body?.activoTag);
    const descripcion = asNonEmptyString(req.body?.descripcion);
    const sucursalInput = req.body?.sucursal;
    const prioridad = normalizePrioridad(req.body?.prioridad);
    const atencionTipo = normalizeTicketAttentionType(req.body?.atencionTipo);
    const hasTrasladoField = req.body?.trasladoRequerido !== undefined;
    const trasladoRequerido = hasTrasladoField ? normalizeTicketTravelRequired(req.body?.trasladoRequerido) : undefined;
    const asignadoA = canEditByRole(req.authUser?.rol) ? asNonEmptyString(req.body?.asignadoA) : '';
    const { usuario, departamento } = getRequestActor(req);

    if (!activoTag || !descripcion || !asNonEmptyString(sucursalInput) || !atencionTipo) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para ticket.' });
    }
    if (hasTrasladoField && trasladoRequerido === undefined) {
      return res.status(400).json({ error: 'Indicador de traslado no valido.' });
    }

    const created = await updateDb((db) => {
      const branchCodes = getBranchCodesFromCatalog(db);
      const sucursal = normalizeTicketBranch(sucursalInput, branchCodes);
      if (!sucursal) return { ok: false, code: 'INVALID_BRANCH' };
      let assignedUser = null;
      if (asignadoA) {
        assignedUser = findTicketAssignee(db.users, asignadoA);
        if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
      }

      const createdAtIso = new Date().toISOString();
      const ticket = {
        id: nextId(db),
        activoTag,
        descripcion,
        sucursal,
        prioridad,
        atencionTipo,
        ...(trasladoRequerido !== undefined ? { trasladoRequerido } : {}),
        estado: 'Abierto',
        fecha: now(),
        fechaCreacion: createdAtIso,
        fechaLimite: calcDueDate(prioridad),
        asignadoA: assignedUser ? assignedUser.nombre : '',
        solicitadoPor: usuario,
        solicitadoPorId: Number(req.authUser?.id) || null,
        solicitadoPorUsername: asNonEmptyString(req.authUser?.username).toLowerCase(),
        departamento,
        attachments: [],
        historial: [
          {
            fecha: now(),
            usuario,
            accion: 'Ticket Creado',
            estado: 'Abierto',
            comentario: 'Registro inicial',
          },
        ],
      };
      db.tickets.push(ticket);

      if (prioridad === 'CRITICA') {
        const activo = db.activos.find((a) => a.tag.toUpperCase() === activoTag.toUpperCase());
        if (activo) activo.estado = 'Falla';
      }

      pushAuditWithContext(db, req, {
        accion: 'Nuevo Ticket',
        item: `${activoTag} | ${sucursal} | ${atencionTipo}${trasladoRequerido ? ' | TRASLADO' : ''}`,
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
      return res.status(400).json({ error: 'Asignado a invalido. Debe ser un tecnico/admin activo.' });
    }
    if (!created?.ok && created?.code === 'INVALID_BRANCH') {
      return res.status(400).json({ error: 'Sucursal invalida para el ticket.' });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo crear el ticket.' });
    }

    res.status(201).json(serializeTicket(created.ticket));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const estado = req.body?.estado ? normalizeEstadoTicket(req.body?.estado) : null;
    const asignadoA = req.body?.asignadoA !== undefined ? asNonEmptyString(req.body?.asignadoA) : undefined;
    const hasAtencionTipoUpdate = req.body?.atencionTipo !== undefined;
    const atencionTipo = hasAtencionTipoUpdate ? normalizeTicketAttentionType(req.body?.atencionTipo) : '';
    const hasTrasladoUpdate = req.body?.trasladoRequerido !== undefined;
    const trasladoRequerido = hasTrasladoUpdate ? normalizeTicketTravelRequired(req.body?.trasladoRequerido) : undefined;
    const comentario = asNonEmptyString(req.body?.comentario);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!estado && asignadoA === undefined && !comentario && !hasAtencionTipoUpdate && !hasTrasladoUpdate) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }
    if (req.body?.estado && !estado) {
      return res.status(400).json({ error: 'Estado de ticket no valido.' });
    }
    if (hasAtencionTipoUpdate && !atencionTipo) {
      return res.status(400).json({ error: 'Tipo de atencion no valido.' });
    }
    if (hasTrasladoUpdate && trasladoRequerido === undefined) {
      return res.status(400).json({ error: 'Indicador de traslado no valido.' });
    }

    const updated = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };

      let nextAssignee;
      if (asignadoA !== undefined) {
        if (!asignadoA) {
          nextAssignee = '';
        } else {
          const assignedUser = findTicketAssignee(db.users, asignadoA);
          if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
          nextAssignee = assignedUser.nombre;
        }
      }

      const previousState = ticket.estado;
      const previousAttentionType = normalizeTicketAttentionType(ticket.atencionTipo);
      const previousTravelRequired = ticket.trasladoRequerido === true;
      if (estado) ticket.estado = estado;
      if (nextAssignee !== undefined) ticket.asignadoA = nextAssignee;
      if (hasAtencionTipoUpdate) ticket.atencionTipo = atencionTipo;
      if (hasTrasladoUpdate) ticket.trasladoRequerido = trasladoRequerido;
      const attentionChanged = hasAtencionTipoUpdate && atencionTipo !== previousAttentionType;
      const travelChanged = hasTrasladoUpdate && trasladoRequerido !== previousTravelRequired;

      const stateChanged = !!estado && estado !== previousState;
      if (CLOSED_STATES.has(ticket.estado)) {
        if (stateChanged && !CLOSED_STATES.has(previousState)) {
          ticket.fechaCierre = new Date().toISOString();
        }
      } else if (ticket.fechaCierre) {
        delete ticket.fechaCierre;
      }

      if (stateChanged) {
        syncAssetOperationalState(db, ticket.activoTag);
      }

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: estado
          ? ticketAuditAction(ticket.estado)
          : attentionChanged
            ? 'Tipo Atencion Ticket'
            : travelChanged
              ? 'Traslado Ticket'
              : 'Ticket Actualizado',
        estado: ticket.estado,
        comentario: comentario || '',
      });

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
          accion: 'Asignacion Ticket',
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
          accion: 'Tipo Atencion Ticket',
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

      return { ok: true, ticket };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a invalido. Debe ser un tecnico/admin activo.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el ticket.' });
    }
    res.json(serializeTicket(updated.ticket));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    const comentario = asNonEmptyString(req.body?.comentario) || 'Ticket resuelto';
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const resolved = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return null;

      const previousState = ticket.estado;
      ticket.estado = 'Resuelto';
      if (!CLOSED_STATES.has(previousState)) {
        ticket.fechaCierre = new Date().toISOString();
      }
      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Ticket Resuelto',
        estado: 'Resuelto',
        comentario,
      });

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
      return ticket;
    });

    if (!resolved) return res.status(404).json({ error: 'Ticket no encontrado.' });
    res.json(serializeTicket(resolved));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const removed = await updateDb((db) => {
      const index = db.tickets.findIndex((item) => Number(item.id) === Number(id));
      if (index < 0) return { ok: false, code: 'NOT_FOUND' };

      const ticket = db.tickets[index];
      const role = req.authUser?.rol || '';
      const isEditor = canEditByRole(role);
      const isTicketOwnerRequester = role === 'solicitante' && ticketBelongsToUser(ticket, req.authUser);
      if (!isEditor && !isTicketOwnerRequester) return { ok: false, code: 'FORBIDDEN' };
      if (isTicketOwnerRequester && ticket.estado !== 'Abierto') return { ok: false, code: 'LOCKED' };

      const [deleted] = db.tickets.splice(index, 1);
      const attachmentPaths = Array.isArray(deleted.attachments)
        ? deleted.attachments
          .map((item) => asNonEmptyString(item?.storagePath))
          .filter(Boolean)
        : [];

      if (ACTIVE_ASSET_TICKET_STATES.has(deleted.estado)) {
        syncAssetOperationalState(db, deleted.activoTag);
      }

      pushAuditWithContext(db, req, {
        accion: 'Ticket Eliminado',
        item: `${deleted.activoTag} | #${deleted.id}`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: deleted.id,
        before: deleted,
      });
      return { ok: true, ticket: deleted, attachmentPaths };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'FORBIDDEN') {
      return res.status(403).json({ error: 'No autorizado para eliminar este ticket.' });
    }
    if (!removed?.ok && removed?.code === 'LOCKED') {
      return res.status(409).json({ error: 'Solo puedes eliminar tickets abiertos creados por ti.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el ticket.' });
    }

    for (const path of removed.attachmentPaths) {
      const absPath = toAbsoluteAttachmentPath(path);
      if (absPath) {
        await fs.unlink(absPath).catch(() => undefined);
      }
    }

    res.json({ ok: true, removedId: removed.ticket.id });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const id = toInt(req.params.id);
    const comentario = asNonEmptyString(req.body?.comentario);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!comentario) return res.status(400).json({ error: 'Comentario requerido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      if (!canAccessTicketByAuthUser(req, ticket)) return { ok: false, code: 'FORBIDDEN' };

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Comentario',
        estado: ticket.estado,
        comentario,
      });

      pushAuditWithContext(db, req, {
        accion: 'Comentario Ticket',
        item: ticket.activoTag,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        meta: { comentario },
      });
      return { ok: true, ticket };
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
    res.status(201).json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/attachments', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const id = toInt(req.params.id);
    const fileName = sanitizeUploadFileName(req.body?.fileName);
    const mimeType = asNonEmptyString(req.body?.mimeType || req.body?.contentType) || 'application/octet-stream';
    const contentBase64 = asNonEmptyString(req.body?.contentBase64);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: 'fileName y contentBase64 son requeridos.' });
    }

    let contentBuffer;
    try {
      contentBuffer = Buffer.from(contentBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Adjunto en base64 invalido.' });
    }
    if (!contentBuffer || contentBuffer.length === 0) {
      return res.status(400).json({ error: 'Adjunto vacio.' });
    }
    if (contentBuffer.length > TICKET_ATTACHMENT_MAX_BYTES) {
      return res.status(413).json({ error: `Adjunto excede limite de ${Math.round(TICKET_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB.` });
    }

    await ensureUploadDir();
    const storedName = `tk_${id}_${Date.now()}_${randomUUID()}_${fileName}`;
    const storagePath = path.join('uploads', storedName).replace(/\\/g, '/');
    const absPath = toAbsoluteAttachmentPath(storagePath);
    if (!absPath) {
      return res.status(500).json({ error: 'No se pudo preparar almacenamiento del adjunto.' });
    }

    let fileSaved = false;
    let persisted = false;
    try {
      await fs.writeFile(absPath, contentBuffer);
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
        ticket.historial.unshift({
          fecha: now(),
          usuario,
          accion: 'Adjunto agregado',
          estado: ticket.estado,
          comentario: fileName,
        });

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
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }
      if (!result?.ok && result?.code === 'FORBIDDEN') {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
      }
      if (!result?.ok && result?.code === 'MAX_ATTACHMENTS') {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(409).json({ error: `Limite de ${TICKET_ATTACHMENT_MAX_COUNT} adjuntos por ticket alcanzado.` });
      }
      if (!result?.ok) {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(500).json({ error: 'No se pudo guardar el adjunto.' });
      }

      persisted = true;
      return res.status(201).json({
        attachment: buildTicketAttachmentResponse(result.attachment),
        ticket: serializeTicket(result.ticket),
      });
    } catch (error) {
      if (fileSaved && !persisted) {
        await fs.unlink(absPath).catch(() => undefined);
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
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID invalido.' });

    const db = await readDb();
    const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!canAccessTicketByAuthUser(req, ticket)) {
      return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
    }
    const attachment = Array.isArray(ticket.attachments)
      ? ticket.attachments.find((item) => Number(item.id) === Number(attachmentId))
      : null;
    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado.' });

    const absPath = toAbsoluteAttachmentPath(attachment.storagePath);
    if (!absPath) return res.status(404).json({ error: 'Ruta de adjunto invalida.' });
    let content;
    try {
      content = await fs.readFile(absPath);
    } catch {
      return res.status(404).json({ error: 'Archivo adjunto no disponible.' });
    }

    const fileName = sanitizeUploadFileName(attachment.fileName || `adjunto_${attachmentId}`);
    res.setHeader('Content-Type', asNonEmptyString(attachment.mimeType) || 'application/octet-stream');
    res.setHeader('Content-Length', String(content.length));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/attachments/:attachmentId', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    const { usuario } = getRequestActor(req);
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID invalido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      ticket.attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
      const index = ticket.attachments.findIndex((item) => Number(item.id) === Number(attachmentId));
      if (index < 0) return { ok: false, code: 'ATTACHMENT_NOT_FOUND' };

      const [attachment] = ticket.attachments.splice(index, 1);

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Adjunto eliminado',
        estado: ticket.estado,
        comentario: attachment.fileName,
      });

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
    const absPath = toAbsoluteAttachmentPath(result.removedStoragePath);
    if (absPath) {
      await fs.unlink(absPath).catch(() => undefined);
    }
    res.json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const estado = req.query.estado ? normalizeEstadoTicket(req.query.estado) : null;
    const prioridad = req.query.prioridad ? normalizePrioridad(req.query.prioridad) : null;
    const atencionTipo = req.query.atencion !== undefined ? normalizeTicketAttentionType(req.query.atencion) : '';
    const onlyOpen = req.query.open === '1';
    const onlySla = req.query.sla === 'vencido';
    const lifecycle = asNonEmptyString(req.query.lifecycle).toUpperCase();
    const sucursal = asNonEmptyString(req.query.sucursal).toUpperCase();
    const assignee = asNonEmptyString(req.query.assignee);
    const search = normalizeTextKey(req.query.search || '');
    const withPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    if (req.query.atencion !== undefined && !atencionTipo) {
      return res.status(400).json({ error: 'Filtro de atencion invalido.' });
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
      list = list.filter((ticket) => {
        const fields = [
          ticket.activoTag,
          ticket.descripcion,
          ticket.asignadoA,
          ticket.sucursal,
          ticket.solicitadoPor,
          ticket.departamento,
          ticket.atencionTipo,
          ticket.trasladoRequerido ? 'traslado' : '',
          String(ticket.id),
        ];
        return fields.some((value) => normalizeTextKey(value || '').includes(search));
      });
    }

    list.sort((a, b) => {
      const leftTs = new Date(a.fechaCreacion || a.fecha || 0).getTime() || 0;
      const rightTs = new Date(b.fechaCreacion || b.fecha || 0).getTime() || 0;
      return rightTs - leftTs;
    });

    if (!withPagination) {
      return res.json(list.map(serializeTicket));
    }

    const { page, pageSize } = parsePagination(req.query);
    const paged = paginateList(list, page, pageSize);

    res.json({
      ...paged,
      items: paged.items.map(serializeTicket),
    });
  } catch (error) {
    next(error);
  }
});

  return router;
}
