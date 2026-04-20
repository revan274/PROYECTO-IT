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

export function useSessionActions(options: UseSessionActionsOptions) {
  const logout = useAppStore((state) => state.logout);
  const resetCoreData = useAppStore((state) => state.resetCoreData);
  const resetSyncStatus = useAppStore((state) => state.resetSyncStatus);
  const clearToast = useAppStore((state) => state.clearToast);
  const clearGlobalSearchTerm = useAppStore((state) => state.clearGlobalSearchTerm);

  const clearSession = useCallback(() => {
    logout();
    options.setView('dashboard');
    resetCoreData();
    options.setAuditRemoteRows(null);
    options.setReportAuditRowsRemote(null);
    options.setAuditFilters(buildDefaultAuditFilters());
    options.setAuditPage(1);
    options.setAuditPageSize(25);
    options.setAuditPagination(buildDefaultAuditPagination(25));
    options.setAuditSummary(null);
    options.setAuditIntegrity(null);
    options.setAuditAlerts(null);
    options.setIsAuditLoading(false);
    resetSyncStatus();
    options.setAssetRiskSummary(null);
    options.setImportDraft(null);
    options.setIsApplyingImport(false);
    options.setSupplyStockDrafts({});
    clearToast();
    clearGlobalSearchTerm();
    options.applyReportFilterSnapshot(buildDefaultReportFilterSnapshot());
    options.setReportPresetName('');
    options.setReportFilterPresets([]);
    options.setTravelReportMonth(buildCurrentMonthInputValue());
    options.setTravelReportTechnician('TODOS');
    options.setTravelReportName('');
    options.setTravelReportDepartment(TRAVEL_DEFAULT_DEPARTMENT);
    options.setTravelReportFuelEfficiency(String(TRAVEL_DEFAULT_FUEL_EFFICIENCY));
    options.setTravelReportAuthorizer(TRAVEL_DEFAULT_AUTHORIZER);
    options.setTravelReportFinance(TRAVEL_DEFAULT_FINANCE);
    options.setTravelKmsByBranch(buildDefaultTravelKmsByBranch());
    options.setTravelAdjustments([]);
    options.setTravelTripDrafts({});
    options.setTravelSavingCode(null);
    options.setSelectedAsset(null);
    options.setSelectedSupplyHistoryItem(null);
    options.setSelectedSupplyHistoryRemoteMovements(null);
    options.setEditingAssetId(null);
    options.setEditingInsumoId(null);
    options.setFormData({});
    options.setInsumoTouched(createEmptyInsumoTouched());
    options.setTicketCommentDrafts({});
    options.setTicketAttachmentLoadingId(null);
    options.setShowModal(null);
    options.setShowQrScanner(false);
    options.setQrManualInput('');
    options.setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
    options.setIsQrScannerActive(false);
    options.setIsResolvingQr(false);
  }, [
    clearGlobalSearchTerm,
    clearToast,
    logout,
    options,
    resetCoreData,
    resetSyncStatus,
  ]);

  return { clearSession };
}
