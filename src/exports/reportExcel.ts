import { buildReportFilterLabels } from '../reports/reportFilterLabels';
import type { RegistroAuditoria, TicketItem } from '../types/app';
import { auditModuleLabel } from '../utils/audit';
import { buildReportTicketExportRows } from './reportTicketsCsv';

interface CountBar {
  label: string;
  count: number;
}

interface TrendLabel {
  label: string;
}

export interface ReportExcelData {
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: string;
  reportPriorityFilter: string;
  reportAttentionFilter: string;
  reportTechnicianFilter: string;
  reportPreviousPeriodLabel: string;
  reportTrendMode: string;
  hasComparisonWindow: boolean;
  reportTickets: TicketItem[];
  reportPreviousTicketsCount: number;
  reportTicketsTrend: TrendLabel;
  reportOpenCount: number;
  reportPreviousOpenCount: number;
  reportOpenTrend: TrendLabel;
  reportClosedCount: number;
  reportCreatedInPeriodCount: number;
  reportClosedInPeriodCount: number;
  reportSlaCompliancePct: number | null;
  reportPreviousSlaCompliancePct: number | null;
  reportSlaComplianceTrend: TrendLabel;
  reportSlaExpiredCount: number;
  reportCriticalCount: number;
  reportAvgResolutionHours: number | null;
  reportPreviousAvgResolutionHours: number | null;
  reportMedianResolutionHours: number | null;
  reportPreviousMedianResolutionHours: number | null;
  reportMttrMedianTrend: TrendLabel;
  reportP90ResolutionHours: number | null;
  reportPreviousP90ResolutionHours: number | null;
  reportP90ResolutionTrend: TrendLabel;
  reportAvgFirstResponseHours: number | null;
  reportPreviousAvgFirstResponseHours: number | null;
  reportMedianFirstResponseHours: number | null;
  reportPreviousMedianFirstResponseHours: number | null;
  reportP90FirstResponseHours: number | null;
  reportPreviousP90FirstResponseHours: number | null;
  reportFirstResponseMedianTrend: TrendLabel;
  reportInventorySnapshot: { totalActivos: number; activosEnFalla: number };
  reportSupplySnapshot: { total: number; agotados: number; bajoMinimo: number };
  reportStateBars: CountBar[];
  reportBranchBars: CountBar[];
  reportAreaBars: CountBar[];
  reportTechBars: CountBar[];
  reportIncidentCauseBars: Array<{ area: string; cause: string; count: number }>;
  reportLifecycleTrend: Array<{ label: string; created: number; closed: number }>;
  reportAuditRows: RegistroAuditoria[];
  nowMs: number;
  formatTicketBranchFromCatalog: (value?: string) => string;
}

/**
 * Genera y descarga el workbook Excel de reportería (9 hojas).
 * Recibe únicamente datos ya calculados; lanza si xlsx falla.
 */
