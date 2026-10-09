export interface SharedTicketArea { id: string; nombre: string; activo: boolean }
export interface SharedTicketCategory { id: string; areaId: string; nombre: string; activo: boolean }
export const DEFAULT_TICKET_AREAS: readonly SharedTicketArea[];
export const DEFAULT_TICKET_CATEGORIES: readonly SharedTicketCategory[];
export function normalizeTicketClassificationCatalogs(source?: { areas?: unknown[]; categorias?: unknown[] }): { areas: SharedTicketArea[]; categorias: SharedTicketCategory[] };
export function resolveTicketClassification(catalogs: { areas: SharedTicketArea[]; categorias: SharedTicketCategory[] }, raw: { areaId?: unknown; categoriaId?: unknown }): { areaId: string; areaNombre: string; categoriaId: string; categoriaNombre: string } | null;
export function migrateLegacyTicketClassification<T extends object>(ticket: T, catalogs: { areas: SharedTicketArea[]; categorias: SharedTicketCategory[] }): T & { clasificacionPendiente?: boolean };
