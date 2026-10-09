import type { TicketHistoryEntry } from '../types/app';
import { parseDateToTimestamp } from './format';

const FIELD_LABELS: Record<string, string> = {
  estado: 'Estado',
  prioridad: 'Prioridad',
  fechaLimite: 'Vencimiento',
  asignadoA: 'Responsable',
  asignadoAId: 'ID responsable',
  atencionTipo: 'Atención',
  trasladoRequerido: 'Traslado',
  solucionAplicada: 'Solución',
  diagnostico: 'Diagnóstico',
  attachmentId: 'ID adjunto',
  fileName: 'Archivo',
  mimeType: 'Tipo de archivo',
  size: 'Bytes',
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/D';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entryValue]) => `${FIELD_LABELS[key] || key}: ${displayValue(entryValue)}`)
      .join(' · ');
  }
  return String(value);
}

export function historyChangeValues(entry: TicketHistoryEntry): { before: unknown; after: unknown } {
  let before = entry.before;
  let after = entry.after;
  if (before === null || before === undefined) {
    if (entry.prioridadAnterior !== undefined || entry.fechaLimiteAnterior !== undefined) {
      before = { prioridad: entry.prioridadAnterior, fechaLimite: entry.fechaLimiteAnterior };
    } else if (entry.anterior !== undefined) before = entry.anterior;
  }
  if (after === null || after === undefined) {
    if (entry.prioridadNueva !== undefined || entry.fechaLimiteNueva !== undefined) {
      after = { prioridad: entry.prioridadNueva, fechaLimite: entry.fechaLimiteNueva };
    } else if (entry.nuevo !== undefined) after = entry.nuevo;
  }
  return { before, after };
}

export function formatHistoryValue(value: unknown): string {
  return displayValue(value);
}

export function sortTicketHistory(entries: readonly TicketHistoryEntry[]): TicketHistoryEntry[] {
  return entries
    .map((entry, index) => ({ entry, index, timestamp: parseDateToTimestamp(entry.fecha) }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp === null) return left.index - right.index;
      if (left.timestamp === null) return 1;
      if (right.timestamp === null) return -1;
      return right.timestamp - left.timestamp || left.index - right.index;
    })
    .map(({ entry }) => entry);
}
