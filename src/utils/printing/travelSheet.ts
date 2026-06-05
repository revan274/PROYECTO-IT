import type { TravelDestinationRule, TravelReportRow } from '../../types/app';
import { escapeHtml } from '../format';
import { formatTravelNumber } from '../appHelpers';
import {
  TRAVEL_DEFAULT_AUTHORIZER,
  TRAVEL_DEFAULT_DEPARTMENT,
  TRAVEL_DEFAULT_FINANCE,
  TRAVEL_REPORT_MIN_ROWS,
} from '../../constants/app';

export interface TravelMovementSheetHtmlParams {
  travelReportDepartment: string;
  travelMonthLabel: string;
  effectiveTravelReporterName: string;
  travelReportAuthorizer: string;
  travelReportFinance: string;
  travelFuelEfficiencyValue: number;
  travelFuelLiters: number;
  travelReportRows: TravelReportRow[];
  travelDestinationRules: TravelDestinationRule[];
  travelSuggestedTripsByCode: Map<string, number>;
  travelTotalTrips: number;
  travelTotalKms: number;
}

/**
 * Construye el HTML del Formato Mensual de Movilidad IT (A4 vertical).
 * Función pura: solo genera la cadena HTML a partir de los datos de viáticos.
 */
export function buildTravelMovementSheetHtml(params: TravelMovementSheetHtmlParams): string {
  const {
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
  } = params;

  const safeDepartment = escapeHtml(String(travelReportDepartment || TRAVEL_DEFAULT_DEPARTMENT).trim().toUpperCase());
  const safeMonth = escapeHtml(travelMonthLabel);
  const safeReporter = escapeHtml(effectiveTravelReporterName.toUpperCase());
  const safeAuthorizer = escapeHtml(String(travelReportAuthorizer || TRAVEL_DEFAULT_AUTHORIZER).trim().toUpperCase());
  const safeFinance = escapeHtml(String(travelReportFinance || TRAVEL_DEFAULT_FINANCE).trim().toUpperCase());
  const safeGeneratedAt = escapeHtml(new Date().toLocaleString('es-MX'));
  const litersLabel = travelFuelEfficiencyValue > 0 ? travelFuelLiters.toFixed(1) : 'N/D';

  const rowHtml = travelReportRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.nombre.toUpperCase())}</td>
        <td class="center">${row.routeIndex || ''}</td>
        <td>${escapeHtml(row.destinationLabel)}</td>
        <td class="center">${formatTravelNumber(row.kms)}</td>
        <td class="center">${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.motivo)}</td>
      </tr>
    `).join('');
  const blankRowHtml = Array.from({ length: Math.max(0, TRAVEL_REPORT_MIN_ROWS - travelReportRows.length) })
    .map(() => `
        <tr class="blank">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `)
    .join('');
  const routeRowsHtml = travelDestinationRules.map((row) => `
      <tr>
        <td class="center">${row.index}</td>
        <td>${escapeHtml(row.label)}</td>
        <td class="center">${formatTravelNumber(row.kms)}</td>
        <td class="center">${travelSuggestedTripsByCode.get(row.code) || 0}</td>
      </tr>
    `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Formato Mensual Movilidad IT</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #d8d8d8; color: #111827; }
    .sheet {
      width: 100%;
      min-height: 100vh;
      padding: 8px;
      background: #d8d8d8;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 6px;
    }
    .logo-box {
      width: 86px;
      height: 86px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 2px solid #f59e0b;
      font-weight: 900;
      color: #f97316;
      font-size: 30px;
    }
    .header-main h1 {
      margin: 0;
      font-size: 38px;
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .meta {
      margin-top: 8px;
      display: grid;
      grid-template-columns: auto auto;
      gap: 4px 12px;
      font-size: 13px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .meta .label { color: #374151; }
    .meta .value { color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
      background: #f9fafb;
    }
    th, td {
      border: 1px solid #111827;
      padding: 3px 5px;
      vertical-align: middle;
      line-height: 1.15;
    }
    thead th {
      background: #fbbf24;
      color: #111827;
      text-align: left;
      font-size: 10px;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .main-table tbody tr:nth-child(odd) td {
      background: #f5f5dc;
    }
    .main-table tbody tr.blank td {
      color: transparent;
    }
    .main-table .center,
    .route-table .center {
      text-align: center;
    }
    .main-table tfoot td {
      background: #e5f000;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 13px;
    }
    .main-table tfoot td.label {
      text-align: left;
    }
    .subgrid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 16px;
      align-items: start;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .route-table {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .route-table th {
      background: #fbbf24;
      font-size: 10px;
    }
    .signatures {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .signature-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      align-items: end;
      gap: 10px;
      text-transform: uppercase;
      font-size: 16px;
      font-weight: 800;
      line-height: 1;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .signature-row .label {
      white-space: nowrap;
      letter-spacing: .04em;
    }
    .signature-row .line {
      border-bottom: 1px solid #111827;
      min-height: 24px;
      padding: 0 6px 2px;
      display: flex;
      align-items: flex-end;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      font-size: 14px;
    }
    .generated {
      margin-top: 10px;
      font-size: 11px;
      text-transform: uppercase;
      color: #4b5563;
      letter-spacing: .04em;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="logo-box">G</div>
      <div class="header-main">
        <h1>Supermercado Los Gigantes</h1>
        <div class="meta">
          <span class="label">Departamento:</span><span class="value">${safeDepartment}</span>
          <span class="label">Reporte del mes:</span><span class="value">${safeMonth}</span>
        </div>
      </div>
    </div>

    <table class="main-table">
      <colgroup>
        <col style="width: 28%;" />
        <col style="width: 4%;" />
        <col style="width: 12%;" />
        <col style="width: 8%;" />
        <col style="width: 12%;" />
        <col style="width: 36%;" />
      </colgroup>
      <thead>
        <tr>
          <th>NOMBRE</th>
          <th>#</th>
          <th>DESTINO</th>
          <th>KMS</th>
          <th>FECHA</th>
          <th>MOTIVO</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml || ''}
        ${blankRowHtml}
      </tbody>
      <tfoot>
        <tr>
          <td class="label">TOTAL DE VIAJES</td>
          <td class="center">${travelTotalTrips}</td>
          <td class="label">KMS</td>
          <td class="center">${formatTravelNumber(travelTotalKms)}</td>
          <td class="label">LITROS</td>
          <td class="center">${escapeHtml(litersLabel)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="subgrid">
      <table class="route-table">
        <thead>
          <tr>
            <th>#</th>
            <th>DESTINO</th>
            <th>KMS</th>
            <th>VIAJES</th>
          </tr>
        </thead>
        <tbody>
          ${routeRowsHtml}
        </tbody>
      </table>
      <div class="signatures">
        <div class="signature-row">
          <div class="label">PRESENTA</div>
          <div class="line">${safeReporter}</div>
        </div>
        <div class="signature-row">
          <div class="label">AUTORIZA</div>
          <div class="line">${safeAuthorizer}</div>
        </div>
        <div class="signature-row">
          <div class="label">FINANZAS</div>
          <div class="line">${safeFinance}</div>
        </div>
      </div>
    </div>

    <div class="generated">Generado: ${safeGeneratedAt}</div>
  </div>
</body>
</html>`;
}
