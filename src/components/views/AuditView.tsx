import React from 'react';
import { Download } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type {
  AuditAlertsState,
  AuditFiltersState,
  AuditIntegrityState,
  AuditModule,
  AuditPaginationState,
  RegistroAuditoria,
} from '../../types/app';

interface AuditViewProps {
  isAuditLoading: boolean;
  auditRowsForGrouping: RegistroAuditoria[];
  resetAuditFilters: () => void;
  fetchAuditHistory: () => Promise<void>;
  descargarAuditoria: (module?: AuditModule) => void;
  auditFilters: AuditFiltersState;
  updateAuditFilters: (filters: Partial<AuditFiltersState>) => void;
  auditModuleTotals: { tickets: number; insumos: number; activos: number; otros: number };
  auditResultTotals: { ok: number; error: number };
  auditIntegrity: AuditIntegrityState | null;
  auditAlerts: AuditAlertsState | null;
  auditByModule: {
    tickets: RegistroAuditoria[];
    insumos: RegistroAuditoria[];
    activos: RegistroAuditoria[];
    otros: RegistroAuditoria[];
  };
  backendConnected: boolean;
  isRequesterOnlyUser?: boolean;
  setAuditPage: React.Dispatch<React.SetStateAction<number>>;
  auditPagination: AuditPaginationState;
  auditPageSize: number;
  setAuditPageSize: React.Dispatch<React.SetStateAction<number>>;
}

