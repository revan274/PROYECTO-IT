import { useMemo } from 'react';

import type { TicketItem } from '../types/app';
import {
  calculateMedian,
  calculatePercentile,
  collectFirstResponseHours,
  collectResolutionHours,
  formatMetricTrend,
  roundHours,
} from '../utils/appHelpers';
import {
  isTicketClosed,
  isTicketSlaExpired,
} from '../utils/tickets';
import { summarizeHistoricalSla } from '../utils/sla';

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
  const reportClosedCount = reportTickets.filter((ticket) => ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado').length;
  const reportCriticalCount = reportTickets
    .filter((ticket) => ticket.prioridad === 'CRITICA').length;
  const reportSlaExpiredCount = reportTickets
    .filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const reportSlaSummary = summarizeHistoricalSla(reportTickets);
  const reportSlaTotalCount = reportSlaSummary.total;
  const reportSlaCompliantCount = reportSlaSummary.compliant;
  const reportSlaCompliancePct = reportSlaSummary.percentage;

  const reportPreviousOpenCount = reportPreviousTickets
    .filter((ticket) => !isTicketClosed(ticket)).length;
  const reportPreviousSlaSummary = summarizeHistoricalSla(reportPreviousTickets);
  const reportPreviousSlaCompliancePct = reportPreviousSlaSummary.percentage;

  const reportResolutionHours = collectResolutionHours([...reportTickets]);
  const reportPreviousResolutionHours = collectResolutionHours([...reportPreviousTickets]);
  const reportFirstResponseHours = collectFirstResponseHours([...reportTickets]);
  const reportPreviousFirstResponseHours = collectFirstResponseHours([...reportPreviousTickets]);
  const average = (values: number[]) => values.length > 0
    ? roundHours(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
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
  const reportAvgFirstResponseHours = average(reportFirstResponseHours);
  const reportMedianFirstResponseHours = calculateMedian(reportFirstResponseHours);
  const reportP90FirstResponseHours = calculatePercentile(reportFirstResponseHours, 90);
  const reportPreviousAvgFirstResponseHours = average(reportPreviousFirstResponseHours);
  const reportPreviousMedianFirstResponseHours = calculateMedian(reportPreviousFirstResponseHours);
  const reportPreviousP90FirstResponseHours = calculatePercentile(reportPreviousFirstResponseHours, 90);

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
    reportAvgFirstResponseHours,
    reportMedianFirstResponseHours,
    reportP90FirstResponseHours,
    reportPreviousAvgFirstResponseHours,
    reportPreviousMedianFirstResponseHours,
    reportPreviousP90FirstResponseHours,
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
    reportFirstResponseMedianTrend: hasComparisonWindow
      ? formatMetricTrend(reportMedianFirstResponseHours, reportPreviousMedianFirstResponseHours, {
          positiveIsGood: false,
          decimals: 1,
          unitSuffix: ' h',
        })
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
