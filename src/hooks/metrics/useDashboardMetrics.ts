import { useMemo } from 'react';
import type { DashboardRange, TicketItem } from '../../types/app';
import { TICKET_STATES } from '../../constants/app';
import { isTicketSlaExpired } from '../../utils/tickets';
import {
  formatDashboardTrend,
  resolveDashboardRangeWindow,
  ticketCreatedTimestamp,
  ticketTimestamp,
} from '../../utils/appHelpers';

interface UseDashboardMetricsParams {
  scopedTickets: TicketItem[];
  isTicketOpen: (ticket: TicketItem) => boolean;
  dashboardRange: DashboardRange;
  liveNow: number;
  isDashboardView: boolean;
  formatTicketBranchFromCatalog: (value?: string) => string;
}

/**
 * Deriva todas las métricas, series y tendencias del dashboard.
 * Extraído de App.tsx sin cambios de comportamiento.
 */
export function useDashboardMetrics({
  scopedTickets,
  isTicketOpen,
  dashboardRange,
  liveNow,
  isDashboardView,
  formatTicketBranchFromCatalog,
}: UseDashboardMetricsParams) {
  const dashboardWindow = useMemo(
    () => resolveDashboardRangeWindow(dashboardRange, liveNow),
    [dashboardRange, liveNow],
  );
  const dashboardTicketsCurrent = useMemo(
    () =>
      !isDashboardView
        ? []
        :
        scopedTickets.filter((ticket) => {
          const ts = ticketCreatedTimestamp(ticket);
          return ts >= dashboardWindow.startMs && ts <= dashboardWindow.endMs;
        }),
    [dashboardWindow.endMs, dashboardWindow.startMs, isDashboardView, scopedTickets],
  );
  const dashboardTicketsPrevious = useMemo(
    () =>
      !isDashboardView
        ? []
        :
        scopedTickets.filter((ticket) => {
          const ts = ticketCreatedTimestamp(ticket);
          return ts >= dashboardWindow.previousStartMs && ts <= dashboardWindow.previousEndMs;
        }),
    [dashboardWindow.previousEndMs, dashboardWindow.previousStartMs, isDashboardView, scopedTickets],
  );
  const dashboardOpenTicketsCurrent = useMemo(
    () => dashboardTicketsCurrent.filter(isTicketOpen),
    [dashboardTicketsCurrent, isTicketOpen],
  );
  const dashboardOpenTicketsPrevious = useMemo(
    () => dashboardTicketsPrevious.filter(isTicketOpen),
    [dashboardTicketsPrevious, isTicketOpen],
  );
  const dashboardCriticalTicketsCurrent = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => ticket.prioridad === 'CRITICA'),
    [dashboardOpenTicketsCurrent],
  );
  const dashboardCriticalTicketsPrevious = useMemo(
    () => dashboardOpenTicketsPrevious.filter((ticket) => ticket.prioridad === 'CRITICA'),
    [dashboardOpenTicketsPrevious],
  );
  const dashboardSlaExpiredCurrent = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => isTicketSlaExpired(ticket, liveNow)),
    [dashboardOpenTicketsCurrent, liveNow],
  );
  const dashboardSlaExpiredPrevious = useMemo(
    () => dashboardOpenTicketsPrevious.filter((ticket) => isTicketSlaExpired(ticket, liveNow)),
    [dashboardOpenTicketsPrevious, liveNow],
  );
  const dashboardUnassignedCount = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => !(ticket.asignadoA || '').trim()).length,
    [dashboardOpenTicketsCurrent],
  );
  const dashboardInProcessCount = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => ticket.estado === 'En Proceso').length,
    [dashboardOpenTicketsCurrent],
  );
  const dashboardRecentTickets = useMemo(
    () => [...dashboardTicketsCurrent].sort((a, b) => ticketTimestamp(b) - ticketTimestamp(a)).slice(0, 5),
    [dashboardTicketsCurrent],
  );
  const dashboardTopOwners = useMemo(() => {
    const counts = new Map<string, number>();
    dashboardOpenTicketsCurrent.forEach((ticket) => {
      const assignee = String(ticket.asignadoA || '').trim();
      if (!assignee) return;
      counts.set(assignee, (counts.get(assignee) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [dashboardOpenTicketsCurrent]);
  const dashboardStateBars = useMemo(
    () => TICKET_STATES.map((state) => ({
      label: state,
      count: dashboardTicketsCurrent.filter((ticket) => ticket.estado === state).length,
    })),
    [dashboardTicketsCurrent],
  );
  const dashboardBranchBars = useMemo(() => {
    const counts = new Map<string, number>();
    dashboardTicketsCurrent.forEach((ticket) => {
      const label = formatTicketBranchFromCatalog(ticket.sucursal);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [dashboardTicketsCurrent, formatTicketBranchFromCatalog]);
  const dashboardAgingBars = useMemo(() => {
    const buckets = [
      { label: '0-4h', minHours: 0, maxHours: 4, count: 0 },
      { label: '4-8h', minHours: 4, maxHours: 8, count: 0 },
      { label: '8-24h', minHours: 8, maxHours: 24, count: 0 },
      { label: '>24h', minHours: 24, maxHours: Number.POSITIVE_INFINITY, count: 0 },
    ];
    const nowMs = liveNow;
    dashboardOpenTicketsCurrent.forEach((ticket) => {
      const ageHours = Math.max(0, (nowMs - ticketCreatedTimestamp(ticket)) / (60 * 60 * 1000));
      const target = buckets.find((bucket) => ageHours >= bucket.minHours && ageHours < bucket.maxHours);
      if (target) target.count += 1;
    });
    return buckets;
  }, [dashboardOpenTicketsCurrent, liveNow]);
  const dashboardSlaTotalCount = dashboardTicketsCurrent.length;
  const dashboardSlaExpiredCount = dashboardSlaExpiredCurrent.length;
  const { dashboardSlaCompliantCount, dashboardSlaCompliancePct } = useMemo(() => {
    const compliant = Math.max(0, dashboardSlaTotalCount - dashboardSlaExpiredCount);
    const pct = dashboardSlaTotalCount > 0
      ? Math.round((compliant / dashboardSlaTotalCount) * 100)
      : 100;
    return { dashboardSlaCompliantCount: compliant, dashboardSlaCompliancePct: pct };
  }, [dashboardSlaTotalCount, dashboardSlaExpiredCount]);
  const dashboardOpenTrend = useMemo(
    () => formatDashboardTrend(dashboardOpenTicketsCurrent.length, dashboardOpenTicketsPrevious.length, false),
    [dashboardOpenTicketsCurrent.length, dashboardOpenTicketsPrevious.length],
  );
  const dashboardCriticalTrend = useMemo(
    () => formatDashboardTrend(dashboardCriticalTicketsCurrent.length, dashboardCriticalTicketsPrevious.length, false),
    [dashboardCriticalTicketsCurrent.length, dashboardCriticalTicketsPrevious.length],
  );
  const dashboardSlaTrend = useMemo(
    () => formatDashboardTrend(dashboardSlaExpiredCurrent.length, dashboardSlaExpiredPrevious.length, false),
    [dashboardSlaExpiredCurrent.length, dashboardSlaExpiredPrevious.length],
  );
  const dashboardStateMax = useMemo(
    () => Math.max(1, ...dashboardStateBars.map((item) => item.count)),
    [dashboardStateBars],
  );
  const dashboardBranchMax = useMemo(
    () => Math.max(1, ...dashboardBranchBars.map((item) => item.count)),
    [dashboardBranchBars],
  );
  const dashboardOwnerMax = useMemo(
    () => Math.max(1, ...dashboardTopOwners.map((item) => item[1])),
    [dashboardTopOwners],
  );
  const dashboardAgingMax = useMemo(
    () => Math.max(1, ...dashboardAgingBars.map((item) => item.count)),
    [dashboardAgingBars],
  );

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
    dashboardOpenTrend,
    dashboardCriticalTrend,
    dashboardSlaTrend,
    dashboardStateMax,
    dashboardBranchMax,
    dashboardOwnerMax,
    dashboardAgingMax,
  };
}
