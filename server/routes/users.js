import express from 'express';
import { updateDb, sanitizeUser } from '../store.js';
import { getRequestDb } from '../utils/helpers.js';

const MIN_PASSWORD_LENGTH = 12;

export function createUsersRouter({
  requireAuth,
  ensurePermission,
  createUserPasswordHash,
  roleIsEnabledByCatalog,
  getRequestActor,
  pushAuditWithContext,
  asNonEmptyString,
  normalizeUserRole,
  getCatalogsFromDb,
  normalizeUserCargo,
  toInt,
  nextId,
  countActiveAdmins,
  revokeSessionsByUserId,
  isValidEmail,
  normalizeTextKey,
  CLOSED_STATES,
  canEditByRole,
}) {
  const router = express.Router();

  function hasTicketHistory(db, user) {
    const userId = Number(user?.id);
    const username = asNonEmptyString(user?.username).toLowerCase();
    const nameKey = normalizeTextKey(user?.nombre);

    return (Array.isArray(db.tickets) ? db.tickets : []).some((ticket) => {
      const requesterId = Number(ticket?.solicitadoPorId);
      const requesterUsername = asNonEmptyString(ticket?.solicitadoPorUsername).toLowerCase();
      const hasRequesterId = Number.isInteger(requesterId) && requesterId > 0;
      const isLegacyRequester = !hasRequesterId && !requesterUsername;

      return (
        (nameKey && normalizeTextKey(ticket?.asignadoA) === nameKey)
        || (Number.isFinite(userId) && hasRequesterId && requesterId === userId)
        || (username && requesterUsername === username)
        || (isLegacyRequester && nameKey && normalizeTextKey(ticket?.solicitadoPor) === nameKey)
      );
    });
  }

  function hasOpenAssignedTickets(db, user) {
    const nameKey = normalizeTextKey(user?.nombre);
    if (!nameKey) return false;

    return (Array.isArray(db.tickets) ? db.tickets : []).some((ticket) => (
      normalizeTextKey(ticket?.asignadoA) === nameKey
      && !CLOSED_STATES.has(ticket?.estado)
    ));
  }

  function renameTicketAssignments(db, previousName, nextName) {
    const previousNameKey = normalizeTextKey(previousName);
    if (!previousNameKey || previousNameKey === normalizeTextKey(nextName)) return 0;

    let updatedCount = 0;
    for (const ticket of Array.isArray(db.tickets) ? db.tickets : []) {
      if (normalizeTextKey(ticket?.asignadoA) !== previousNameKey) continue;
      ticket.asignadoA = nextName;
      updatedCount += 1;
    }
    return updatedCount;
  }

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'users.manage')) return;
    const db = await getRequestDb(req);
    res.json(db.users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'users.manage')) return;

    const nombre = asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ');
    const username = asNonEmptyString(req.body?.username).toLowerCase();
    const password = asNonEmptyString(req.body?.password);
    const cargoInput = req.body?.cargo ?? req.body?.departamento;
    const rol = normalizeUserRole(req.body?.rol) || 'solicitante';
    const emailInput = asNonEmptyString(req.body?.email).toLowerCase();
    const { usuario } = getRequestActor(req);

    if (!nombre || !username || !password || !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Nombre, usuario, password y cargo son requeridos.' });
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `El password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    }
    if (emailInput && !isValidEmail(emailInput)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
    }

    const created = await updateDb((db) => {
      const catalogs = getCatalogsFromDb(db);
      const cargo = normalizeUserCargo(cargoInput, catalogs.cargos);
      if (!cargo) return { ok: false, code: 'INVALID_CARGO' };
      if (!roleIsEnabledByCatalog(db, rol)) return { ok: false, code: 'ROLE_DISABLED' };

      const duplicated = db.users.some((u) => String(u.username).toLowerCase() === username);
      if (duplicated) return { ok: false, code: 'DUPLICATE' };

      const user = {
        id: nextId(db),
        nombre,
        username,
        passwordHash: createUserPasswordHash(password),
        rol,
        departamento: cargo,
        email: emailInput,
        activo: true,
      };
      db.users.push(user);
      pushAuditWithContext(db, req, {
        accion: 'Alta Usuario',
        item: `${user.username} | ${cargo}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: user.id,
        after: sanitizeUser(user),
      });
      return { ok: true, user };
    });

    if (!created?.ok && created?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }
    if (!created?.ok && created?.code === 'INVALID_CARGO') {
      return res.status(400).json({ error: 'Cargo inválido.' });
    }
    if (!created?.ok && created?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catálogo.' });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }

    res.status(201).json(sanitizeUser(created.user));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'users.manage')) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido.' });

    const hasNombre = req.body?.nombre !== undefined;
    const hasUsername = req.body?.username !== undefined;
    const hasPassword = req.body?.password !== undefined;
    const hasCargo = req.body?.cargo !== undefined || req.body?.departamento !== undefined;
    const hasRol = req.body?.rol !== undefined;
    const hasActivo = req.body?.activo !== undefined;
    const hasEmail = req.body?.email !== undefined;

    if (!hasNombre && !hasUsername && !hasPassword && !hasCargo && !hasRol && !hasActivo && !hasEmail) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }

    const nombre = hasNombre ? asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ') : undefined;
    const username = hasUsername ? asNonEmptyString(req.body?.username).toLowerCase() : undefined;
    const password = hasPassword ? asNonEmptyString(req.body?.password) : undefined;
    const cargoInput = req.body?.cargo !== undefined ? req.body?.cargo : req.body?.departamento;
    const rol = hasRol ? normalizeUserRole(req.body?.rol) : undefined;
    const activo = hasActivo ? req.body?.activo : undefined;
    const email = hasEmail ? asNonEmptyString(req.body?.email).toLowerCase() : undefined;
    const { usuario } = getRequestActor(req);

    if (hasNombre && !nombre) {
      return res.status(400).json({ error: 'Nombre inválido.' });
    }
    if (hasUsername) {
      if (!username) return res.status(400).json({ error: 'Usuario inválido.' });
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
      }
    }
    if (hasPassword && password && password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `El password debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    }
    if (hasCargo && !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Cargo inválido.' });
    }
    if (hasRol && !rol) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (hasActivo && typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El estado activo debe ser booleano.' });
    }
    if (hasEmail && email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
    }

    const updated = await updateDb((db) => {
      const user = db.users.find((item) => Number(item.id) === Number(id));
      if (!user) return { ok: false, code: 'NOT_FOUND' };
      const catalogs = getCatalogsFromDb(db);
      const nextCargo = hasCargo ? normalizeUserCargo(cargoInput, catalogs.cargos) : user.departamento;
      if (hasCargo && !nextCargo) return { ok: false, code: 'INVALID_CARGO' };

      const isSelf = Number(req.authUser?.id) === Number(user.id);
      const nextRol = rol || user.rol;
      if (!roleIsEnabledByCatalog(db, nextRol)) return { ok: false, code: 'ROLE_DISABLED' };
      const nextActivo = hasActivo ? activo : user.activo !== false;

      if (isSelf && (nextActivo === false || nextRol !== 'admin')) {
        return { ok: false, code: 'SELF_ADMIN_GUARD' };
      }

      const willDropAdmin = user.rol === 'admin' && user.activo !== false && (nextRol !== 'admin' || nextActivo === false);
      if (willDropAdmin && countActiveAdmins(db.users, user.id) === 0) {
        return { ok: false, code: 'LAST_ADMIN' };
      }

      if (hasOpenAssignedTickets(db, user) && (nextActivo === false || !canEditByRole(nextRol))) {
        return { ok: false, code: 'OPEN_TICKETS_ASSIGNED' };
      }

      if (username) {
        const duplicated = db.users.some(
          (item) => Number(item.id) !== Number(user.id) && String(item.username).toLowerCase() === username,
        );
        if (duplicated) return { ok: false, code: 'DUPLICATE' };
      }

      const previousName = user.nombre;
      const previousUsername = user.username;
      const previousRole = user.rol;
      if (nombre) user.nombre = nombre;
      if (username) user.username = username;
      if (hasCargo) user.departamento = nextCargo;
      if (rol) user.rol = rol;
      if (hasActivo) user.activo = activo;
      if (hasEmail) user.email = email;
      if (password) {
        user.passwordHash = createUserPasswordHash(password);
      }
      const ticketAssignmentsRenamed = nombre
        ? renameTicketAssignments(db, previousName, user.nombre)
        : 0;
      const shouldRevokeSessions = Boolean(
        password
        || (username && username !== previousUsername)
        || (rol && rol !== previousRole)
        || (hasActivo && activo === false),
      );
      if (shouldRevokeSessions) {
        user.authVersion = Math.max(0, Math.trunc(Number(user.authVersion) || 0)) + 1;
      }

      pushAuditWithContext(db, req, {
        accion: hasActivo ? (activo ? 'Activación Usuario' : 'Desactivación Usuario') : 'Edición Usuario',
        item: `${user.username} | ${user.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: user.id,
        after: sanitizeUser(user),
        meta: ticketAssignmentsRenamed > 0 ? { ticketAssignmentsRenamed } : undefined,
      });
      return { ok: true, user, shouldRevokeSessions };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_CARGO') {
      return res.status(400).json({ error: 'Cargo inválido.' });
    }
    if (!updated?.ok && updated?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catálogo.' });
    }
    if (!updated?.ok && updated?.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
    }
    if (!updated?.ok && updated?.code === 'SELF_ADMIN_GUARD') {
      return res.status(409).json({ error: 'No puedes desactivarte ni quitarte el rol administrador.' });
    }
    if (!updated?.ok && updated?.code === 'OPEN_TICKETS_ASSIGNED') {
      return res.status(409).json({ error: 'No puedes desactivar ni quitar la capacidad de atención a este usuario mientras tenga tickets abiertos asignados. Reasígnalos o resuélvelos primero.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
    }

    if (updated.shouldRevokeSessions) {
      await revokeSessionsByUserId(updated.user.id).catch(() => undefined);
    }
    res.json(sanitizeUser(updated.user));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'users.manage')) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID inválido.' });
    const { usuario } = getRequestActor(req);

    const removed = await updateDb((db) => {
      const index = db.users.findIndex((item) => Number(item.id) === Number(id));
      if (index < 0) return { ok: false, code: 'NOT_FOUND' };

      const target = db.users[index];
      if (Number(req.authUser?.id) === Number(target.id)) {
        return { ok: false, code: 'SELF_DELETE' };
      }

      if (target.rol === 'admin' && target.activo !== false && countActiveAdmins(db.users, target.id) === 0) {
        return { ok: false, code: 'LAST_ADMIN' };
      }

      if (hasTicketHistory(db, target)) {
        return { ok: false, code: 'TICKET_HISTORY' };
      }

      db.users.splice(index, 1);
      const subscriptions = Array.isArray(db.pushSubscriptions) ? db.pushSubscriptions : [];
      const pushSubscriptionsRemoved = subscriptions.filter((subscription) => Number(subscription?.userId) === Number(target.id)).length;
      db.pushSubscriptions = subscriptions.filter((subscription) => Number(subscription?.userId) !== Number(target.id));
      pushAuditWithContext(db, req, {
        accion: 'Baja Usuario',
        item: `${target.username} | ${target.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: target.id,
        before: sanitizeUser(target),
        meta: pushSubscriptionsRemoved > 0 ? { pushSubscriptionsRemoved } : undefined,
      });
      return { ok: true, userId: target.id };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
    }
    if (!removed?.ok && removed?.code === 'SELF_DELETE') {
      return res.status(409).json({ error: 'No puedes eliminar tu propio usuario.' });
    }
    if (!removed?.ok && removed?.code === 'TICKET_HISTORY') {
      return res.status(409).json({ error: 'No puedes eliminar a este usuario porque tiene tickets asociados. Desactiva su cuenta para conservar la trazabilidad.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
    }

    await revokeSessionsByUserId(removed.userId).catch(() => undefined);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

  return router;
}
