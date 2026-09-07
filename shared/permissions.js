// Catálogo de permisos de Mesa IT.
//
// Antes, la autorización se expresaba con tres booleanos de grano grueso: `ensureAdmin`,
// `ensureCanEdit` (admin o técnico) y `ensureCanCreateTickets`. `ensureCanEdit` por sí solo
// cubría cuatro dominios distintos —activos, insumos, tickets y viáticos— y operaciones de
// consecuencia muy distinta: mover stock de un insumo y borrar la evidencia adjunta de un
// ticket compartían el mismo permiso. No se podía autorizar una sin la otra, y crear un rol
// intermedio ("Supervisor que asigna pero no borra") obligaba a tocar los ~60 call sites.
//
// Esta matriz nombra cada operación por separado SIN cambiar quién puede hacer qué: los
// grupos reproducen exactamente los booleanos anteriores, y `server/permissions.test.js`
// verifica esa equivalencia rol por rol. A partir de aquí, un rol nuevo se define editando
// la matriz, no los call sites.

/** Solo administradores. */
export const ADMIN_ONLY_PERMISSIONS = Object.freeze([
  'catalogos.manage',
  'users.manage',
  'activos.deleteAll',
  'tickets.historical',
]);

/** Operación IT: hoy admin y técnico (equivalente a `canEditByRole`). */
export const EDITOR_PERMISSIONS = Object.freeze([
  'activos.create',
  'activos.update',
  'activos.delete',
  'activos.import',
  'insumos.create',
  'insumos.update',
  'insumos.delete',
  'insumos.stock',
  'tickets.update',
  'tickets.resolve',
  'tickets.attachments.delete',
  'travel.manage',
]);

/** Autoría sobre tickets: hoy admin, técnico y solicitante (equivalente a `canCreateTicketsByRole`). */
export const TICKET_AUTHOR_PERMISSIONS = Object.freeze([
  'tickets.create',
  'tickets.comment',
  'tickets.attach',
]);

export const PERMISSIONS = Object.freeze([
  ...ADMIN_ONLY_PERMISSIONS,
  ...EDITOR_PERMISSIONS,
  ...TICKET_AUTHOR_PERMISSIONS,
]);

const PERMISSION_SET = new Set(PERMISSIONS);

/**
 * Rol -> permisos otorgados. `consulta` no aparece: es de solo lectura y no recibe ninguno.
 * Un rol ausente de esta tabla no obtiene permisos (falla cerrado).
 */
export const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze([...ADMIN_ONLY_PERMISSIONS, ...EDITOR_PERMISSIONS, ...TICKET_AUTHOR_PERMISSIONS]),
  tecnico: Object.freeze([...EDITOR_PERMISSIONS, ...TICKET_AUTHOR_PERMISSIONS]),
  consulta: Object.freeze([]),
  solicitante: Object.freeze([...TICKET_AUTHOR_PERMISSIONS]),
});

const ROLE_PERMISSION_SETS = new Map(
  Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [role, new Set(permissions)]),
);

/** Falla cerrado: un permiso o un rol desconocido nunca autoriza. */
export function roleHasPermission(role, permission) {
  if (!PERMISSION_SET.has(permission)) return false;
  const granted = ROLE_PERMISSION_SETS.get(String(role || '').trim().toLowerCase());
  return Boolean(granted && granted.has(permission));
}
