import { useCallback, useMemo } from 'react';
import type {
  Activo,
  AuditModule,
  CatalogBranch,
  Insumo,
  RegistroAuditoria,
  ReportAttentionFilter,
  ReportPriorityFilter,
  ReportStateFilter,
  TicketItem,
  TravelDestinationRule,
  TravelReportRow,
  UserItem,
  UserSession,
  ViewType,
} from '../../types/app';
import {
  TICKET_STATES,
  TRAVEL_DEFAULT_FUEL_EFFICIENCY,
  TRAVEL_DESTINATION_PRESETS,
} from '../../constants/app';
import { normalizeForCompare, parseDateToTimestamp } from '../../utils/format';
import { auditModuleLabel, getAuditRowTimestampMs } from '../../utils/audit';
import { formatTicketAttentionType, isTicketSlaExpired } from '../../utils/tickets';
import {
  buildTravelReportRowsFromActualTrips,
  calculateMedian,
  calculatePercentile,
  collectResolutionHours,
  compactBranchLabel,
  extractTicketIssueDescription,
  formatMetricTrend,
  formatMonthInputLabel,
  formatTravelDate,
  getSupplyHealthStatus,
  getTicketAreaLabel,
  matchesReportArea,
  matchesReportAttention,
  matchesReportBranch,
  matchesReportPriority,
  matchesReportState,
  matchesReportTechnician,
  normalizeIncidentCause,
  parseMonthInputRange,
  parseNonNegativeNumber,
  parseTicketTravelCreatedAt,
  resolveTicketTravelDestinationCode,
  resolveTravelTechnicianScope,
  roundHours,
  roundToTwoDecimals,
  startOfLocalDayTimestamp,
  startOfLocalWeekTimestamp,
  ticketCreatedTimestamp,
  ticketTimestamp,
} from '../../utils/appHelpers';

interface UseReportMetricsParams {
  scopedTickets: TicketItem[];
  isReportsView: boolean;
  view: ViewType;
  isTicketOpen: (ticket: TicketItem) => boolean;
  liveNow: number;
  reportDateFrom: string;
  reportDateTo: string;
  reportBranchFilter: string;
  reportAreaFilter: string;
  reportStateFilter: ReportStateFilter;
  reportPriorityFilter: ReportPriorityFilter;
  reportAttentionFilter: ReportAttentionFilter;
  reportTechnicianFilter: string;
  travelReportMonth: string;
  travelReportTechnician: string;
  travelReportName: string;
  travelReportFuelEfficiency: string;
  users: UserItem[];
  sessionUser: UserSession | null;
  activeTicketBranches: CatalogBranch[];
  activeTicketBranchCodes: Set<string>;
  normalizedAuditRows: RegistroAuditoria[];
  reportAuditRowsRemote: RegistroAuditoria[] | null;
  activos: Activo[];
  insumos: Insumo[];
  formatTicketBranchFromCatalog: (value?: string) => string;
}

/**
 * Deriva todas las métricas, series, tendencias y datos de viáticos de la vista
 * de Reportería. Extraído de App.tsx sin cambios de comportamiento.
 */
