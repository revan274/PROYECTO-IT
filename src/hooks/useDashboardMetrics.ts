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

interface UseDashboardMetricsOptions {
  scopedTickets: TicketItem[];
  dashboardRange: DashboardRange;
  liveNow: number;
  isDashboardView: boolean;
  formatTicketBranch: (value?: string) => string;
}

export function useDashboardMetrics({
  scopedTickets,
  dashboardRange,
  liveNow,
  isDashboardView,
  formatTicketBranch,
}: UseDashboardMetricsOptions) {
  return useMemo(() => {
    const dashboardWindow = resolveDashboardRangeWindow(dashboardRange, liveNow);
    const isTicketOpen = (ticket: TicketItem) => !isTicketClosed(ticket);
    const dashboardTicketsCurrent = isDashboardView
      ? scopedTickets.filter((ticket) => {
        const timestamp = ticketCreatedTimestamp(ticket);
        return timestamp >= dashboardWindow.startMs && timestamp <= dashboardWindow.endMs;
      })
      : [];
    const dashboardTicketsPrevious = isDashboardView
      ? scopedTickets.filter((ticket) => {
        const timestamp = ticketCreatedTimestamp(ticket);
        return timestamp >= dashboardWindow.previousStartMs
          && timestamp <= dashboardWindow.previousEndMs;
      })
      : [];
    const dashboardOpenTicketsCurrent = dashboardTicketsCurrent.filter(isTicketOpen);
    const dashboardOpenTicketsPrevious = dashboardTicketsPrevious.filter(isTicketOpen);
    const dashboardCriticalTicketsCurrent = dashboardOpenTicketsCurrent
      .filter((ticket) => ticket.prioridad === 'CRITICA');
    const dashboardCriticalTicketsPrevious = dashboardOpenTicketsPrevious
      .filter((ticket) => ticket.prioridad === 'CRITICA');
    const dashboardSlaExpiredCurrent = dashboardOpenTicketsCurrent
      .filter((ticket) => isTicketSlaExpired(ticket, liveNow));
    const dashboardSlaExpiredPrevious = dashboardOpenTicketsPrevious
      .filter((ticket) => isTicketSlaExpired(ticket, liveNow));
    const dashboardUnassignedCount = dashboardOpenTicketsCurrent
      .filter((ticket) => !(ticket.asignadoA || '').trim()).length;
    const dashboardInProcessCount = dashboardOpenTicketsCurrent
      .filter((ticket) => ticket.estado === 'En Proceso').length;
    const dashboardRecentTickets = [...dashboardTicketsCurrent]
      .sort((left, right) => ticketTimestamp(right) - ticketTimestamp(left))
      .slice(0, 5);

    const ownerCounts = new Map<string, number>();
    dashboardOpenTicketsCurrent.forEach((ticket) => {
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
    dashboardOpenTicketsCurrent.forEach((ticket) => {
      const ageHours = Math.max(
        0,
        (liveNow - ticketCreatedTimestamp(ticket)) / (60 * 60 * 1000),
      );
      const target = dashboardAgingBars
        .find((bucket) => ageHours >= bucket.minHours && ageHours < bucket.maxHours);
      if (target) target.count += 1;
    });

    const dashboardSlaTotalCount = dashboardTicketsCurrent.length;
    const dashboardSlaExpiredCount = dashboardSlaExpiredCurrent.length;
    const dashboardSlaCompliantCount = Math.max(
      0,
      dashboardSlaTotalCount - dashboardSlaExpiredCount,
    );
    const dashboardSlaCompliancePct = dashboardSlaTotalCount > 0
      ? Math.round((dashboardSlaCompliantCount / dashboardSlaTotalCount) * 100)
      : 100;

    return {
      dashboardWindow,
      dashboardOpenTicketsCurrent,
      dashboardCriticalTicketsCurrent,
      dashboardUnassignedCount,
      dashboardInProcessCount,
      dashboardRecentTickets,
      dashboardTopOwners,
      dashboardStateBars,
      dashboardBranchBars,
      dashboardAgingBars,
      dashboardSlaTotalCount,
      dashboardSlaExpiredCount,
      dashboardSlaCompliantCount,
      dashboardSlaCompliancePct,
      dashboardOpenTrend: formatDashboardTrend(
        dashboardOpenTicketsCurrent.length,
        dashboardOpenTicketsPrevious.length,
        false,
      ),
      dashboardCriticalTrend: formatDashboardTrend(
        dashboardCriticalTicketsCurrent.length,
        dashboardCriticalTicketsPrevious.length,
        false,
      ),
      dashboardSlaTrend: formatDashboardTrend(
        dashboardSlaExpiredCurrent.length,
        dashboardSlaExpiredPrevious.length,
        false,
      ),
      dashboardStateMax: Math.max(1, ...dashboardStateBars.map((item) => item.count)),
      dashboardBranchMax: Math.max(1, ...dashboardBranchBars.map((item) => item.count)),
      dashboardOwnerMax: Math.max(1, ...dashboardTopOwners.map((item) => item[1])),
      dashboardAgingMax: Math.max(1, ...dashboardAgingBars.map((item) => item.count)),
    };
  }, [
    dashboardRange,
    formatTicketBranch,
    isDashboardView,
    liveNow,
    scopedTickets,
  ]);
}
