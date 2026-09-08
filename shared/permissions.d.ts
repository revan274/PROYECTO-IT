export type Permission =
  | 'catalogos.manage'
  | 'users.manage'
  | 'activos.deleteAll'
  | 'tickets.historical'
  | 'diagnostics.read'
  | 'activos.create'
  | 'activos.update'
  | 'activos.delete'
  | 'activos.import'
  | 'insumos.create'
  | 'insumos.update'
  | 'insumos.delete'
  | 'insumos.stock'
  | 'tickets.update'
  | 'tickets.resolve'
  | 'tickets.attachments.delete'
  | 'travel.manage'
  | 'tickets.create'
  | 'tickets.comment'
  | 'tickets.attach';

export const ADMIN_ONLY_PERMISSIONS: readonly Permission[];
export const EDITOR_PERMISSIONS: readonly Permission[];
export const TICKET_AUTHOR_PERMISSIONS: readonly Permission[];
export const PERMISSIONS: readonly Permission[];
export const ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>>;

export function roleHasPermission(role: unknown, permission: unknown): boolean;
