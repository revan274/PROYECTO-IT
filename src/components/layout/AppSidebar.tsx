import { LogOut } from 'lucide-react';
import type { ComponentType } from 'react';
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
  onSelectView: (view: TView) => void;
  onLogout: () => void;
  authorBrand: string;
}

export function AppSidebar<TView extends string>({
  view,
  navItems,
  sidebarOpen,
  onSelectView,
  onLogout,
  authorBrand,
}: AppSidebarProps<TView>) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white flex flex-col border-r border-slate-100 transform transition-transform duration-300 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-10 flex items-center gap-3">
        <LogoGigantes className="w-10 h-10" />
        <h1 className="text-xl font-black text-[#F58220]">GIGANTES</h1>
      </div>
      <nav className="flex-1 px-6 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-wider ${view === item.id ? 'bg-[#F58220] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-8">
        <p className="mb-4 text-[9px] font-semibold tracking-[0.08em] text-slate-300">
          {authorBrand}
        </p>
        <button onClick={onLogout} className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">
          <LogOut size={14} /> Cerrar Sistema
        </button>
      </div>
    </aside>
  );
}
