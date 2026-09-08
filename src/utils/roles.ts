import type { UserRole } from '../types/app';
import { roleHasPermission } from '../../shared/permissions.js';

export const USER_ROLE_ORDER: UserRole[] = ['admin', 'tecnico', 'consulta', 'solicitante'];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLE_ORDER.includes(value as UserRole);
}

/**
 * ¿Este rol tiene este permiso? Consulta la MISMA matriz que aplica el servidor
 * (`shared/permissions.js`), así que la interfaz y la API no pueden desalinearse.
 *
 * El backend sigue siendo la autoridad: esto solo decide qué se muestra. Pero si ambos
 * lados divergen, la UI ofrece botones que la API rechaza —o esconde acciones legítimas—
 * y eso no se detecta hasta que un usuario se topa con ello.
 */
export function can(role: string | null | undefined, permission: string): boolean {
  return roleHasPermission(role, permission);
}

// Los helpers de abajo conservan su nombre y su significado, pero ya no repiten las reglas:
// las derivan de la matriz. Cada uno consulta un permiso representativo de su grupo.

export function canEditByRole(role?: string | null): boolean {
  return can(role, 'activos.update');
}

export function canCreateTicketsByRole(role?: string | null): boolean {
  return can(role, 'tickets.create');
}

export function canManageUsersByRole(role?: string | null): boolean {
  return can(role, 'users.manage');
}

export function isRequesterOnlyRole(role?: string | null): boolean {
  return canCreateTicketsByRole(role) && !canEditByRole(role);
}

export function roleCanGenerateTickets(role?: string | null): boolean {
  return canCreateTicketsByRole(role);
}
