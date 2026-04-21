import { Menu, Moon, Search, Sun, WifiOff } from 'lucide-react';

type ThemeMode = 'light' | 'dark';

interface SessionUserLike {
  rol?: string;
  nombre?: string;
}

interface AppHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenSidebar: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  backendConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  sessionUser: SessionUserLike | null;
  authorBrand: string;
}

export function AppHeader({
  searchTerm,
  onSearchChange,
  onOpenSidebar,
  theme,
  onToggleTheme,
  backendConnected,
  isSyncing,
  lastSync,
  sessionUser,
}: AppHeaderProps) {
  const initials = sessionUser?.nombre?.slice(0, 2).toUpperCase() ?? 'IT';

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-3.5 sm:px-6 lg:px-10 z-20 sticky top-0">
      <div className="flex items-center gap-3 sm:gap-4">

        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors shrink-0 btn-press"
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
          <input
            id="global-search"
            type="text"
            placeholder="Buscar activo, ticket, usuario..."
            className="search-bar w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1 hidden lg:block" />

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Backend status */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors
              ${backendConnected
                ? 'text-[#4a7f10] bg-[#f4fce3] border-[#d8f5a2]'
                : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
          >
            {backendConnected
              ? <><span className="status-dot-online" /><span>{isSyncing ? 'Sincronizando...' : `Online${lastSync ? ` · ${lastSync}` : ''}`}</span></>
              : <><WifiOff size={12} /><span>Offline</span></>
            }
          </div>

          {/* Small mobile status pill */}
          <div className={`sm:hidden w-2.5 h-2.5 rounded-full shrink-0 ${backendConnected ? 'status-dot-online' : 'status-dot-offline'}`} />

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="theme-toggle w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500
              hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center btn-press"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Session info — desktop only */}
          <div className="hidden lg:block text-right leading-tight">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {sessionUser?.rol ?? 'sin rol'}
            </p>
            <p className="text-xs font-black text-slate-700 truncate max-w-[140px]">
              {sessionUser?.nombre ?? 'Invitado'}
            </p>
          </div>

          {/* Avatar */}
          <div
            className="avatar-pulse w-10 h-10 sm:w-11 sm:h-11 rounded-2xl
              bg-gradient-to-br from-[#8CC63F] to-[#6dab24]
              flex items-center justify-center
              text-white text-xs font-black
              shadow-md shadow-green-200/60
              cursor-default select-none shrink-0"
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
