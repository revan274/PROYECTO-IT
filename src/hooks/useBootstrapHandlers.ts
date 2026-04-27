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
  setSelectedSupplyHistoryRemoteMovements,
  setAssetRiskSummary,
}: UseBootstrapHandlersOptions) {
  const handleBootstrapData = useCallback((data: BootstrapResponse) => {
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setAuditPagination(buildDefaultAuditPagination(auditPageSize));
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
  ]);

  const handleBootstrapFailure = useCallback(() => {
    setAuditRemoteRows(null);
    setReportAuditRowsRemote(null);
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setAuditPagination(buildDefaultAuditPagination(auditPageSize));
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
  ]);

  return {
    handleBootstrapData,
    handleBootstrapFailure,
  };
}
