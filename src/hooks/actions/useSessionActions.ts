import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type {
  Activo,
  AuditAlertsState,
  AuditFiltersState,
  AuditIntegrityState,
  AuditPaginationState,
  AuditSummaryState,
  FormDataState,
  Insumo,
  InsumoTouchedState,
  ModalType,
  RegistroAuditoria,
  ReportFilterPreset,
  ReportFilterSnapshot,
  SupplyAuditMovement,
  TravelTripAdjustment,
  ViewType,
} from '../../types/app';
import {
  buildCurrentMonthInputValue,
  buildDefaultAuditFilters,
  buildDefaultAuditPagination,
  buildDefaultReportFilterSnapshot,
  buildDefaultTravelKmsByBranch,
  createEmptyInsumoTouched,
} from '../../utils/app';
import {
  TRAVEL_DEFAULT_AUTHORIZER,
  TRAVEL_DEFAULT_DEPARTMENT,
  TRAVEL_DEFAULT_FINANCE,
  TRAVEL_DEFAULT_FUEL_EFFICIENCY,
} from '../../constants/app';

interface UseSessionActionsOptions {
  setView: (view: ViewType) => void;
  applyReportFilterSnapshot: (snapshot: ReportFilterSnapshot) => void;
  setAuditRemoteRows: Dispatch<SetStateAction<RegistroAuditoria[] | null>>;
  setReportAuditRowsRemote: Dispatch<SetStateAction<RegistroAuditoria[] | null>>;
  setAuditFilters: Dispatch<SetStateAction<AuditFiltersState>>;
  setAuditPage: Dispatch<SetStateAction<number>>;
  setAuditPageSize: Dispatch<SetStateAction<number>>;
  setAuditPagination: Dispatch<SetStateAction<AuditPaginationState>>;
  setAuditSummary: Dispatch<SetStateAction<AuditSummaryState | null>>;
  setAuditIntegrity: Dispatch<SetStateAction<AuditIntegrityState | null>>;
  setAuditAlerts: Dispatch<SetStateAction<AuditAlertsState | null>>;
  setIsAuditLoading: Dispatch<SetStateAction<boolean>>;
  setAssetRiskSummary: Dispatch<SetStateAction<null>>;
  setImportDraft: Dispatch<SetStateAction<null>>;
  setIsApplyingImport: Dispatch<SetStateAction<boolean>>;
  setSupplyStockDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setSelectedAsset: Dispatch<SetStateAction<Activo | null>>;
  setSelectedSupplyHistoryItem: Dispatch<SetStateAction<Insumo | null>>;
  setSelectedSupplyHistoryRemoteMovements: Dispatch<SetStateAction<SupplyAuditMovement[] | null>>;
  setEditingAssetId: Dispatch<SetStateAction<number | null>>;
  setEditingInsumoId: Dispatch<SetStateAction<number | null>>;
  setFormData: Dispatch<SetStateAction<FormDataState>>;
  setInsumoTouched: Dispatch<SetStateAction<InsumoTouchedState>>;
  setShowModal: Dispatch<SetStateAction<ModalType>>;
  setShowQrScanner: Dispatch<SetStateAction<boolean>>;
  setQrManualInput: Dispatch<SetStateAction<string>>;
  setQrScannerStatus: Dispatch<SetStateAction<string>>;
  setIsQrScannerActive: Dispatch<SetStateAction<boolean>>;
  setIsResolvingQr: Dispatch<SetStateAction<boolean>>;
  setTicketCommentDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setTicketAttachmentLoadingId: Dispatch<SetStateAction<number | null>>;
  setReportPresetName: Dispatch<SetStateAction<string>>;
  setReportFilterPresets: Dispatch<SetStateAction<ReportFilterPreset[]>>;
  setTravelReportMonth: Dispatch<SetStateAction<string>>;
  setTravelReportTechnician: Dispatch<SetStateAction<string>>;
  setTravelReportName: Dispatch<SetStateAction<string>>;
  setTravelReportDepartment: Dispatch<SetStateAction<string>>;
  setTravelReportFuelEfficiency: Dispatch<SetStateAction<string>>;
  setTravelReportAuthorizer: Dispatch<SetStateAction<string>>;
  setTravelReportFinance: Dispatch<SetStateAction<string>>;
  setTravelKmsByBranch: Dispatch<SetStateAction<Record<string, string>>>;
  setTravelAdjustments: Dispatch<SetStateAction<TravelTripAdjustment[]>>;
  setTravelTripDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setTravelSavingCode: Dispatch<SetStateAction<string | null>>;
}

