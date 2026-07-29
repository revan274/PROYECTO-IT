import { useCallback, useEffect, useRef } from 'react';
import type { BootstrapResponse } from '../types/app';
import { useAppStore } from '../store/useAppStore';
import { apiRequest, getApiErrorMessage } from '../utils/api';
import { normalizeCatalogState } from '../utils/assets';
import { isSessionRejectedApiError } from '../utils/format';

interface UseAppBootstrapOptions {
  pollingMs?: number;
  onBootstrapData?: (data: BootstrapResponse) => void;
  onRefreshSuccess?: () => void;
  onRefreshFailure?: () => void;
  onSessionRejected: () => void;
}

export function useAppBootstrap({
  pollingMs = 60_000,
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
  const bootstrapEtagRef = useRef('');
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const inFlightIsForceRef = useRef(false);
  const initializedSessionKeyRef = useRef('');

  const refreshData = useCallback(
    async (options?: boolean | { silent?: boolean; force?: boolean }) => {
      const silent = typeof options === 'boolean' ? options : (options?.silent ?? false);
      const force = typeof options === 'boolean' ? options : (options?.force ?? false);
      if (!sessionUser) return;

      if (inFlightRefreshRef.current) {
        if (!force || inFlightIsForceRef.current) return inFlightRefreshRef.current;
        await inFlightRefreshRef.current;
      }

      const request = (async () => {
        if (!silent) setIsSyncing(true);

        try {
          const headers = new Headers();
          if (!force && bootstrapEtagRef.current) {
            headers.set('If-None-Match', bootstrapEtagRef.current);
          }

          let responseEtag = '';
          const data = await apiRequest<BootstrapResponse | undefined>(
            '/bootstrap',
            { headers },
            {
              acceptNotModified: true,
              onResponse(response) {
                responseEtag = response.headers.get('etag') || '';
              },
            },
          );
          if (responseEtag) bootstrapEtagRef.current = responseEtag;

          if (data) {
            setCoreData({
              activos: data.activos || [],
              insumos: data.insumos || [],
              tickets: data.tickets || [],
              users: data.users || [],
              catalogos: normalizeCatalogState(data.catalogos),
              auditoria: Array.isArray(data.auditoria) ? data.auditoria : [],
            });
            onBootstrapData?.(data);
          }
          setBackendConnected(true);
          setLastSync(new Date().toLocaleTimeString());
          onRefreshSuccess?.();
        } catch (error) {
          if (isSessionRejectedApiError(error)) {
            bootstrapEtagRef.current = '';
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
      })();

      inFlightRefreshRef.current = request;
      inFlightIsForceRef.current = force;
      try {
        await request;
      } finally {
        if (inFlightRefreshRef.current === request) {
          inFlightRefreshRef.current = null;
          inFlightIsForceRef.current = false;
        }
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
    bootstrapEtagRef.current = '';
  }, [sessionUser?.id, sessionUser?.username]);

  useEffect(() => {
    if (!sessionUser) {
      initializedSessionKeyRef.current = '';
      return;
    }

    const sessionKey = `${sessionUser.id}:${sessionUser.username}`;
    if (initializedSessionKeyRef.current !== sessionKey) {
      initializedSessionKeyRef.current = sessionKey;
      void refreshData({ silent: true, force: true });
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshData({ silent: true });
    };
    const intervalId = window.setInterval(refreshIfVisible, pollingMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshIfVisible();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [pollingMs, refreshData, sessionUser]);

  const ensureBackendConnected = useCallback(
    (action: string) => {
      if (backendConnected) return true;
      showToast(`${action} requiere conexión con el backend.`, 'warning');
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
