export const USER_ROLE_ORDER = ['admin', 'tecnico', 'consulta', 'solicitante'];

export const USER_ROLES = new Set(USER_ROLE_ORDER);

export const DEFAULT_ROLE_CATALOG = [
  { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
  { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: true },
  { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
  { value: 'solicitante', label: 'Solicitante', permissions: 'Crear y dar seguimiento a tickets', activo: true },
];

export function normalizeKnownUserRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return USER_ROLES.has(role) ? role : null;
}

export function normalizeStoredUserRole(value) {
  return normalizeKnownUserRole(value) || 'consulta';
}

export function canEditByRole(role) {
  const normalized = normalizeKnownUserRole(role);
  return normalized === 'admin' || normalized === 'tecnico';
}

export function canCreateTicketsByRole(role) {
  const normalized = normalizeKnownUserRole(role);
  return canEditByRole(normalized) || normalized === 'solicitante';
}

export function canManageUsersByRole(role) {
  return normalizeKnownUserRole(role) === 'admin';
}

export function isRequesterOnlyRole(role) {
  return normalizeKnownUserRole(role) === 'solicitante';
}
