import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getApiErrorMessage } from '../utils/api';
import type { ShowToast } from '../types/actionDependencies';

export type PushNotificationStatus = 'idle' | 'enabled' | 'denied' | 'unsupported' | 'loading';

interface PushConfigurationResponse {
  enabled: boolean;
  publicKey?: string;
  reason?: string;
}

interface UsePushNotificationsOptions {
  sessionUser: { id?: number; username?: string } | null;
  showToast: ShowToast;
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(base64);
  const result = new ArrayBuffer(decoded.length);
  const bytes = new Uint8Array(result);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return result;
}

function supportsPush(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function usePushNotifications({ sessionUser, showToast }: UsePushNotificationsOptions) {
  const [status, setStatus] = useState<PushNotificationStatus>(() => (
    supportsPush() ? 'idle' : 'unsupported'
  ));

  const sessionKey = sessionUser ? `${sessionUser.id || ''}:${sessionUser.username || ''}` : '';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!sessionKey || !supportsPush()) {
        if (!cancelled) setStatus(supportsPush() ? 'idle' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? 'enabled' : 'idle');
      } catch {
        if (!cancelled) setStatus('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionKey]);

  const enable = useCallback(async () => {
    if (!supportsPush()) {
      showToast('Las notificaciones push requieren HTTPS y un navegador compatible.', 'warning');
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('Las notificaciones están bloqueadas en este navegador.', 'warning');
      setStatus('denied');
      return;
    }

    setStatus('loading');
    try {
      const configuration = await apiRequest<PushConfigurationResponse>('/push/config', {
        cache: 'no-store',
      });
      if (!configuration.enabled || !configuration.publicKey) {
        showToast('Las notificaciones push aún no están configuradas en el servidor.', 'warning');
        setStatus('idle');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        showToast('No se concedió permiso para recibir notificaciones.', 'warning');
        return;
      }

      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(configuration.publicKey),
        });
      await apiRequest('/push/subscriptions', {
        method: 'POST',
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus('enabled');
      showToast('Notificaciones push activadas en este dispositivo.', 'success');
    } catch (error) {
      setStatus('idle');
      showToast(getApiErrorMessage(error) || 'No se pudieron activar las notificaciones push.', 'error');
    }
  }, [showToast]);

  const disable = useCallback(async () => {
    if (!supportsPush()) return;
    setStatus('loading');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await apiRequest('/push/subscriptions', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      setStatus('idle');
      showToast('Notificaciones push desactivadas en este dispositivo.', 'success');
    } catch (error) {
      setStatus('idle');
      showToast(getApiErrorMessage(error) || 'No se pudieron desactivar las notificaciones push.', 'error');
    }
  }, [showToast]);

  return {
    pushStatus: status,
    togglePushNotifications: status === 'enabled' ? disable : enable,
  };
}
