import { useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiRequest, getApiErrorMessage } from '../../utils/api';
import type { LoginResponse } from '../../types/app';

interface UseAuthActionsProps {
  clearSession: () => void;
}

export function useAuthActions({ clearSession }: UseAuthActionsProps) {
  const setStoredSession = useAppStore((state) => state.setStoredSession);
  const showToast = useAppStore((state) => state.showToast);
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      showToast('Usuario y password son requeridos', 'warning');
      return;
    }
    setLoginLoading(true);

    try {
      const auth = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      setStoredSession({
        user: auth.user,
        token: auth.token,
        loggedAt: auth.loggedAt,
      });
      showToast(`Bienvenido ${auth.user.nombre}`, 'success');
    } catch (error) {
      const message = getApiErrorMessage(error);
      showToast(message || 'No se pudo conectar con el backend', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignora error de logout remoto y limpia sesión local de todas formas.
    }
    clearSession();
  }, [clearSession]);

  return {
    loginForm,
    setLoginForm,
    loginLoading,
    handleLogin,
    handleLogout,
  };
}
