import React from 'react';
import type { Activo, Insumo, TicketItem, ViewType } from '../../types/app';
import { DASHBOARD_RANGES } from '../../constants/app';
import { Badge } from '../ui/Badge';
import { getSupplyHealthStatus } from '../../utils/appHelpers';
import {
  normalizeTicketAttentionType,
  formatTicketAttentionType,
  getSlaStatus,
} from '../../utils/tickets';
import { formatDateTime } from '../../utils/format';

interface Trend {
  label: string;
  toneClass: string;
}

interface BarChartItem {
  label: string;
  count: number;
}

interface DashboardViewProps {
  dashboardWindow: { label: string };
  dashboardOpenTicketsCurrent: any[];
  dashboardCriticalTicketsCurrent: any[];
  dashboardUnassignedCount: number;
  dashboardRange: string;
  setDashboardRange: (val: any) => void;
  systemHealth: number;
  insumos: Insumo[];
  dashboardOpenTrend: Trend;
  activos: Activo[];
  dashboardCriticalTrend: Trend;
  dashboardSlaExpiredCount: number;
  dashboardSlaTrend: Trend;
  setView: (view: ViewType) => void;
  applyTicketFocus: (focus: string) => void;
  dashboardRecentTickets: TicketItem[];
  setSearchTerm: (term: string) => void;
  dashboardTopOwners: Array<[string, number]>;
  dashboardOwnerMax: number;
  dashboardInProcessCount: number;
  applyInventoryFocus: (focus: string) => void;
  activosSinResponsable: number;
  activosVidaAlta: number;
  effectiveRiskSummary: { duplicateIpCount: number; duplicateMacCount: number };
  dashboardStateBars: BarChartItem[];
  dashboardStateMax: number;
  dashboardBranchBars: BarChartItem[];
  dashboardBranchMax: number;
  dashboardSlaCompliancePct: number;
  dashboardSlaCompliantCount: number;
  dashboardSlaTotalCount: number;
  dashboardAgingBars: BarChartItem[];
  dashboardAgingMax: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboardWindow,
  dashboardOpenTicketsCurrent,
  dashboardCriticalTicketsCurrent,
  dashboardUnassignedCount,
  dashboardRange,
  setDashboardRange,
  systemHealth,
  insumos,
  dashboardOpenTrend,
  activos,
  dashboardCriticalTrend,
  dashboardSlaExpiredCount,
  dashboardSlaTrend,
  setView,
  applyTicketFocus,
  dashboardRecentTickets,
  setSearchTerm,
  dashboardTopOwners,
  dashboardOwnerMax,
  dashboardInProcessCount,
  applyInventoryFocus,
  activosSinResponsable,
  activosVidaAlta,
  effectiveRiskSummary,
  dashboardStateBars,
  dashboardStateMax,
  dashboardBranchBars,
  dashboardBranchMax,
  dashboardSlaCompliancePct,
  dashboardSlaCompliantCount,
  dashboardSlaTotalCount,
  dashboardAgingBars,
  dashboardAgingMax,
}) => {
  return (
    <div className="space-y-8">
      <div className="bg-slate-800 text-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] flex flex-col gap-6 md:flex-row md:items-center md:justify-between shadow-2xl relative overflow-hidden">
        <div className="z-10 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-2">Estado del Sistema</h2>
          <p className="text-slate-400 text-sm">Resumen operativo | Periodo: {dashboardWindow.label}</p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Abiertos: {dashboardOpenTicketsCurrent.length} | Criticos: {dashboardCriticalTicketsCurrent.length} | Sin Asignar: {dashboardUnassignedCount}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DASHBOARD_RANGES.map((range) => (
              <button
                key={`dash-range-${range.value}`}
                onClick={() => setDashboardRange(range.value)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                  dashboardRange === range.value
                    ? 'bg-[#F58220] text-white border-[#F58220]'
                    : 'bg-white/5 text-slate-200 border-white/20 hover:bg-white/10'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="z-10 self-start md:self-auto">
          <div className="text-left md:text-right">
            <p className="text-4xl sm:text-5xl font-black">{systemHealth}%</p>
            <p className="text-[10px] font-black text-[#8CC63F] uppercase tracking-widest">Salud IT</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
        <div onClick={() => setView('supplies')} className="bg-[#F58220] p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-xl cursor-pointer">
          <p className="text-xs font-black uppercase opacity-60 mb-2">Stock Bajo</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black">{insumos.filter((i) => getSupplyHealthStatus(i) !== 'OK').length}</h2>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-white/70">Snapshot actual</p>
        </div>
        <div onClick={() => applyTicketFocus('ABIERTOS')} className="bg-white p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] text-slate-800 border border-slate-100 shadow-xl cursor-pointer">
          <p className="text-xs font-black uppercase text-slate-400 mb-2">Tickets Abiertos</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#F58220]">{dashboardOpenTicketsCurrent.length}</h2>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardOpenTrend.toneClass}`}>{dashboardOpenTrend.label}</p>
        </div>
        <div onClick={() => setView('inventory')} className="bg-[#8CC63F] p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-xl cursor-pointer">
          <p className="text-xs font-black uppercase opacity-60 mb-2">Activos</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black">{activos.length}</h2>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-white/70">Snapshot actual</p>
        </div>
        <div onClick={() => applyTicketFocus('CRITICA')} className="bg-amber-50 p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] text-amber-700 border border-amber-100 shadow-xl cursor-pointer">
          <p className="text-xs font-black uppercase opacity-60 mb-2">Críticos</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black">{dashboardCriticalTicketsCurrent.length}</h2>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardCriticalTrend.toneClass}`}>{dashboardCriticalTrend.label}</p>
        </div>
        <div onClick={() => applyTicketFocus('SLA')} className="bg-red-50 p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] text-red-600 border border-red-100 shadow-xl cursor-pointer">
          <p className="text-xs font-black uppercase opacity-60 mb-2">SLA Vencido</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black">{dashboardSlaExpiredCount}</h2>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardSlaTrend.toneClass}`}>{dashboardSlaTrend.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad Reciente | {dashboardWindow.label}</p>
              <h3 className="text-lg font-black uppercase text-slate-800">Ultimos Tickets del Periodo</h3>
            </div>
            <button
              onClick={() => setView('tickets')}
              className="px-5 py-2 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Ver Todo
            </button>
          </div>

          <div className="space-y-3">
            {dashboardRecentTickets.map((ticket) => (
              <button
                key={`recent-${ticket.id}`}
                onClick={() => {
                  setView('tickets');
                  setSearchTerm(ticket.activoTag);
                }}
                className="w-full text-left border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                  <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                  <Badge variant={normalizeTicketAttentionType(ticket.atencionTipo) || 'sin definir'}>
                    {formatTicketAttentionType(ticket.atencionTipo)}
                  </Badge>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                    {getSlaStatus(ticket).label}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">#{ticket.id}</span>
                </div>
                <p className="text-sm font-black uppercase text-slate-800">{ticket.activoTag} | {ticket.descripcion}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                  Asignado: {ticket.asignadoA || 'Sin asignar'} | Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)}
                </p>
              </button>
            ))}
            {dashboardRecentTickets.length === 0 && (
              <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                Sin tickets en el periodo seleccionado.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga Operativa</p>
            <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Tickets por Tecnico</h3>
            <div className="space-y-3">
              {dashboardTopOwners.map(([owner, count]) => (
                <div key={`owner-${owner}`} className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-700">{owner}</span>
                    <span className="text-xs font-black text-[#F58220]">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#F58220]"
                      style={{ width: `${Math.round((count / dashboardOwnerMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {dashboardTopOwners.length === 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black uppercase text-slate-400">
                  Sin tickets asignados.
                </div>
              )}
              <button
                onClick={() => applyTicketFocus('SIN_ASIGNAR')}
                className="w-full bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
              >
                Sin asignar: {dashboardUnassignedCount}
              </button>
              <button
                onClick={() => applyTicketFocus('EN_PROCESO')}
                className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
              >
                En proceso: {dashboardInProcessCount}
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Riesgos Inventario</p>
            <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Atencion Prioritaria</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('SIN_RESP');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin Responsable</p>
                <p className="text-xl font-black text-red-500">{activosSinResponsable}</p>
              </button>
              <button
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('VIDA_ALTA');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vida Util Alta</p>
                <p className="text-xl font-black text-amber-500">{activosVidaAlta}</p>
              </button>
              <button
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('DUP_RED');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duplicados de Red</p>
                <p className="text-xl font-black text-slate-700">{effectiveRiskSummary.duplicateIpCount + effectiveRiskSummary.duplicateMacCount}</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8 space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribucion de Tickets</p>
            <h3 className="text-lg font-black uppercase text-slate-800">Estado y Sucursal ({dashboardWindow.label})</h3>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Por estado</p>
            {dashboardStateBars.map((item) => (
              <div key={`state-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#8CC63F]"
                    style={{ width: `${Math.round((item.count / dashboardStateMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Por sucursal</p>
            {dashboardBranchBars.map((item) => (
              <div key={`branch-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${Math.round((item.count / dashboardBranchMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {dashboardBranchBars.length === 0 && (
              <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                Sin tickets en el periodo.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8 space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLA y Aging</p>
            <h3 className="text-lg font-black uppercase text-slate-800">Cumplimiento y Antiguedad ({dashboardWindow.label})</h3>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase text-slate-600">SLA Cumplido</p>
              <p className="text-xl font-black text-green-600">{dashboardSlaCompliancePct}%</p>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${dashboardSlaCompliancePct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
              <span>Cumplidos: {dashboardSlaCompliantCount}</span>
              <span>Vencidos: {dashboardSlaExpiredCount}</span>
              <span>Total: {dashboardSlaTotalCount}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aging tickets abiertos</p>
            {dashboardAgingBars.map((item) => (
              <div key={`aging-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${Math.round((item.count / dashboardAgingMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardView;
