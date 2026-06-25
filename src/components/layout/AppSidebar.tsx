import { LogOut } from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { LogoGigantes } from '../brand/LogoGigantes';

interface NavItem<TView extends string> {
  id: TView;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

interface AppSidebarProps<TView extends string> {
  navItems: NavItem<TView>[];
  sidebarOpen: boolean;
  getItemHref: (view: TView) => string;
  onCloseSidebar: () => void;
  onLogout: () => void;
  authorBrand: string;
}

export function AppSidebar<TView extends string>({
  navItems,
  sidebarOpen,
  getItemHref,
  onCloseSidebar,
  onLogout,
  authorBrand,
}: AppSidebarProps<TView>) {
  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menu"
        onClick={onCloseSidebar}
        className={`fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[84vw] max-w-72 bg-surface flex flex-col border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:w-64 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 flex items-center gap-3 border-b border-border">
          <LogoGigantes className="w-9 h-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-brand truncate">GIGANTES</h1>
            <p className="text-[11px] font-medium tracking-wide text-fg-subtle">Mesa IT</p>
          </div>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={getItemHref(item.id)}
              onClick={onCloseSidebar}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand text-brand-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <p className="mb-3 text-[11px] text-fg-subtle break-words">
            {authorBrand}
          </p>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm font-medium text-danger hover:opacity-80 transition-opacity">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
