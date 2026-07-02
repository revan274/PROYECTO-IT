import React from 'react';
import { Sun, Moon, User } from 'lucide-react';
import { LogoGigantes } from '../brand/LogoGigantes';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <Button
        size="icon"
        className="fixed top-4 right-4 z-20 hover:text-slate-700 transition-colors"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 p-8 sm:p-12 text-center">
        <div className="flex items-center justify-center mb-4">
          <LogoGigantes className="block w-56 sm:w-64 max-w-full h-auto mx-auto" />
        </div>
        <p className="text-[#8CC63F] font-bold text-sm tracking-[0.2em] uppercase mb-8">
          IT Management System
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <Field label="Usuario">
            <Input
              variant="formMuted" className="w-full"
              value={loginForm.username || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="admin"
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              variant="formMuted" className="w-full"
              value={loginForm.password || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Ingresa tu password"
              autoComplete="current-password"
            />
          </Field>
          <Button
            variant="primary"
            size="bare"
            className="w-full py-4 rounded-3xl shadow-xl hover:scale-[1.02] transition-all tracking-widest gap-2"
            type="submit"
            disabled={loginLoading}
          >
            <User size={18} /> {loginLoading ? 'Entrando...' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className="mt-6 text-left text-[10px] text-slate-400 font-black uppercase tracking-wider">
          <p>Solicita tus credenciales al administrador del sistema.</p>
          <p className="mt-2 text-[9px] font-semibold normal-case tracking-normal text-slate-300">
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