export function useSessionActions({
  setView,
  applyReportFilterSnapshot,
  setAuditRemoteRows,
  setReportAuditRowsRemote,
  setAuditFilters,
  setAuditPage,
  setAuditPageSize,
  setAuditPagination,
  setAuditSummary,
  setAuditIntegrity,
  setAuditAlerts,
  setIsAuditLoading,
  setAssetRiskSummary,
  setImportDraft,
  setIsApplyingImport,
  setSupplyStockDrafts,
  setSelectedAsset,
  setSelectedSupplyHistoryItem,
  setSelectedSupplyHistoryRemoteMovements,
  setEditingAssetId,
  setEditingInsumoId,
  setFormData,
  setInsumoTouched,
  setShowModal,
  setShowQrScanner,
  setQrManualInput,
  setQrScannerStatus,
  setIsQrScannerActive,
  setIsResolvingQr,
  setTicketCommentDrafts,
  setTicketAttachmentLoadingId,
  setReportPresetName,
  setReportFilterPresets,
  setTravelReportMonth,
  setTravelReportTechnician,
  setTravelReportName,
  setTravelReportDepartment,
  setTravelReportFuelEfficiency,
  setTravelReportAuthorizer,
  setTravelReportFinance,
  setTravelKmsByBranch,
  setTravelAdjustments,
  setTravelTripDrafts,
  setTravelSavingCode,
}: UseSessionActionsOptions) {
  const logout = useAppStore((state) => state.logout);
  const resetCoreData = useAppStore((state) => state.resetCoreData);
  const resetSyncStatus = useAppStore((state) => state.resetSyncStatus);
  const clearToast = useAppStore((state) => state.clearToast);
  const clearGlobalSearchTerm = useAppStore((state) => state.clearGlobalSearchTerm);

  const clearSession = useCallback(() => {
    logout();
    setView('dashboard');
    resetCoreData();
    setAuditRemoteRows(null);
    setReportAuditRowsRemote(null);
    setAuditFilters(buildDefaultAuditFilters());
    setAuditPage(1);
    setAuditPageSize(25);
    setAuditPagination(buildDefaultAuditPagination(25));
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setIsAuditLoading(false);
    resetSyncStatus();
    setAssetRiskSummary(null);
    setImportDraft(null);
    setIsApplyingImport(false);
    setSupplyStockDrafts({});
    clearToast();
    clearGlobalSearchTerm();
    applyReportFilterSnapshot(buildDefaultReportFilterSnapshot());
    setReportPresetName('');
    setReportFilterPresets([]);
    setTravelReportMonth(buildCurrentMonthInputValue());
    setTravelReportTechnician('TODOS');
    setTravelReportName('');
    setTravelReportDepartment(TRAVEL_DEFAULT_DEPARTMENT);
    setTravelReportFuelEfficiency(String(TRAVEL_DEFAULT_FUEL_EFFICIENCY));
    setTravelReportAuthorizer(TRAVEL_DEFAULT_AUTHORIZER);
    setTravelReportFinance(TRAVEL_DEFAULT_FINANCE);
    setTravelKmsByBranch(buildDefaultTravelKmsByBranch());
    setTravelAdjustments([]);
    setTravelTripDrafts({});
    setTravelSavingCode(null);
    setSelectedAsset(null);
    setSelectedSupplyHistoryItem(null);
    setSelectedSupplyHistoryRemoteMovements(null);
    setEditingAssetId(null);
    setEditingInsumoId(null);
    setFormData({});
    setInsumoTouched(createEmptyInsumoTouched());
    setTicketCommentDrafts({});
    setTicketAttachmentLoadingId(null);
    setShowModal(null);
    setShowQrScanner(false);
    setQrManualInput('');
    setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
    setIsQrScannerActive(false);
    setIsResolvingQr(false);
  }, [
    applyReportFilterSnapshot,
    clearGlobalSearchTerm,
    clearToast,
    logout,
    resetCoreData,
    resetSyncStatus,
    setAssetRiskSummary,
    setAuditAlerts,
    setAuditFilters,
    setAuditIntegrity,
    setAuditPage,
    setAuditPageSize,
    setAuditPagination,
    setAuditRemoteRows,
    setAuditSummary,
    setEditingAssetId,
    setEditingInsumoId,
    setFormData,
    setImportDraft,
    setInsumoTouched,
    setIsApplyingImport,
    setIsAuditLoading,
    setIsQrScannerActive,
    setIsResolvingQr,
    setQrManualInput,
    setQrScannerStatus,
    setReportAuditRowsRemote,
    setReportFilterPresets,
    setReportPresetName,
    setSelectedAsset,
    setSelectedSupplyHistoryItem,
    setSelectedSupplyHistoryRemoteMovements,
    setShowModal,
    setShowQrScanner,
    setSupplyStockDrafts,
    setTicketAttachmentLoadingId,
    setTicketCommentDrafts,
    setTravelAdjustments,
    setTravelKmsByBranch,
    setTravelReportAuthorizer,
    setTravelReportDepartment,
    setTravelReportFinance,
    setTravelReportFuelEfficiency,
    setTravelReportMonth,
    setTravelReportName,
    setTravelReportTechnician,
    setTravelSavingCode,
    setTravelTripDrafts,
    setView,
  ]);

  return { clearSession };
}
