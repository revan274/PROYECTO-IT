import { useMemo } from 'react';

import type { TicketItem } from '../types/app';
import {
  calculateMedian,
  calculatePercentile,
  collectResolutionHours,
  formatMetricTrend,
  roundHours,
} from '../utils/appHelpers';
import {
  isTicketClosed,
  isTicketSlaExpired,
} from '../utils/tickets';

interface ReportKpiDataOptions {
  reportTickets: readonly TicketItem[];
  reportPreviousTickets: readonly TicketItem[];
  hasComparisonWindow: boolean;
  liveNow: number;
}

const DEFAULT_TREND = {
  label: 'Comparativo no disponible',
  toneClass: 'text-slate-400',
};

export function deriveReportKpiData({
  reportTickets,
  reportPreviousTickets,
  hasComparisonWindow,
  liveNow,
}: ReportKpiDataOptions) {
  const reportOpenCount = reportTickets.filter((ticket) => !isTicketClosed(ticket)).length;
  const reportClosedCount = reportTickets.length - reportOpenCount;
  const reportCriticalCount = reportTickets
    .filter((ticket) => ticket.prioridad === 'CRITICA').length;
  const reportSlaExpiredCount = reportTickets
    .filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const reportSlaTotalCount = reportTickets.length;
  const reportSlaCompliantCount = Math.max(
    0,
    reportSlaTotalCount - reportSlaExpiredCount,
  );
  const reportSlaCompliancePct = reportSlaTotalCount > 0
    ? Math.round((reportSlaCompliantCount / reportSlaTotalCount) * 100)
    : 100;

  const reportPreviousOpenCount = reportPreviousTickets
    .filter((ticket) => !isTicketClosed(ticket)).length;
  const reportPreviousSlaExpiredCount = reportPreviousTickets
    .filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const reportPreviousSlaTotalCount = reportPreviousTickets.length;
  const reportPreviousSlaCompliantCount = Math.max(
    0,
    reportPreviousSlaTotalCount - reportPreviousSlaExpiredCount,
  );
  const reportPreviousSlaCompliancePct = reportPreviousSlaTotalCount > 0
    ? Math.round(
        (reportPreviousSlaCompliantCount / reportPreviousSlaTotalCount) * 100,
      )
    : 100;

  const reportResolutionHours = collectResolutionHours([...reportTickets]);
  const reportPreviousResolutionHours = collectResolutionHours([...reportPreviousTickets]);
  const reportAvgResolutionHours = reportResolutionHours.length > 0
    ? roundHours(
        reportResolutionHours.reduce((sum, value) => sum + value, 0)
        / reportResolutionHours.length,
      )
    : null;
  const reportMedianResolutionHours = calculateMedian(reportResolutionHours);
  const reportP90ResolutionHours = calculatePercentile(reportResolutionHours, 90);
  const reportPreviousAvgResolutionHours = reportPreviousResolutionHours.length > 0
    ? roundHours(
        reportPreviousResolutionHours.reduce((sum, value) => sum + value, 0)
        / reportPreviousResolutionHours.length,
      )
    : null;
  const reportPreviousMedianResolutionHours = calculateMedian(
    reportPreviousResolutionHours,
  );
  const reportPreviousP90ResolutionHours = calculatePercentile(
    reportPreviousResolutionHours,
    90,
  );

  return {
    reportOpenCount,
    reportClosedCount,
    reportCriticalCount,
    reportSlaExpiredCount,
    reportSlaTotalCount,
    reportSlaCompliantCount,
    reportSlaCompliancePct,
    reportPreviousOpenCount,
    reportPreviousSlaCompliancePct,
    reportAvgResolutionHours,
    reportMedianResolutionHours,
    reportP90ResolutionHours,
    reportPreviousAvgResolutionHours,
    reportPreviousMedianResolutionHours,
    reportPreviousP90ResolutionHours,
    reportTicketsTrend: hasComparisonWindow
      ? formatMetricTrend(reportTickets.length, reportPreviousTickets.length, {
          positiveIsGood: false,
        })
      : DEFAULT_TREND,
    reportOpenTrend: hasComparisonWindow
      ? formatMetricTrend(reportOpenCount, reportPreviousOpenCount, {
          positiveIsGood: false,
        })
      : DEFAULT_TREND,
    reportSlaComplianceTrend: hasComparisonWindow
      ? formatMetricTrend(
          reportSlaCompliancePct,
          reportPreviousSlaCompliancePct,
          {
            positiveIsGood: true,
            unitSuffix: '%',
            usePoints: true,
          },
        )
      : DEFAULT_TREND,
    reportMttrMedianTrend: hasComparisonWindow
      ? formatMetricTrend(
          reportMedianResolutionHours,
          reportPreviousMedianResolutionHours,
          {
            positiveIsGood: false,
            decimals: 1,
            unitSuffix: ' h',
          },
        )
      : DEFAULT_TREND,
    reportP90ResolutionTrend: hasComparisonWindow
      ? formatMetricTrend(
          reportP90ResolutionHours,
          reportPreviousP90ResolutionHours,
          {
            positiveIsGood: false,
            decimals: 1,
            unitSuffix: ' h',
          },
        )
      : DEFAULT_TREND,
  };
}

export function useReportKpiData(options: ReportKpiDataOptions) {
  const {
    reportTickets,
    reportPreviousTickets,
    hasComparisonWindow,
    liveNow,
  } = options;

  return useMemo(
    () => deriveReportKpiData({
      reportTickets,
      reportPreviousTickets,
      hasComparisonWindow,
      liveNow,
    }),
    [
      hasComparisonWindow,
      liveNow,
      reportPreviousTickets,
      reportTickets,
    ],
  );
}
