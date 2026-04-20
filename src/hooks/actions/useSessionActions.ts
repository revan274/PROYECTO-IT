import { useCallback, useRef, useEffect } from 'react';
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

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const clearSession = useCallback(() => {
    logout();
    const currentOptions = optionsRef.current;
    currentOptions.setView('dashboard');
    resetCoreData();
    currentOptions.setAuditRemoteRows(null);
    currentOptions.setReportAuditRowsRemote(null);
    currentOptions.setAuditFilters(buildDefaultAuditFilters());
    currentOptions.setAuditPage(1);
    currentOptions.setAuditPageSize(25);
    currentOptions.setAuditPagination(buildDefaultAuditPagination(25));
    currentOptions.setAuditSummary(null);
    currentOptions.setAuditIntegrity(null);
    currentOptions.setAuditAlerts(null);
    currentOptions.setIsAuditLoading(false);
    resetSyncStatus();
    currentOptions.setAssetRiskSummary(null);
    currentOptions.setImportDraft(null);
    currentOptions.setIsApplyingImport(false);
    currentOptions.setSupplyStockDrafts({});
    clearToast();
    clearGlobalSearchTerm();
    currentOptions.applyReportFilterSnapshot(buildDefaultReportFilterSnapshot());
    currentOptions.setReportPresetName('');
    currentOptions.setReportFilterPresets([]);
    currentOptions.setTravelReportMonth(buildCurrentMonthInputValue());
    currentOptions.setTravelReportTechnician('TODOS');
    currentOptions.setTravelReportName('');
    currentOptions.setTravelReportDepartment(TRAVEL_DEFAULT_DEPARTMENT);
    currentOptions.setTravelReportFuelEfficiency(String(TRAVEL_DEFAULT_FUEL_EFFICIENCY));
    currentOptions.setTravelReportAuthorizer(TRAVEL_DEFAULT_AUTHORIZER);
    currentOptions.setTravelReportFinance(TRAVEL_DEFAULT_FINANCE);
    currentOptions.setTravelKmsByBranch(buildDefaultTravelKmsByBranch());
    currentOptions.setTravelAdjustments([]);
    currentOptions.setTravelTripDrafts({});
    currentOptions.setTravelSavingCode(null);
    currentOptions.setSelectedAsset(null);
    currentOptions.setSelectedSupplyHistoryItem(null);
    currentOptions.setSelectedSupplyHistoryRemoteMovements(null);
    currentOptions.setEditingAssetId(null);
    currentOptions.setEditingInsumoId(null);
    currentOptions.setFormData({});
    currentOptions.setInsumoTouched(createEmptyInsumoTouched());
    currentOptions.setTicketCommentDrafts({});
    currentOptions.setTicketAttachmentLoadingId(null);
    currentOptions.setShowModal(null);
    currentOptions.setShowQrScanner(false);
    currentOptions.setQrManualInput('');
    currentOptions.setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
    currentOptions.setIsQrScannerActive(false);
    currentOptions.setIsResolvingQr(false);
  }, [
    clearGlobalSearchTerm,
    clearToast,
    logout,
    resetCoreData,
    resetSyncStatus,
  ]);

  return { clearSession };
}
