import React from 'react';
import type {
  Activo,
  DashboardRange,
  Insumo,
  InventoryRiskFilter,
  TicketItem,
  ViewType,
} from '../../types/app';
import { DASHBOARD_RANGES } from '../../constants/app';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FilterChip } from '../ui/FilterChip';
import { getSupplyHealthStatus } from '../../utils/appHelpers';
import {
  normalizeTicketAttentionType,
  formatTicketAttentionType,
  getSlaStatus,
  ticketRequiresTravel,
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

type TicketFocusAction = 'ABIERTOS' | 'CRITICA' | 'SIN_ASIGNAR' | 'SLA' | 'EN_PROCESO';
type InventoryFocusAction = InventoryRiskFilter | 'FALLA';

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
  applyTicketFocus: (focus: TicketFocusAction) => void;
  dashboardRecentTickets: TicketItem[];
  setSearchTerm: (term: string) => void;
  dashboardTopOwners: Array<[string, number]>;
  dashboardOwnerMax: number;
  dashboardInProcessCount: number;
  applyInventoryFocus: (focus: InventoryFocusAction) => void;
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
          <p className="text-slate-400 text-sm">Resumen operativo | Período: {dashboardWindow.label}</p>
          <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Abiertos: {dashboardOpenTicketsCurrent.length} | Críticos: {dashboardCriticalTicketsCurrent.length} | Sin Asignar: {dashboardUnassignedCount}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DASHBOARD_RANGES.map((range) => (
              <FilterChip
                key={`dash-range-${range.value}`}
                tone="brand"
                active={dashboardRange === range.value}
                onClick={() => setDashboardRange(range.value)}
              >
                {range.label}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="z-10 self-start md:self-auto">
          <div className="text-left md:text-right">
            <p className="text-4xl sm:text-5xl font-black">{systemHealth}%</p>
            <p className="text-[10px] font-black text-brand-green uppercase tracking-widest">Salud IT</p>
          </div>
        </div>
      </div>

      {/*
        Una sola definición de tarjeta alimentada por datos. Antes eran cinco bloques escritos
        a mano con cinco tratamientos distintos: dos rellenos sólidos (Stock bajo en naranja,
        Activos en verde) y tres fondos tenues. El peso visual quedaba invertido respecto a la
        urgencia — lo que más gritaba era un conteo neutro, mientras Críticos y SLA vencido,
        que son los que exigen actuar, quedaban apagados.

        Ahora el tono codifica gravedad de forma creciente (neutro → marca → ámbar → naranja →
        rojo) y la estructura es idéntica en las cinco, así que la fila se escanea de un golpe.
        La etiqueta reserva dos líneas para que todos los números compartan línea base aunque
        unos títulos envuelvan y otros no.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
        {[
          {
            key: 'activos',
            label: 'Activos',
            value: activos.length,
            note: 'Snapshot actual',
            noteClass: 'text-slate-400',
            skin: 'bg-slate-50 border-slate-200 hover:border-slate-300',
            labelClass: 'text-slate-400',
            valueClass: 'text-slate-600',
            ring: 'focus-visible:ring-slate-200',
            onClick: () => setView('inventory'),
          },
          {
            key: 'abiertos',
            label: 'Tickets abiertos',
            value: dashboardOpenTicketsCurrent.length,
            note: dashboardOpenTrend.label,
            noteClass: dashboardOpenTrend.toneClass,
            skin: 'bg-white border-slate-200 hover:border-slate-300',
            labelClass: 'text-slate-400',
            valueClass: 'text-brand',
            ring: 'focus-visible:ring-orange-200',
            onClick: () => applyTicketFocus('ABIERTOS'),
          },
          {
            key: 'stock',
            label: 'Stock bajo',
            value: insumos.filter((i) => getSupplyHealthStatus(i) !== 'OK').length,
            note: 'Snapshot actual',
            noteClass: 'text-indigo-400',
            skin: 'bg-indigo-50 border-indigo-100 hover:border-indigo-200',
            labelClass: 'text-indigo-600',
            valueClass: 'text-indigo-700',
            ring: 'focus-visible:ring-indigo-200',
            onClick: () => setView('supplies'),
          },
          {
            key: 'criticos',
            label: 'Críticos',
            value: dashboardCriticalTicketsCurrent.length,
            note: dashboardCriticalTrend.label,
            noteClass: dashboardCriticalTrend.toneClass,
            skin: 'bg-amber-50 border-amber-200 hover:border-amber-300',
            labelClass: 'text-amber-600',
            valueClass: 'text-amber-700',
            ring: 'focus-visible:ring-amber-300',
            onClick: () => applyTicketFocus('CRITICA'),
          },
          {
            key: 'sla',
            label: 'SLA vencido',
            value: dashboardSlaExpiredCount,
            note: dashboardSlaTrend.label,
            noteClass: dashboardSlaTrend.toneClass,
            skin: 'bg-red-50 border-red-200 hover:border-red-300',
            labelClass: 'text-red-600',
            valueClass: 'text-red-700',
            ring: 'focus-visible:ring-red-300',
            onClick: () => applyTicketFocus('SLA'),
          },
        ].map((tile) => (
          <Button
            key={tile.key}
            variant="plain"
            size="bare"
            onClick={tile.onClick}
            className={`w-full flex-col items-stretch justify-start text-left border p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 ${tile.skin} ${tile.ring}`}
          >
            <p className={`text-xs font-black uppercase tracking-wider min-h-[2.5em] ${tile.labelClass}`}>{tile.label}</p>
            <h2 className={`text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums ${tile.valueClass}`}>{tile.value}</h2>
            <p className={`mt-3 text-[10px] font-black uppercase tracking-wider ${tile.noteClass}`}>{tile.note}</p>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad Reciente | {dashboardWindow.label}</p>
              <h3 className="text-lg font-black uppercase text-slate-800">Últimos Tickets del Período</h3>
            </div>
            <Button
              size="bare"
              onClick={() => setView('tickets')}
              className="px-5 py-2 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Ver Todo
            </Button>
          </div>

          <div className="space-y-3">
            {dashboardRecentTickets.map((ticket) => (
              <Button
                variant="plain"
                size="bare"
                key={`recent-${ticket.id}`}
                onClick={() => {
                  setView('tickets');
                  setSearchTerm(ticket.activoTag);
                }}
                className="w-full flex-col items-stretch justify-start text-left border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                  <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                  <Badge variant={normalizeTicketAttentionType(ticket.atencionTipo) || 'sin definir'}>
                    {formatTicketAttentionType(ticket.atencionTipo)}
                  </Badge>
                  {ticketRequiresTravel(ticket) && (
                    <Badge variant="traslado">Traslado</Badge>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                    {getSlaStatus(ticket).label}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">#{ticket.id}</span>
                </div>
                <p className="text-sm font-black uppercase text-slate-800">{ticket.activoTag} | {ticket.descripcion}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                  Asignado: {ticket.asignadoA || 'Sin asignar'} | Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)}
                </p>
              </Button>
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
            <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Tickets por Técnico</h3>
            <div className="space-y-3">
              {dashboardTopOwners.map(([owner, count]) => (
                <div key={`owner-${owner}`} className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-700">{owner}</span>
                    <span className="text-xs font-black text-brand">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand"
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
              <Button
                variant="plain"
                size="bare"
                onClick={() => applyTicketFocus('SIN_ASIGNAR')}
                className="w-full bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
              >
                Sin asignar: {dashboardUnassignedCount}
              </Button>
              <Button
                variant="plain"
                size="bare"
                onClick={() => applyTicketFocus('EN_PROCESO')}
                className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
              >
                En proceso: {dashboardInProcessCount}
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Riesgos Inventario</p>
            <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Atención Prioritaria</h3>
            <div className="space-y-3">
              <Button
                variant="plain"
                size="bare"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('SIN_RESP');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin Responsable</p>
                <p className="text-xl font-black text-red-500">{activosSinResponsable}</p>
              </Button>
              <Button
                variant="plain"
                size="bare"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('VIDA_ALTA');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vida Util Alta</p>
                <p className="text-xl font-black text-amber-500">{activosVidaAlta}</p>
              </Button>
              <Button
                variant="plain"
                size="bare"
                onClick={() => {
                  setView('inventory');
                  applyInventoryFocus('DUP_RED');
                }}
                className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duplicados de Red</p>
                <p className="text-xl font-black text-slate-700">{effectiveRiskSummary.duplicateIpCount + effectiveRiskSummary.duplicateMacCount}</p>
              </Button>
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
                    className="h-full bg-brand-green"
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
