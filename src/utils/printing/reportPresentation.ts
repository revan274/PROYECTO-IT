import type { AuditModule, TicketItem } from '../../types/app';
import { escapeHtml, formatDateTime } from '../format';
import { getTicketAreaLabel } from '../appHelpers';
import { formatTicketAttentionType, isTicketSlaExpired } from '../tickets';

interface ReportTrend {
  label: string;
  toneClass?: string;
}

interface BarRow {
  label: string;
  count: number;
}

interface IncidentCauseRow {
  area: string;
  cause: string;
  count: number;
}

interface LifecycleTrendRow {
  label: string;
  created: number;
  closed: number;
}

interface AuditModuleBarRow {
  module: AuditModule;
  label: string;
  count: number;
}

interface SnapshotInventory {
  totalActivos: number;
  activosEnFalla: number;
  sinResponsable: number;
}

interface SnapshotSupply {
  total: number;
  agotados: number;
  bajoMinimo: number;
}

export interface ReportPresentationHtmlParams {
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: string;
  reportPriorityFilter: string;
  reportAttentionFilter: string;
  reportTechnicianFilter: string;
  reportPreviousPeriodLabel: string;
  reportTrendMode: 'DIARIA' | 'SEMANAL';
  sessionUserName: string;
  hasReportComparison: boolean;
  reportTicketsTrend: ReportTrend;
  reportOpenTrend: ReportTrend;
  reportSlaComplianceTrend: ReportTrend;
  reportTickets: TicketItem[];
  liveNow: number;
  reportStateBars: BarRow[];
  reportBranchBars: Array<{ label: string; count: number }>;
  reportAreaBars: BarRow[];
  reportIncidentCauseBars: IncidentCauseRow[];
  reportLifecycleTrend: LifecycleTrendRow[];
  reportAuditModuleBars: AuditModuleBarRow[];
  reportOpenCount: number;
  reportClosedCount: number;
  reportSlaCompliancePct: number;
  reportSlaCompliantCount: number;
  reportSlaTotalCount: number;
  reportSlaExpiredCount: number;
  reportInventorySnapshot: SnapshotInventory;
  reportSupplySnapshot: SnapshotSupply;
  formatTicketBranchFromCatalog: (value?: string) => string;
}

/**
 * Construye el HTML del Reporte Ejecutivo IT (A4, multipágina).
 * Función pura: solo genera la cadena HTML a partir de los datos del reporte.
 */
