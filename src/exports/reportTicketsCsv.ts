import type { TicketItem } from '../types/app';
import { getTicketAreaLabel } from '../utils/appHelpers';
import { formatTicketAttentionType } from '../utils/tickets';
import { formatTicketSlaResult } from '../utils/sla';
import { downloadCsv } from './csvDownload';

export const REPORT_TICKET_EXPORT_HEADERS = [
  'ID',
  'Fecha creación',
  'Primera atención',
  'Fecha resolución',
  'Fecha cierre',
  'Sucursal',
  'Área',
  'Categoría',
  'Tag',
  'Prioridad',
  'Estado',
  'Atención',
  'SLA',
  'Asignado',
  'Solicitante',
  'Departamento',
  'Descripción',
] as const;

export type ReportTicketExportRow = Record<(typeof REPORT_TICKET_EXPORT_HEADERS)[number], string | number>;

interface ReportTicketExportData {
  reportTickets: readonly TicketItem[];
  nowMs: number;
  formatTicketBranchFromCatalog: (value?: string) => string;
}

export function buildReportTicketExportRows(data: ReportTicketExportData): ReportTicketExportRow[] {
  return data.reportTickets.map((ticket) => ({
    ID: ticket.id,
    'Fecha creación': ticket.fechaCreacion || ticket.fecha || '',
    'Primera atención': ticket.fechaPrimeraAtencion || '',
    'Fecha resolución': ticket.fechaResolucion || '',
    'Fecha cierre': ticket.fechaCierre || '',
    Sucursal: data.formatTicketBranchFromCatalog(ticket.sucursal),
    Área: getTicketAreaLabel(ticket),
    Categoría: ticket.categoriaNombre || ticket.categoriaId || 'N/D',
    Tag: ticket.activoTag || 'SIN ACTIVO',
    Prioridad: ticket.prioridad,
    Estado: ticket.estado,
    Atención: formatTicketAttentionType(ticket.atencionTipo),
    SLA: formatTicketSlaResult(ticket, data.nowMs),
    Asignado: ticket.asignadoA || 'Sin asignar',
    Solicitante: ticket.solicitadoPor || '',
    Departamento: ticket.departamento || '',
    Descripción: ticket.descripcion,
  }));
}

export function downloadReportTicketsCsv(
  data: ReportTicketExportData & { reportDateFrom: string; reportDateTo: string },
): void {
  const rows = buildReportTicketExportRows(data);
  const csvRows = rows.map((row) => REPORT_TICKET_EXPORT_HEADERS.map((header) => String(row[header] ?? '')));
  const suffix = `${data.reportDateFrom || 'inicio'}_${data.reportDateTo || 'fin'}`.replace(/[^0-9A-Za-z_-]/g, '-');
  downloadCsv([...REPORT_TICKET_EXPORT_HEADERS], csvRows, `tickets_reporteria_${suffix}.csv`);
}
