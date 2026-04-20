import { useCallback, useEffect } from 'react';
import type { BootstrapResponse } from '../types/app';
import { useAppStore } from '../store/useAppStore';
import { ApiError, apiRequest, getApiErrorMessage } from '../utils/api';
import { normalizeCatalogState } from '../utils/assets';

interface UseAppBootstrapOptions {
  pollingMs?: number;
  onBootstrapData?: (data: BootstrapResponse) => void;
  onRefreshSuccess?: () => void;
  onRefreshFailure?: () => void;
  onSessionRejected: () => void;
}

function isSessionRejectedApiError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 401 || error.status === 403;
}

export function useAppBootstrap({
  pollingMs = 60000,
  onBootstrapData,
  onRefreshSuccess,
  onRefreshFailure,
  onSessionRejected,
}: UseAppBootstrapOptions) {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const setCoreData = useAppStore((state) => state.setCoreData);
  const setIsSyncing = useAppStore((state) => state.setIsSyncing);
  const isSyncing = useAppStore((state) => state.isSyncing);
  const setBackendConnected = useAppStore((state) => state.setBackendConnected);
  const backendConnected = useAppStore((state) => state.backendConnected);
  const setLastSync = useAppStore((state) => state.setLastSync);
  const lastSync = useAppStore((state) => state.lastSync);
  const setRefreshAppData = useAppStore((state) => state.setRefreshAppData);
  const showToast = useAppStore((state) => state.showToast);

  const refreshData = useCallback(
    async (options?: boolean | { silent?: boolean; force?: boolean }) => {
      const silent = typeof options === 'boolean' ? options : (options?.silent ?? false);
      if (!sessionUser) return;
      if (!silent) setIsSyncing(true);

      try {
        const data = await apiRequest<BootstrapResponse>('/bootstrap');
        setCoreData({
          activos: data.activos || [],
          insumos: data.insumos || [],
          tickets: data.tickets || [],
          users: data.users || [],
          catalogos: normalizeCatalogState(data.catalogos),
          auditoria: Array.isArray(data.auditoria) ? data.auditoria : [],
        });
        onBootstrapData?.(data);
        setBackendConnected(true);
        setLastSync(new Date().toLocaleTimeString());
        onRefreshSuccess?.();
      } catch (error) {
        if (isSessionRejectedApiError(error)) {
          onSessionRejected();
          if (!silent) {
            showToast('La sesión ya no es válida. Inicia sesión nuevamente.', 'warning');
          }
          return;
        }

        setBackendConnected(false);
        onRefreshFailure?.();
        showToast(getApiErrorMessage(error) || 'No se pudo sincronizar con el backend', 'warning');
      } finally {
        if (!silent) setIsSyncing(false);
      }
    },
    [
      onBootstrapData,
      onRefreshFailure,
      onRefreshSuccess,
      onSessionRejected,
      sessionUser,
      setBackendConnected,
      setCoreData,
      setIsSyncing,
      setLastSync,
      showToast,
    ],
  );

  useEffect(() => {
    setRefreshAppData(refreshData);
    return () => setRefreshAppData(null);
  }, [refreshData, setRefreshAppData]);

  useEffect(() => {
    if (!sessionUser) return;

    void refreshData({ silent: true, force: true });

    const intervalId = window.setInterval(() => {
      void refreshData({ silent: true });
    }, pollingMs);

    return () => window.clearInterval(intervalId);
  }, [pollingMs, refreshData, sessionUser]);

  const ensureBackendConnected = useCallback(
    (action: string) => {
      if (backendConnected) return true;
      showToast(`${action} requiere conexion con el backend.`, 'warning');
      return false;
    },
    [backendConnected, showToast],
  );

  return {
    refreshData,
    ensureBackendConnected,
    isSyncing,
    backendConnected,
    lastSync,
  };
}
