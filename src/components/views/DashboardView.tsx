import React from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronRight,
  Clock3,
  HardDrive,
  ShieldCheck,
  UserRoundSearch,
  Workflow,
} from 'lucide-react';
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
  const stockAlertCount = insumos.filter((item) => getSupplyHealthStatus(item) !== 'OK').length;
  const duplicateNetworkCount = effectiveRiskSummary.duplicateIpCount + effectiveRiskSummary.duplicateMacCount;
  const safeHealth = Math.max(0, Math.min(systemHealth, 100));
  const ringStyle = {
    background: `conic-gradient(#f58220 0deg ${safeHealth * 3.6}deg, rgba(148, 163, 184, 0.18) ${safeHealth * 3.6}deg 360deg)`,
  };

  const resolveBarWidth = (count: number, max: number): string => {
    if (count <= 0 || max <= 0) return '0%';
    return `${Math.max(10, Math.round((count / max) * 100))}%`;
  };

  const kpiCards = [
    {
      key: 'stock',
      label: 'Stock Bajo',
      value: stockAlertCount,
      meta: 'Insumos a vigilar',
      detail: 'Ir a suministros',
      icon: Boxes,
      toneClass: 'premium-kpi-card-orange',
      valueClass: 'text-[#f58220]',
      buttonClass: 'hover:border-[#f58220]/35',
      onClick: () => setView('supplies'),
    },
    {
      key: 'open',
      label: 'Tickets Abiertos',
      value: dashboardOpenTicketsCurrent.length,
      meta: dashboardOpenTrend.label,
      detail: 'Abrir foco operativo',
      icon: Activity,
      toneClass: 'premium-kpi-card-blue',
      valueClass: 'text-sky-600',
      buttonClass: 'hover:border-sky-400/35',
      onClick: () => applyTicketFocus('ABIERTOS'),
    },
    {
      key: 'assets',
      label: 'Activos IT',
      value: activos.length,
      meta: 'Inventario vigente',
      detail: 'Explorar inventario',
      icon: HardDrive,
      toneClass: 'premium-kpi-card-green',
      valueClass: 'text-[#6aa323]',
      buttonClass: 'hover:border-[#8CC63F]/35',
      onClick: () => setView('inventory'),
    },
    {
      key: 'critical',
      label: 'Críticos',
      value: dashboardCriticalTicketsCurrent.length,
      meta: dashboardCriticalTrend.label,
      detail: 'Prioridad máxima',
      icon: AlertTriangle,
      toneClass: 'premium-kpi-card-orange',
      valueClass: 'text-amber-600',
      buttonClass: 'hover:border-amber-400/35',
      onClick: () => applyTicketFocus('CRITICA'),
    },
    {
      key: 'sla',
      label: 'SLA Vencido',
      value: dashboardSlaExpiredCount,
      meta: dashboardSlaTrend.label,
      detail: 'Escalar ahora',
      icon: Clock3,
      toneClass: 'premium-kpi-card-red',
      valueClass: 'text-red-500',
      buttonClass: 'hover:border-red-400/35',
      onClick: () => applyTicketFocus('SLA'),
    },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="premium-panel rounded-[2.3rem] p-6 sm:p-8 lg:p-10">
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-center">
          <div className="relative min-w-0">
            <span className="premium-chip mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Global Network Health
            </span>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Estado del Sistema
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Centro operativo con una lectura rápida del periodo actual, foco en incidentes, SLA y riesgos de inventario.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {DASHBOARD_RANGES.map((range) => (
                <button
                  key={`dash-range-${range.value}`}
                  type="button"
                  onClick={() => setDashboardRange(range.value)}
                  className={`premium-button rounded-full border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] ${
                    dashboardRange === range.value
                      ? 'border-[#f7b57c] bg-gradient-to-r from-[#f58220] to-[#ff9b47] text-white shadow-[0_18px_36px_rgba(245,130,32,0.28)]'
                      : 'border-white/30 bg-white/50 text-slate-600 hover:border-[#f58220]/20 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="premium-panel-soft rounded-[1.6rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Periodo</p>
                <p className="mt-2 text-lg font-black text-slate-900">{dashboardWindow.label}</p>
                <p className="mt-1 text-xs text-slate-500">Ventana activa de monitoreo.</p>
              </div>
              <div className="premium-panel-soft rounded-[1.6rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tickets abiertos</p>
                <p className="mt-2 text-lg font-black text-slate-900">{dashboardOpenTicketsCurrent.length}</p>
                <p className={`mt-1 text-xs font-black uppercase tracking-[0.16em] ${dashboardOpenTrend.toneClass}`}>
                  {dashboardOpenTrend.label}
                </p>
              </div>
              <div className="premium-panel-soft rounded-[1.6rem] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sin asignar</p>
                <p className="mt-2 text-lg font-black text-slate-900">{dashboardUnassignedCount}</p>
                <p className="mt-1 text-xs text-slate-500">Carga pendiente por despachar.</p>
              </div>
            </div>
          </div>

          <div className="premium-panel-soft rounded-[2rem] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Health Index</p>
                <p className="mt-2 text-4xl font-black text-slate-900">{safeHealth}%</p>
                <p className="mt-1 text-sm text-slate-500">Estabilidad percibida del ecosistema IT.</p>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                Live
              </div>
            </div>

            <div className="mt-6 flex items-center gap-5">
              <div className="flex h-32 w-32 items-center justify-center rounded-full p-3 shadow-inner" style={ringStyle}>
                <div className="premium-panel-soft flex h-full w-full items-center justify-center rounded-full">
                  <div className="text-center">
                    <p className="text-3xl font-black text-slate-900">{safeHealth}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Salud IT</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Backend monitoreado</span>
                  <span className="text-slate-800">Operativo</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Protección SLA</span>
                  <span className="text-slate-800">{dashboardSlaCompliancePct}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Riesgos inventario</span>
                  <span className="text-slate-800">{duplicateNetworkCount + activosSinResponsable}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Críticos activos</span>
                  <span className="text-slate-800">{dashboardCriticalTicketsCurrent.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={`premium-panel premium-kpi-card ${card.toneClass} ${card.buttonClass} rounded-[1.8rem] p-5 text-left`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                  <p className={`mt-4 text-4xl font-black ${card.valueClass}`}>{card.value}</p>
                </div>
                <div className="premium-panel-soft flex h-11 w-11 items-center justify-center rounded-[1rem]">
                  <Icon className={`h-5 w-5 ${card.valueClass}`} />
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-500">{card.meta}</p>
              <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <span>{card.detail}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="premium-panel rounded-[2rem] p-6 sm:p-7">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Actividad reciente | {dashboardWindow.label}
              </p>
              <h3 className="text-xl font-black tracking-tight text-slate-900">Últimos Tickets del Periodo</h3>
            </div>
            <button
              type="button"
              onClick={() => setView('tickets')}
              className="premium-button rounded-full border border-white/35 bg-white/55 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 hover:border-[#f58220]/20 hover:text-slate-900"
            >
              Ver Todo
            </button>
          </div>

          <div className="space-y-3">
            {dashboardRecentTickets.map((ticket) => {
              const sla = getSlaStatus(ticket);
              return (
                <button
                  key={`recent-${ticket.id}`}
                  type="button"
                  onClick={() => {
                    setView('tickets');
                    setSearchTerm(ticket.activoTag);
                  }}
                  className="premium-panel-soft interactive-card w-full rounded-[1.55rem] border border-white/25 p-4 text-left"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                    <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                    <Badge variant={normalizeTicketAttentionType(ticket.atencionTipo) || 'sin definir'}>
                      {formatTicketAttentionType(ticket.atencionTipo)}
                    </Badge>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${sla.className}`}>
                      {sla.label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">#{ticket.id}</span>
                  </div>
                  <p className="text-sm font-black uppercase text-slate-900">
                    {ticket.activoTag} | {ticket.descripcion}
                  </p>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Asignado: {ticket.asignadoA || 'Sin asignar'} | Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)}
                  </p>
                </button>
              );
            })}

            {dashboardRecentTickets.length === 0 && (
              <div className="premium-panel-soft rounded-[1.6rem] border border-dashed border-white/30 px-6 py-10 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Sin tickets en el periodo seleccionado.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="premium-panel rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Carga Operativa</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Tickets por Técnico</h3>
            <div className="mt-5 space-y-3">
              {dashboardTopOwners.map(([owner, count]) => (
                <div key={`owner-${owner}`} className="premium-panel-soft rounded-[1.4rem] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-black uppercase tracking-[0.16em] text-slate-700">{owner}</span>
                    <span className="text-xs font-black text-[#f58220]">{count}</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#f58220] to-[#ffb36a]"
                      style={{ width: resolveBarWidth(count, dashboardOwnerMax) }}
                    />
                  </div>
                </div>
              ))}

              {dashboardTopOwners.length === 0 && (
                <div className="premium-panel-soft rounded-[1.4rem] p-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Sin tickets asignados.
                </div>
              )}

              <button
                type="button"
                onClick={() => applyTicketFocus('SIN_ASIGNAR')}
                className="premium-panel-soft interactive-card flex w-full items-center justify-between rounded-[1.4rem] p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="premium-panel-soft flex h-10 w-10 items-center justify-center rounded-[1rem]">
                    <UserRoundSearch className="h-4 w-4 text-amber-600" />
                  </span>
                  <span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sin asignar</p>
                    <p className="text-sm font-black text-slate-900">{dashboardUnassignedCount} tickets</p>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => applyTicketFocus('EN_PROCESO')}
                className="premium-panel-soft interactive-card flex w-full items-center justify-between rounded-[1.4rem] p-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="premium-panel-soft flex h-10 w-10 items-center justify-center rounded-[1rem]">
                    <Workflow className="h-4 w-4 text-indigo-500" />
                  </span>
                  <span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">En proceso</p>
                    <p className="text-sm font-black text-slate-900">{dashboardInProcessCount} tickets</p>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="premium-panel rounded-[2rem] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Riesgos Inventario</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Atención Prioritaria</h3>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('SIN_RESP');
                }}
                className="premium-panel-soft interactive-card flex w-full items-center justify-between rounded-[1.4rem] p-4 text-left"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sin Responsable</p>
                  <p className="mt-2 text-2xl font-black text-red-500">{activosSinResponsable}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('VIDA_ALTA');
                }}
                className="premium-panel-soft interactive-card flex w-full items-center justify-between rounded-[1.4rem] p-4 text-left"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vida útil alta</p>
                  <p className="mt-2 text-2xl font-black text-amber-500">{activosVidaAlta}</p>
                </div>
                <Clock3 className="h-5 w-5 text-amber-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('DUP_RED');
                }}
                className="premium-panel-soft interactive-card flex w-full items-center justify-between rounded-[1.4rem] p-4 text-left"
              >
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Duplicados de red</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{duplicateNetworkCount}</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-sky-500" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="premium-panel rounded-[2rem] p-6 sm:p-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Distribución de Tickets</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
              Estado y Sucursal ({dashboardWindow.label})
            </h3>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Por estado</p>
              {dashboardStateBars.map((item) => (
                <div key={`state-${item.label}`} className="premium-panel-soft rounded-[1.35rem] p-3.5">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8CC63F] to-[#b9e56c]"
                      style={{ width: resolveBarWidth(item.count, dashboardStateMax) }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Por sucursal</p>
              {dashboardBranchBars.map((item) => (
                <div key={`branch-${item.label}`} className="premium-panel-soft rounded-[1.35rem] p-3.5">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                      style={{ width: resolveBarWidth(item.count, dashboardBranchMax) }}
                    />
                  </div>
                </div>
              ))}
              {dashboardBranchBars.length === 0 && (
                <div className="premium-panel-soft rounded-[1.35rem] border border-dashed border-white/25 p-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Sin tickets en el periodo.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="premium-panel rounded-[2rem] p-6 sm:p-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">SLA y Aging</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
              Cumplimiento y Antigüedad ({dashboardWindow.label})
            </h3>
          </div>

          <div className="premium-panel-soft mt-6 rounded-[1.6rem] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">SLA Cumplido</p>
              <p className="text-2xl font-black text-emerald-600">{dashboardSlaCompliancePct}%</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-950/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-[#8CC63F]"
                style={{ width: `${dashboardSlaCompliancePct}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              <span>Cumplidos: {dashboardSlaCompliantCount}</span>
              <span>Vencidos: {dashboardSlaExpiredCount}</span>
              <span>Total: {dashboardSlaTotalCount}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Aging tickets abiertos</p>
            {dashboardAgingBars.map((item) => (
              <div key={`aging-${item.label}`} className="premium-panel-soft rounded-[1.35rem] p-3.5">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-950/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                    style={{ width: resolveBarWidth(item.count, dashboardAgingMax) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
