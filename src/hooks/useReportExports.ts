import type {
  ReportAttentionFilter,
  ReportPriorityFilter,
  ReportStateFilter,
  ToastType,
  UserSession,
} from '../types/app';
import { formatDateTime } from '../utils/format';
import { auditModuleLabel } from '../utils/audit';
import { formatTicketAttentionType, isTicketSlaExpired } from '../utils/tickets';
import { getTicketAreaLabel } from '../utils/appHelpers';
import { buildReportPresentationHtml as buildReportPresentationHtmlModule } from '../utils/printing/reportPresentation';
import { buildTravelMovementSheetHtml as buildTravelMovementSheetHtmlModule } from '../utils/printing/travelSheet';
import type { useReportMetrics } from './metrics/useReportMetrics';

type ReportMetrics = ReturnType<typeof useReportMetrics>;

interface UseReportExportsParams {
  metrics: ReportMetrics;
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: ReportStateFilter;
  reportPriorityFilter: ReportPriorityFilter;
  reportAttentionFilter: ReportAttentionFilter;
  reportTechnicianFilter: string;
  travelReportDepartment: string;
  travelReportAuthorizer: string;
  travelReportFinance: string;
  sessionUser: UserSession | null;
  liveNow: number;
  formatTicketBranchFromCatalog: (value?: string) => string;
  showToast: (message: string, type?: ToastType) => void;
}

/**
 * Provee los exportadores/impresores de la vista de Reportería (PDF/Excel/
 * presentación y formato mensual de viáticos). Extraído de App.tsx sin cambios.
 */
