import type { AuditModule, RegistroAuditoria } from '../types/app';
import { auditModuleLabel } from '../utils/audit';
import { downloadCsv } from './csvDownload';

/**
 * Exporta registros de auditoría como CSV.
 * Recibe las filas ya seleccionadas/filtradas; no depende de estado de UI.
 */
export function downloadAuditCsv(rows: RegistroAuditoria[], module?: AuditModule): void {
  const headers = ['Módulo', 'Fecha', 'Usuario', 'Acción', 'Item', 'Cantidad', 'Resultado', 'Entidad', 'RequestId'];
  const csvRows = rows.map((log) => [
    auditModuleLabel(log.modulo || 'otros'),
    log.fecha,
    log.usuario,
    log.accion,
    log.item,
    String(log.cantidad),
    log.resultado || 'ok',
    log.entidad || '',
    log.requestId || '',
  ]);
  const suffix = module ? `_${module}` : '_general';
  downloadCsv(headers, csvRows, `auditoria_it${suffix}_${new Date().toISOString().slice(0, 10)}.csv`);
}
