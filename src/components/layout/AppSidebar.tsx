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
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Cerrar menu"
        onClick={onCloseSidebar}
        className={`fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-72 flex flex-col
          bg-white border-r border-slate-100/80
          shadow-[4px_0_24px_rgba(0,0,0,0.06)]
          transform transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:w-72
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="px-6 py-7 sm:px-8 sm:py-8 flex items-center gap-4 border-b border-slate-50">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#F58220] to-[#D4690A] flex items-center justify-center shadow-lg shadow-orange-200 shrink-0">
            <LogoGigantes className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight text-[#F58220] truncate leading-tight">
              GIGANTES
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 leading-tight">
              Mesa IT
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={getItemHref(item.id)}
              onClick={onCloseSidebar}
              className={({ isActive }) =>
                `w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[1.25rem] text-xs font-black uppercase tracking-wider
                transition-all duration-200 select-none
                ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`w-8 h-8 rounded-[0.75rem] flex items-center justify-center shrink-0 transition-colors duration-200
                      ${isActive
                        ? 'bg-white/20'
                        : 'bg-slate-100 group-hover:bg-slate-200'
                      }`}
                  >
                    <item.icon className="w-4 h-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-5 sm:px-6 sm:py-6 border-t border-slate-50">
          <p className="mb-4 text-[9px] font-semibold tracking-[0.08em] text-slate-300 break-words leading-relaxed">
            {authorBrand}
          </p>
          <button
            onClick={onLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl
              text-[10px] font-black text-red-400 uppercase tracking-widest
              hover:bg-red-50 hover:text-red-600
              transition-all duration-200 btn-press w-full"
          >
            <LogOut size={13} />
            Cerrar Sistema
          </button>
        </div>
      </aside>
    </>
  );
}
