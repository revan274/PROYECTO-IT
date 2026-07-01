import type { AuditFiltersState, AuditHistoryResponse, RegistroAuditoria } from '../types/app';
import { apiRequest } from '../utils/app';

/**
 * Cliente HTTP del módulo de auditoría.
 * Única fuente de construcción de query y normalización de respuesta.
 */

export function buildAuditQueryParams(
  filters: Record<string, string | number | undefined | null>,
): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    params.set(key, normalized);
  });
  return params;
}

function requestAudit(params: URLSearchParams): Promise<AuditHistoryResponse> {
  const query = params.toString();
  return apiRequest<AuditHistoryResponse>(`/auditoria${query ? `?${query}` : ''}`);
}

/** Página del historial de auditoría con filtros del servidor. */
export function fetchAuditHistoryPage(
  filters: AuditFiltersState,
  page: number,
  pageSize: number,
): Promise<AuditHistoryResponse> {
  const params = buildAuditQueryParams({
    module: filters.module,
    result: filters.result,
    user: filters.user,
    entity: filters.entity,
    action: filters.action,
    q: filters.q,
    from: filters.from,
    to: filters.to,
  });
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return requestAudit(params);
}

/** Todas las filas que cumplen los filtros (sin paginar, sin diagnósticos). */
export async function fetchAllAuditRows(
  filters: Record<string, string | number | undefined>,
): Promise<RegistroAuditoria[]> {
  const params = buildAuditQueryParams(filters);
  params.set('all', '1');
  params.set('includeDiagnostics', '0');
  const data = await requestAudit(params);
  return Array.isArray(data.items) ? data.items : [];
}
