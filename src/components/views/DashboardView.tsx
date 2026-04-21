import React from 'react';
import type { Activo, DashboardRange, Insumo, TicketItem, ViewType } from '../../types/app';
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
  dashboardOpenTicketsCurrent: TicketItem[];
  dashboardCriticalTicketsCurrent: TicketItem[];
  dashboardUnassignedCount: number;
  dashboardRange: DashboardRange;
  setDashboardRange: (val: DashboardRange) => void;
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

const lowStockCount = (insumos: Insumo[]) =>
  insumos.filter((i) => getSupplyHealthStatus(i) !== 'OK').length;

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
  const healthColor =
    systemHealth >= 80 ? '#8CC63F' : systemHealth >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-8 view-enter">

      {/* ── Hero Banner ──────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[2.5rem] sm:rounded-[3rem] p-7 sm:p-10
          bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800
          shadow-2xl shadow-slate-900/30"
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #F58220 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8CC63F 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
              Mesa IT · Resumen Operativo
            </p>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-tight">
              Estado del Sistema
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Periodo activo:{' '}
              <span className="text-slate-200 font-semibold">{dashboardWindow.label}</span>
            </p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Abiertos:{' '}
              <span className="text-slate-300">{dashboardOpenTicketsCurrent.length}</span>
              {' · '}Críticos:{' '}
              <span className="text-red-400">{dashboardCriticalTicketsCurrent.length}</span>
              {' · '}Sin Asignar:{' '}
              <span className="text-amber-400">{dashboardUnassignedCount}</span>
            </p>

            {/* Range selector */}
            <div className="mt-5 flex flex-wrap gap-2">
              {DASHBOARD_RANGES.map((range) => (
                <button
                  key={`dash-range-${range.value}`}
                  onClick={() => setDashboardRange(range.value)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider
                    border transition-all duration-200 btn-press
                    ${dashboardRange === range.value
                      ? 'bg-[#F58220] text-white border-[#F58220] shadow-lg shadow-orange-500/25'
                      : 'bg-white/5 text-slate-300 border-white/15 hover:bg-white/10 hover:border-white/25'
                    }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Health Ring */}
          <div className="self-start md:self-center flex flex-col items-center gap-1">
            <p
              className="text-5xl sm:text-6xl font-black number-in"
              style={{ color: healthColor }}
            >
              {systemHealth}%
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Salud IT
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-5">

        {/* Stock Bajo */}
        <button
          onClick={() => setView('supplies')}
          className="stagger-card brand-glow card-premium p-6 sm:p-8 text-left cursor-pointer
            bg-gradient-to-br from-[#F58220] to-[#E0751A] !border-transparent"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
            Stock Bajo
          </p>
          <p className="text-5xl sm:text-6xl font-black text-white number-in">
            {lowStockCount(insumos)}
          </p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-white/50">
            Snapshot actual
          </p>
        </button>

        {/* Tickets Abiertos */}
        <button
          onClick={() => applyTicketFocus('ABIERTOS')}
          className="stagger-card card-premium p-6 sm:p-8 text-left cursor-pointer"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
            Tickets Abiertos
          </p>
          <p className="text-5xl sm:text-6xl font-black text-[#F58220] number-in">
            {dashboardOpenTicketsCurrent.length}
          </p>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardOpenTrend.toneClass}`}>
            {dashboardOpenTrend.label}
          </p>
        </button>

        {/* Activos */}
        <button
          onClick={() => setView('inventory')}
          className="stagger-card brand-glow card-premium p-6 sm:p-8 text-left cursor-pointer
            bg-gradient-to-br from-[#8CC63F] to-[#6dab24] !border-transparent"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
            Activos
          </p>
          <p className="text-5xl sm:text-6xl font-black text-white number-in">
            {activos.length}
          </p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-white/50">
            Snapshot actual
          </p>
        </button>

        {/* Críticos */}
        <button
          onClick={() => applyTicketFocus('CRITICA')}
          className="stagger-card card-premium p-6 sm:p-8 text-left cursor-pointer
            bg-amber-50/80 !border-amber-100"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-2">
            Críticos
          </p>
          <p className="text-5xl sm:text-6xl font-black text-amber-600 number-in">
            {dashboardCriticalTicketsCurrent.length}
          </p>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardCriticalTrend.toneClass}`}>
            {dashboardCriticalTrend.label}
          </p>
        </button>

        {/* SLA Vencido */}
        <button
          onClick={() => applyTicketFocus('SLA')}
          className="stagger-card card-premium p-6 sm:p-8 text-left cursor-pointer
            bg-red-50/80 !border-red-100"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">
            SLA Vencido
          </p>
          <p className="text-5xl sm:text-6xl font-black text-red-600 number-in">
            {dashboardSlaExpiredCount}
          </p>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${dashboardSlaTrend.toneClass}`}>
            {dashboardSlaTrend.label}
          </p>
        </button>
      </div>

      {/* ── Main Content Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">

        {/* Recent Tickets */}
        <div className="xl:col-span-2 card-premium p-6 sm:p-8 stagger-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Actividad · {dashboardWindow.label}
              </p>
              <h3 className="text-lg font-black uppercase text-slate-800 leading-tight">
                Últimos Tickets del Periodo
              </h3>
            </div>
            <button
              onClick={() => setView('tickets')}
              className="shrink-0 px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-black uppercase
                text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 btn-press"
            >
              Ver Todo →
            </button>
          </div>

          <div className="space-y-3">
            {dashboardRecentTickets.map((ticket, i) => (
              <button
                key={`recent-${ticket.id}`}
                onClick={() => {
                  setView('tickets');
                  setSearchTerm(ticket.activoTag);
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className="stagger-card w-full text-left rounded-2xl p-4
                  border border-slate-100 hover:border-[#F58220]/30 hover:bg-[#F58220]/[0.02]
                  transition-all duration-200 hover:shadow-sm"
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
                    #{ticket.id}
                  </span>
                </div>
                <p className="text-sm font-black uppercase text-slate-800">
                  {ticket.activoTag} · {ticket.descripcion}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1.5">
                  Asignado: {ticket.asignadoA || 'Sin asignar'} · {formatDateTime(ticket.fechaCreacion || ticket.fecha)}
                </p>
              </button>
            ))}
            {dashboardRecentTickets.length === 0 && (
              <div className="border-2 border-dashed border-slate-100 rounded-2xl p-10 text-center
                text-xs font-black uppercase tracking-wider text-slate-300">
                Sin tickets en el periodo seleccionado.
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Tickets por Técnico */}
          <div className="card-premium p-6 sm:p-7 stagger-card">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Carga Operativa
            </p>
            <h3 className="text-base font-black uppercase text-slate-800 mb-5">
              Tickets por Técnico
            </h3>
            <div className="space-y-3">
              {dashboardTopOwners.map(([owner, count]) => (
                <div key={`owner-${owner}`} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-600 truncate mr-2">
                      {owner}
                    </span>
                    <span className="text-xs font-black text-[#F58220] shrink-0">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bar-animated rounded-full"
                      style={{
                        width: `${Math.round((count / dashboardOwnerMax) * 100)}%`,
                        background: 'linear-gradient(90deg, #F58220, #E0751A)',
                      }}
                    />
                  </div>
                </div>
              ))}
              {dashboardTopOwners.length === 0 && (
                <p className="text-xs font-black uppercase text-slate-300">Sin tickets asignados.</p>
              )}

              <button
                onClick={() => applyTicketFocus('SIN_ASIGNAR')}
                className="w-full mt-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl px-4 py-3
                  text-xs font-black uppercase text-left hover:bg-amber-100 transition-colors duration-200 btn-press"
              >
                Sin asignar: {dashboardUnassignedCount}
              </button>
              <button
                onClick={() => applyTicketFocus('EN_PROCESO')}
                className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl px-4 py-3
                  text-xs font-black uppercase text-left hover:bg-indigo-100 transition-colors duration-200 btn-press"
              >
                En proceso: {dashboardInProcessCount}
              </button>
            </div>
          </div>

          {/* Riesgos Inventario */}
          <div className="card-premium p-6 sm:p-7 stagger-card">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Riesgos Inventario
            </p>
            <h3 className="text-base font-black uppercase text-slate-800 mb-5">
              Atención Prioritaria
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: 'Sin Responsable',
                  value: activosSinResponsable,
                  color: 'text-red-500',
                  focus: 'SIN_RESP',
                },
                {
                  label: 'Vida Útil Alta',
                  value: activosVidaAlta,
                  color: 'text-amber-500',
                  focus: 'VIDA_ALTA',
                },
                {
                  label: 'Duplicados de Red',
                  value: effectiveRiskSummary.duplicateIpCount + effectiveRiskSummary.duplicateMacCount,
                  color: 'text-slate-700',
                  focus: 'DUP_RED',
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setView('inventory');
                    applyInventoryFocus(item.focus);
                  }}
                  className="w-full border border-slate-100 rounded-2xl px-4 py-3.5 text-left
                    hover:bg-slate-50 hover:border-slate-200 transition-all duration-200 btn-press"
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {item.label}
                  </p>
                  <p className={`text-2xl font-black ${item.color} mt-0.5`}>{item.value}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">

        {/* Estado & Sucursal */}
        <div className="card-premium p-6 sm:p-8 space-y-6 stagger-card">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Distribución de Tickets
            </p>
            <h3 className="text-lg font-black uppercase text-slate-800">
              Estado y Sucursal · {dashboardWindow.label}
            </h3>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Por estado
            </p>
            {dashboardStateBars.map((item) => (
              <div key={`state-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bar-animated rounded-full"
                    style={{
                      width: `${Math.round((item.count / dashboardStateMax) * 100)}%`,
                      background: 'linear-gradient(90deg, #8CC63F, #6dab24)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Por sucursal
            </p>
            {dashboardBranchBars.map((item) => (
              <div key={`branch-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bar-animated rounded-full"
                    style={{
                      width: `${Math.round((item.count / dashboardBranchMax) * 100)}%`,
                      background: 'linear-gradient(90deg, #6366f1, #4f46e5)',
                    }}
                  />
                </div>
              </div>
            ))}
            {dashboardBranchBars.length === 0 && (
              <div className="border-2 border-dashed border-slate-100 rounded-2xl p-4 text-center
                text-[10px] font-black uppercase tracking-wider text-slate-300">
                Sin tickets en el periodo.
              </div>
            )}
          </div>
        </div>

        {/* SLA & Aging */}
        <div className="card-premium p-6 sm:p-8 space-y-6 stagger-card">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              SLA y Aging
            </p>
            <h3 className="text-lg font-black uppercase text-slate-800">
              Cumplimiento y Antigüedad · {dashboardWindow.label}
            </h3>
          </div>

          {/* SLA bar */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase text-slate-600">SLA Cumplido</p>
              <p
                className="text-2xl font-black number-in"
                style={{ color: dashboardSlaCompliancePct >= 70 ? '#8CC63F' : '#ef4444' }}
              >
                {dashboardSlaCompliancePct}%
              </p>
            </div>
            <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bar-animated rounded-full"
                style={{
                  width: `${dashboardSlaCompliancePct}%`,
                  background: `linear-gradient(90deg, ${dashboardSlaCompliancePct >= 70 ? '#8CC63F, #6dab24' : '#ef4444, #dc2626'})`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
              <span className="text-green-600">✓ {dashboardSlaCompliantCount}</span>
              <span className="text-red-500">✗ {dashboardSlaExpiredCount}</span>
              <span className="text-slate-400">Total {dashboardSlaTotalCount}</span>
            </div>
          </div>

          {/* Aging bars */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Aging tickets abiertos
            </p>
            {dashboardAgingBars.map((item) => (
              <div key={`aging-${item.label}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bar-animated rounded-full"
                    style={{
                      width: `${Math.round((item.count / dashboardAgingMax) * 100)}%`,
                      background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }}
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
