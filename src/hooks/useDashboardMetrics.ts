import { useMemo } from 'react';
import { TICKET_STATES } from '../constants/app';
import type { DashboardRange, TicketItem } from '../types/app';
import {
  formatDashboardTrend,
  resolveDashboardRangeWindow,
  ticketCreatedTimestamp,
  ticketTimestamp,
} from '../utils/appHelpers';
import { isTicketClosed, isTicketSlaExpired } from '../utils/tickets';
import { summarizeHistoricalSla } from '../utils/sla';

interface UseDashboardMetricsOptions {
  scopedTickets: TicketItem[];
  dashboardRange: DashboardRange;
  liveNow: number;
  isDashboardView: boolean;
  formatTicketBranch: (value?: string) => string;
}

function timestampInWindow(value: string | null | undefined, startMs: number, endMs: number) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs;
}

export function deriveDashboardMetrics({
  scopedTickets,
  dashboardRange,
  liveNow,
  isDashboardView,
  formatTicketBranch,
}: UseDashboardMetricsOptions) {
  const dashboardWindow = resolveDashboardRangeWindow(dashboardRange, liveNow);
  const isTicketOpen = (ticket: TicketItem) => !isTicketClosed(ticket);
  const sourceTickets = isDashboardView ? scopedTickets : [];

  // Snapshot operativo: deliberadamente independiente del rango histórico.
  const dashboardBacklogTickets = sourceTickets.filter(isTicketOpen);
  const dashboardBacklogCriticalTickets = dashboardBacklogTickets
    .filter((ticket) => ticket.prioridad === 'CRITICA');
  const dashboardBacklogSlaExpiredTickets = dashboardBacklogTickets
    .filter((ticket) => isTicketSlaExpired(ticket, liveNow));
  const dashboardUnassignedCount = dashboardBacklogTickets
    .filter((ticket) => !(ticket.asignadoA || '').trim()).length;
  const dashboardInProcessCount = dashboardBacklogTickets
    .filter((ticket) => ticket.estado === 'En Proceso').length;

  // Métricas históricas: cada hito entra por su propia fecha, incluso si el ticket
  // se creó antes del período seleccionado.
  const dashboardTicketsCurrent = sourceTickets.filter((ticket) => {
    const timestamp = ticketCreatedTimestamp(ticket);
    return timestamp >= dashboardWindow.startMs && timestamp <= dashboardWindow.endMs;
  });
  const dashboardTicketsPrevious = sourceTickets.filter((ticket) => {
    const timestamp = ticketCreatedTimestamp(ticket);
    return timestamp >= dashboardWindow.previousStartMs && timestamp <= dashboardWindow.previousEndMs;
  });
  const dashboardResolvedCurrent = sourceTickets.filter((ticket) =>
    timestampInWindow(ticket.fechaResolucion, dashboardWindow.startMs, dashboardWindow.endMs));
  const dashboardResolvedPrevious = sourceTickets.filter((ticket) =>
    timestampInWindow(ticket.fechaResolucion, dashboardWindow.previousStartMs, dashboardWindow.previousEndMs));
  const dashboardClosedCurrent = sourceTickets.filter((ticket) =>
    timestampInWindow(ticket.fechaCierre, dashboardWindow.startMs, dashboardWindow.endMs));
  const dashboardClosedPrevious = sourceTickets.filter((ticket) =>
    timestampInWindow(ticket.fechaCierre, dashboardWindow.previousStartMs, dashboardWindow.previousEndMs));

  const dashboardRecentTickets = [...dashboardTicketsCurrent]
    .sort((left, right) => ticketTimestamp(right) - ticketTimestamp(left))
    .slice(0, 5);

  const ownerCounts = new Map<string, number>();
  dashboardBacklogTickets.forEach((ticket) => {
    const assignee = String(ticket.asignadoA || '').trim();
    if (assignee) ownerCounts.set(assignee, (ownerCounts.get(assignee) || 0) + 1);
  });
  const dashboardTopOwners = Array.from(ownerCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const dashboardStateBars = TICKET_STATES.map((state) => ({
    label: state,
    count: dashboardTicketsCurrent.filter((ticket) => ticket.estado === state).length,
  }));

  const branchCounts = new Map<string, number>();
  dashboardTicketsCurrent.forEach((ticket) => {
    const label = formatTicketBranch(ticket.sucursal);
    branchCounts.set(label, (branchCounts.get(label) || 0) + 1);
  });
  const dashboardBranchBars = Array.from(branchCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const dashboardAgingBars = [
    { label: '0-4h', minHours: 0, maxHours: 4, count: 0 },
    { label: '4-8h', minHours: 4, maxHours: 8, count: 0 },
    { label: '8-24h', minHours: 8, maxHours: 24, count: 0 },
    { label: '>24h', minHours: 24, maxHours: Number.POSITIVE_INFINITY, count: 0 },
  ];
  dashboardBacklogTickets.forEach((ticket) => {
    const ageHours = Math.max(0, (liveNow - ticketCreatedTimestamp(ticket)) / (60 * 60 * 1000));
    const target = dashboardAgingBars.find((bucket) => ageHours >= bucket.minHours && ageHours < bucket.maxHours);
    if (target) target.count += 1;
  });

  const dashboardSlaSummary = summarizeHistoricalSla(dashboardResolvedCurrent);
  const previousSlaSummary = summarizeHistoricalSla(dashboardResolvedPrevious);
  const dashboardSlaComplianceTrend = dashboardSlaSummary.percentage === null || previousSlaSummary.percentage === null
    ? { label: 'Comparativo N/D', toneClass: 'text-slate-400' }
    : formatDashboardTrend(dashboardSlaSummary.percentage, previousSlaSummary.percentage, true);

  return {
    dashboardWindow,
    dashboardBacklogTickets,
    dashboardBacklogCriticalTickets,
    dashboardUnassignedCount,
    dashboardInProcessCount,
    dashboardBacklogSlaExpiredCount: dashboardBacklogSlaExpiredTickets.length,
    dashboardRecentTickets,
    dashboardTopOwners,
    dashboardStateBars,
    dashboardBranchBars,
    dashboardAgingBars,
    dashboardCreatedCount: dashboardTicketsCurrent.length,
    dashboardResolvedCount: dashboardResolvedCurrent.length,
    dashboardClosedCount: dashboardClosedCurrent.length,
    dashboardSlaTotalCount: dashboardSlaSummary.total,
    dashboardSlaCompliantCount: dashboardSlaSummary.compliant,
    dashboardSlaCompliancePct: dashboardSlaSummary.percentage,
    dashboardCreatedTrend: formatDashboardTrend(dashboardTicketsCurrent.length, dashboardTicketsPrevious.length, false),
    dashboardResolvedTrend: formatDashboardTrend(dashboardResolvedCurrent.length, dashboardResolvedPrevious.length, true),
    dashboardClosedTrend: formatDashboardTrend(dashboardClosedCurrent.length, dashboardClosedPrevious.length, true),
    dashboardSlaComplianceTrend,
    dashboardStateMax: Math.max(1, ...dashboardStateBars.map((item) => item.count)),
    dashboardBranchMax: Math.max(1, ...dashboardBranchBars.map((item) => item.count)),
    dashboardOwnerMax: Math.max(1, ...dashboardTopOwners.map((item) => item[1])),
    dashboardAgingMax: Math.max(1, ...dashboardAgingBars.map((item) => item.count)),
  };
}

export function useDashboardMetrics(options: UseDashboardMetricsOptions) {
  const { dashboardRange, formatTicketBranch, isDashboardView, liveNow, scopedTickets } = options;
  return useMemo(
    () => deriveDashboardMetrics({
      dashboardRange,
      formatTicketBranch,
      isDashboardView,
      liveNow,
      scopedTickets,
    }),
    [dashboardRange, formatTicketBranch, isDashboardView, liveNow, scopedTickets],
  );
}
