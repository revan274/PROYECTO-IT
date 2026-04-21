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
  return (
    <header className="bg-white border-b border-slate-100 px-4 py-4 sm:px-6 lg:px-10 lg:py-6 z-20">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" className="lg:hidden text-slate-400 shrink-0" onClick={onOpenSidebar}>
              <Menu />
            </button>
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider ${backendConnected ? 'text-[#8CC63F] bg-[#f4fce3] border-[#d8f5a2]' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
              <span>{backendConnected ? 'Backend Online' : 'Backend Offline'}</span>
              {isSyncing && <span className="text-slate-400">SYNC...</span>}
              {!isSyncing && lastSync && backendConnected && <span className="text-slate-400">({lastSync})</span>}
            </div>
            <div className="hidden lg:block text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase">{sessionUser?.rol || 'sin rol'}</p>
              <p className="text-xs font-black text-slate-700">{sessionUser?.nombre || 'Invitado'}</p>
              <p className="text-[8px] font-semibold text-slate-300 tracking-[0.05em] normal-case">{authorBrand}</p>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#f4fce3] flex items-center justify-center text-[#8CC63F] font-black border-2 border-white shadow-sm ring-2 ring-slate-50">
              {sessionUser?.nombre?.slice(0, 2).toUpperCase() || 'IT'}
            </div>
          </div>
        </div>

        <div className="relative w-full md:hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex sm:hidden items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider">
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${backendConnected ? 'text-[#8CC63F] bg-[#f4fce3] border-[#d8f5a2]' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
            <span>{backendConnected ? 'Online' : 'Offline'}</span>
            {isSyncing && <span className="text-slate-400">Sync</span>}
          </div>
          <div className="text-right min-w-0">
            <p className="text-slate-400 truncate">{sessionUser?.rol || 'sin rol'}</p>
            <p className="text-slate-700 truncate">{sessionUser?.nombre || 'Invitado'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
