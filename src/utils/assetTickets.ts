import type { Activo, TicketItem } from '../types/app';
import { normalizeForCompare } from './format';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function getTicketCreatedAtMs(ticket: TicketItem): number | null {
  const value = Date.parse(ticket.fechaCreacion || ticket.fecha || '');
  return Number.isFinite(value) ? value : null;
}

export function ticketBelongsToAsset(ticket: TicketItem, asset: Activo): boolean {
  const assetId = Number(ticket.activoId);
  if (Number.isSafeInteger(assetId) && assetId > 0) return assetId === Number(asset.id);
  if (ticket.activoReferenciaPendiente) return false;
  return Boolean(ticket.activoTag)
    && normalizeForCompare(ticket.activoTag) === normalizeForCompare(asset.tag);
}

export function buildAssetTicketHistory(
  asset: Activo,
  tickets: TicketItem[],
  nowMs = Date.now(),
): { tickets: TicketItem[]; incidentsLast90Days: number } {
  const relatedTickets = tickets
    .filter((ticket) => ticketBelongsToAsset(ticket, asset))
    .sort((left, right) => {
      const leftMs = getTicketCreatedAtMs(left) ?? Number.NEGATIVE_INFINITY;
      const rightMs = getTicketCreatedAtMs(right) ?? Number.NEGATIVE_INFINITY;
      return rightMs - leftMs || right.id - left.id;
    });
  const windowStart = nowMs - NINETY_DAYS_MS;
  const incidentsLast90Days = relatedTickets.filter((ticket) => {
    const createdAtMs = getTicketCreatedAtMs(ticket);
    const isIncident = !ticket.tipoSolicitud || ticket.tipoSolicitud === 'INCIDENTE_ACTIVO';
    return isIncident && createdAtMs !== null && createdAtMs >= windowStart && createdAtMs <= nowMs;
  }).length;

  return { tickets: relatedTickets, incidentsLast90Days };
}
