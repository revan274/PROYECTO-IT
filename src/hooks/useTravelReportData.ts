import { useMemo } from 'react';

import {
  TRAVEL_DEFAULT_FUEL_EFFICIENCY,
  TRAVEL_DESTINATION_PRESETS,
} from '../constants/app';
import type {
  CatalogBranch,
  TicketItem,
  TravelDestinationRule,
  TravelReportRow,
  UserItem,
  UserSession,
} from '../types/app';
import {
  buildTravelReportRowsFromActualTrips,
  compactBranchLabel,
  extractTicketIssueDescription,
  formatMonthInputLabel,
  formatTravelDate,
  parseMonthInputRange,
  parseNonNegativeNumber,
  parseTicketTravelCreatedAt,
  resolveTicketTravelDestinationCode,
  resolveTravelTechnicianScope,
  roundToTwoDecimals,
} from '../utils/appHelpers';
import { normalizeForCompare } from '../utils/format';

interface TravelReportDataOptions {
  isReportsView: boolean;
  scopedTickets: readonly TicketItem[];
  matchesReportCoreFilters: (ticket: TicketItem) => boolean;
  activeTicketBranches: readonly CatalogBranch[];
  activeTicketBranchCodes: ReadonlySet<string>;
  travelReportMonth: string;
  travelReportTechnician: string;
  travelReportName: string;
  travelReportFuelEfficiency: string;
  users: readonly UserItem[];
  sessionUser: UserSession | null;
}

export function deriveTravelReportData({
  isReportsView,
  scopedTickets,
  matchesReportCoreFilters,
  activeTicketBranches,
  activeTicketBranchCodes,
  travelReportMonth,
  travelReportTechnician,
  travelReportName,
  travelReportFuelEfficiency,
  users,
  sessionUser,
}: TravelReportDataOptions) {
  const travelSourceTickets = isReportsView
    ? scopedTickets.filter((ticket) => matchesReportCoreFilters(ticket))
    : [];

  const travelTechnicianOptions = Array.from(
    new Set(
      travelSourceTickets
        .map((ticket) => String(ticket.asignadoA || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const travelDestinationRules: TravelDestinationRule[] = [];
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
    travelDestinationRules.push({
      code,
      index: preset.index,
      label,
      kms: preset.defaultKms,
    });
    usedCodes.add(code);
  });

  let nextIndex = travelDestinationRules.length > 0
    ? Math.max(...travelDestinationRules.map((row) => row.index)) + 1
    : 1;
  activeTicketBranches
    .map((branch) => String(branch.code || '').trim().toUpperCase())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .forEach((code) => {
      if (usedCodes.has(code)) return;
      const branch = branchByCode.get(code);
      travelDestinationRules.push({
        code,
        index: nextIndex,
        label: compactBranchLabel(branch?.name) || code,
        kms: 0,
      });
      usedCodes.add(code);
      nextIndex += 1;
    });
  travelDestinationRules.sort((left, right) => left.index - right.index);

  const travelDestinationRuleByCode = new Map(
    travelDestinationRules.map((row) => [row.code, row]),
  );
  const travelMonthRange = parseMonthInputRange(travelReportMonth);
  const currentTravelScope = resolveTravelTechnicianScope(travelReportTechnician, users);

  const manualReporterName = String(travelReportName || '').trim();
  let effectiveTravelReporterName = manualReporterName;
  if (!effectiveTravelReporterName) {
    if (travelReportTechnician !== 'TODOS' && travelReportTechnician !== 'SIN_ASIGNAR') {
      effectiveTravelReporterName = String(
        currentTravelScope.label || travelReportTechnician || '',
      ).trim();
    }
    if (!effectiveTravelReporterName) {
      effectiveTravelReporterName = String(sessionUser?.nombre || '').trim() || 'SIN NOMBRE';
    }
  }

  const travelTicketRows: TravelReportRow[] = [];
  if (isReportsView && travelMonthRange) {
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

      const destinationCode = resolveTicketTravelDestinationCode(
        ticket,
        activeTicketBranchCodes,
      );
      if (!destinationCode) return;

      const destinationRule = travelDestinationRuleByCode.get(destinationCode);
      travelTicketRows.push({
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
    travelTicketRows.sort((left, right) => {
      if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
      return left.ticketId - right.ticketId;
    });
  }

  const travelSuggestedTripsByCode = new Map<string, number>();
  travelTicketRows.forEach((row) => {
    travelSuggestedTripsByCode.set(
      row.destinationCode,
      (travelSuggestedTripsByCode.get(row.destinationCode) || 0) + 1,
    );
  });

  const travelReportRows = buildTravelReportRowsFromActualTrips(
    travelTicketRows,
    travelSuggestedTripsByCode,
    travelDestinationRuleByCode,
    effectiveTravelReporterName,
    travelMonthRange,
  );
  const travelTotalTrips = Array.from(travelSuggestedTripsByCode.values())
    .reduce((sum, trips) => sum + trips, 0);
  const travelTotalKms = Array.from(travelSuggestedTripsByCode.entries())
    .reduce((sum, [destinationCode, trips]) => {
      const destinationRule = travelDestinationRuleByCode.get(destinationCode);
      return sum + ((destinationRule?.kms || 0) * trips);
    }, 0);
  const travelFuelEfficiencyValue = parseNonNegativeNumber(
    travelReportFuelEfficiency,
    TRAVEL_DEFAULT_FUEL_EFFICIENCY,
  );
  const travelFuelLiters = travelFuelEfficiencyValue > 0
    ? roundToTwoDecimals(travelTotalKms / travelFuelEfficiencyValue)
    : 0;

  return {
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
    travelMonthLabel: formatMonthInputLabel(travelReportMonth),
  };
}

export function useTravelReportData(options: TravelReportDataOptions) {
  const {
    isReportsView,
    scopedTickets,
    matchesReportCoreFilters,
    activeTicketBranches,
    activeTicketBranchCodes,
    travelReportMonth,
    travelReportTechnician,
    travelReportName,
    travelReportFuelEfficiency,
    users,
    sessionUser,
  } = options;

  return useMemo(
    () => deriveTravelReportData({
      isReportsView,
      scopedTickets,
      matchesReportCoreFilters,
      activeTicketBranches,
      activeTicketBranchCodes,
      travelReportMonth,
      travelReportTechnician,
      travelReportName,
      travelReportFuelEfficiency,
      users,
      sessionUser,
    }),
    [
      activeTicketBranchCodes,
      activeTicketBranches,
      isReportsView,
      matchesReportCoreFilters,
      scopedTickets,
      sessionUser,
      travelReportFuelEfficiency,
      travelReportMonth,
      travelReportName,
      travelReportTechnician,
      users,
    ],
  );
}
