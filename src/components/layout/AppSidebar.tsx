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
        className={`fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-md transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[88vw] max-w-80 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="premium-panel flex h-full flex-col rounded-none border-l-0 border-y-0 px-5 py-5 sm:px-6 sm:py-6 lg:rounded-r-[2.4rem] lg:border-y lg:border-r">
          <div className="flex items-center gap-3 rounded-[1.8rem] border border-white/15 bg-slate-950/[0.03] px-4 py-4 sm:px-5">
            <div className="premium-panel-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem]">
              <LogoGigantes className="h-9 w-9 shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Mesa IT</p>
              <h1 className="truncate text-lg font-black tracking-tight text-slate-900">GIGANTES</h1>
              <p className="truncate text-[11px] font-semibold text-slate-500">Operations console</p>
            </div>
          </div>
          <div className="mt-5 px-1">
            <span className="premium-chip">Luxury Glass Operations</span>
          </div>

          <nav className="mt-6 flex-1 space-y-2 overflow-y-auto px-1 pb-4">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={getItemHref(item.id)}
                onClick={onCloseSidebar}
                className={({ isActive }) =>
                  `premium-nav-link flex w-full items-center gap-3 rounded-[1.45rem] px-3 py-3.5 text-left text-[11px] font-black uppercase tracking-[0.18em] ${
                    isActive
                      ? 'premium-nav-link-active'
                      : 'text-slate-500 hover:bg-white/35 hover:text-slate-800'
                  }`
                }
              >
                <span className="premium-nav-icon">
                  <item.icon className="h-5 w-5 shrink-0" />
                </span>
                <span className="relative z-10 truncate">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-6">
            <p className="mb-4 break-words text-[10px] font-semibold tracking-[0.12em] text-slate-400">
              {authorBrand}
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="premium-button flex w-full items-center justify-between rounded-[1.35rem] border border-red-200/50 bg-red-50/80 px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-red-500 hover:border-red-300 hover:bg-red-50"
            >
              <span className="flex items-center gap-2">
                <LogOut size={14} />
                Cerrar Sistema
              </span>
              <span className="text-[11px]">01</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
