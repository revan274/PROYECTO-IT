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

const SEARCH_CLASS =
  'w-full pl-11 pr-4 h-10 bg-surface-2 border border-border rounded-lg text-sm text-fg placeholder:text-fg-subtle ' +
  'outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors';

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
  const statusClass = backendConnected
    ? 'text-success bg-success-soft'
    : 'text-warning bg-warning-soft';

  return (
    <header className="bg-surface border-b border-border px-4 py-3 sm:px-6 lg:px-8 lg:py-4 z-20">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" aria-label="Abrir menú" className="lg:hidden text-fg-muted shrink-0" onClick={onOpenSidebar}>
              <Menu />
            </button>
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                type="search"
                placeholder="Buscar..."
                aria-label="Buscar"
                className={SEARCH_CLASS}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              className="w-9 h-9 rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg flex items-center justify-center transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className={`hidden sm:inline-flex items-center gap-2 px-2.5 h-9 rounded-lg text-xs font-medium ${statusClass}`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
              <span>{backendConnected ? 'Backend Online' : 'Backend Offline'}</span>
              {isSyncing && <span className="text-fg-subtle">SYNC...</span>}
              {!isSyncing && lastSync && backendConnected && <span className="text-fg-subtle">({lastSync})</span>}
            </div>
            <div className="hidden lg:block text-right leading-tight">
              <p className="text-[11px] text-fg-subtle capitalize">{sessionUser?.rol || 'sin rol'}</p>
              <p className="text-sm font-medium text-fg">{sessionUser?.nombre || 'Invitado'}</p>
              <p className="text-[10px] text-fg-subtle">{authorBrand}</p>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-soft flex items-center justify-center text-brand text-sm font-semibold border border-border">
              {sessionUser?.nombre?.slice(0, 2).toUpperCase() || 'IT'}
            </div>
          </div>
        </div>

        <div className="relative w-full md:hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="search"
            placeholder="Buscar..."
            aria-label="Buscar"
            className={SEARCH_CLASS}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex sm:hidden items-center justify-between gap-3 text-xs font-medium">
          <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${statusClass}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
            <span>{backendConnected ? 'Online' : 'Offline'}</span>
            {isSyncing && <span className="text-fg-subtle">Sync</span>}
          </div>
          <div className="text-right min-w-0 leading-tight">
            <p className="text-fg-subtle truncate capitalize">{sessionUser?.rol || 'sin rol'}</p>
            <p className="text-fg truncate">{sessionUser?.nombre || 'Invitado'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
