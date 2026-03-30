import express from 'express';
import { readDb, updateDb, sanitizeUser } from '../store.js';

export function createUsersRouter({
  requireAuth,
  ensureAdmin,
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
}) {
  const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const db = await readDb();
    res.json(db.users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const nombre = asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ');
    const username = asNonEmptyString(req.body?.username).toLowerCase();
    const password = asNonEmptyString(req.body?.password);
    const cargoInput = req.body?.cargo ?? req.body?.departamento;
    const rol = normalizeUserRole(req.body?.rol) || 'solicitante';
    const { usuario } = getRequestActor(req);

    if (!nombre || !username || !password || !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Nombre, usuario, password y cargo son requeridos.' });
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres.' });
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
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (!created?.ok && created?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catalogo.' });
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
    if (!ensureAdmin(req, res)) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const hasNombre = req.body?.nombre !== undefined;
    const hasUsername = req.body?.username !== undefined;
    const hasPassword = req.body?.password !== undefined;
    const hasCargo = req.body?.cargo !== undefined || req.body?.departamento !== undefined;
    const hasRol = req.body?.rol !== undefined;
    const hasActivo = req.body?.activo !== undefined;

    if (!hasNombre && !hasUsername && !hasPassword && !hasCargo && !hasRol && !hasActivo) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }

    const nombre = hasNombre ? asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ') : undefined;
    const username = hasUsername ? asNonEmptyString(req.body?.username).toLowerCase() : undefined;
    const password = hasPassword ? asNonEmptyString(req.body?.password) : undefined;
    const cargoInput = req.body?.cargo !== undefined ? req.body?.cargo : req.body?.departamento;
    const rol = hasRol ? normalizeUserRole(req.body?.rol) : undefined;
    const activo = hasActivo ? req.body?.activo : undefined;
    const { usuario } = getRequestActor(req);

    if (hasNombre && !nombre) {
      return res.status(400).json({ error: 'Nombre invalido.' });
    }
    if (hasUsername) {
      if (!username) return res.status(400).json({ error: 'Usuario invalido.' });
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
      }
    }
    if (hasPassword && password && password.length < 6) {
      return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres.' });
    }
    if (hasCargo && !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (hasRol && !rol) {
      return res.status(400).json({ error: 'Rol invalido.' });
    }
    if (hasActivo && typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El estado activo debe ser booleano.' });
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

      if (username) {
        const duplicated = db.users.some(
          (item) => Number(item.id) !== Number(user.id) && String(item.username).toLowerCase() === username,
        );
        if (duplicated) return { ok: false, code: 'DUPLICATE' };
      }

      if (nombre) user.nombre = nombre;
      if (username) user.username = username;
      if (hasCargo) user.departamento = nextCargo;
      if (rol) user.rol = rol;
      if (hasActivo) user.activo = activo;
      if (password) {
        user.passwordHash = createUserPasswordHash(password);
        revokeSessionsByUserId(user.id);
      }

      if (hasActivo && activo === false) {
        revokeSessionsByUserId(user.id);
      }

      pushAuditWithContext(db, req, {
        accion: hasActivo ? (activo ? 'Activacion Usuario' : 'Desactivacion Usuario') : 'Edicion Usuario',
        item: `${user.username} | ${user.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: user.id,
        after: sanitizeUser(user),
      });
      return { ok: true, user };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_CARGO') {
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (!updated?.ok && updated?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catalogo.' });
    }
    if (!updated?.ok && updated?.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
    }
    if (!updated?.ok && updated?.code === 'SELF_ADMIN_GUARD') {
      return res.status(409).json({ error: 'No puedes desactivarte ni quitarte el rol administrador.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
    }

    res.json(sanitizeUser(updated.user));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
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

      db.users.splice(index, 1);
      revokeSessionsByUserId(target.id);
      pushAuditWithContext(db, req, {
        accion: 'Baja Usuario',
        item: `${target.username} | ${target.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: target.id,
        before: sanitizeUser(target),
      });
      return { ok: true };
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
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

  return router;
}
