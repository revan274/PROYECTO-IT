import { LOGO_GIGANTES_DATA_URI } from '../assets/logoGigantes';
import {
  TRAVEL_DEFAULT_AUTHORIZER,
  TRAVEL_DEFAULT_DEPARTMENT,
  TRAVEL_DEFAULT_FINANCE,
  TRAVEL_REPORT_MIN_ROWS,
} from '../constants/app';
import type { TravelDestinationRule, TravelReportRow } from '../types/app';
import { formatTravelNumber } from '../utils/appHelpers';
import { escapeHtml } from '../utils/format';

export interface TravelSheetData {
  department: string;
  monthLabel: string;
  reporterName: string;
  authorizer: string;
  finance: string;
  fuelEfficiencyValue: number;
  fuelLiters: number;
  rows: TravelReportRow[];
  destinationRules: TravelDestinationRule[];
  suggestedTripsByCode: ReadonlyMap<string, number>;
  totalTrips: number;
  totalKms: number;
}

/**
 * Genera el HTML del Formato Mensual de Movilidad IT imprimible (A4 horizontal).
 * Función pura: datos → string HTML.
 */
export function buildTravelSheetHtml(data: TravelSheetData): string {
  const safeDepartment = escapeHtml(String(data.department || TRAVEL_DEFAULT_DEPARTMENT).trim().toUpperCase());
  const safeMonth = escapeHtml(data.monthLabel);
  const safeReporter = escapeHtml(String(data.reporterName || 'SIN NOMBRE').trim().toUpperCase());
  const safeAuthorizer = escapeHtml(String(data.authorizer || TRAVEL_DEFAULT_AUTHORIZER).trim().toUpperCase());
  const safeFinance = escapeHtml(String(data.finance || TRAVEL_DEFAULT_FINANCE).trim().toUpperCase());
  const safeGeneratedAt = escapeHtml(new Date().toLocaleString('es-MX'));
  const litersLabel = data.fuelEfficiencyValue > 0 ? data.fuelLiters.toFixed(1) : 'N/D';
  const efficiencyLabel = data.fuelEfficiencyValue > 0
    ? `${formatTravelNumber(data.fuelEfficiencyValue)} km/l`
    : 'N/D';

  const rowHtml = data.rows.map((row) => `
      <tr>
        <td class="name-cell">${escapeHtml(row.nombre.toUpperCase())}</td>
        <td class="center route-cell">${row.routeIndex || '—'}</td>
        <td>${escapeHtml(row.destinationLabel)}</td>
        <td class="center numeric">${formatTravelNumber(row.kms)}</td>
        <td class="center date-cell">${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.motivo)}</td>
      </tr>
    `).join('');
  const blankRowHtml = Array.from({ length: Math.max(0, TRAVEL_REPORT_MIN_ROWS - data.rows.length) })
    .map(() => `
        <tr class="blank" aria-hidden="true">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `)
    .join('');
  const routeRowsHtml = data.destinationRules.map((row) => `
      <tr>
        <td class="center">${row.index}</td>
        <td>${escapeHtml(row.label)}</td>
        <td class="center numeric">${formatTravelNumber(row.kms)}</td>
        <td class="center numeric">${data.suggestedTripsByCode.get(row.code) || 0}</td>
      </tr>
    `).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Movilidad IT · ${safeMonth}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    :root {
      color-scheme: light;
      --navy: #0f2747;
      --navy-soft: #173b68;
      --orange: #f58220;
      --orange-soft: #fff3e7;
      --green: #8cc63f;
      --line: #cbd5e1;
      --muted: #64748b;
      --surface: #f8fafc;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      padding: 24px;
      font-family: Arial, Helvetica, sans-serif;
      background: #e8edf3;
      color: #172033;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: min(1120px, 100%);
      min-height: 760px;
      margin: 0 auto;
      padding: 24px 26px 18px;
      background: #fff;
      border-top: 7px solid var(--orange);
      box-shadow: 0 18px 55px rgba(15, 39, 71, .16);
    }
    .header {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      align-items: center;
      gap: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid var(--navy);
    }
    .brand {
      display: flex;
      align-items: center;
      min-height: 64px;
      padding-right: 20px;
      border-right: 1px solid #dbe3ec;
    }
    .logo-box {
      display: block;
      width: 158px;
      height: 58px;
      object-fit: contain;
      object-position: left center;
    }
    .header-main { min-width: 0; }
    .eyebrow {
      margin: 0 0 3px;
      color: var(--orange);
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .18em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      color: var(--navy);
      font-size: 28px;
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: .015em;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 11px;
    }
    .meta-item {
      min-width: 0;
      padding: 7px 9px;
      border: 1px solid #dbe3ec;
      border-radius: 7px;
      background: var(--surface);
    }
    .meta-label {
      display: block;
      margin-bottom: 2px;
      color: var(--muted);
      font-size: 7px;
      font-weight: 800;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .meta-value {
      display: block;
      color: var(--navy);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.15;
      text-transform: uppercase;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .main-table {
      margin-top: 14px;
      font-size: 9px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 4px 6px;
      vertical-align: middle;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    thead th {
      background: var(--navy);
      color: #fff;
      text-align: left;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    thead th:first-child { border-left-color: var(--navy); }
    thead th:last-child { border-right-color: var(--navy); }
    .main-table tbody tr { height: 22px; }
    .main-table tbody tr:nth-child(even) td { background: var(--surface); }
    .main-table tbody tr:not(.blank) td:first-child { font-weight: 700; }
    .main-table tbody tr.blank td { color: transparent; }
    .center { text-align: center; }
    .numeric { font-variant-numeric: tabular-nums; }
    .date-cell { white-space: nowrap; }
    .route-cell { color: var(--navy-soft); font-weight: 800; }
    .totals td {
      padding: 0;
      border-color: var(--navy);
      background: var(--navy);
      color: #fff;
    }
    .metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 34px;
      padding: 6px 10px;
    }
    .metric span {
      color: #dbeafe;
      font-size: 7px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .metric strong {
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      white-space: nowrap;
    }
    .metric.accent { background: var(--orange); }
    .metric.accent span { color: #fff7ed; }
    .lower-grid {
      display: grid;
      grid-template-columns: minmax(330px, 42%) minmax(0, 1fr);
      gap: 18px;
      margin-top: 14px;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 0 0 6px;
      color: var(--navy);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .section-title::after {
      content: '';
      height: 2px;
      flex: 1;
      background: var(--orange);
    }
    .route-table { font-size: 8px; }
    .route-table th { padding: 4px 5px; font-size: 7px; }
    .route-table td { padding: 4px 5px; }
    .signatures {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .signature-row {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      align-items: end;
      gap: 10px;
    }
    .signature-label {
      padding-bottom: 4px;
      color: var(--navy);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .signature-line {
      min-width: 0;
      min-height: 28px;
      padding: 9px 6px 3px;
      border-bottom: 1px solid #64748b;
      color: #1e293b;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
      padding-top: 7px;
      border-top: 1px solid #dbe3ec;
      color: var(--muted);
      font-size: 7px;
      line-height: 1.3;
    }
    .footer strong { color: var(--navy); }
    @media (max-width: 760px) {
      body { padding: 0; }
      .sheet { width: 100%; min-width: 720px; box-shadow: none; }
    }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet {
        width: 100%;
        min-height: 0;
        padding: 0;
        border-top-width: 5px;
        box-shadow: none;
      }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div class="brand">
        <img class="logo-box" src="${LOGO_GIGANTES_DATA_URI}" alt="Supermercado Los Gigantes" />
      </div>
      <div class="header-main">
        <p class="eyebrow">Control operativo · Mesa IT</p>
        <h1>Formato mensual de movilidad</h1>
        <div class="meta">
          <div class="meta-item">
            <span class="meta-label">Departamento</span>
            <span class="meta-value">${safeDepartment}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Periodo</span>
            <span class="meta-value">${safeMonth}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Responsable</span>
            <span class="meta-value">${safeReporter}</span>
          </div>
        </div>
      </div>
    </header>

    <table class="main-table" aria-label="Detalle mensual de viajes">
      <colgroup>
        <col style="width: 16%;" />
        <col style="width: 5%;" />
        <col style="width: 13%;" />
        <col style="width: 8%;" />
        <col style="width: 12%;" />
        <col style="width: 46%;" />
      </colgroup>
      <thead>
        <tr>
          <th>Responsable</th>
          <th class="center">Ruta</th>
          <th>Destino</th>
          <th class="center">Kms</th>
          <th class="center">Fecha</th>
          <th>Motivo del traslado</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
        ${blankRowHtml}
      </tbody>
      <tfoot>
        <tr class="totals">
          <td colspan="2">
            <div class="metric accent"><span>Total de viajes</span><strong>${data.totalTrips}</strong></div>
          </td>
          <td colspan="2">
            <div class="metric"><span>Distancia total</span><strong>${formatTravelNumber(data.totalKms)} km</strong></div>
          </td>
          <td colspan="2">
            <div class="metric"><span>Combustible estimado</span><strong>${escapeHtml(litersLabel)} L</strong></div>
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="lower-grid">
      <section aria-label="Resumen de rutas">
        <h2 class="section-title">Resumen por ruta</h2>
        <table class="route-table">
          <colgroup>
            <col style="width: 12%;" />
            <col style="width: 48%;" />
            <col style="width: 20%;" />
            <col style="width: 20%;" />
          </colgroup>
          <thead>
            <tr>
              <th class="center">Ruta</th>
              <th>Destino</th>
              <th class="center">Kms</th>
              <th class="center">Viajes</th>
            </tr>
          </thead>
          <tbody>${routeRowsHtml}</tbody>
        </table>
      </section>

      <section aria-label="Firmas de validación">
        <h2 class="section-title">Validación</h2>
        <div class="signatures">
          <div class="signature-row">
            <div class="signature-label">Presenta</div>
            <div class="signature-line">${safeReporter}</div>
          </div>
          <div class="signature-row">
            <div class="signature-label">Autoriza</div>
            <div class="signature-line">${safeAuthorizer}</div>
          </div>
          <div class="signature-row">
            <div class="signature-label">Finanzas</div>
            <div class="signature-line">${safeFinance}</div>
          </div>
        </div>
      </section>
    </div>

    <footer class="footer">
      <span>Consumo estimado con rendimiento de <strong>${escapeHtml(efficiencyLabel)}</strong>. Validar contra comprobantes antes de autorizar.</span>
      <span>Generado: ${safeGeneratedAt}</span>
    </footer>
  </main>
</body>
</html>`;
}
