import { LOGO_GIGANTES_DATA_URI } from '../assets/logoGigantes';
import type { TicketItem } from '../types/app';
import { getTicketAreaLabel } from '../utils/appHelpers';
import { escapeHtml, formatDateTime } from '../utils/format';
import { formatTicketAttentionType, isTicketSlaExpired } from '../utils/tickets';
import { buildReportFilterLabels } from './reportFilterLabels';

interface CountBar {
  label: string;
  count: number;
}

interface TrendLabel {
  label: string;
}

export interface ExecutiveReportData {
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
  reportTicketsTrend: TrendLabel;
  reportOpenTrend: TrendLabel;
  reportSlaComplianceTrend: TrendLabel;
  reportTickets: TicketItem[];
  reportStateBars: CountBar[];
  reportBranchBars: CountBar[];
  reportAreaBars: CountBar[];
  reportIncidentCauseBars: Array<{ area: string; cause: string; count: number }>;
  reportLifecycleTrend: Array<{ label: string; created: number; closed: number }>;
  reportAuditModuleBars: CountBar[];
  reportOpenCount: number;
  reportClosedCount: number;
  reportSlaCompliancePct: number;
  reportSlaCompliantCount: number;
  reportSlaTotalCount: number;
  reportSlaExpiredCount: number;
  reportInventorySnapshot: { totalActivos: number; activosEnFalla: number };
  reportSupplySnapshot: { total: number; agotados: number; bajoMinimo: number };
  sessionUserName: string;
  nowMs: number;
  formatTicketBranchFromCatalog: (value: string) => string;
}

/**
 * Genera el HTML del Reporte Ejecutivo IT imprimible (A4).
 * Función pura: datos → string HTML.
 */
export function buildExecutiveReportHtml(data: ExecutiveReportData): string {
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
    hasComparisonWindow,
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
    reportTickets,
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
    sessionUserName,
    nowMs,
    formatTicketBranchFromCatalog,
  } = data;

  const labels = buildReportFilterLabels({
    reportDateFrom,
    reportDateTo,
    reportBranchFilter,
    reportAreaFilter,
    reportStateFilter,
    reportPriorityFilter,
    reportAttentionFilter,
    reportTechnicianFilter,
    reportTrendMode,
    formatTicketBranchFromCatalog,
  });
  const filterSummary = `Sucursal: ${labels.branchLabel} | Área: ${labels.areaLabel} | Estado: ${labels.stateLabel} | Prioridad: ${labels.priorityLabel} | Atención: ${labels.attentionLabel} | Técnico: ${labels.technicianLabel}`;
  const generatedAt = new Date().toLocaleString();
  const safePeriod = escapeHtml(labels.periodLabel);
  const safeFilterSummary = escapeHtml(filterSummary);
  const safePreviousPeriod = escapeHtml(reportPreviousPeriodLabel);
  const safeTrendMode = escapeHtml(labels.trendModeLabel);
  const safeGeneratedAt = escapeHtml(generatedAt);
  const safeUser = escapeHtml(sessionUserName);
  const safeTicketsTrend = escapeHtml(reportTicketsTrend.label);
  const safeOpenTrend = escapeHtml(reportOpenTrend.label);
  const safeSlaTrend = escapeHtml(reportSlaComplianceTrend.label);
  const previousPeriodMeta = hasComparisonWindow
    ? `<p class="meta"><strong>Periodo anterior:</strong> ${safePreviousPeriod}</p>`
    : '';
  const ticketsTrendHtml = hasComparisonWindow ? `<div class="delta">${safeTicketsTrend}</div>` : '';
  const openTrendHtml = hasComparisonWindow ? `<div class="delta">${safeOpenTrend}</div>` : '';
  const slaTrendHtml = hasComparisonWindow ? `<div class="delta">${safeSlaTrend}</div>` : '';
  const ticketRows = reportTickets.slice(0, 40).map((ticket) => {
    const area = getTicketAreaLabel(ticket);
    const branch = formatTicketBranchFromCatalog(ticket.sucursal);
    const attention = formatTicketAttentionType(ticket.atencionTipo);
    const sla = isTicketSlaExpired(ticket, nowMs) ? 'Vencido' : 'En tiempo';
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
    <img src="${LOGO_GIGANTES_DATA_URI}" alt="Supermercado Los Gigantes" style="height:56px;width:auto;object-fit:contain;display:block;margin-bottom:12px;" />
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
