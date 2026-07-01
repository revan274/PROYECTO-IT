import { useCallback, useEffect, useRef } from 'react';
import { fetchAllAuditRows, fetchAuditHistoryPage } from '../../api/auditApi';
import type {
  AuditAlertsState,
  AuditFiltersState,
  AuditIntegrityState,
  AuditPaginationState,
  AuditSummaryState,
  RegistroAuditoria,
  ToastType,
} from '../../types/app';
import { buildDefaultAuditPagination } from '../../utils/app';
import {
  getApiErrorMessage,
  isRouteNotFoundApiError,
  isSessionRejectedApiError,
} from '../../utils/format';

export type AuditRowsResult =
  | { status: 'ok'; rows: RegistroAuditoria[] }
  | { status: 'session-rejected' }
  | { status: 'error' };

export interface UseAuditActionsParams {
  hasSession: boolean;
  backendConnected: boolean;
  isRequesterOnlyUser: boolean;
  view: string;
  auditFilters: AuditFiltersState;
  auditPage: number;
  auditPageSize: number;
  clearSession: () => void;
  showToast: (message: string, type?: ToastType) => void;
  setAuditRemoteRows: (value: RegistroAuditoria[] | null) => void;
  setAuditPagination: (value: AuditPaginationState) => void;
  setAuditSummary: (value: AuditSummaryState | null) => void;
  setAuditIntegrity: (value: AuditIntegrityState | null) => void;
  setAuditAlerts: (value: AuditAlertsState | null) => void;
  setIsAuditLoading: (value: boolean) => void;
}

/**
 * Coordinador del módulo de auditoría remota.
 * HTTP y normalización viven en api/auditApi; aquí solo guardas, estado,
 * manejo de errores y protección contra respuestas obsoletas.
 */
export function useAuditActions({
  hasSession,
  backendConnected,
  isRequesterOnlyUser,
  view,
  auditFilters,
  auditPage,
  auditPageSize,
  clearSession,
  showToast,
  setAuditRemoteRows,
  setAuditPagination,
  setAuditSummary,
  setAuditIntegrity,
  setAuditAlerts,
  setIsAuditLoading,
}: UseAuditActionsParams) {
  // Token monotónico: solo la petición más reciente puede escribir estado.
  const historyRequestIdRef = useRef(0);

  const {
    module: filterModule,
    result: filterResult,
    user: filterUser,
    entity: filterEntity,
    action: filterAction,
    q: filterQ,
    from: filterFrom,
    to: filterTo,
  } = auditFilters;

  const handleSessionRejected = useCallback(() => {
    clearSession();
    showToast('La sesión ya no es válida. Inicia sesión nuevamente.', 'warning');
  }, [clearSession, showToast]);

  const fetchAuditHistory = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!hasSession) return;
    if (!backendConnected && !force) return;
    if (isRequesterOnlyUser) return;
    if (view !== 'history') return;

    const requestId = ++historyRequestIdRef.current;
    const isCurrent = () => requestId === historyRequestIdRef.current;

    setIsAuditLoading(true);
    try {
      const data = await fetchAuditHistoryPage(
        {
          module: filterModule,
          result: filterResult,
          user: filterUser,
          entity: filterEntity,
          action: filterAction,
          q: filterQ,
          from: filterFrom,
          to: filterTo,
        },
        auditPage,
        auditPageSize,
      );
      if (!isCurrent()) return;
      setAuditRemoteRows(Array.isArray(data.items) ? data.items : []);
      setAuditPagination(data.pagination || buildDefaultAuditPagination(auditPageSize));
      setAuditSummary(data.summary || null);
      setAuditIntegrity(data.integrity || null);
      setAuditAlerts(data.alerts || null);
    } catch (error) {
      if (!isCurrent()) return;
      if (isSessionRejectedApiError(error)) {
        handleSessionRejected();
        return;
      }
      if (!isRouteNotFoundApiError(error)) {
        showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditoría', 'warning');
      }
      setAuditRemoteRows(null);
      setAuditPagination(buildDefaultAuditPagination(auditPageSize));
      setAuditSummary(null);
      setAuditIntegrity(null);
      setAuditAlerts(null);
    } finally {
      if (isCurrent()) setIsAuditLoading(false);
    }
  }, [
    auditPage,
    auditPageSize,
    backendConnected,
    filterAction,
    filterEntity,
    filterFrom,
    filterModule,
    filterQ,
    filterResult,
    filterTo,
    filterUser,
    handleSessionRejected,
    hasSession,
    isRequesterOnlyUser,
    setAuditAlerts,
    setAuditIntegrity,
    setAuditPagination,
    setAuditRemoteRows,
    setAuditSummary,
    setIsAuditLoading,
    showToast,
    view,
  ]);

  /**
   * Carga filas completas de auditoría con manejo de errores centralizado.
   * `notifyGenericError` reproduce la diferencia actual entre vistas:
   * reportería avisa errores genéricos, historial de insumos los silencia.
   */
  const loadAllAuditRows = useCallback(async (
    filters: Record<string, string | number | undefined>,
    options?: { notifyGenericError?: boolean },
  ): Promise<AuditRowsResult> => {
    try {
      const rows = await fetchAllAuditRows(filters);
      return { status: 'ok', rows };
    } catch (error) {
      if (isSessionRejectedApiError(error)) {
        handleSessionRejected();
        return { status: 'session-rejected' };
      }
      if (options?.notifyGenericError && !isRouteNotFoundApiError(error)) {
        showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditoría', 'warning');
      }
      return { status: 'error' };
    }
  }, [handleSessionRejected, showToast]);

  // Carga reactiva del historial al entrar a la vista o cambiar filtros/página.
  useEffect(() => {
    if (view !== 'history') return;
    void fetchAuditHistory();
  }, [view, fetchAuditHistory]);

  return {
    fetchAuditHistory,
    loadAllAuditRows,
  };
}
