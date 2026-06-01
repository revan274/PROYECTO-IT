import type { UserRole } from '../types/app';

export const USER_ROLE_ORDER: UserRole[] = ['admin', 'tecnico', 'consulta', 'solicitante'];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLE_ORDER.includes(value as UserRole);
}

export function canEditByRole(role?: string | null): boolean {
  return role === 'admin' || role === 'tecnico';
}

export function canCreateTicketsByRole(role?: string | null): boolean {
  return canEditByRole(role) || role === 'solicitante';
}

export function canManageUsersByRole(role?: string | null): boolean {
  return role === 'admin';
}

export function isRequesterOnlyRole(role?: string | null): boolean {
  return role === 'solicitante';
}

export function roleCanGenerateTickets(role?: string | null): boolean {
  return canCreateTicketsByRole(role);
}
