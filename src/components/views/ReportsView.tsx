import React from 'react';
import type {
  PrioridadTicket,
  ReportAttentionFilter,
  ReportFilterPreset,
  ReportPriorityFilter,
  ReportStateFilter,
  TicketAttentionType,
  TicketEstado,
} from '../../types/app';

type Trend = {
  label: string;
  toneClass: string;
};

type CountBarItem = {
  label: string;
  count: number;
};

type BranchBarItem = CountBarItem & {
  code: string;
};

type LifecycleTrendItem = {
  key: string | number;
  label: string;
  created: number;
  closed: number;
};

type AuditModuleBarItem = {
  module: string;
  label: string;
  count: number;
};

type IncidentCauseBarItem = {
  key: string;
  area: string;
  cause: string;
  count: number;
};

type InventorySnapshot = {
  totalActivos: number;
  activosEnFalla: number;
  sinResponsable: number;
};

type SupplySnapshot = {
  total: number;
  agotados: number;
  bajoMinimo: number;
};

interface ReportsViewProps {
  openReportExecutivePresentation: () => void;
  exportReportExcel: () => void;
  exportReportPdf: () => void;
  reportDateFrom: string;
  setReportDateFrom: React.Dispatch<React.SetStateAction<string>>;
  reportDateTo: string;
  setReportDateTo: React.Dispatch<React.SetStateAction<string>>;
  reportBranchFilter: string;
  setReportBranchFilter: React.Dispatch<React.SetStateAction<string>>;
  reportBranchOptions: readonly string[];
  formatTicketBranchFromCatalog: (value?: string) => string;
  reportAreaFilter: string;
  setReportAreaFilter: React.Dispatch<React.SetStateAction<string>>;
  reportAreaOptions: readonly string[];
  reportStateFilter: ReportStateFilter;
  setReportStateFilter: React.Dispatch<React.SetStateAction<ReportStateFilter>>;
  ticketStates: readonly TicketEstado[];
  reportPriorityFilter: ReportPriorityFilter;
  setReportPriorityFilter: React.Dispatch<React.SetStateAction<ReportPriorityFilter>>;
  reportAttentionFilter: ReportAttentionFilter;
  setReportAttentionFilter: React.Dispatch<React.SetStateAction<ReportAttentionFilter>>;
  ticketAttentionTypes: readonly TicketAttentionType[];
  formatTicketAttentionType: (value: unknown) => string;
  reportTechnicianFilter: string;
  setReportTechnicianFilter: React.Dispatch<React.SetStateAction<string>>;
  reportTechnicianOptions: readonly string[];
  resetReportFilters: () => void;
  reportPresetName: string;
  setReportPresetName: React.Dispatch<React.SetStateAction<string>>;
  saveCurrentReportFilterPreset: () => void;
  reportFilterPresets: readonly ReportFilterPreset[];
  applyReportFilterPreset: (preset: ReportFilterPreset) => void;
  deleteReportFilterPreset: (preset: ReportFilterPreset) => void;
  openTravelMovementSheet: () => void;
  printTravelMovementSheet: () => void;
  travelReportMonth: string;
  setTravelReportMonth: React.Dispatch<React.SetStateAction<string>>;
  travelReportTechnician: string;
  setTravelReportTechnician: React.Dispatch<React.SetStateAction<string>>;
  travelTechnicianOptions: readonly string[];
  travelReportName: string;
  setTravelReportName: React.Dispatch<React.SetStateAction<string>>;
  travelReportDepartment: string;
  setTravelReportDepartment: React.Dispatch<React.SetStateAction<string>>;
  travelReportFuelEfficiency: string;
  setTravelReportFuelEfficiency: React.Dispatch<React.SetStateAction<string>>;
  travelReportAuthorizer: string;
  setTravelReportAuthorizer: React.Dispatch<React.SetStateAction<string>>;
  travelReportFinance: string;
  setTravelReportFinance: React.Dispatch<React.SetStateAction<string>>;
  travelDestinationRules: readonly TravelDestinationRule[];
  travelSuggestedTripsByCode: ReadonlyMap<string, number>;
  travelMonthLabel: string;
  effectiveTravelReporterName: string;
  travelTotalTrips: number;
  travelTotalKms: number;
  formatTravelNumber: (value: number) => string;
  travelFuelEfficiencyValue: number;
  travelFuelLiters: number;
  reportTicketsCount: number;
  hasReportComparison: boolean;
  reportTicketsTrend: Trend;
  reportOpenCount: number;
  reportOpenTrend: Trend;
  reportClosedCount: number;
  reportSlaCompliancePct: number;
  reportSlaCompliantCount: number;
  reportSlaTotalCount: number;
  reportSlaComplianceTrend: Trend;
  reportSlaExpiredCount: number;
  reportTrendMode: 'DIARIA' | 'SEMANAL';
  reportCreatedInPeriodCount: number;
  reportClosedInPeriodCount: number;
  reportLifecycleTrend: readonly LifecycleTrendItem[];
  reportLifecycleTrendMax: number;
  reportStateBars: readonly CountBarItem[];
  applyReportDrillDown: (filters: {
    estado?: TicketEstado;
    prioridad?: PrioridadTicket;
    sucursalCode?: string;
    area?: string;
    asignadoA?: string;
  }) => void;
  reportStateMax: number;
  reportBranchBars: readonly BranchBarItem[];
  reportBranchMax: number;
  reportAreaBars: readonly CountBarItem[];
  reportAreaMax: number;
  reportTechBars: readonly CountBarItem[];
  reportTechMax: number;
  reportAuditModuleBars: readonly AuditModuleBarItem[];
  reportAuditMax: number;
  reportAuditRowsCount: number;
  reportAuditTotalCount: number;
  reportIncidentCauseBars: readonly IncidentCauseBarItem[];
  applyReportIncidentCauseDrillDown: (area: string, cause: string) => void;
  reportIncidentCauseMax: number;
  reportTravelCount: number;
  reportAttentionBars: readonly CountBarItem[];
  reportAttentionMax: number;
  reportInventorySnapshot: InventorySnapshot;
  reportSupplySnapshot: SupplySnapshot;
}

