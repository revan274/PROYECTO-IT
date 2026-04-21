import { Menu, Moon, Search, Sun } from 'lucide-react';

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
  authorBrand,
}: AppHeaderProps) {
  const backendStatusClass = backendConnected
    ? 'border-[#d6f4ab] bg-[#f4fce3] text-[#4a7f10]'
    : 'border-amber-200 bg-amber-50 text-amber-600';

  return (
    <header className="z-20 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10">
      <div className="premium-panel rounded-[2rem] px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="premium-icon-button flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] text-slate-500 lg:hidden"
                onClick={onOpenSidebar}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Mesa IT Control</p>
                <div className="flex items-center gap-2">
                  <span className="premium-chip hidden md:inline-flex">Premium Ops</span>
                  <p className="truncate text-sm font-semibold text-slate-500">{authorBrand}</p>
                </div>
              </div>
              <div className="relative hidden w-full max-w-xl md:block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="premium-input w-full rounded-[1.4rem] py-3.5 pl-11 pr-4 text-sm outline-none"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] sm:flex ${backendStatusClass}`}>
                <span className={backendConnected ? 'sync-indicator inline-flex items-center gap-2' : 'inline-flex items-center gap-2'}>
                  <span>{backendConnected ? 'Backend Online' : 'Backend Offline'}</span>
                </span>
                {isSyncing && <span className="text-slate-400">Sync...</span>}
                {!isSyncing && lastSync && backendConnected && <span className="text-slate-400">{lastSync}</span>}
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                className="premium-icon-button flex h-11 w-11 items-center justify-center rounded-[1.1rem] text-slate-500"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <div className="premium-panel-soft hidden items-center gap-3 rounded-[1.5rem] px-3 py-2 lg:flex">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{sessionUser?.rol || 'sin rol'}</p>
                  <p className="text-xs font-black text-slate-800">{sessionUser?.nombre || 'Invitado'}</p>
                  <p className="text-[10px] font-semibold text-slate-500">{authorBrand}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-white/45 bg-gradient-to-br from-[#fef3c7] via-[#f4fce3] to-white text-sm font-black text-[#0f172a] shadow-lg ring-1 ring-white/50">
                  {sessionUser?.nombre?.slice(0, 2).toUpperCase() || 'IT'}
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full md:hidden">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="premium-input w-full rounded-[1.4rem] py-3.5 pl-11 pr-4 text-sm outline-none"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 sm:hidden">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${backendStatusClass}`}>
              <span>{backendConnected ? 'Online' : 'Offline'}</span>
              {isSyncing && <span className="text-slate-400">Sync</span>}
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{sessionUser?.rol || 'sin rol'}</p>
              <p className="truncate text-sm font-black text-slate-800">{sessionUser?.nombre || 'Invitado'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
