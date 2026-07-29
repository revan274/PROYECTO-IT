import { useMemo } from 'react';

import type {
  ReportAttentionFilter,
  ReportPriorityFilter,
  ReportStateFilter,
  TicketItem,
} from '../types/app';
import {
  getTicketAreaLabel,
  matchesReportArea,
  matchesReportAttention,
  matchesReportBranch,
  matchesReportPriority,
  matchesReportState,
  matchesReportTechnician,
  startOfLocalDayTimestamp,
  ticketCreatedTimestamp,
  ticketTimestamp,
} from '../utils/appHelpers';
import { parseDateToTimestamp } from '../utils/format';

interface ReportTicketDataOptions {
  isReportsView: boolean;
  scopedTickets: readonly TicketItem[];
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: ReportStateFilter;
  reportPriorityFilter: ReportPriorityFilter;
  reportAttentionFilter: ReportAttentionFilter;
  reportTechnicianFilter: string;
}

export function deriveReportTicketData({
  isReportsView,
  scopedTickets,
  reportDateFrom,
  reportDateTo,
  reportBranchFilter,
  reportAreaFilter,
  reportStateFilter,
  reportPriorityFilter,
  reportAttentionFilter,
  reportTechnicianFilter,
}: ReportTicketDataOptions) {
  const parsedStart = parseDateToTimestamp(reportDateFrom);
  const parsedEnd = parseDateToTimestamp(reportDateTo);
  const reportStartMs = parsedStart === null
    ? null
    : startOfLocalDayTimestamp(parsedStart);
  const reportEndMs = parsedEnd === null
    ? null
    : startOfLocalDayTimestamp(parsedEnd) + (24 * 60 * 60 * 1000) - 1;

  const reportComparisonWindow = (
    reportStartMs === null
    || reportEndMs === null
    || reportEndMs < reportStartMs
  )
    ? null
    : {
        previousStartMs: reportStartMs - ((reportEndMs - reportStartMs) + 1),
        previousEndMs: reportStartMs - 1,
      };

  const reportPreviousPeriodLabel = reportComparisonWindow
    ? `${new Date(reportComparisonWindow.previousStartMs).toLocaleDateString()} a ${new Date(reportComparisonWindow.previousEndMs).toLocaleDateString()}`
    : 'N/D';

  const reportBaseTicketsByDate = isReportsView
    ? scopedTickets.filter((ticket) => {
        const createdAt = ticketCreatedTimestamp(ticket);
        if (reportStartMs !== null && createdAt < reportStartMs) return false;
        if (reportEndMs !== null && createdAt > reportEndMs) return false;
        return true;
      })
    : [];

  const reportBranchOptions = Array.from(
    new Set(
      reportBaseTicketsByDate
        .map((ticket) => String(ticket.sucursal || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const reportAreaOptions = Array.from(
    new Set(
      reportBaseTicketsByDate
        .map((ticket) => getTicketAreaLabel(ticket))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const matchesReportCoreFilters = (ticket: TicketItem): boolean =>
    matchesReportBranch(ticket, reportBranchFilter)
    && matchesReportArea(ticket, reportAreaFilter)
    && matchesReportState(ticket, reportStateFilter)
    && matchesReportPriority(ticket, reportPriorityFilter)
    && matchesReportAttention(ticket, reportAttentionFilter);

  const reportTechnicianOptions = Array.from(
    new Set(
      reportBaseTicketsByDate
        .filter((ticket) => matchesReportCoreFilters(ticket))
        .map((ticket) => String(ticket.asignadoA || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const reportScopedTicketsByFilters = isReportsView
    ? scopedTickets
        .filter((ticket) => matchesReportCoreFilters(ticket))
        .filter((ticket) => matchesReportTechnician(ticket, reportTechnicianFilter))
    : [];

  const reportTickets = reportScopedTicketsByFilters
    .filter((ticket) => {
      const createdAt = ticketCreatedTimestamp(ticket);
      if (reportStartMs !== null && createdAt < reportStartMs) return false;
      if (reportEndMs !== null && createdAt > reportEndMs) return false;
      return true;
    })
    .sort((left, right) => ticketTimestamp(right) - ticketTimestamp(left));

  const reportPreviousTickets = reportComparisonWindow
    ? reportScopedTicketsByFilters
        .filter((ticket) => {
          const createdAt = ticketCreatedTimestamp(ticket);
          return (
            createdAt >= reportComparisonWindow.previousStartMs
            && createdAt <= reportComparisonWindow.previousEndMs
          );
        })
        .sort((left, right) => ticketTimestamp(right) - ticketTimestamp(left))
    : [];

  return {
    reportStartMs,
    reportEndMs,
    reportComparisonWindow,
    reportPreviousPeriodLabel,
    reportBranchOptions,
    reportAreaOptions,
    matchesReportCoreFilters,
    reportTechnicianOptions,
    reportScopedTicketsByFilters,
    reportTickets,
    reportPreviousTickets,
  };
}

export function useReportTicketData(options: ReportTicketDataOptions) {
  const {
    isReportsView,
    scopedTickets,
    reportDateFrom,
    reportDateTo,
    reportBranchFilter,
    reportAreaFilter,
    reportStateFilter,
    reportPriorityFilter,
    reportAttentionFilter,
    reportTechnicianFilter,
  } = options;

  return useMemo(
    () => deriveReportTicketData({
      isReportsView,
      scopedTickets,
      reportDateFrom,
      reportDateTo,
      reportBranchFilter,
      reportAreaFilter,
      reportStateFilter,
      reportPriorityFilter,
      reportAttentionFilter,
      reportTechnicianFilter,
    }),
    [
      isReportsView,
      reportAreaFilter,
      reportAttentionFilter,
      reportBranchFilter,
      reportDateFrom,
      reportDateTo,
      reportPriorityFilter,
      reportStateFilter,
      reportTechnicianFilter,
      scopedTickets,
    ],
  );
}