export function ReportsView({
  openReportExecutivePresentation,
  exportReportExcel,
  exportReportPdf,
  reportDateFrom,
  setReportDateFrom,
  reportDateTo,
  setReportDateTo,
  reportBranchFilter,
  setReportBranchFilter,
  reportBranchOptions,
  formatTicketBranchFromCatalog,
  reportAreaFilter,
  setReportAreaFilter,
  reportAreaOptions,
  reportStateFilter,
  setReportStateFilter,
  ticketStates,
  reportPriorityFilter,
  setReportPriorityFilter,
  reportAttentionFilter,
  setReportAttentionFilter,
  ticketAttentionTypes,
  formatTicketAttentionType,
  reportTechnicianFilter,
  setReportTechnicianFilter,
  reportTechnicianOptions,
  resetReportFilters,
  reportPresetName,
  setReportPresetName,
  saveCurrentReportFilterPreset,
  reportFilterPresets,
  applyReportFilterPreset,
  deleteReportFilterPreset,
  openTravelMovementSheet,
  printTravelMovementSheet,
  travelReportMonth,
  setTravelReportMonth,
  travelReportTechnician,
  setTravelReportTechnician,
  travelTechnicianOptions,
  travelReportName,
  setTravelReportName,
  travelReportDepartment,
  setTravelReportDepartment,
  travelReportFuelEfficiency,
  setTravelReportFuelEfficiency,
  travelReportAuthorizer,
  setTravelReportAuthorizer,
  travelReportFinance,
  setTravelReportFinance,
  travelDestinationRules,
  travelSuggestedTripsByCode,
  travelMonthLabel,
  effectiveTravelReporterName,
  travelTotalTrips,
  travelTotalKms,
  formatTravelNumber,
  travelFuelEfficiencyValue,
  travelFuelLiters,
  reportTicketsCount,
  hasReportComparison,
  reportTicketsTrend,
  reportOpenCount,
  reportOpenTrend,
  reportClosedCount,
  reportSlaCompliancePct,
  reportSlaCompliantCount,
  reportSlaTotalCount,
  reportSlaComplianceTrend,
  reportSlaExpiredCount,
  reportTrendMode,
  reportCreatedInPeriodCount,
  reportClosedInPeriodCount,
  reportLifecycleTrend,
  reportLifecycleTrendMax,
  reportStateBars,
  applyReportDrillDown,
  reportStateMax,
  reportBranchBars,
  reportBranchMax,
  reportAreaBars,
  reportAreaMax,
  reportTechBars,
  reportTechMax,
  reportAuditModuleBars,
  reportAuditMax,
  reportAuditRowsCount,
  reportAuditTotalCount,
  reportIncidentCauseBars,
  applyReportIncidentCauseDrillDown,
  reportIncidentCauseMax,
  reportTravelCount,
  reportAttentionBars,
  reportAttentionMax,
  reportInventorySnapshot,
  reportSupplySnapshot,
}: ReportsViewProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel bg-white/90 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analitica Operativa</p>
            <h3 className="font-black font-['Outfit'] text-slate-800 uppercase tracking-tight text-2xl">Reporteria Ejecutiva</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openReportExecutivePresentation}
              className="px-4 py-3 rounded-2xl border border-indigo-200 bg-indigo-50 text-xs font-black uppercase text-indigo-700 hover:bg-indigo-100"
            >
              Abrir Presentacion
            </button>
            <button
              onClick={exportReportExcel}
              className="px-4 py-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs font-black uppercase text-emerald-700 hover:bg-emerald-100"
            >
              Exportar Excel
            </button>
            <button
              onClick={exportReportPdf}
              className="px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50 text-xs font-black uppercase text-blue-700 hover:bg-blue-100"
            >
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="p-8 border-b border-slate-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-9 gap-3">
            <input
              type="date"
              value={reportDateFrom}
              onChange={(event) => setReportDateFrom(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <input
              type="date"
              value={reportDateTo}
              onChange={(event) => setReportDateTo(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <select
              value={reportBranchFilter}
              onChange={(event) => setReportBranchFilter(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODAS">Sucursal: todas</option>
              {reportBranchOptions.map((code) => (
                <option key={`rep-branch-${code}`} value={code}>
                  {formatTicketBranchFromCatalog(code)}
                </option>
              ))}
            </select>
            <select
              value={reportAreaFilter}
              onChange={(event) => setReportAreaFilter(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODAS">Area: todas</option>
              {reportAreaOptions.map((area) => (
                <option key={`rep-area-${area}`} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <select
              value={reportStateFilter}
              onChange={(event) => setReportStateFilter(event.target.value as ReportStateFilter)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODOS">Estado: todos</option>
              {ticketStates.map((state) => (
                <option key={`rep-state-${state}`} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <select
              value={reportPriorityFilter}
              onChange={(event) => setReportPriorityFilter(event.target.value as ReportPriorityFilter)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODAS">Prioridad: todas</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Critica</option>
            </select>
            <select
              value={reportAttentionFilter}
              onChange={(event) => setReportAttentionFilter(event.target.value as ReportAttentionFilter)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODAS">Atencion: todas</option>
              {ticketAttentionTypes.map((type) => (
                <option key={`rep-attention-${type}`} value={type}>
                  {formatTicketAttentionType(type)}
                </option>
              ))}
            </select>
            <select
              value={reportTechnicianFilter}
              onChange={(event) => setReportTechnicianFilter(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODOS">Tecnico: todos</option>
              <option value="SIN_ASIGNAR">Tecnico: sin asignar</option>
              {reportTechnicianOptions.map((name) => (
                <option key={`rep-tech-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={resetReportFilters}
              className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={reportPresetName}
                onChange={(event) => setReportPresetName(event.target.value)}
                placeholder="Nombre del preset"
                className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
              />
              <button
                onClick={saveCurrentReportFilterPreset}
                className="px-4 py-3 rounded-2xl border border-indigo-200 bg-indigo-50 text-xs font-black uppercase text-indigo-700 hover:bg-indigo-100"
              >
                Guardar Preset
              </button>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 self-center">
              Presets guardados: {reportFilterPresets.length}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {reportFilterPresets.map((preset) => (
              <div key={preset.id} className="flex items-center rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <button
                  onClick={() => applyReportFilterPreset(preset)}
                  className="px-3 py-2 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-50"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => deleteReportFilterPreset(preset)}
                  className="px-3 py-2 text-[10px] font-black uppercase text-red-500 border-l border-slate-200 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            ))}
            {reportFilterPresets.length === 0 && (
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                No hay presets guardados para este usuario.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-amber-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Movilidad y combustible</p>
            <h3 className="font-black font-['Outfit'] text-slate-800 uppercase tracking-tight text-2xl">Formato Mensual de Viajes IT</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openTravelMovementSheet}
              className="px-4 py-3 rounded-2xl border border-amber-300 bg-amber-100 text-xs font-black uppercase text-amber-800 hover:bg-amber-200"
            >
              Abrir Formato
            </button>
            <button
              onClick={printTravelMovementSheet}
              className="px-4 py-3 rounded-2xl border border-orange-300 bg-orange-100 text-xs font-black uppercase text-orange-800 hover:bg-orange-200"
            >
              Imprimir Formato
            </button>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            <input
              type="month"
              value={travelReportMonth}
              onChange={(event) => setTravelReportMonth(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <select
              value={travelReportTechnician}
              onChange={(event) => setTravelReportTechnician(event.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            >
              <option value="TODOS">Tecnico: todos</option>
              <option value="SIN_ASIGNAR">Tecnico: sin asignar</option>
              {travelTechnicianOptions.map((name) => (
                <option key={`travel-tech-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={travelReportName}
              onChange={(event) => setTravelReportName(event.target.value)}
              placeholder="Nombre en formato"
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <input
              type="text"
              value={travelReportDepartment}
              onChange={(event) => setTravelReportDepartment(event.target.value.toUpperCase())}
              placeholder="Departamento"
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <input
              type="text"
              value={travelReportFuelEfficiency}
              onChange={(event) => setTravelReportFuelEfficiency(event.target.value)}
              placeholder="Rendimiento km/l"
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <input
              type="text"
              value={travelReportAuthorizer}
              onChange={(event) => setTravelReportAuthorizer(event.target.value.toUpperCase())}
              placeholder="Autoriza"
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
            <input
              type="text"
              value={travelReportFinance}
              onChange={(event) => setTravelReportFinance(event.target.value.toUpperCase())}
              placeholder="Finanzas"
              className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Tabla de rutas / kms base
              </p>
              <div className="space-y-2">
                {travelDestinationRules.map((row) => (
                  <div key={`travel-kms-${row.code}`} className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[42px_minmax(0,1fr)_88px_76px] sm:items-center">
                    <div className="text-xs font-black uppercase text-slate-500 text-center">#{row.index}</div>
                    <div className="text-xs font-black uppercase text-slate-700">{row.label}</div>
                    <div className="px-3 py-2 text-xs font-black uppercase text-slate-700 text-center">{row.kms} km</div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-left sm:text-right">
                      {travelSuggestedTripsByCode.get(row.code) || 0} viajes
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-amber-50/50 p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Resumen del formato</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Mes</p>
                  <p className="text-sm font-black uppercase text-slate-800">{travelMonthLabel}</p>
                </div>
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Reporta</p>
                  <p className="text-sm font-black uppercase text-slate-800">{effectiveTravelReporterName}</p>
                </div>
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total viajes</p>
                  <p className="text-2xl font-black text-slate-800">{travelTotalTrips}</p>
                </div>
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total kms</p>
                  <p className="text-2xl font-black text-slate-800">{formatTravelNumber(travelTotalKms)}</p>
                </div>
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Rendimiento</p>
                  <p className="text-sm font-black uppercase text-slate-800">{travelFuelEfficiencyValue} km/l</p>
                </div>
                <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Litros</p>
                  <p className="text-2xl font-black text-slate-800">{travelFuelEfficiencyValue > 0 ? travelFuelLiters.toFixed(1) : 'N/D'}</p>
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                El formato toma tickets del mes seleccionado y respeta filtros de sucursal, area, estado y prioridad.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets</p>
          <p className="text-3xl font-black text-slate-800">{reportTicketsCount}</p>
          {hasReportComparison && (
            <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportTicketsTrend.toneClass}`}>{reportTicketsTrend.label}</p>
          )}
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
          <p className="text-3xl font-black text-blue-600">{reportOpenCount}</p>
          {hasReportComparison && (
            <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportOpenTrend.toneClass}`}>{reportOpenTrend.label}</p>
          )}
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cerrados</p>
          <p className="text-3xl font-black text-green-600">{reportClosedCount}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Cumplimiento SLA</p>
          <p className="text-3xl font-black text-green-700">{reportSlaCompliancePct}%</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-green-600">
            {reportSlaCompliantCount}/{reportSlaTotalCount} en tiempo
          </p>
          {hasReportComparison && (
            <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportSlaComplianceTrend.toneClass}`}>
              {reportSlaComplianceTrend.label}
            </p>
          )}
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLA Vencido</p>
          <p className="text-3xl font-black text-red-600">{reportSlaExpiredCount}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Traslados Req.</p>
          <p className="text-3xl font-black text-amber-600">{reportTravelCount}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h4 className="text-base font-black uppercase text-slate-800">
              Tendencia {reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria'}: Creados vs Cerrados
            </h4>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Creado por fecha de alta y cerrado por fecha de cierre
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Creados: {reportCreatedInPeriodCount} | Cerrados: {reportClosedInPeriodCount}
          </div>
        </div>
        <div className="space-y-4">
          {reportLifecycleTrend.map((item) => (
            <div key={`report-trend-${item.key}`} className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                <span>{item.label}</span>
                <span>Cre: {item.created} | Cer: {item.closed}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-700">
                    <span>Creados</span>
                    <span>{item.created}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.round((item.created / reportLifecycleTrendMax) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    <span>Cerrados</span>
                    <span>{item.closed}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-emerald-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.round((item.closed / reportLifecycleTrendMax) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {reportLifecycleTrend.length === 0 && (
            <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
              Sin datos para tendencia en este periodo.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-black uppercase text-slate-800">Tickets por Estado</h4>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drill-down</span>
          </div>
          {reportStateBars.map((item) => (
            <button
              key={`report-state-${item.label}`}
              onClick={() => applyReportDrillDown({ estado: item.label as TicketEstado })}
              className="w-full text-left space-y-1"
            >
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#F58220]"
                  style={{ width: `${Math.round((item.count / reportStateMax) * 100)}%` }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-black uppercase text-slate-800">Tickets por Sucursal</h4>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drill-down</span>
          </div>
          {reportBranchBars.map((item) => (
            <button
              key={`report-branch-${item.code}`}
              onClick={() => applyReportDrillDown({ sucursalCode: item.code })}
              className="w-full text-left space-y-1"
            >
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${Math.round((item.count / reportBranchMax) * 100)}%` }}
                />
              </div>
            </button>
          ))}
          {reportBranchBars.length === 0 && (
            <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
              Sin datos de sucursal para este periodo.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
          <h4 className="text-base font-black uppercase text-slate-800">Top Areas</h4>
          {reportAreaBars.slice(0, 8).map((item) => (
            <button
              key={`report-area-${item.label}`}
              onClick={() => applyReportDrillDown({ area: item.label })}
              className="w-full text-left space-y-1"
            >
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.round((item.count / reportAreaMax) * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
          <h4 className="text-base font-black uppercase text-slate-800">Carga por Tecnico</h4>
          {reportTechBars.slice(0, 8).map((item) => (
            <button
              key={`report-tech-${item.label}`}
              onClick={() => item.label !== 'SIN ASIGNAR' && applyReportDrillDown({ asignadoA: item.label })}
              className="w-full text-left space-y-1 disabled:cursor-not-allowed"
              disabled={item.label === 'SIN ASIGNAR'}
            >
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.round((item.count / reportTechMax) * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
          <h4 className="text-base font-black uppercase text-slate-800">Auditoria por Modulo</h4>
          {reportAuditModuleBars.map((item) => (
            <div key={`report-audit-${item.module}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-slate-700" style={{ width: `${Math.round((item.count / reportAuditMax) * 100)}%` }} />
              </div>
            </div>
          ))}
          <div className="pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Logs filtrados: {reportAuditRowsCount} | Total auditoría: {reportAuditTotalCount}
          </div>
        </div>
      </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-black uppercase text-slate-800">Top Causas Recurrentes</h4>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Area + Falla</span>
        </div>
        {reportIncidentCauseBars.map((item) => (
          <button
            key={`report-cause-${item.key}`}
            onClick={() => applyReportIncidentCauseDrillDown(item.area, item.cause)}
            className="w-full text-left space-y-1"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.area}</p>
            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-700">
              <span>{item.cause}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-fuchsia-500"
                style={{ width: `${Math.round((item.count / reportIncidentCauseMax) * 100)}%` }}
              />
            </div>
          </button>
        ))}
        {reportIncidentCauseBars.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Sin incidencias recurrentes para este periodo.
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
        <h4 className="text-base font-black uppercase text-slate-800">Tipos de Atencion</h4>
        {reportAttentionBars.map((item) => (
          <div key={`report-attention-${item.label}`} className="w-full text-left space-y-1">
            <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
              <span>{item.label}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${Math.round((item.count / reportAttentionMax) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {reportAttentionBars.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
            Sin datos de atencion para este periodo.
          </div>
        )}
      </div>
    </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventario</p>
          <p className="text-sm font-black text-slate-700">
            Activos: {reportInventorySnapshot.totalActivos} | En falla: {reportInventorySnapshot.activosEnFalla} | Sin responsable: {reportInventorySnapshot.sinResponsable}
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Insumos</p>
          <p className="text-sm font-black text-slate-700">
            Total: {reportSupplySnapshot.total} | Agotados: {reportSupplySnapshot.agotados} | Bajo minimo: {reportSupplySnapshot.bajoMinimo}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReportsView;