export function useReportMetrics({
  scopedTickets,
  isReportsView,
  view,
  isTicketOpen,
  liveNow,
  reportDateFrom,
  reportDateTo,
  reportBranchFilter,
  reportAreaFilter,
  reportStateFilter,
  reportPriorityFilter,
  reportAttentionFilter,
  reportTechnicianFilter,
  travelReportMonth,
  travelReportTechnician,
  travelReportName,
  travelReportFuelEfficiency,
  users,
  sessionUser,
  activeTicketBranches,
  activeTicketBranchCodes,
  normalizedAuditRows,
  reportAuditRowsRemote,
  activos,
  insumos,
  formatTicketBranchFromCatalog,
}: UseReportMetricsParams) {
  const reportStartMs = useMemo(() => {
    const parsed = parseDateToTimestamp(reportDateFrom);
    if (parsed === null) return null;
    return startOfLocalDayTimestamp(parsed);
  }, [reportDateFrom]);
  const reportEndMs = useMemo(() => {
    const parsed = parseDateToTimestamp(reportDateTo);
    if (parsed === null) return null;
    return startOfLocalDayTimestamp(parsed) + (24 * 60 * 60 * 1000) - 1;
  }, [reportDateTo]);
  const reportComparisonWindow = useMemo(() => {
    if (reportStartMs === null || reportEndMs === null || reportEndMs < reportStartMs) return null;
    const spanMs = (reportEndMs - reportStartMs) + 1;
    return {
      previousStartMs: reportStartMs - spanMs,
      previousEndMs: reportStartMs - 1,
    };
  }, [reportEndMs, reportStartMs]);
  const reportPreviousPeriodLabel = useMemo(() => {
    if (!reportComparisonWindow) return 'N/D';
    const startLabel = new Date(reportComparisonWindow.previousStartMs).toLocaleDateString();
    const endLabel = new Date(reportComparisonWindow.previousEndMs).toLocaleDateString();
    return `${startLabel} a ${endLabel}`;
  }, [reportComparisonWindow]);
  const reportBaseTicketsByDate = useMemo(
    () =>
      !isReportsView
        ? []
        :
        scopedTickets.filter((ticket) => {
          const createdAt = ticketCreatedTimestamp(ticket);
          if (reportStartMs !== null && createdAt < reportStartMs) return false;
          if (reportEndMs !== null && createdAt > reportEndMs) return false;
          return true;
        }),
    [isReportsView, reportEndMs, reportStartMs, scopedTickets],
  );
  const reportBranchOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reportBaseTicketsByDate
            .map((ticket) => String(ticket.sucursal || '').trim().toUpperCase())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reportBaseTicketsByDate],
  );
  const reportAreaOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reportBaseTicketsByDate
            .map((ticket) => getTicketAreaLabel(ticket))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [reportBaseTicketsByDate],
  );
  const matchesReportCoreFilters = useCallback(
    (ticket: TicketItem) =>
      matchesReportBranch(ticket, reportBranchFilter)
      && matchesReportArea(ticket, reportAreaFilter)
      && matchesReportState(ticket, reportStateFilter)
      && matchesReportPriority(ticket, reportPriorityFilter)
      && matchesReportAttention(ticket, reportAttentionFilter),
    [reportAreaFilter, reportAttentionFilter, reportBranchFilter, reportPriorityFilter, reportStateFilter],
  );
  const reportTechnicianOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reportBaseTicketsByDate
            .filter((ticket) => matchesReportCoreFilters(ticket))
            .map((ticket) => String(ticket.asignadoA || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [matchesReportCoreFilters, reportBaseTicketsByDate],
  );
  const travelSourceTickets = useMemo(
    () =>
      !isReportsView
        ? []
        :
        scopedTickets
          .filter((ticket) => matchesReportCoreFilters(ticket)),
    [isReportsView, matchesReportCoreFilters, scopedTickets],
  );
  const travelTechnicianOptions = useMemo(
    () =>
      Array.from(
        new Set(
          travelSourceTickets
            .map((ticket) => String(ticket.asignadoA || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [travelSourceTickets],
  );
  const travelDestinationRules = useMemo(() => {
    const rows: TravelDestinationRule[] = [];
    const usedCodes = new Set<string>();
    const branchByCode = new Map<string, CatalogBranch>();
    activeTicketBranches.forEach((branch) => {
      const code = String(branch.code || '').trim().toUpperCase();
      if (!code) return;
      branchByCode.set(code, branch);
    });

    TRAVEL_DESTINATION_PRESETS.forEach((preset) => {
      const code = String(preset.code || '').trim().toUpperCase();
      if (!code || usedCodes.has(code)) return;
      const branch = branchByCode.get(code);
      const label = preset.label || compactBranchLabel(branch?.name) || code;
      rows.push({
        code,
        index: preset.index,
        label,
        kms: preset.defaultKms,
      });
      usedCodes.add(code);
    });

    let nextIndex = rows.length > 0 ? Math.max(...rows.map((row) => row.index)) + 1 : 1;
    activeTicketBranches
      .map((branch) => String(branch.code || '').trim().toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .forEach((code) => {
        if (usedCodes.has(code)) return;
        const branch = branchByCode.get(code);
        rows.push({
          code,
          index: nextIndex,
          label: compactBranchLabel(branch?.name) || code,
          kms: 0,
        });
        usedCodes.add(code);
        nextIndex += 1;
      });

    return rows.sort((a, b) => a.index - b.index);
  }, [activeTicketBranches]);
  const travelDestinationRuleByCode = useMemo(
    () => new Map(travelDestinationRules.map((row) => [row.code, row])),
    [travelDestinationRules],
  );
  const travelMonthRange = useMemo(
    () => parseMonthInputRange(travelReportMonth),
    [travelReportMonth],
  );
  const currentTravelScope = useMemo(
    () => resolveTravelTechnicianScope(travelReportTechnician, users),
    [travelReportTechnician, users],
  );
  const effectiveTravelReporterName = useMemo(() => {
    const manual = String(travelReportName || '').trim();
    if (manual) return manual;
    if (travelReportTechnician !== 'TODOS' && travelReportTechnician !== 'SIN_ASIGNAR') {
      const selected = String(currentTravelScope.label || travelReportTechnician || '').trim();
      if (selected) return selected;
    }
    const sessionName = String(sessionUser?.nombre || '').trim();
    return sessionName || 'SIN NOMBRE';
  }, [currentTravelScope.label, sessionUser?.nombre, travelReportName, travelReportTechnician]);
  const travelTicketRows = useMemo(() => {
    if (!isReportsView || !travelMonthRange) return [] as TravelReportRow[];
    const rows: TravelReportRow[] = [];
    const normalizedTechnician = normalizeForCompare(travelReportTechnician);
    travelSourceTickets.forEach((ticket) => {
      const createdAt = parseTicketTravelCreatedAt(ticket);
      if (createdAt === null) return;
      if (createdAt < travelMonthRange.startMs || createdAt > travelMonthRange.endMs) return;

      const assigned = String(ticket.asignadoA || '').trim();
      if (travelReportTechnician === 'SIN_ASIGNAR' && assigned) return;
      if (travelReportTechnician !== 'TODOS' && travelReportTechnician !== 'SIN_ASIGNAR') {
        if (normalizeForCompare(assigned) !== normalizedTechnician) return;
      }

      if (!ticket.trasladoRequerido) return;

      const destinationCode = resolveTicketTravelDestinationCode(ticket, activeTicketBranchCodes);
      if (!destinationCode) return;

      const destinationRule = travelDestinationRuleByCode.get(destinationCode);
      rows.push({
        ticketId: ticket.id,
        createdAt,
        nombre: effectiveTravelReporterName,
        destinationCode,
        destinationLabel: destinationRule?.label || destinationCode,
        routeIndex: destinationRule?.index || 0,
        kms: destinationRule?.kms || 0,
        fecha: formatTravelDate(ticket.fechaCreacion || ticket.fecha),
        motivo: extractTicketIssueDescription(ticket),
      });
    });
    rows.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.ticketId - b.ticketId;
    });
    return rows;
  }, [
    activeTicketBranchCodes,
    effectiveTravelReporterName,
    isReportsView,
    travelDestinationRuleByCode,
    travelMonthRange,
    travelReportTechnician,
    travelSourceTickets,
  ]);
  const travelSuggestedTripsByCode = useMemo(() => {
    const counts = new Map<string, number>();
    travelTicketRows.forEach((row) => {
      counts.set(row.destinationCode, (counts.get(row.destinationCode) || 0) + 1);
    });
    return counts;
  }, [travelTicketRows]);
  const travelReportRows = useMemo(
    () => buildTravelReportRowsFromActualTrips(
      travelTicketRows,
      travelSuggestedTripsByCode,
      travelDestinationRuleByCode,
      effectiveTravelReporterName,
      travelMonthRange,
    ),
    [
      effectiveTravelReporterName,
      travelDestinationRuleByCode,
      travelMonthRange,
      travelTicketRows,
      travelSuggestedTripsByCode,
    ],
  );
  const travelTotalTrips = useMemo(
    () => Array.from(travelSuggestedTripsByCode.values()).reduce((sum, trips) => sum + trips, 0),
    [travelSuggestedTripsByCode],
  );
  const travelTotalKms = useMemo(
    () => Array.from(travelSuggestedTripsByCode.entries()).reduce((sum, [destinationCode, trips]) => {
      const destinationRule = travelDestinationRuleByCode.get(destinationCode);
      return sum + ((destinationRule?.kms || 0) * trips);
    }, 0),
    [travelDestinationRuleByCode, travelSuggestedTripsByCode],
  );
  const travelFuelEfficiencyValue = useMemo(
    () => parseNonNegativeNumber(travelReportFuelEfficiency, TRAVEL_DEFAULT_FUEL_EFFICIENCY),
  [travelReportFuelEfficiency],
  );
  const travelFuelLiters = travelFuelEfficiencyValue > 0
    ? roundToTwoDecimals(travelTotalKms / travelFuelEfficiencyValue)
    : 0;
  const travelMonthLabel = useMemo(
    () => formatMonthInputLabel(travelReportMonth),
    [travelReportMonth],
  );
  const reportScopedTicketsByFilters = useMemo(
    () =>
      !isReportsView
        ? []
        :
        scopedTickets
          .filter((ticket) => matchesReportCoreFilters(ticket))
          .filter((ticket) => matchesReportTechnician(ticket, reportTechnicianFilter)),
    [isReportsView, matchesReportCoreFilters, reportTechnicianFilter, scopedTickets],
  );
  const reportTickets = useMemo(
    () =>
      !isReportsView
        ? []
        :
        reportScopedTicketsByFilters
          .filter((ticket) => {
            const createdAt = ticketCreatedTimestamp(ticket);
            if (reportStartMs !== null && createdAt < reportStartMs) return false;
            if (reportEndMs !== null && createdAt > reportEndMs) return false;
            return true;
          })
          .sort((a, b) => ticketTimestamp(b) - ticketTimestamp(a)),
    [isReportsView, reportEndMs, reportScopedTicketsByFilters, reportStartMs],
  );
  const reportPreviousTickets = useMemo(() => {
    if (!isReportsView || !reportComparisonWindow) return [] as TicketItem[];
    return reportScopedTicketsByFilters
      .filter((ticket) => {
        const createdAt = ticketCreatedTimestamp(ticket);
        return createdAt >= reportComparisonWindow.previousStartMs && createdAt <= reportComparisonWindow.previousEndMs;
      })
      .sort((a, b) => ticketTimestamp(b) - ticketTimestamp(a));
  }, [isReportsView, reportComparisonWindow, reportScopedTicketsByFilters]);
  const reportTrendMode = useMemo<'DIARIA' | 'SEMANAL'>(() => {
    if (reportStartMs === null || reportEndMs === null || reportEndMs < reportStartMs) return 'DIARIA';
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.ceil(((reportEndMs - reportStartMs) + 1) / dayMs);
    return spanDays > 45 ? 'SEMANAL' : 'DIARIA';
  }, [reportEndMs, reportStartMs]);
  const reportLifecycleTrend = useMemo(() => {
    if (!isReportsView) {
      return [] as Array<{ key: number; label: string; created: number; closed: number }>;
    }
    if (reportStartMs === null || reportEndMs === null || reportEndMs < reportStartMs) {
      return [] as Array<{ key: number; label: string; created: number; closed: number }>;
    }

    const locale = 'es-MX';
    const dayMs = 24 * 60 * 60 * 1000;
    const buckets = new Map<number, { key: number; label: string; created: number; closed: number }>();

    if (reportTrendMode === 'SEMANAL') {
      const firstBucket = startOfLocalWeekTimestamp(reportStartMs);
      const lastBucket = startOfLocalWeekTimestamp(reportEndMs);
      for (let cursor = firstBucket; cursor <= lastBucket; cursor += 7 * dayMs) {
        const weekEnd = Math.min(cursor + (7 * dayMs) - 1, reportEndMs);
        const labelStart = new Date(cursor).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
        const labelEnd = new Date(weekEnd).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
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
          const bucketKey = startOfLocalWeekTimestamp(createdAt);
          const row = buckets.get(bucketKey);
          if (row) row.created += 1;
        }

        const closedAt = parseDateToTimestamp(ticket.fechaCierre || '');
        if (closedAt !== null && closedAt >= reportStartMs && closedAt <= reportEndMs) {
          const bucketKey = startOfLocalWeekTimestamp(closedAt);
          const row = buckets.get(bucketKey);
          if (row) row.closed += 1;
        }
      });
    } else {
      const firstBucket = startOfLocalDayTimestamp(reportStartMs);
      const lastBucket = startOfLocalDayTimestamp(reportEndMs);
      for (let cursor = firstBucket; cursor <= lastBucket; cursor += dayMs) {
        const label = new Date(cursor).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
        buckets.set(cursor, {
          key: cursor,
          label,
          created: 0,
          closed: 0,
        });
      }

      reportScopedTicketsByFilters.forEach((ticket) => {
        const createdAt = ticketCreatedTimestamp(ticket);
        if (createdAt >= reportStartMs && createdAt <= reportEndMs) {
          const bucketKey = startOfLocalDayTimestamp(createdAt);
          const row = buckets.get(bucketKey);
          if (row) row.created += 1;
        }

        const closedAt = parseDateToTimestamp(ticket.fechaCierre || '');
        if (closedAt !== null && closedAt >= reportStartMs && closedAt <= reportEndMs) {
          const bucketKey = startOfLocalDayTimestamp(closedAt);
          const row = buckets.get(bucketKey);
          if (row) row.closed += 1;
        }
      });
    }

    return Array.from(buckets.values()).sort((a, b) => a.key - b.key);
  }, [isReportsView, reportEndMs, reportScopedTicketsByFilters, reportStartMs, reportTrendMode]);
  const reportLifecycleTrendMax = useMemo(
    () => (reportLifecycleTrend.length > 0 ? Math.max(1, ...reportLifecycleTrend.map((row) => Math.max(row.created, row.closed))) : 1),
    [reportLifecycleTrend],
  );
  const reportCreatedInPeriodCount = useMemo(
    () => reportLifecycleTrend.reduce((sum, row) => sum + row.created, 0),
    [reportLifecycleTrend],
  );
  const reportClosedInPeriodCount = useMemo(
    () => reportLifecycleTrend.reduce((sum, row) => sum + row.closed, 0),
    [reportLifecycleTrend],
  );
  const reportOpenCount = reportTickets.filter(isTicketOpen).length;
  const reportClosedCount = reportTickets.length - reportOpenCount;
  const reportCriticalCount = reportTickets.filter((ticket) => ticket.prioridad === 'CRITICA').length;
  const reportSlaExpiredCount = reportTickets.filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const reportSlaTotalCount = reportTickets.length;
  const reportSlaCompliantCount = Math.max(0, reportSlaTotalCount - reportSlaExpiredCount);
  const reportSlaCompliancePct = reportSlaTotalCount > 0
    ? Math.round((reportSlaCompliantCount / reportSlaTotalCount) * 100)
    : 100;
  const reportPreviousOpenCount = reportPreviousTickets.filter(isTicketOpen).length;
  const reportPreviousSlaExpiredCount = reportPreviousTickets.filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const reportPreviousSlaTotalCount = reportPreviousTickets.length;
  const reportPreviousSlaCompliantCount = Math.max(0, reportPreviousSlaTotalCount - reportPreviousSlaExpiredCount);
  const reportPreviousSlaCompliancePct = reportPreviousSlaTotalCount > 0
    ? Math.round((reportPreviousSlaCompliantCount / reportPreviousSlaTotalCount) * 100)
    : 100;
  const reportResolutionHours = collectResolutionHours(reportTickets);
  const reportPreviousResolutionHours = collectResolutionHours(reportPreviousTickets);
  const reportAvgResolutionHours = reportResolutionHours.length > 0
    ? roundHours(reportResolutionHours.reduce((sum, value) => sum + value, 0) / reportResolutionHours.length)
    : null;
  const reportMedianResolutionHours = calculateMedian(reportResolutionHours);
  const reportP90ResolutionHours = calculatePercentile(reportResolutionHours, 90);
  const reportPreviousAvgResolutionHours = reportPreviousResolutionHours.length > 0
    ? roundHours(reportPreviousResolutionHours.reduce((sum, value) => sum + value, 0) / reportPreviousResolutionHours.length)
    : null;
  const reportPreviousMedianResolutionHours = calculateMedian(reportPreviousResolutionHours);
  const reportPreviousP90ResolutionHours = calculatePercentile(reportPreviousResolutionHours, 90);
  const reportDefaultTrend = useMemo(
    () => ({ label: 'Comparativo no disponible', toneClass: 'text-slate-400' }),
    [],
  );
  const reportTicketsTrend = useMemo(
    () => (
      reportComparisonWindow
        ? formatMetricTrend(reportTickets.length, reportPreviousTickets.length, { positiveIsGood: false })
        : reportDefaultTrend
    ),
    [reportComparisonWindow, reportDefaultTrend, reportPreviousTickets.length, reportTickets.length],
  );
  const reportOpenTrend = useMemo(
    () => (
      reportComparisonWindow
        ? formatMetricTrend(reportOpenCount, reportPreviousOpenCount, { positiveIsGood: false })
        : reportDefaultTrend
    ),
    [reportComparisonWindow, reportDefaultTrend, reportOpenCount, reportPreviousOpenCount],
  );
  const reportSlaComplianceTrend = useMemo(
    () => (
      reportComparisonWindow
        ? formatMetricTrend(reportSlaCompliancePct, reportPreviousSlaCompliancePct, {
          positiveIsGood: true,
          unitSuffix: '%',
          usePoints: true,
        })
        : reportDefaultTrend
    ),
    [reportComparisonWindow, reportDefaultTrend, reportPreviousSlaCompliancePct, reportSlaCompliancePct],
  );
  const reportMttrMedianTrend = useMemo(
    () => (
      reportComparisonWindow
        ? formatMetricTrend(reportMedianResolutionHours, reportPreviousMedianResolutionHours, {
          positiveIsGood: false,
          decimals: 1,
          unitSuffix: ' h',
        })
        : reportDefaultTrend
    ),
    [reportComparisonWindow, reportDefaultTrend, reportMedianResolutionHours, reportPreviousMedianResolutionHours],
  );
  const reportP90ResolutionTrend = useMemo(
    () => (
      reportComparisonWindow
        ? formatMetricTrend(reportP90ResolutionHours, reportPreviousP90ResolutionHours, {
          positiveIsGood: false,
          decimals: 1,
          unitSuffix: ' h',
        })
        : reportDefaultTrend
    ),
    [reportComparisonWindow, reportDefaultTrend, reportP90ResolutionHours, reportPreviousP90ResolutionHours],
  );
  const reportStateBars = TICKET_STATES.map((state) => ({
    label: state,
    count: reportTickets.filter((ticket) => ticket.estado === state).length,
  }));
  // Deps are complete (formatTicketBranchFromCatalog + reportTickets); el React Compiler
  // no puede probar la estabilidad de la función recibida por parámetro, pero la
  // memoización manual es correcta.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const reportBranchBars = useMemo(() => {
    const counts = new Map<string, number>();
    reportTickets.forEach((ticket) => {
      const key = String(ticket.sucursal || '').trim().toUpperCase() || 'N/A';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([code, count]) => ({ code, label: formatTicketBranchFromCatalog(code), count }))
      .sort((a, b) => b.count - a.count);
  }, [formatTicketBranchFromCatalog, reportTickets]);
  const reportAreaBars = useMemo(() => {
    const counts = new Map<string, number>();
    reportTickets.forEach((ticket) => {
      const area = getTicketAreaLabel(ticket);
      counts.set(area, (counts.get(area) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [reportTickets]);
  const reportTechBars = useMemo(() => {
    const counts = new Map<string, number>();
    reportTickets.forEach((ticket) => {
      const assignee = String(ticket.asignadoA || '').trim() || 'SIN ASIGNAR';
      counts.set(assignee, (counts.get(assignee) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [reportTickets]);
  const reportAttentionBars = useMemo(() => {
    const counts = new Map<string, number>();
    reportTickets.forEach((ticket) => {
      const type = formatTicketAttentionType(ticket.atencionTipo) || 'NO ESPECIFICADO';
      counts.set(type, (counts.get(type) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [reportTickets]);
  const reportIncidentCauseBars = useMemo(() => {
    const grouped = new Map<string, { key: string; area: string; cause: string; count: number }>();
    reportTickets.forEach((ticket) => {
      const area = getTicketAreaLabel(ticket);
      const cause = extractTicketIssueDescription(ticket);
      const areaKey = normalizeForCompare(area) || 'sin-area';
      const causeKey = normalizeIncidentCause(cause);
      const key = `${areaKey}::${causeKey}`;
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
        return;
      }
      grouped.set(key, {
        key,
        area,
        cause,
        count: 1,
      });
    });
    return Array.from(grouped.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const areaOrder = a.area.localeCompare(b.area);
        if (areaOrder !== 0) return areaOrder;
        return a.cause.localeCompare(b.cause);
      })
      .slice(0, 10);
  }, [reportTickets]);
  const reportStateMax = Math.max(1, ...reportStateBars.map((item) => item.count));
  const reportBranchMax = Math.max(1, ...reportBranchBars.map((item) => item.count));
  const reportAreaMax = Math.max(1, ...reportAreaBars.map((item) => item.count));
  const reportTechMax = Math.max(1, ...reportTechBars.map((item) => item.count));
  const reportAttentionMax = Math.max(1, ...reportAttentionBars.map((item) => item.count));
  const reportIncidentCauseMax = Math.max(1, ...reportIncidentCauseBars.map((item) => item.count));
  const reportTravelCount = useMemo(() => reportTickets.filter(t => t.trasladoRequerido).length, [reportTickets]);
  const effectiveReportAuditRows = useMemo(
    () => (view === 'reports' && reportAuditRowsRemote !== null ? reportAuditRowsRemote : normalizedAuditRows),
    [normalizedAuditRows, reportAuditRowsRemote, view],
  );
  const reportAuditRows = useMemo(
    () =>
      effectiveReportAuditRows.filter((log) => {
        const timestamp = getAuditRowTimestampMs(log);
        if (timestamp === null) return false;
        if (reportStartMs !== null && timestamp < reportStartMs) return false;
        if (reportEndMs !== null && timestamp > reportEndMs) return false;
        return true;
      }),
    [effectiveReportAuditRows, reportEndMs, reportStartMs],
  );
  const reportAuditModuleBars = useMemo(() => {
    const counts = new Map<AuditModule, number>();
    reportAuditRows.forEach((log) => {
      const module = log.modulo || 'otros';
      counts.set(module, (counts.get(module) || 0) + 1);
    });
    return (['tickets', 'insumos', 'activos', 'otros'] as AuditModule[]).map((module) => ({
      module,
      label: auditModuleLabel(module),
      count: counts.get(module) || 0,
    }));
  }, [reportAuditRows]);
  const reportAuditMax = Math.max(1, ...reportAuditModuleBars.map((item) => item.count));
  const reportAuditTotalCount = effectiveReportAuditRows.length;
  const reportInventorySnapshot = {
    totalActivos: activos.length,
    activosEnFalla: activos.filter((asset) => asset.estado === 'Falla').length,
    sinResponsable: activos.filter((asset) => !(asset.responsable || '').trim()).length,
  };
  const reportSupplySnapshot = {
    total: insumos.length,
    agotados: insumos.filter((item) => getSupplyHealthStatus(item) === 'AGOTADO').length,
    bajoMinimo: insumos.filter((item) => getSupplyHealthStatus(item) === 'BAJO').length,
  };

  return {
    reportComparisonWindow,
    reportPreviousPeriodLabel,
    reportBranchOptions,
    reportAreaOptions,
    reportTechnicianOptions,
    travelTechnicianOptions,
    travelDestinationRules,
    travelMonthRange,
    effectiveTravelReporterName,
    travelSuggestedTripsByCode,
    travelReportRows,
    travelTotalTrips,
    travelTotalKms,
    travelFuelEfficiencyValue,
    travelFuelLiters,
    travelMonthLabel,
    reportTickets,
    reportPreviousTickets,
    reportTrendMode,
    reportLifecycleTrend,
    reportLifecycleTrendMax,
    reportCreatedInPeriodCount,
    reportClosedInPeriodCount,
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
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
    reportMttrMedianTrend,
    reportP90ResolutionTrend,
    reportStateBars,
    reportBranchBars,
    reportAreaBars,
    reportTechBars,
    reportAttentionBars,
    reportIncidentCauseBars,
    reportStateMax,
    reportBranchMax,
    reportAreaMax,
    reportTechMax,
    reportAttentionMax,
    reportIncidentCauseMax,
    reportTravelCount,
    reportAuditRows,
    reportAuditModuleBars,
    reportAuditMax,
    reportAuditTotalCount,
    reportInventorySnapshot,
    reportSupplySnapshot,
  };
}
