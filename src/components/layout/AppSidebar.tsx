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
  view: TView;
  navItems: NavItem<TView>[];
  sidebarOpen: boolean;
  getItemHref: (view: TView) => string;
  onCloseSidebar: () => void;
  onLogout: () => void;
  authorBrand: string;
}

export function AppSidebar<TView extends string>({
  view,
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
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-72 bg-white flex flex-col border-r border-slate-100 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:w-72 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex items-center gap-3">
          <LogoGigantes className="w-10 h-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#F58220] truncate">GIGANTES</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Mesa IT</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={getItemHref(item.id)}
              onClick={onCloseSidebar}
              className={`w-full flex items-center gap-4 px-4 py-3 sm:px-5 sm:py-4 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-wider ${view === item.id ? 'bg-[#F58220] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-6 sm:p-8 border-t border-slate-100">
          <p className="mb-4 text-[9px] font-semibold tracking-[0.08em] text-slate-300 break-words">
            {authorBrand}
          </p>
          <button onClick={onLogout} className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">
            <LogOut size={14} /> Cerrar Sistema
          </button>
        </div>
      </aside>
    </>
  );
}
