import { LOGO_GIGANTES_DATA_URI } from '../assets/logoGigantes';
import type { TicketItem } from '../types/app';
import { getTicketAreaLabel } from '../utils/appHelpers';
import { escapeHtml, formatDateTime } from '../utils/format';
import { formatTicketAttentionType } from '../utils/tickets';
import { formatTicketSlaResult } from '../utils/sla';
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
  reportSlaCompliancePct: number | null;
  reportSlaCompliantCount: number;
  reportSlaTotalCount: number;
  reportSlaExpiredCount: number;
  reportAvgFirstResponseHours: number | null;
  reportMedianFirstResponseHours: number | null;
  reportP90FirstResponseHours: number | null;
  reportFirstResponseMedianTrend: TrendLabel;
  reportAvgResolutionHours: number | null;
  reportMedianResolutionHours: number | null;
  reportP90ResolutionHours: number | null;
  reportMttrMedianTrend: TrendLabel;
  reportInventorySnapshot: { totalActivos: number; activosEnFalla: number };
  reportSupplySnapshot: { total: number; agotados: number; bajoMinimo: number };
  sessionUserName: string;
  nowMs: number;
  formatTicketBranchFromCatalog: (value?: string) => string;
}

/**
 * Genera el Reporte Ejecutivo IT con el diseño horizontal de la referencia.
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
    reportAvgFirstResponseHours,
    reportMedianFirstResponseHours,
    reportP90FirstResponseHours,
    reportFirstResponseMedianTrend,
    reportAvgResolutionHours,
    reportMedianResolutionHours,
    reportP90ResolutionHours,
    reportMttrMedianTrend,
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
  const generatedAt = new Date(nowMs).toLocaleString('es-MX');
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
  const firstResponseTrendHtml = hasComparisonWindow
    ? `<div class="delta">${escapeHtml(reportFirstResponseMedianTrend.label)}</div>`
    : '';
  const mttrTrendHtml = hasComparisonWindow
    ? `<div class="delta">${escapeHtml(reportMttrMedianTrend.label)}</div>`
    : '';
  const ticketRows = reportTickets.slice(0, 40).map((ticket) => {
    const area = getTicketAreaLabel(ticket);
    const branch = formatTicketBranchFromCatalog(ticket.sucursal);
    const attention = formatTicketAttentionType(ticket.atencionTipo);
    const sla = formatTicketSlaResult(ticket, nowMs);
    return `
        <tr>
          <td>${ticket.id}</td>
          <td>${escapeHtml(formatDateTime(ticket.fechaCreacion || ticket.fecha))}</td>
          <td>${escapeHtml(branch)}</td>
          <td>${escapeHtml(area)}</td>
          <td>${escapeHtml(ticket.activoTag || 'SIN ACTIVO')}</td>
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
    `);
  const auditRows = reportAuditModuleBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
  const header = (title: string, section: string) => `
    <header class="header">
      <div class="brand"><img src="${LOGO_GIGANTES_DATA_URI}" alt="Supermercado Los Gigantes" /></div>
      <div class="header-main">
        <p class="eyebrow">Control operativo · Mesa IT</p>
        <h1>${title}</h1>
        <div class="metadata">
          <div class="meta-item"><span class="meta-label">Periodo</span><span class="meta-value">${safePeriod}</span></div>
          <div class="meta-item"><span class="meta-label">Tendencia</span><span class="meta-value">${safeTrendMode}</span></div>
          <div class="meta-item"><span class="meta-label">Responsable</span><span class="meta-value">${safeUser}</span></div>
        </div>
      </div>
    </header>
    <p class="filters"><strong>Filtros:</strong> ${safeFilterSummary}</p>
    <p class="section-index">Reporte Ejecutivo IT <span>${section}</span></p>`;
  const footer = `
    <footer class="footer"><span>Supermercado Los Gigantes · Mesa IT</span><span>Generado: ${safeGeneratedAt}</span></footer>`;
  const tableBlock = (title: string, columns: string[], rows: string) => `
    <section class="report-block">
      <h2 class="section-title">${title}</h2>
      <table>
        <thead><tr>${columns.map((column) => `<th scope="col">${column}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${columns.length}" class="empty">Sin datos</td></tr>`}</tbody>
      </table>
    </section>`;
  // Paginar la tendencia evita desplazar una tabla larga y dejar solo el encabezado.
  const trendPageCount = Math.max(1, Math.ceil(trendRows.length / 24));
  const activityPages = Array.from({ length: trendPageCount }, (_, index) => `
    <section class="report-page">
      ${header('Actividad y auditoría', `03 · Evolución del periodo${trendPageCount > 1 ? ` · ${index + 1}/${trendPageCount}` : ''}`)}
      <div class="two-columns activity">
        ${tableBlock(`Tendencia ${safeTrendMode} · Creados vs cerrados`, ['Periodo', 'Creados', 'Cerrados'], trendRows.slice(index * 24, (index + 1) * 24).join(''))}
        ${index === 0 ? tableBlock('Auditoría por módulo', ['Módulo', 'Movimientos'], auditRows) : ''}
      </div>
      ${footer}
    </section>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte Ejecutivo IT</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    :root {
      color-scheme: light;
      --navy: #0f2747;
      --orange: #f58220;
      --line: #cbd5e1;
      --muted: #64748b;
      --surface: #f8fafc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, Helvetica, sans-serif;
      color: #172033;
      background: #e8edf3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-page {
      max-width: 1120px;
      margin: 0 auto 24px;
      padding: 22px 26px 16px;
      border-top: 6px solid var(--orange);
      background: #fff;
      box-shadow: 0 18px 55px rgba(15, 39, 71, .12);
    }
    .header { display: grid; grid-template-columns: 164px minmax(0, 1fr); gap: 22px; align-items: center; padding-bottom: 12px; border-bottom: 2px solid var(--navy); }
    .brand { padding-right: 18px; border-right: 1px solid var(--line); }
    .brand img { display: block; width: 145px; height: 64px; object-fit: contain; }
    .header-main { min-width: 0; }
    .eyebrow { margin: 0 0 4px; color: var(--orange); font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; color: var(--navy); font-size: 28px; line-height: 1.1; font-weight: 900; text-transform: uppercase; }
    .metadata { display: grid; grid-template-columns: 1.3fr .7fr 1fr; gap: 8px; margin-top: 10px; }
    .meta-item { padding: 7px 9px; border: 1px solid #dbe3ec; border-radius: 7px; background: var(--surface); min-width: 0; }
    .meta-label { display: block; color: var(--muted); font-size: 7px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .meta-value { display: block; margin-top: 3px; color: var(--navy); font-size: 10px; line-height: 1.25; font-weight: 800; overflow-wrap: anywhere; }
    .filters, .meta { margin: 8px 0; color: var(--muted); font-size: 9px; line-height: 1.4; overflow-wrap: anywhere; }
    .section-index { display: flex; justify-content: space-between; margin: 10px 0; color: var(--muted); font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
    .section-index span { color: var(--navy); }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .kpis { grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 12px; }
    .snapshots { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 14px; }
    .card { padding: 10px 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); min-width: 0; break-inside: avoid; }
    .kpis .card { background: var(--navy); border-color: var(--navy); color: #fff; }
    .kpis .card:first-child { background: var(--orange); border-color: var(--orange); }
    .label { color: var(--muted); font-size: 8px; text-transform: uppercase; font-weight: 800; letter-spacing: .06em; }
    .kpi { margin-top: 5px; color: var(--navy); font-size: 25px; font-weight: 900; font-variant-numeric: tabular-nums; }
    .delta { margin-top: 5px; color: var(--muted); font-size: 8px; line-height: 1.35; overflow-wrap: anywhere; }
    .kpis .label, .kpis .kpi, .kpis .delta { color: #fff; }
    .two-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin-top: 14px; align-items: start; }
    .report-block { min-width: 0; }
    .section-title { display: flex; align-items: center; gap: 10px; margin: 0 0 7px; color: var(--navy); font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; break-after: avoid; }
    .section-title::after { content: ''; height: 2px; flex: 1; background: var(--orange); }
    .metric-block { break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
    th, td { border: 1px solid var(--line); padding: 5px 7px; text-align: left; vertical-align: middle; line-height: 1.25; overflow-wrap: anywhere; }
    th { background: var(--navy); color: #fff; font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    tbody tr:nth-child(even) td { background: var(--surface); }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .empty { color: var(--muted); text-align: center; padding: 14px; }
    .detail-table { font-size: 9px; }
    .detail-table td, .detail-table th { padding: 5px; }
    .activity table { font-size: 9px; }
    .activity td { padding: 3px 7px; }
    .footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--line); color: var(--muted); font-size: 8px; line-height: 1.3; break-inside: avoid; }
    @media (max-width: 760px) {
      body { padding: 0; }
      .report-page { min-width: 960px; margin-bottom: 16px; }
    }
    @media print {
      body { padding: 0; background: #fff; }
      .report-page { max-width: none; min-width: 0; margin: 0; padding: 12px 0 0; box-shadow: none; }
      .report-page + .report-page { break-before: page; page-break-before: always; }
      .two-columns { display: block; columns: 2; column-gap: 18px; }
      .two-columns > .report-block { margin-bottom: 14px; break-inside: avoid; }
      .metrics, .activity { display: grid; columns: auto; }
    }
  </style>
</head>
<body>
  <section class="report-page">
    ${header('Reporte Ejecutivo IT', '01 · Resumen ejecutivo')}
    ${previousPeriodMeta}
    <div class="grid kpis">
      <div class="card"><div class="label">Tickets</div><div class="kpi">${reportTickets.length}</div>${ticketsTrendHtml}</div>
      <div class="card"><div class="label">Abiertos</div><div class="kpi">${reportOpenCount}</div>${openTrendHtml}</div>
      <div class="card"><div class="label">Cerrados</div><div class="kpi">${reportClosedCount}</div></div>
      <div class="card"><div class="label">SLA cumplido</div><div class="kpi">${reportSlaCompliancePct === null ? 'N/D' : `${reportSlaCompliancePct}%`}</div><div class="delta">${reportSlaTotalCount > 0 ? `${reportSlaCompliantCount}/${reportSlaTotalCount} resueltos en tiempo` : 'Sin resoluciones evaluables'}</div>${slaTrendHtml}</div>
      <div class="card"><div class="label">SLA vencido</div><div class="kpi">${reportSlaExpiredCount}</div></div>
    </div>
    <div class="two-columns metrics">
    <section class="report-block metric-block">
    <h2 class="section-title">Tiempo de primera respuesta</h2>
    <p class="meta">Creación → primera atención. No representa tiempo de resolución.</p>
    <div class="grid">
      <div class="card"><div class="label">Promedio</div><div class="kpi">${reportAvgFirstResponseHours === null ? 'N/D' : `${reportAvgFirstResponseHours} h`}</div></div>
      <div class="card"><div class="label">Mediana</div><div class="kpi">${reportMedianFirstResponseHours === null ? 'N/D' : `${reportMedianFirstResponseHours} h`}</div>${firstResponseTrendHtml}</div>
      <div class="card"><div class="label">P90</div><div class="kpi">${reportP90FirstResponseHours === null ? 'N/D' : `${reportP90FirstResponseHours} h`}</div></div>
    </div>
    </section>
    <section class="report-block metric-block">
    <h2 class="section-title">MTTR por ciclo resuelto</h2>
    <p class="meta">Inicio del ciclo → resolución. El cierre administrativo no interviene.</p>
    <div class="grid">
      <div class="card"><div class="label">Promedio</div><div class="kpi">${reportAvgResolutionHours === null ? 'N/D' : `${reportAvgResolutionHours} h`}</div></div>
      <div class="card"><div class="label">Mediana</div><div class="kpi">${reportMedianResolutionHours === null ? 'N/D' : `${reportMedianResolutionHours} h`}</div>${mttrTrendHtml}</div>
      <div class="card"><div class="label">P90</div><div class="kpi">${reportP90ResolutionHours === null ? 'N/D' : `${reportP90ResolutionHours} h`}</div></div>
    </div>
    </section>
    </div>
    <div class="grid snapshots">
      <div class="card"><div class="label">Activos totales</div><div class="kpi">${reportInventorySnapshot.totalActivos}</div></div>
      <div class="card"><div class="label">Activos en falla</div><div class="kpi">${reportInventorySnapshot.activosEnFalla}</div></div>
      <div class="card"><div class="label">Insumos total</div><div class="kpi">${reportSupplySnapshot.total}</div></div>
      <div class="card"><div class="label">Insumos críticos</div><div class="kpi">${reportSupplySnapshot.agotados + reportSupplySnapshot.bajoMinimo}</div></div>
    </div>
    ${footer}
  </section>

  <section class="report-page">
    ${header('Distribución operativa', '02 · Estados, sucursales y causas')}
    <div class="two-columns">
      ${tableBlock('Tickets por estado', ['Estado', 'Cantidad'], stateRows)}
      ${tableBlock('Tickets por sucursal · Top 10', ['Sucursal', 'Cantidad'], branchRows)}
      ${tableBlock('Tickets por área · Top 10', ['Área', 'Cantidad'], areaRows)}
      ${tableBlock('Top causas recurrentes', ['Área', 'Causa', 'Tickets'], causeRows)}
    </div>
    ${footer}
  </section>

  ${activityPages}

  <section class="report-page">
    ${header('Detalle de tickets', '04 · Seguimiento operativo')}
    <h2 class="section-title">Tickets del periodo (${reportTickets.length})</h2>
    <p class="meta">Mostrando ${Math.min(reportTickets.length, 40)} de ${reportTickets.length} tickets según los filtros seleccionados.</p>
    <table class="detail-table">
      <colgroup>
        <col style="width:4%" /><col style="width:12%" /><col style="width:11%" /><col style="width:11%" /><col style="width:8%" />
        <col style="width:8%" /><col style="width:9%" /><col style="width:8%" /><col style="width:8%" /><col style="width:11%" />
      </colgroup>
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
    ${footer}
  </section>
</body>
</html>`;
}
