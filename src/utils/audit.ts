import type {
  AuditFiltersState,
  AuditModule,
  RegistroAuditoria,
} from '../types/app';
import { normalizeForCompare, normalizeLooseDateString } from './format';

export function normalizeAuditModule(value?: string): AuditModule | null {
  const raw = normalizeForCompare(value || '');
  if (raw === 'activos') return 'activos';
  if (raw === 'insumos') return 'insumos';
  if (raw === 'tickets') return 'tickets';
  if (raw === 'otros') return 'otros';
  return null;
}

export function inferAuditModule(accion: string, item = ''): AuditModule {
  const action = normalizeForCompare(accion || '');
  const subject = normalizeForCompare(item || '');
  if (
    action.includes('ticket')
    || action.includes('asignacion')
    || action.includes('sla')
    || subject.startsWith('tk-')
  ) {
    return 'tickets';
  }
  if (
    action.includes('activo')
    || action.includes('inventario')
    || action.includes('equipo')
  ) {
    return 'activos';
  }
  if (
    action.includes('insumo')
    || action.includes('stock')
    || action.includes('entrada')
    || action.includes('salida')
    || action.includes('ajuste')
    || action.includes('baja logica')
    || action.includes('registro nuevo')
  ) {
    return 'insumos';
  }
  return 'otros';
}

export function resolveAuditModule(log: Pick<RegistroAuditoria, 'accion' | 'item' | 'modulo'>): AuditModule {
  return normalizeAuditModule(log.modulo) || inferAuditModule(log.accion, log.item);
}

export function auditModuleLabel(module: AuditModule): string {
  if (module === 'activos') return 'Activos IT';
  if (module === 'insumos') return 'Insumos';
  if (module === 'tickets') return 'Tickets';
  return 'Otros';
}

export function parseAuditBoundaryDate(value?: string, endOfDay = false): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return null;
}

export function getAuditRowTimestampMs(log: Pick<RegistroAuditoria, 'timestamp' | 'fecha'>): number | null {
  const ts = String(log.timestamp || '').trim();
  if (ts) {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const raw = normalizeLooseDateString(log.fecha);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return null;
}

export function filterAuditRowsClient(rows: RegistroAuditoria[], filters: AuditFiltersState): RegistroAuditoria[] {
  const userKey = normalizeForCompare(filters.user || '');
  const entityKey = normalizeForCompare(filters.entity || '');
  const actionKey = normalizeForCompare(filters.action || '');
  const queryKey = normalizeForCompare(filters.q || '');
  const fromMs = parseAuditBoundaryDate(filters.from, false);
  const toMs = parseAuditBoundaryDate(filters.to, true);

  const filtered = rows.filter((log) => {
    if (filters.module && resolveAuditModule(log) !== filters.module) return false;
    if (filters.result && (String(log.resultado || 'ok').toLowerCase() !== filters.result)) return false;

    if (userKey) {
      const fields = [log.usuario, log.username, log.rol, log.departamento];
      if (!fields.some((value) => normalizeForCompare(String(value || '')).includes(userKey))) return false;
    }
    if (entityKey && !normalizeForCompare(String(log.entidad || '')).includes(entityKey)) return false;
    if (actionKey && !normalizeForCompare(String(log.accion || '')).includes(actionKey)) return false;
    if (queryKey) {
      const fields = [
        log.accion,
        log.item,
        log.usuario,
        log.username,
        log.rol,
        log.departamento,
        log.entidad,
        log.motivo,
        log.modulo,
        log.requestId,
        log.ip,
        String(log.id || ''),
        String(log.entidadId ?? ''),
      ];
      if (!fields.some((value) => normalizeForCompare(String(value || '')).includes(queryKey))) return false;
    }

    const ts = getAuditRowTimestampMs(log);
    if (fromMs !== null && (ts === null || ts < fromMs)) return false;
    if (toMs !== null && (ts === null || ts > toMs)) return false;
    return true;
  });

  filtered.sort((left, right) => {
    const leftTs = getAuditRowTimestampMs(left) || 0;
    const rightTs = getAuditRowTimestampMs(right) || 0;
    return rightTs - leftTs;
  });
  return filtered;
}
