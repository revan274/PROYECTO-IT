import { formatTicketAttentionType } from '../utils/tickets';

export interface ReportFilterInputs {
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: string;
  reportPriorityFilter: string;
  reportAttentionFilter: string;
  reportTechnicianFilter: string;
  reportTrendMode: string;
  formatTicketBranchFromCatalog: (value: string) => string;
}

export interface ReportFilterLabels {
  periodLabel: string;
  branchLabel: string;
  areaLabel: string;
  stateLabel: string;
  priorityLabel: string;
  attentionLabel: string;
  technicianLabel: string;
  trendModeLabel: string;
}

/**
 * Etiquetas legibles de los filtros de reportería.
 * Compartidas por el Reporte Ejecutivo (PDF) y la exportación Excel.
 */
export function buildReportFilterLabels(inputs: ReportFilterInputs): ReportFilterLabels {
  return {
    periodLabel: `${inputs.reportDateFrom || 'N/D'} a ${inputs.reportDateTo || 'N/D'}`,
    branchLabel: inputs.reportBranchFilter === 'TODAS'
      ? 'Todas las sucursales'
      : inputs.formatTicketBranchFromCatalog(inputs.reportBranchFilter),
    areaLabel: inputs.reportAreaFilter === 'TODAS' ? 'Todas las áreas' : inputs.reportAreaFilter,
    stateLabel: inputs.reportStateFilter === 'TODOS' ? 'Todos los estados' : inputs.reportStateFilter,
    priorityLabel: inputs.reportPriorityFilter === 'TODAS' ? 'Todas las prioridades' : inputs.reportPriorityFilter,
    attentionLabel: inputs.reportAttentionFilter === 'TODAS'
      ? 'Todas las atenciones'
      : formatTicketAttentionType(inputs.reportAttentionFilter),
    technicianLabel: inputs.reportTechnicianFilter === 'TODOS'
      ? 'Todos los tecnicos'
      : inputs.reportTechnicianFilter === 'SIN_ASIGNAR'
        ? 'Sin asignar'
        : inputs.reportTechnicianFilter,
    trendModeLabel: inputs.reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria',
  };
}