export async function downloadReportExcelWorkbook(data: ReportExcelData): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const labels = buildReportFilterLabels(data);
  const summaryRows = [
    { Indicador: 'Periodo', Valor: labels.periodLabel },
    { Indicador: 'Filtro sucursal', Valor: labels.branchLabel },
    { Indicador: 'Filtro área', Valor: labels.areaLabel },
    { Indicador: 'Filtro estado', Valor: labels.stateLabel },
    { Indicador: 'Filtro prioridad', Valor: labels.priorityLabel },
    { Indicador: 'Filtro atención', Valor: labels.attentionLabel },
    { Indicador: 'Filtro técnico', Valor: labels.technicianLabel },
    { Indicador: 'Periodo anterior', Valor: data.reportPreviousPeriodLabel },
    { Indicador: 'Tendencia agrupada', Valor: labels.trendModeLabel },
    { Indicador: 'Tickets', Valor: data.reportTickets.length },
    { Indicador: 'Tickets periodo anterior', Valor: data.hasComparisonWindow ? data.reportPreviousTicketsCount : 'N/D' },
    { Indicador: 'Comparativo tickets', Valor: data.reportTicketsTrend.label },
    { Indicador: 'Abiertos', Valor: data.reportOpenCount },
    { Indicador: 'Abiertos periodo anterior', Valor: data.hasComparisonWindow ? data.reportPreviousOpenCount : 'N/D' },
    { Indicador: 'Comparativo abiertos', Valor: data.reportOpenTrend.label },
    { Indicador: 'Cerrados', Valor: data.reportClosedCount },
    { Indicador: 'Tickets creados en periodo', Valor: data.reportCreatedInPeriodCount },
    { Indicador: 'Tickets cerrados en periodo', Valor: data.reportClosedInPeriodCount },
    { Indicador: 'Causas recurrentes detectadas', Valor: data.reportIncidentCauseBars.length },
    { Indicador: 'Cumplimiento SLA (%)', Valor: data.reportSlaCompliancePct ?? 'N/D' },
    { Indicador: 'Cumplimiento SLA previo (%)', Valor: data.hasComparisonWindow ? (data.reportPreviousSlaCompliancePct ?? 'N/D') : 'N/D' },
    { Indicador: 'Comparativo cumplimiento SLA', Valor: data.reportSlaComplianceTrend.label },
    { Indicador: 'SLA vencido', Valor: data.reportSlaExpiredCount },
    { Indicador: 'Críticos', Valor: data.reportCriticalCount },
    { Indicador: 'Definicion MTTR', Valor: 'Inicio del ciclo -> resolucion; el cierre administrativo no interviene' },
    { Indicador: 'MTTR por ciclo promedio (horas)', Valor: data.reportAvgResolutionHours ?? 'N/D' },
    { Indicador: 'MTTR por ciclo promedio previo (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousAvgResolutionHours ?? 'N/D') : 'N/D' },
    { Indicador: 'MTTR por ciclo mediana (horas)', Valor: data.reportMedianResolutionHours ?? 'N/D' },
    { Indicador: 'MTTR por ciclo mediana previa (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousMedianResolutionHours ?? 'N/D') : 'N/D' },
    { Indicador: 'Comparativo MTTR por ciclo mediana', Valor: data.reportMttrMedianTrend.label },
    { Indicador: 'MTTR por ciclo P90 (horas)', Valor: data.reportP90ResolutionHours ?? 'N/D' },
    { Indicador: 'MTTR por ciclo P90 previo (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousP90ResolutionHours ?? 'N/D') : 'N/D' },
    { Indicador: 'Comparativo MTTR por ciclo P90', Valor: data.reportP90ResolutionTrend.label },
    { Indicador: 'Primera respuesta promedio (horas)', Valor: data.reportAvgFirstResponseHours ?? 'N/D' },
    { Indicador: 'Primera respuesta promedio previa (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousAvgFirstResponseHours ?? 'N/D') : 'N/D' },
    { Indicador: 'Primera respuesta mediana (horas)', Valor: data.reportMedianFirstResponseHours ?? 'N/D' },
    { Indicador: 'Primera respuesta mediana previa (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousMedianFirstResponseHours ?? 'N/D') : 'N/D' },
    { Indicador: 'Comparativo primera respuesta mediana', Valor: data.reportFirstResponseMedianTrend.label },
    { Indicador: 'Primera respuesta P90 (horas)', Valor: data.reportP90FirstResponseHours ?? 'N/D' },
    { Indicador: 'Primera respuesta P90 previa (horas)', Valor: data.hasComparisonWindow ? (data.reportPreviousP90FirstResponseHours ?? 'N/D') : 'N/D' },
    { Indicador: 'Activos totales', Valor: data.reportInventorySnapshot.totalActivos },
    { Indicador: 'Activos en falla', Valor: data.reportInventorySnapshot.activosEnFalla },
    { Indicador: 'Insumos total', Valor: data.reportSupplySnapshot.total },
    { Indicador: 'Insumos agotados', Valor: data.reportSupplySnapshot.agotados },
    { Indicador: 'Insumos bajo mínimo', Valor: data.reportSupplySnapshot.bajoMinimo },
  ];
  const detailRows = buildReportTicketExportRows(data);
  const stateRows = data.reportStateBars.map((row) => ({ Estado: row.label, Cantidad: row.count }));
  const branchRows = data.reportBranchBars.map((row) => ({ Sucursal: row.label, Cantidad: row.count }));
  const areaRows = data.reportAreaBars.map((row) => ({ Área: row.label, Cantidad: row.count }));
  const techRows = data.reportTechBars.map((row) => ({ Técnico: row.label, Cantidad: row.count }));
  const causeRows = data.reportIncidentCauseBars.map((row) => ({
    Área: row.area,
    Causa: row.cause,
    Cantidad: row.count,
  }));
  const trendRows = data.reportLifecycleTrend.map((row) => ({
    Periodo: row.label,
    Creados: row.created,
    Cerrados: row.closed,
  }));
  const auditRows = data.reportAuditRows.map((row) => ({
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
  const suffix = `${data.reportDateFrom || 'inicio'}_${data.reportDateTo || 'fin'}`.replace(/[^0-9A-Za-z_-]/g, '-');
  XLSX.writeFile(workbook, `reporteria_it_${suffix}.xlsx`);
}
