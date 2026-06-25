import React from 'react';
import { Sun, Moon, User } from 'lucide-react';
import { LogoGigantes } from '../brand/LogoGigantes';
import { Toast } from '../ui/Toast';

interface LoginViewProps {
  theme: string;
  toggleTheme: () => void;
  handleLogin: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loginLoading: boolean;
  loginForm: { username: string; password?: string };
  setLoginForm: React.Dispatch<React.SetStateAction<{ username: string; password?: string }>>;
  AUTHOR_SIGNATURE: string;
  toast: { message: string; type: 'success' | 'warning' | 'error' } | null;
  setToast: (toast: { message: string; type: 'success' | 'warning' | 'error' } | null) => void;
}

const INPUT_CLASS =
  'w-full h-11 px-3.5 bg-surface border border-border rounded-lg text-sm text-fg placeholder:text-fg-subtle ' +
  'outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/30';

export function LoginView({
  theme,
  toggleTheme,
  handleLogin,
  loginLoading,
  loginForm,
  setLoginForm,
  AUTHOR_SIGNATURE,
  toast,
  setToast,
}: LoginViewProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 font-sans text-fg">
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        className="fixed top-4 right-4 z-20 w-9 h-9 rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg flex items-center justify-center transition-colors"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="bg-surface w-full max-w-sm rounded-2xl shadow-pop border border-border p-8 sm:p-10 text-center">
        <div className="flex justify-center mb-5">
          <LogoGigantes className="w-16 h-16 sm:w-20 sm:h-20" />
        </div>
        <h1 className="text-2xl font-semibold text-brand tracking-tight">LOS GIGANTES</h1>
        <p className="text-fg-subtle text-xs tracking-[0.18em] uppercase mt-1 mb-8">
          IT Management System
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-[13px] font-medium text-fg">
              Usuario
            </label>
            <input
              id="login-username"
              className={INPUT_CLASS}
              value={loginForm.username || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-[13px] font-medium text-fg">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className={INPUT_CLASS}
              value={loginForm.password || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Ingresa tu password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full h-11 bg-brand text-brand-fg font-medium rounded-lg shadow-card hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <User size={18} /> {loginLoading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-left text-xs text-fg-subtle">
          <p>Solicita tus credenciales al administrador del sistema.</p>
          <p className="mt-2 text-[11px] text-fg-subtle">
            {AUTHOR_SIGNATURE}
          </p>
        </div>
      </div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