export const AuditView: React.FC<AuditViewProps> = ({
  isAuditLoading,
  auditRowsForGrouping,
  resetAuditFilters,
  fetchAuditHistory,
  descargarAuditoria,
  auditFilters,
  updateAuditFilters,
  auditModuleTotals,
  auditResultTotals,
  auditIntegrity,
  auditAlerts,
  auditByModule,
  backendConnected,
  isRequesterOnlyUser,
  setAuditPage,
  auditPagination,
  auditPageSize,
  setAuditPageSize,
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel bg-white/90 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trazabilidad</p>
            <h3 className="font-black font-['Outfit'] text-slate-800 uppercase tracking-tight text-2xl">Auditoría Ejecutiva</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {isAuditLoading ? 'Consultando registros...' : `Registros mostrados: ${auditRowsForGrouping.length}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetAuditFilters}
              className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50"
            >
              Limpiar Filtros
            </button>
            <button
              onClick={() => void fetchAuditHistory()}
              className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-500 hover:bg-slate-50"
            >
              Actualizar
            </button>
            <button
              onClick={() => descargarAuditoria()}
              className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <select
            value={auditFilters.module}
            onChange={(e) => updateAuditFilters({ module: (e.target.value || '') as '' | AuditModule })}
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 bg-white"
          >
            <option value="">Modulo: Todos</option>
            <option value="tickets">Tickets</option>
            <option value="insumos">Insumos</option>
            <option value="activos">Activos</option>
            <option value="otros">Otros</option>
          </select>
          <select
            value={auditFilters.result}
            onChange={(e) => updateAuditFilters({ result: (e.target.value || '') as '' | 'ok' | 'error' })}
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 bg-white"
          >
            <option value="">Resultado: Todos</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
          </select>
          <input
            value={auditFilters.user}
            onChange={(e) => updateAuditFilters({ user: e.target.value })}
            placeholder="Usuario / rol / depto"
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
          <input
            value={auditFilters.action}
            onChange={(e) => updateAuditFilters({ action: e.target.value })}
            placeholder="Acción"
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
          <input
            value={auditFilters.entity}
            onChange={(e) => updateAuditFilters({ entity: e.target.value })}
            placeholder="Entidad"
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
          <input
            value={auditFilters.q}
            onChange={(e) => updateAuditFilters({ q: e.target.value })}
            placeholder="Búsqueda libre"
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
          <input
            type="date"
            value={auditFilters.from}
            onChange={(e) => updateAuditFilters({ from: e.target.value })}
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
          <input
            type="date"
            value={auditFilters.to}
            onChange={(e) => updateAuditFilters({ to: e.target.value })}
            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 hover-lift backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Tickets</p>
          <p className="text-3xl font-black text-blue-700">{auditModuleTotals.tickets}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50/80 p-4 hover-lift backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Insumos</p>
          <p className="text-3xl font-black text-green-700">{auditModuleTotals.insumos}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50/80 p-4 hover-lift backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Activos IT</p>
          <p className="text-3xl font-black text-orange-700">{auditModuleTotals.activos}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 hover-lift backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Otros</p>
          <p className="text-3xl font-black text-slate-700">{auditModuleTotals.otros}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">OK / ERROR</p>
          <p className="text-xl font-black text-emerald-700">{auditResultTotals.ok} / {auditResultTotals.error}</p>
        </div>
        <div className={auditIntegrity?.ok === false ? 'rounded-2xl border border-red-100 bg-red-50 p-4' : 'rounded-2xl border border-lime-100 bg-lime-50 p-4'}>
          <p className={auditIntegrity?.ok === false ? 'text-[10px] font-black uppercase tracking-widest text-red-500' : 'text-[10px] font-black uppercase tracking-widest text-lime-600'}>
            Integridad
          </p>
          <p className={auditIntegrity?.ok === false ? 'text-sm font-black uppercase text-red-700' : 'text-sm font-black uppercase text-lime-700'}>
            {auditIntegrity?.ok === false ? `Incidencias: ${auditIntegrity.invalid}` : 'Cadena OK'}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            Alertas 24h: {auditAlerts?.errorCount24h || 0}
          </p>
        </div>
      </div>

      {([
        { module: 'tickets' as AuditModule, title: 'Auditoría Tickets', rows: auditByModule.tickets },
        { module: 'insumos' as AuditModule, title: 'Auditoría Insumos', rows: auditByModule.insumos },
        { module: 'activos' as AuditModule, title: 'Auditoría Activos IT', rows: auditByModule.activos },
        { module: 'otros' as AuditModule, title: 'Auditoría Otros', rows: auditByModule.otros },
      ]).map((section) => (
        <div key={`audit-${section.module}`} className="glass-panel bg-white/90 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h4 className="font-black font-['Outfit'] text-slate-800 uppercase tracking-tight">{section.title}</h4>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{section.rows.length} registros</span>
            </div>
            <button
              onClick={() => descargarAuditoria(section.module)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download size={14} /> CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Fecha</th>
                  <th className="px-8 py-4">Usuario</th>
                  <th className="px-8 py-4">Acción</th>
                  <th className="px-8 py-4">Item</th>
                  <th className="px-8 py-4">Resultado</th>
                  <th className="px-8 py-4 text-right">Cant.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {section.rows.map((log) => (
                  <tr key={`${section.module}-${log.id}`}>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500 tracking-tighter">{log.fecha}</td>
                    <td className="px-8 py-4 text-[10px] font-black text-[#8CC63F] uppercase tracking-widest">{log.usuario}</td>
                    <td className="px-8 py-4"><Badge variant={log.accion}>{log.accion}</Badge></td>
                    <td className="px-8 py-4 font-black text-slate-800 uppercase text-xs">{log.item}</td>
                    <td className="px-8 py-4">
                      <span
                        className={
                          (log.resultado || 'ok') === 'error'
                            ? 'inline-flex px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest border-red-200 bg-red-50 text-red-600'
                            : 'inline-flex px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest border-emerald-200 bg-emerald-50 text-emerald-600'
                        }
                      >
                        {(log.resultado || 'ok').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-black text-slate-800 text-right">{log.cantidad}</td>
                  </tr>
                ))}
                {section.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                      Sin movimientos registrados para {section.title.toLowerCase()}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {backendConnected && !isRequesterOnlyUser && (
        <div className="glass-panel bg-white/90 rounded-[2rem] shadow-2xl border border-slate-100 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuditPage((prev: number) => Math.max(1, prev - 1))}
              disabled={isAuditLoading || auditPagination.page <= 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setAuditPage((prev: number) => Math.min(auditPagination.totalPages || 1, prev + 1))}
              disabled={isAuditLoading || auditPagination.page >= (auditPagination.totalPages || 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 disabled:opacity-40"
            >
              Siguiente
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Página {auditPagination.page} de {auditPagination.totalPages} | Total {auditPagination.total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamaño</span>
            <select
              value={String(auditPageSize)}
              onChange={(e) => {
                const size = Number(e.target.value) || 25;
                setAuditPageSize(size);
                setAuditPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 bg-white"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