export function buildReportPresentationHtml(params: ReportPresentationHtmlParams): string {
  const {
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
    sessionUserName,
    hasReportComparison,
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
  } = params;

  const periodLabel = `${reportDateFrom || 'N/D'} a ${reportDateTo || 'N/D'}`;
  const branchLabel = reportBranchFilter === 'TODAS' ? 'Todas las sucursales' : formatTicketBranchFromCatalog(reportBranchFilter);
  const areaLabel = reportAreaFilter === 'TODAS' ? 'Todas las áreas' : reportAreaFilter;
  const stateLabel = reportStateFilter === 'TODOS' ? 'Todos los estados' : reportStateFilter;
  const priorityLabel = reportPriorityFilter === 'TODAS' ? 'Todas las prioridades' : reportPriorityFilter;
  const attentionLabel = reportAttentionFilter === 'TODAS'
    ? 'Todas las atenciones'
    : formatTicketAttentionType(reportAttentionFilter);
  const technicianLabel = reportTechnicianFilter === 'TODOS'
    ? 'Todos los tecnicos'
    : reportTechnicianFilter === 'SIN_ASIGNAR'
      ? 'Sin asignar'
      : reportTechnicianFilter;
  const filterSummary = `Sucursal: ${branchLabel} | Área: ${areaLabel} | Estado: ${stateLabel} | Prioridad: ${priorityLabel} | Atención: ${attentionLabel} | Técnico: ${technicianLabel}`;
  const generatedAt = new Date().toLocaleString();
  const safePeriod = escapeHtml(periodLabel);
  const safeFilterSummary = escapeHtml(filterSummary);
  const safePreviousPeriod = escapeHtml(reportPreviousPeriodLabel);
  const safeTrendMode = escapeHtml(reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria');
  const safeGeneratedAt = escapeHtml(generatedAt);
  const safeUser = escapeHtml(sessionUserName || 'Sistema');
  const safeTicketsTrend = escapeHtml(reportTicketsTrend.label);
  const safeOpenTrend = escapeHtml(reportOpenTrend.label);
  const safeSlaTrend = escapeHtml(reportSlaComplianceTrend.label);
  const previousPeriodMeta = hasReportComparison
    ? `<p class="meta"><strong>Periodo anterior:</strong> ${safePreviousPeriod}</p>`
    : '';
  const ticketsTrendHtml = hasReportComparison ? `<div class="delta">${safeTicketsTrend}</div>` : '';
  const openTrendHtml = hasReportComparison ? `<div class="delta">${safeOpenTrend}</div>` : '';
  const slaTrendHtml = hasReportComparison ? `<div class="delta">${safeSlaTrend}</div>` : '';
  const ticketRows = reportTickets.slice(0, 40).map((ticket) => {
    const area = getTicketAreaLabel(ticket);
    const branch = formatTicketBranchFromCatalog(ticket.sucursal);
    const attention = formatTicketAttentionType(ticket.atencionTipo);
    const sla = isTicketSlaExpired(ticket, liveNow) ? 'Vencido' : 'En tiempo';
    return `
        <tr>
          <td>${ticket.id}</td>
          <td>${escapeHtml(formatDateTime(ticket.fechaCreacion || ticket.fecha))}</td>
          <td>${escapeHtml(branch)}</td>
          <td>${escapeHtml(area)}</td>
          <td>${escapeHtml(ticket.activoTag)}</td>
          <td>${escapeHtml(ticket.prioridad)}</td>
          <td>${escapeHtml(ticket.estado)}</td>
          <td>${escapeHtml(attention)}</td>
          <td>${escapeHtml(sla)}</td>
          <td>${escapeHtml(ticket.asignadoA || 'Sin asignar')}</td>
        </tr>
      `;
  }).join('');
  const stateRows = reportStateBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  const branchRows = reportBranchBars.slice(0, 10).map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  const areaRows = reportAreaBars.slice(0, 10).map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  const causeRows = reportIncidentCauseBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.area)}</td>
        <td>${escapeHtml(item.cause)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  const trendRows = reportLifecycleTrend.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.created}</td>
        <td>${item.closed}</td>
      </tr>
    `).join('');
  const auditRows = reportAuditModuleBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte Ejecutivo IT</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1, h2 { margin: 0; }
    .cover { padding: 12mm; border: 2px solid #e2e8f0; border-radius: 12px; }
    .meta { margin-top: 10px; font-size: 12px; color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .kpi { font-size: 28px; font-weight: 800; margin-top: 4px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .05em; }
    .delta { margin-top: 6px; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: .04em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; }
    .section-title { margin-top: 14px; font-size: 14px; font-weight: 800; text-transform: uppercase; }
  </style>
</head>
<body>
  <section class="page cover">
    <h1>Reporte Ejecutivo IT</h1>
    <p class="meta"><strong>Periodo:</strong> ${safePeriod}</p>
    <p class="meta"><strong>Filtros:</strong> ${safeFilterSummary}</p>
    ${previousPeriodMeta}
    <p class="meta"><strong>Tendencia:</strong> ${safeTrendMode}</p>
    <p class="meta"><strong>Generado:</strong> ${safeGeneratedAt}</p>
    <p class="meta"><strong>Usuario:</strong> ${safeUser}</p>
    <div class="grid">
      <div class="card"><div class="label">Tickets</div><div class="kpi">${reportTickets.length}</div>${ticketsTrendHtml}</div>
      <div class="card"><div class="label">Abiertos</div><div class="kpi">${reportOpenCount}</div>${openTrendHtml}</div>
      <div class="card"><div class="label">Cerrados</div><div class="kpi">${reportClosedCount}</div></div>
      <div class="card"><div class="label">SLA cumplido</div><div class="kpi">${reportSlaCompliancePct}%</div><div class="delta">${reportSlaCompliantCount}/${reportSlaTotalCount} en tiempo</div>${slaTrendHtml}</div>
      <div class="card"><div class="label">SLA vencido</div><div class="kpi">${reportSlaExpiredCount}</div></div>
    </div>
    <div class="grid">
      <div class="card"><div class="label">Activos totales</div><div class="kpi">${reportInventorySnapshot.totalActivos}</div></div>
      <div class="card"><div class="label">Activos en falla</div><div class="kpi">${reportInventorySnapshot.activosEnFalla}</div></div>
      <div class="card"><div class="label">Insumos total</div><div class="kpi">${reportSupplySnapshot.total}</div></div>
      <div class="card"><div class="label">Insumos críticos</div><div class="kpi">${reportSupplySnapshot.agotados + reportSupplySnapshot.bajoMinimo}</div></div>
    </div>
  </section>

  <section class="page">
    <h2>Distribucion Operativa</h2>
    <p class="section-title">Tickets por estado</p>
    <table>
      <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
      <tbody>${stateRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tickets por sucursal</p>
    <table>
      <thead><tr><th>Sucursal</th><th>Cantidad</th></tr></thead>
      <tbody>${branchRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tickets por área</p>
    <table>
      <thead><tr><th>Area</th><th>Cantidad</th></tr></thead>
      <tbody>${areaRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Top causas recurrentes</p>
    <table>
      <thead><tr><th>Area</th><th>Causa</th><th>Tickets</th></tr></thead>
      <tbody>${causeRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tendencia ${safeTrendMode} de tickets (creados vs cerrados)</p>
    <table>
      <thead><tr><th>Periodo</th><th>Creados</th><th>Cerrados</th></tr></thead>
      <tbody>${trendRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Auditoría por módulo</p>
    <table>
      <thead><tr><th>Módulo</th><th>Movimientos</th></tr></thead>
      <tbody>${auditRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
  </section>

  <section class="page">
    <h2>Detalle de Tickets (${reportTickets.length})</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Fecha</th>
          <th>Sucursal</th>
          <th>Area</th>
          <th>Tag</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Atención</th>
          <th>SLA</th>
          <th>Asignado</th>
        </tr>
      </thead>
      <tbody>
        ${ticketRows || '<tr><td colspan="10">Sin tickets para los filtros seleccionados.</td></tr>'}
      </tbody>
    </table>
  </section>
</body>
</html>`;
}
