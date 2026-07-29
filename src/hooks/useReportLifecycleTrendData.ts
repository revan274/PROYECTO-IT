import { useMemo } from 'react';

import type { TicketItem } from '../types/app';
import {
  startOfLocalDayTimestamp,
  startOfLocalWeekTimestamp,
  ticketCreatedTimestamp,
} from '../utils/appHelpers';
import { parseDateToTimestamp } from '../utils/format';

export interface ReportLifecycleTrendItem {
  key: number;
  label: string;
  created: number;
  closed: number;
}

interface ReportLifecycleTrendDataOptions {
  isReportsView: boolean;
  reportStartMs: number | null;
  reportEndMs: number | null;
  reportScopedTicketsByFilters: readonly TicketItem[];
}

export function deriveReportLifecycleTrendData({
  isReportsView,
  reportStartMs,
  reportEndMs,
  reportScopedTicketsByFilters,
}: ReportLifecycleTrendDataOptions) {
  const dayMs = 24 * 60 * 60 * 1000;
  const hasValidRange = (
    reportStartMs !== null
    && reportEndMs !== null
    && reportEndMs >= reportStartMs
  );
  const spanDays = hasValidRange
    ? Math.ceil(((reportEndMs - reportStartMs) + 1) / dayMs)
    : 0;
  const reportTrendMode: 'DIARIA' | 'SEMANAL' = spanDays > 45 ? 'SEMANAL' : 'DIARIA';
  const reportLifecycleTrend: ReportLifecycleTrendItem[] = [];

  if (isReportsView && hasValidRange) {
    const locale = 'es-MX';
    const buckets = new Map<number, ReportLifecycleTrendItem>();

    if (reportTrendMode === 'SEMANAL') {
      const firstBucket = startOfLocalWeekTimestamp(reportStartMs);
      const lastBucket = startOfLocalWeekTimestamp(reportEndMs);
      for (let cursor = firstBucket; cursor <= lastBucket; cursor += 7 * dayMs) {
        const weekEnd = Math.min(cursor + (7 * dayMs) - 1, reportEndMs);
        const labelStart = new Date(cursor).toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
        });
        const labelEnd = new Date(weekEnd).toLocaleDateString(locale, {
          day: '2-digit',
          month: 'short',
        });
        buckets.set(cursor, {
          key: cursor,
          label: `${labelStart} - ${labelEnd}`,
          created: 0,
          closed: 0,
        });
      }

      reportScopedTicketsByFilters.forEach((ticket) => {
        const createdAt = ticketCreatedTimestamp(ticket);
        if (createdAt >= reportStartMs && createdAt <= reportEndMs) {
          const row = buckets.get(startOfLocalWeekTimestamp(createdAt));
          if (row) row.created += 1;
        }

        const closedAt = parseDateToTimestamp(ticket.fechaCierre || '');
        if (closedAt !== null && closedAt >= reportStartMs && closedAt <= reportEndMs) {
          const row = buckets.get(startOfLocalWeekTimestamp(closedAt));
          if (row) row.closed += 1;
        }
      });
    } else {
      const firstBucket = startOfLocalDayTimestamp(reportStartMs);
      const lastBucket = startOfLocalDayTimestamp(reportEndMs);
      for (let cursor = firstBucket; cursor <= lastBucket; cursor += dayMs) {
        buckets.set(cursor, {
          key: cursor,
          label: new Date(cursor).toLocaleDateString(locale, {
            day: '2-digit',
            month: 'short',
          }),
          created: 0,
          closed: 0,
        });
      }

      reportScopedTicketsByFilters.forEach((ticket) => {
        const createdAt = ticketCreatedTimestamp(ticket);
        if (createdAt >= reportStartMs && createdAt <= reportEndMs) {
          const row = buckets.get(startOfLocalDayTimestamp(createdAt));
          if (row) row.created += 1;
        }

        const closedAt = parseDateToTimestamp(ticket.fechaCierre || '');
        if (closedAt !== null && closedAt >= reportStartMs && closedAt <= reportEndMs) {
          const row = buckets.get(startOfLocalDayTimestamp(closedAt));
          if (row) row.closed += 1;
        }
      });
    }

    reportLifecycleTrend.push(
      ...Array.from(buckets.values()).sort((left, right) => left.key - right.key),
    );
  }

  return {
    reportTrendMode,
    reportLifecycleTrend,
    reportLifecycleTrendMax: reportLifecycleTrend.length > 0
      ? Math.max(
          1,
          ...reportLifecycleTrend.map((row) => Math.max(row.created, row.closed)),
        )
      : 1,
    reportCreatedInPeriodCount: reportLifecycleTrend
      .reduce((sum, row) => sum + row.created, 0),
    reportClosedInPeriodCount: reportLifecycleTrend
      .reduce((sum, row) => sum + row.closed, 0),
  };
}

export function useReportLifecycleTrendData(options: ReportLifecycleTrendDataOptions) {
  const {
    isReportsView,
    reportStartMs,
    reportEndMs,
    reportScopedTicketsByFilters,
  } = options;

  return useMemo(
    () => deriveReportLifecycleTrendData({
      isReportsView,
      reportStartMs,
      reportEndMs,
      reportScopedTicketsByFilters,
    }),
    [
      isReportsView,
      reportEndMs,
      reportScopedTicketsByFilters,
      reportStartMs,
    ],
  );
}
