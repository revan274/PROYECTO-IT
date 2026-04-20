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
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        className="fixed top-4 right-4 z-20 w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 p-8 sm:p-12 text-center">
        <div className="flex justify-center mb-6">
          <LogoGigantes className="w-20 h-20 sm:w-24 sm:h-24 animate-bounce" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#F58220]">LOS GIGANTES</h1>
        <p className="text-[#8CC63F] font-bold text-sm tracking-[0.2em] uppercase mb-8">
          IT Management System
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
              Usuario
            </label>
            <input
              className="w-full p-4 bg-slate-50 glass-input rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-100"
              value={loginForm.username || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              className="w-full p-4 bg-slate-50 glass-input rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-100"
              value={loginForm.password || ''}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Ingresa tu password"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-[#F58220] text-white font-black py-4 rounded-3xl shadow-xl hover:scale-[1.02] transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <User size={18} /> {loginLoading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
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