export function useReportExports({
  metrics,
  reportDateFrom,
  reportDateTo,
  reportBranchFilter,
  reportAreaFilter,
  reportStateFilter,
  reportPriorityFilter,
  reportAttentionFilter,
  reportTechnicianFilter,
  travelReportDepartment,
  travelReportAuthorizer,
  travelReportFinance,
  sessionUser,
  liveNow,
  formatTicketBranchFromCatalog,
  showToast,
}: UseReportExportsParams) {
  const {
    reportComparisonWindow,
    reportPreviousPeriodLabel,
    travelDestinationRules,
    travelMonthRange,
    effectiveTravelReporterName,
    travelSuggestedTripsByCode,
    travelReportRows,
    travelTotalTrips,
    travelTotalKms,
    travelFuelEfficiencyValue,
    travelFuelLiters,
    travelMonthLabel,
    reportTickets,
    reportPreviousTickets,
    reportTrendMode,
    reportLifecycleTrend,
    reportCreatedInPeriodCount,
    reportClosedInPeriodCount,
    reportOpenCount,
    reportClosedCount,
    reportCriticalCount,
    reportSlaExpiredCount,
    reportSlaTotalCount,
    reportSlaCompliantCount,
    reportSlaCompliancePct,
    reportPreviousOpenCount,
    reportPreviousSlaCompliancePct,
    reportAvgResolutionHours,
    reportMedianResolutionHours,
    reportP90ResolutionHours,
    reportPreviousAvgResolutionHours,
    reportPreviousMedianResolutionHours,
    reportPreviousP90ResolutionHours,
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
    reportMttrMedianTrend,
    reportP90ResolutionTrend,
    reportStateBars,
    reportBranchBars,
    reportAreaBars,
    reportTechBars,
    reportIncidentCauseBars,
    reportAuditRows,
    reportAuditModuleBars,
    reportInventorySnapshot,
    reportSupplySnapshot,
  } = metrics;

  const buildReportPresentationHtml = (): string => buildReportPresentationHtmlModule({
    reportDateFrom,
    reportDateTo,
    reportBranchFilter,
    reportAreaFilter,
    reportStateFilter,
    reportPriorityFilter,
    reportAttentionFilter,
    reportTechnicianFilter,
    reportPreviousPeriodLabel,
    reportTrendMode,
    sessionUserName: sessionUser?.nombre || "Sistema",
    hasReportComparison: !!reportComparisonWindow,
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
    reportTickets,
    liveNow,
    reportStateBars,
    reportBranchBars,
    reportAreaBars,
    reportIncidentCauseBars,
    reportLifecycleTrend,
    reportAuditModuleBars,
    reportOpenCount,
    reportClosedCount,
    reportSlaCompliancePct,
    reportSlaCompliantCount,
    reportSlaTotalCount,
    reportSlaExpiredCount,
    reportInventorySnapshot,
    reportSupplySnapshot,
    formatTicketBranchFromCatalog,
  });

  const openReportPresentationWindow = (autoPrint = false) => {
    const html = buildReportPresentationHtml();
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(fallbackUrl), 2000);
        showToast('Popup bloqueado. Se abrio un reporte alterno en otra pestana.', 'warning');
      } catch {
        showToast('No se pudo abrir ventana de presentacion/reportes', 'warning');
      }
      return;
    }

    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      try {
        win.close();
      } catch {
        // no-op
      }
      showToast('No se pudo renderizar la presentacion/reportes', 'error');
      return;
    }

    if (autoPrint) {
      let printed = false;
      const trigger = () => {
        if (printed || win.closed) return;
        if (win.document.readyState !== 'complete') return;
        printed = true;
        win.focus();
        win.print();
      };
      win.addEventListener('load', () => {
        window.setTimeout(trigger, 250);
      }, { once: true });
      window.setTimeout(trigger, 1200);
    }
  };
  const exportReportExcel = async () => {
    if (reportTickets.length === 0 && reportClosedInPeriodCount === 0) {
      showToast('No hay datos de tickets para exportar en el periodo seleccionado', 'warning');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        { Indicador: 'Periodo', Valor: `${reportDateFrom || 'N/D'} a ${reportDateTo || 'N/D'}` },
        { Indicador: 'Filtro sucursal', Valor: reportBranchFilter === 'TODAS' ? 'Todas las sucursales' : formatTicketBranchFromCatalog(reportBranchFilter) },
        { Indicador: 'Filtro área', Valor: reportAreaFilter === 'TODAS' ? 'Todas las áreas' : reportAreaFilter },
        { Indicador: 'Filtro estado', Valor: reportStateFilter === 'TODOS' ? 'Todos los estados' : reportStateFilter },
        { Indicador: 'Filtro prioridad', Valor: reportPriorityFilter === 'TODAS' ? 'Todas las prioridades' : reportPriorityFilter },
        {
          Indicador: 'Filtro atención',
          Valor: reportAttentionFilter === 'TODAS'
            ? 'Todas las atenciones'
            : formatTicketAttentionType(reportAttentionFilter),
        },
        {
          Indicador: 'Filtro técnico',
          Valor: reportTechnicianFilter === 'TODOS'
            ? 'Todos los tecnicos'
            : reportTechnicianFilter === 'SIN_ASIGNAR'
              ? 'Sin asignar'
              : reportTechnicianFilter,
        },
        { Indicador: 'Periodo anterior', Valor: reportPreviousPeriodLabel },
        { Indicador: 'Tendencia agrupada', Valor: reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria' },
        { Indicador: 'Tickets', Valor: reportTickets.length },
        { Indicador: 'Tickets periodo anterior', Valor: reportComparisonWindow ? reportPreviousTickets.length : 'N/D' },
        { Indicador: 'Comparativo tickets', Valor: reportTicketsTrend.label },
        { Indicador: 'Abiertos', Valor: reportOpenCount },
        { Indicador: 'Abiertos periodo anterior', Valor: reportComparisonWindow ? reportPreviousOpenCount : 'N/D' },
        { Indicador: 'Comparativo abiertos', Valor: reportOpenTrend.label },
        { Indicador: 'Cerrados', Valor: reportClosedCount },
        { Indicador: 'Tickets creados en periodo', Valor: reportCreatedInPeriodCount },
        { Indicador: 'Tickets cerrados en periodo', Valor: reportClosedInPeriodCount },
        { Indicador: 'Causas recurrentes detectadas', Valor: reportIncidentCauseBars.length },
        { Indicador: 'Cumplimiento SLA (%)', Valor: reportSlaCompliancePct },
        { Indicador: 'Cumplimiento SLA previo (%)', Valor: reportComparisonWindow ? reportPreviousSlaCompliancePct : 'N/D' },
        { Indicador: 'Comparativo cumplimiento SLA', Valor: reportSlaComplianceTrend.label },
        { Indicador: 'SLA vencido', Valor: reportSlaExpiredCount },
        { Indicador: 'Críticos', Valor: reportCriticalCount },
        { Indicador: 'MTTR promedio (horas)', Valor: reportAvgResolutionHours ?? 'N/D' },
        { Indicador: 'MTTR promedio previo (horas)', Valor: reportComparisonWindow ? (reportPreviousAvgResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'MTTR mediana (horas)', Valor: reportMedianResolutionHours ?? 'N/D' },
        { Indicador: 'MTTR mediana previa (horas)', Valor: reportComparisonWindow ? (reportPreviousMedianResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'Comparativo MTTR mediana', Valor: reportMttrMedianTrend.label },
        { Indicador: 'P90 resolucion (horas)', Valor: reportP90ResolutionHours ?? 'N/D' },
        { Indicador: 'P90 resolucion previo (horas)', Valor: reportComparisonWindow ? (reportPreviousP90ResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'Comparativo P90 resolucion', Valor: reportP90ResolutionTrend.label },
        { Indicador: 'Activos totales', Valor: reportInventorySnapshot.totalActivos },
        { Indicador: 'Activos en falla', Valor: reportInventorySnapshot.activosEnFalla },
        { Indicador: 'Insumos total', Valor: reportSupplySnapshot.total },
        { Indicador: 'Insumos agotados', Valor: reportSupplySnapshot.agotados },
        { Indicador: 'Insumos bajo mínimo', Valor: reportSupplySnapshot.bajoMinimo },
      ];
      const detailRows = reportTickets.map((ticket) => ({
        ID: ticket.id,
        Fecha: formatDateTime(ticket.fechaCreacion || ticket.fecha),
        Sucursal: formatTicketBranchFromCatalog(ticket.sucursal),
        Área: getTicketAreaLabel(ticket),
        Tag: ticket.activoTag,
        Prioridad: ticket.prioridad,
        Estado: ticket.estado,
        Atención: formatTicketAttentionType(ticket.atencionTipo),
        SLA: isTicketSlaExpired(ticket, liveNow) ? 'VENCIDO' : 'EN TIEMPO',
        Asignado: ticket.asignadoA || 'Sin asignar',
        SolicitadoPor: ticket.solicitadoPor || '',
        Departamento: ticket.departamento || '',
        Descripción: ticket.descripcion,
      }));
      const stateRows = reportStateBars.map((row) => ({ Estado: row.label, Cantidad: row.count }));
      const branchRows = reportBranchBars.map((row) => ({ Sucursal: row.label, Cantidad: row.count }));
      const areaRows = reportAreaBars.map((row) => ({ Área: row.label, Cantidad: row.count }));
      const techRows = reportTechBars.map((row) => ({ Técnico: row.label, Cantidad: row.count }));
      const causeRows = reportIncidentCauseBars.map((row) => ({
        Área: row.area,
        Causa: row.cause,
        Cantidad: row.count,
      }));
      const trendRows = reportLifecycleTrend.map((row) => ({
        Periodo: row.label,
        Creados: row.created,
        Cerrados: row.closed,
      }));
      const auditRows = reportAuditRows.map((row) => ({
        Fecha: row.fecha,
        Usuario: row.usuario,
        Módulo: auditModuleLabel(row.modulo || 'otros'),
        Acción: row.accion,
        Item: row.item,
        Cantidad: row.cantidad,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Tickets');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stateRows), 'Estado');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(branchRows), 'Sucursal');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(areaRows), 'Área');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(techRows), 'Técnico');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(causeRows), 'Causas');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trendRows), 'Tendencia');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditRows), 'Auditoría');
      const suffix = `${reportDateFrom || 'inicio'}_${reportDateTo || 'fin'}`.replace(/[^0-9A-Za-z_-]/g, '-');
      XLSX.writeFile(workbook, `reporteria_it_${suffix}.xlsx`);
      showToast('Reporte Excel generado', 'success');
    } catch {
      showToast('No se pudo exportar el reporte en Excel', 'error');
    }
  };
  const exportReportPdf = () => {
    openReportPresentationWindow(true);
  };
  const openReportExecutivePresentation = () => {
    openReportPresentationWindow(false);
  };
  const buildTravelMovementSheetHtml = (): string => buildTravelMovementSheetHtmlModule({
    travelReportDepartment,
    travelMonthLabel,
    effectiveTravelReporterName,
    travelReportAuthorizer,
    travelReportFinance,
    travelFuelEfficiencyValue,
    travelFuelLiters,
    travelReportRows,
    travelDestinationRules,
    travelSuggestedTripsByCode,
    travelTotalTrips,
    travelTotalKms,
  });

  const openTravelMovementSheetWindow = (autoPrint = false) => {
    if (!travelMonthRange) {
      showToast('Selecciona un mes valido para generar el formato', 'warning');
      return;
    }
    if (travelReportRows.length === 0) {
      showToast('No hay tickets para el mes/filtros seleccionados. Se abrira formato en blanco.', 'warning');
    }

    const html = buildTravelMovementSheetHtml();
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(fallbackUrl), 2000);
        showToast('Popup bloqueado. Se abrio el formato en otra pestana.', 'warning');
      } catch {
        showToast('No se pudo abrir el formato mensual de movilidad', 'error');
      }
      return;
    }

    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      try {
        win.close();
      } catch {
        // no-op
      }
      showToast('No se pudo renderizar el formato mensual de movilidad', 'error');
      return;
    }

    if (autoPrint) {
      let printed = false;
      const trigger = () => {
        if (printed || win.closed) return;
        if (win.document.readyState !== 'complete') return;
        printed = true;
        win.focus();
        win.print();
      };
      win.addEventListener('load', () => {
        window.setTimeout(trigger, 250);
      }, { once: true });
      window.setTimeout(trigger, 1200);
    }
  };
  const openTravelMovementSheet = () => {
    openTravelMovementSheetWindow(false);
  };
  const printTravelMovementSheet = () => {
    openTravelMovementSheetWindow(true);
  };

  return {
    exportReportExcel,
    exportReportPdf,
    openReportExecutivePresentation,
    openTravelMovementSheet,
    printTravelMovementSheet,
  };
}
