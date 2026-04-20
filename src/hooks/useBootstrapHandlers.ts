import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  AssetRiskSummary,
  AuditAlertsState,
  AuditPaginationState,
  AuditIntegrityState,
  AuditSummaryState,
  BootstrapResponse,
  RegistroAuditoria,
  SupplyAuditMovement,
  TravelTripAdjustment,
} from '../types/app';
import { buildDefaultAuditPagination } from '../utils/app';
import { calculateAssetRiskSummary } from '../utils/assets';

interface UseBootstrapHandlersOptions {
  auditPageSize: number;
  setAuditRemoteRows: Dispatch<SetStateAction<RegistroAuditoria[] | null>>;
  setReportAuditRowsRemote: Dispatch<SetStateAction<RegistroAuditoria[] | null>>;
  setAuditSummary: Dispatch<SetStateAction<AuditSummaryState | null>>;
  setAuditIntegrity: Dispatch<SetStateAction<AuditIntegrityState | null>>;
  setAuditAlerts: Dispatch<SetStateAction<AuditAlertsState | null>>;
  setAuditPagination: Dispatch<SetStateAction<AuditPaginationState>>;
  setTravelAdjustments: Dispatch<SetStateAction<TravelTripAdjustment[]>>;
  setSelectedSupplyHistoryRemoteMovements: Dispatch<SetStateAction<SupplyAuditMovement[] | null>>;
  setAssetRiskSummary: Dispatch<SetStateAction<AssetRiskSummary | null>>;
}

export function useBootstrapHandlers({
  auditPageSize,
  setAuditRemoteRows,
  setReportAuditRowsRemote,
  setAuditSummary,
  setAuditIntegrity,
  setAuditAlerts,
  setAuditPagination,
  setTravelAdjustments,
  setSelectedSupplyHistoryRemoteMovements,
  setAssetRiskSummary,
}: UseBootstrapHandlersOptions) {
  const handleBootstrapData = useCallback((data: BootstrapResponse) => {
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setAuditPagination(buildDefaultAuditPagination(auditPageSize));
    setTravelAdjustments(data.travelAdjustments || []);
    if (data.riskSummary) {
      setAssetRiskSummary(data.riskSummary);
    } else {
      setAssetRiskSummary(calculateAssetRiskSummary(data.activos || []));
    }
  }, [
    auditPageSize,
    setAssetRiskSummary,
    setAuditAlerts,
    setAuditIntegrity,
    setAuditPagination,
    setAuditSummary,
    setTravelAdjustments,
  ]);

  const handleBootstrapFailure = useCallback(() => {
    setAuditRemoteRows(null);
    setReportAuditRowsRemote(null);
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setAuditPagination(buildDefaultAuditPagination(auditPageSize));
    setTravelAdjustments([]);
    setSelectedSupplyHistoryRemoteMovements(null);
  }, [
    auditPageSize,
    setAuditAlerts,
    setAuditIntegrity,
    setAuditPagination,
    setAuditRemoteRows,
    setAuditSummary,
    setReportAuditRowsRemote,
    setSelectedSupplyHistoryRemoteMovements,
    setTravelAdjustments,
  ]);

  return {
    handleBootstrapData,
    handleBootstrapFailure,
  };
}
