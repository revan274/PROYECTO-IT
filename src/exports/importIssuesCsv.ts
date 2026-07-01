import type { ImportAssetDetail } from '../types/app';
import { downloadCsv } from './csvDownload';

/**
 * Exporta las incidencias de una importación de inventario como CSV.
 * Recibe únicamente las incidencias ya filtradas; no depende de estado de UI.
 */
export function downloadImportIssuesCsv(issues: ImportAssetDetail[]): void {
  const headers = ['Fila', 'Estado', 'TAG', 'Motivo'];
  const rows = issues.map((issue) => [
    String(issue.rowNumber || ''),
    issue.status || '',
    issue.tag || '',
    issue.reason || '',
  ]);
  downloadCsv(headers, rows, `import_issues_${new Date().toISOString().slice(0, 10)}.csv`);
}
