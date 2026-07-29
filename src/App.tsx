import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { downloadAuditCsv } from './exports/auditCsv';
import { downloadInventoryCsv } from './exports/inventoryCsv';
import { downloadReportExcelWorkbook } from './exports/reportExcel';
import { buildExecutiveReportHtml } from './reports/executiveReport';
import { openAutoPrintLabelWindow, openHtmlReportWindow } from './reports/openPrintWindow';
import { buildAssetQrLabelHtml } from './reports/qrLabelReport';
import { buildTravelSheetHtml } from './reports/travelSheetReport';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { useAuditUiState } from './hooks/useAuditUiState';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useBootstrapHandlers } from './hooks/useBootstrapHandlers';
import { useCoreData } from './hooks/useCoreData';
import { useInventoryUiState } from './hooks/useInventoryUiState';
import { useModalState } from './hooks/useModalState';
import { useQrScanner } from './hooks/useQrScanner';
import { useReportState } from './hooks/useReportState';
import { useTicketUiState } from './hooks/useTicketUiState';
import { useUserUiState } from './hooks/useUserUiState';
import { useAssetActions } from './hooks/actions/useAssetActions';
import { useAuditActions } from './hooks/actions/useAuditActions';
import { useAuthActions } from './hooks/actions/useAuthActions';
import { useInventoryImport } from './hooks/actions/useInventoryImport';
import { useSessionActions } from './hooks/actions/useSessionActions';
import { useSupplyActions } from './hooks/actions/useSupplyActions';
import { useTicketActions } from './hooks/actions/useTicketActions';
import { useUserActions } from './hooks/actions/useUserActions';
import { useDialogs } from './hooks/useDialogs';
import { useAppCatalogs } from './hooks/useAppCatalogs';
import { getViewPath, useAppNavigation, VIEW_PATHS } from './hooks/useAppNavigation';
import { useAssetDirectoryData } from './hooks/useAssetDirectoryData';
import { useDashboardMetrics } from './hooks/useDashboardMetrics';
import { useReportKpiData } from './hooks/useReportKpiData';
import { useReportLifecycleTrendData } from './hooks/useReportLifecycleTrendData';
import { useReportTicketData } from './hooks/useReportTicketData';
import { useSupplyDirectoryData } from './hooks/useSupplyDirectoryData';
import { useTicketDirectoryData } from './hooks/useTicketDirectoryData';
import { useTravelReportData } from './hooks/useTravelReportData';
import { useUserDirectoryData } from './hooks/useUserDirectoryData';

import { Toast } from './components/ui/Toast';
import { ConfirmDialog } from './components/modals/ConfirmDialog';
import { PromptDialog } from './components/modals/PromptDialog';
import { LoginView } from './components/views/LoginView';
import { TicketsView } from './components/views/TicketsView';
import {
  AUTHOR_BRAND,
  AUTHOR_SIGNATURE,
  TICKET_ATTENTION_TYPES,
  TICKET_STATES,
} from './constants/app';
import type {
  Activo,
  AssetQrTokenResponse,
  AuditFiltersState,
  AuditModule,
  DashboardRange,
  InventoryRiskFilter,
  InventorySortField,
  ModalType,
  PrioridadTicket,
  RegistroAuditoria,
  ReportFilterPreset,
  ReportFilterSnapshot,
  SupplyAuditMovement,
  TicketAttachment,
  TicketEstado,
} from './types/app';
import {
  apiRequest,
  applyThemeToDocument,
  buildDefaultAuditFilters,
  buildDefaultReportFilterSnapshot,
  normalizeReportFilterSnapshot,
  readStoredReportFilterPresets,
  writeStoredReportFilterPresets,
} from './utils/app';
import {
  auditModuleLabel,
  buildSupplyAuditMovementsByInsumoId,
  filterAuditRowsClient,
  getAuditRowTimestampMs,
  resolveAuditModule,
} from './utils/audit';
import {
  canCreateTicketsByRole,
  canEditByRole,
  canManageUsersByRole,
  isRequesterOnlyRole,
  isUserRole,
} from './utils/roles';
import {
  formatBytes,
  formatDateTime,
  getApiErrorMessage,
  normalizeForCompare,
  sanitizeFileToken,
  tokenizeSearchQuery,
} from './utils/format';
import {
  buildSuggestedTicketIssues,
  formatTicketAttentionType,
  normalizeTicketAttentionType,
} from './utils/tickets';


import {
  buildAssetQrCanvasId,
} from './utils/qrTokens';

import {
  formatTravelNumber,
  getTicketAreaLabel,
  extractTicketIssueDescription,
  normalizeIncidentCause,
  getModalTitle,
  getModalSubmitLabel,
  getSupplyHealthStatus,
} from './utils/appHelpers';

const LazyUsersView = lazy(() => import('./components/views/UsersView'));
const LazyDashboardView = lazy(() => import('./components/views/DashboardView'));
const LazyReportsView = lazy(() => import('./components/views/ReportsView'));
const LazyInventoryView = lazy(() => import('./components/views/InventoryView'));
const LazySuppliesView = lazy(() => import('./components/views/SuppliesView'));
const LazyAuditView = lazy(() => import('./components/views/AuditView'));

const LazyQRCodeCanvas = lazy(async () => {
  const module = await import('qrcode.react');
  return { default: module.QRCodeCanvas };
});

function renderLazyView(loadingLabel: string, content: React.ReactNode) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">{loadingLabel}</div>}>
      {content}
    </React.Suspense>
  );
}

function renderProtectedView(
  content: React.ReactNode,
  options: {
    canManageUsers: boolean;
    isRequesterOnlyUser: boolean;
    defaultViewPath: string;
    allowRequester?: boolean;
    requiresUserManagement?: boolean;
  },
) {
  if (options.requiresUserManagement && !options.canManageUsers) {
    return <Navigate to={options.defaultViewPath} replace />;
  }
  if (!options.allowRequester && options.isRequesterOnlyUser) {
    return <Navigate to={options.defaultViewPath} replace />;
  }
  return content;
}

// --- APP PRINCIPAL ---

export default function App() {
  const {
    sessionUser,
    setStoredSession,
    logout,
    globalSearchTerm,
    setGlobalSearchTerm,
    clearGlobalSearchTerm,
    theme,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
    backendConnected,
    setTickets,
    resetCoreData,
    resetSyncStatus,
    toast,
    setToast,
    showToast,
    clearToast,
    showConfirm,
    showPrompt,
  } = useAppStore();
  const searchTerm = globalSearchTerm;

  const {
    activos,
    insumos,
    tickets,
    users,
    catalogos,
    auditoria,
  } = useCoreData();

  const {
    auditRemoteRows,
    setAuditRemoteRows,
    reportAuditRowsRemote,
    setReportAuditRowsRemote,
    auditFilters,
    setAuditFilters,
    auditPage,
    setAuditPage,
    auditPageSize,
    setAuditPageSize,
    auditPagination,
    setAuditPagination,
    auditSummary,
    setAuditSummary,
    auditIntegrity,
    setAuditIntegrity,
    auditAlerts,
    setAuditAlerts,
    isAuditLoading,
    setIsAuditLoading,
  } = useAuditUiState();

  // UI States
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>('30D');
  const {
    reportDateFrom,
    setReportDateFrom,
    reportDateTo,
    setReportDateTo,
    reportBranchFilter,
    setReportBranchFilter,
    reportAreaFilter,
    setReportAreaFilter,
    reportStateFilter,
    setReportStateFilter,
    reportPriorityFilter,
    setReportPriorityFilter,
    reportAttentionFilter,
    setReportAttentionFilter,
    reportTechnicianFilter,
    setReportTechnicianFilter,
    reportPresetName,
    setReportPresetName,
    reportFilterPresets,
    setReportFilterPresets,
    travelReportMonth,
    setTravelReportMonth,
    travelReportTechnician,
    setTravelReportTechnician,
    travelReportName,
    setTravelReportName,
    travelReportDepartment,
    setTravelReportDepartment,
    travelReportFuelEfficiency,
    setTravelReportFuelEfficiency,
    travelReportAuthorizer,
    setTravelReportAuthorizer,
    travelReportFinance,
    setTravelReportFinance,
  } = useReportState();
  const {
    showModal,
    setShowModal,
    selectedAsset,
    setSelectedAsset,
    selectedSupplyHistoryItem,
    setSelectedSupplyHistoryItem,
    selectedSupplyHistoryRemoteMovements,
    setSelectedSupplyHistoryRemoteMovements,
    showQrScanner,
    setShowQrScanner,
    qrScannerStatus,
    setQrScannerStatus,
    isQrScannerActive,
    setIsQrScannerActive,
    isResolvingQr,
    setIsResolvingQr,
    qrManualInput,
    setQrManualInput,
    selectedAssetQrValue,
    setSelectedAssetQrValue,
    selectedAssetQrMode,
    setSelectedAssetQrMode,
    selectedAssetQrIssuedAt,
    setSelectedAssetQrIssuedAt,
    selectedAssetQrLoading,
    setSelectedAssetQrLoading,
    editingAssetId,
    setEditingAssetId,
    editingInsumoId,
    setEditingInsumoId,
    isModalSaving,
    setIsModalSaving,
    formData,
    setFormData,
    insumoTouched,
    setInsumoTouched,
    markInsumoTouched,
    insumoFormValidation,
    supplyStockDrafts,
    setSupplyStockDrafts,
    isImportingInventory,
    setIsImportingInventory,
    inventoryDepartmentFilter,
    setInventoryDepartmentFilter,
    inventoryEquipmentFilter,
    setInventoryEquipmentFilter,
    inventoryStatusFilter,
    setInventoryStatusFilter,
    inventoryRiskFilter,
    setInventoryRiskFilter,
    inventorySortField,
    setInventorySortField,
    inventorySortDirection,
    setInventorySortDirection,
    supplySearchTerm,
    setSupplySearchTerm,
    supplyCategoryFilter,
    setSupplyCategoryFilter,
    supplyStatusFilter,
    setSupplyStatusFilter,
    importDraft,
    setImportDraft,
    isApplyingImport,
    setIsApplyingImport,
    setAssetRiskSummary,
  } = useInventoryUiState({ insumos });
  const {
    ticketLifecycleFilter,
    setTicketLifecycleFilter,
    ticketStateFilter,
    setTicketStateFilter,
    ticketPriorityFilter,
    setTicketPriorityFilter,
    ticketAssignmentFilter,
    setTicketAssignmentFilter,
    ticketSlaFilter,
    setTicketSlaFilter,
    ticketCommentDrafts,
    setTicketCommentDrafts,
    ticketAttachmentLoadingId,
    setTicketAttachmentLoadingId,
  } = useTicketUiState();
  const {
    newUserForm,
    setNewUserForm,
    isCreatingUser,
    setIsCreatingUser,
    editingUserId,
    setEditingUserId,
    userActionLoadingId,
    setUserActionLoadingId,
    userSearchTerm,
    setUserSearchTerm,
    userRoleFilter,
    setUserRoleFilter,
    userStatusFilter,
    setUserStatusFilter,
    userDepartmentFilter,
    setUserDepartmentFilter,
  } = useUserUiState();
  const inventoryImportInputRef = useRef<HTMLInputElement | null>(null);
  const fetchAuditHistoryRef = useRef<(options?: { force?: boolean }) => void>(() => { });

  const [liveNow, setLiveNow] = useState(() => Date.now());
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const debouncedSupplySearchTerm = useDebouncedValue(supplySearchTerm);
  const debouncedUserSearchTerm = useDebouncedValue(userSearchTerm);
  const headerSearchTokens = useMemo(
    () => tokenizeSearchQuery(debouncedSearchTerm),
    [debouncedSearchTerm],
  );
  const supplySearchTokens = useMemo(
    () => tokenizeSearchQuery(debouncedSupplySearchTerm),
    [debouncedSupplySearchTerm],
  );
  const userSearchTokens = useMemo(
    () => tokenizeSearchQuery(debouncedUserSearchTerm),
    [debouncedUserSearchTerm],
  );
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    setLiveNow(Date.now());
    const intervalId = window.setInterval(() => setLiveNow(Date.now()), 300_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setReportFilterPresets([]);
      setReportPresetName('');
      return;
    }
    setReportFilterPresets(readStoredReportFilterPresets(sessionUser));
  }, [sessionUser, setReportFilterPresets, setReportPresetName]);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAssetQrValue('');
      setSelectedAssetQrMode('unavailable');
      setSelectedAssetQrIssuedAt('');
      setSelectedAssetQrLoading(false);
      return;
    }

    if (!backendConnected) {
      setSelectedAssetQrValue('');
      setSelectedAssetQrMode('unavailable');
      setSelectedAssetQrIssuedAt('');
      setSelectedAssetQrLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedAssetQrValue('');
    setSelectedAssetQrMode('unavailable');
    setSelectedAssetQrIssuedAt('');
    setSelectedAssetQrLoading(true);

    void (async () => {
      try {
        const response = await apiRequest<AssetQrTokenResponse>(`/activos/${selectedAsset.id}/qr-token`);
        if (cancelled) return;

        const token = String(response?.token || '').trim();
        if (!token) throw new Error('QR token vacío');

        setSelectedAssetQrValue(token);
        setSelectedAssetQrMode('signed');
        setSelectedAssetQrIssuedAt(String(response?.issuedAt || ''));
      } catch {
        if (cancelled) return;
        setSelectedAssetQrValue('');
        setSelectedAssetQrMode('unavailable');
        setSelectedAssetQrIssuedAt('');
      } finally {
        if (!cancelled) setSelectedAssetQrLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnected,
    selectedAsset,
    setSelectedAssetQrIssuedAt,
    setSelectedAssetQrLoading,
    setSelectedAssetQrMode,
    setSelectedAssetQrValue,
  ]);

  const canEdit = canEditByRole(sessionUser?.rol);
  const canCreateTickets = canCreateTicketsByRole(sessionUser?.rol);
  const canSubmitInsumo = canEdit && insumoFormValidation.isValid && !isModalSaving;
  const isAssetModalOpen = showModal === 'activo';
  const isSupplyModalOpen = showModal === 'insumo';
  const isTicketModalOpen = showModal === 'ticket';
  const canManageUsers = canManageUsersByRole(sessionUser?.rol);
  const isReadOnly = !canEdit;
  const isRequesterOnlyUser = isRequesterOnlyRole(sessionUser?.rol);
  const {
    view,
    setView,
    visibleNavItems,
    defaultViewPath,
    isDashboardView,
    isReportsView,
  } = useAppNavigation({
    canManageUsers,
    isRequesterOnlyUser,
  });
  const {
    activeTicketBranches,
    activeTicketBranchCodes,
    ticketAssetOptions,
    selectedTicketAsset,
    selectedTicketAssetContext,
    userCargoOptions,
    userCargoLabelByValue,
    roleCatalogOptions,
    roleFilterOptions,
    roleLabelByValue,
    rolePermissionsByValue,
    isValidTicketBranchValue,
    formatTicketBranchFromCatalog,
    formatCargoFromCatalog,
  } = useAppCatalogs({
    activos,
    catalogos,
    selectedTicketBranch: formData.sucursal,
    selectedTicketAssetTag: formData.activoTag,
  });
  const applyReportFilterSnapshot = useCallback((snapshot: ReportFilterSnapshot) => {
    setReportDateFrom(snapshot.dateFrom);
    setReportDateTo(snapshot.dateTo);
    setReportBranchFilter(snapshot.branch);
    setReportAreaFilter(snapshot.area);
    setReportStateFilter(snapshot.state);
    setReportPriorityFilter(snapshot.priority);
    setReportAttentionFilter(snapshot.attention);
    setReportTechnicianFilter(snapshot.technician);
  }, [
    setReportAreaFilter,
    setReportAttentionFilter,
    setReportBranchFilter,
    setReportDateFrom,
    setReportDateTo,
    setReportPriorityFilter,
    setReportStateFilter,
    setReportTechnicianFilter,
  ]);
  const { clearSession } = useSessionActions({
    logout,
    resetCoreData,
    resetSyncStatus,
    clearToast,
    clearGlobalSearchTerm,
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
  });

  const {
    handleBootstrapData,
    handleBootstrapFailure,
  } = useBootstrapHandlers({
    auditPageSize,
    setAuditRemoteRows,
    setReportAuditRowsRemote,
    setAuditSummary,
    setAuditIntegrity,
    setAuditAlerts,
    setAuditPagination,
    setSelectedSupplyHistoryRemoteMovements,
    setAssetRiskSummary,
  });

  const handleBootstrapSuccess = useCallback(() => {
    fetchAuditHistoryRef.current({ force: true });
  }, []);

  const {
    refreshData,
    ensureBackendConnected,
    isSyncing,
    lastSync,
  } = useAppBootstrap({
    onSessionRejected: clearSession,
    onBootstrapData: handleBootstrapData,
    onRefreshFailure: handleBootstrapFailure,
    onRefreshSuccess: handleBootstrapSuccess,
  });

  const {
    confirmState,
    promptState,
    onConfirmAccept,
    onConfirmCancel,
    onPromptAccept,
    onPromptCancel,
  } = useDialogs();

  const {
    loginForm,
    setLoginForm,
    loginLoading,
    handleLogin,
    handleLogout,
  } = useAuthActions({
    clearSession,
    setStoredSession,
    showToast,
  });

  useEffect(() => {
    if (!sessionUser) {
      setLoginForm({ username: '', password: '' });
    }
  }, [sessionUser, setLoginForm]);
  const {
    updateFormData,
    openModal: openManagedModal,
    closeModal,
    openAssetEditModal: openAssetEditModalByAsset,
    openInsumoEditModal,
  } = useModalState({
    activeTicketBranches,
    canEdit,
    setShowModal,
    setFormData,
    setEditingAssetId,
    setEditingInsumoId,
    setIsModalSaving,
    setInsumoTouched,
    setSelectedAsset,
    showToast,
  });

  const openModal = useCallback((modal: ModalType | string) => {
    if (modal === 'activo' || modal === 'insumo' || modal === 'ticket') {
      openManagedModal(modal);
    }
  }, [openManagedModal]);

  const openAssetEditModal = useCallback(() => {
    if (!selectedAsset) return;
    openAssetEditModalByAsset(selectedAsset);
  }, [openAssetEditModalByAsset, selectedAsset]);

  const {
    handleSaveActivo,
    eliminarActivo,
    eliminarTodosActivos,
  } = useAssetActions({
    sessionUser,
    activos,
    backendConnected,
    refreshAppData: refreshData,
    showToast,
    showConfirm,
    onAfterBulkDelete: () => setSelectedAsset(null),
  });

  const {
    handleSaveInsumo,
    eliminarInsumo,
    ajustarStock,
    reponerCriticos,
    confirmarStockManual,
  } = useSupplyActions({
    sessionUser,
    insumos,
    backendConnected,
    refreshAppData: refreshData,
    showToast,
    showConfirm,
    showPrompt,
    setInsumoTouched,
    getSupplyHealthStatus,
    setSupplyStockDrafts,
    supplyStockDrafts,
  });

  const handleQrAssetResolved = useCallback((asset: Activo) => {
    setView('inventory');
    setGlobalSearchTerm(asset.tag);
    setSelectedAsset(asset);
  }, [setGlobalSearchTerm, setSelectedAsset, setView]);

  const {
    qrScannerVideoRef,
    isQrCameraSupported,
    resolveQrFromManualInput,
  } = useQrScanner({
    activos,
    backendConnected,
    qrManualInput,
    showQrScanner,
    isResolvingQr,
    setShowQrScanner,
    setQrManualInput,
    setQrScannerStatus,
    setIsQrScannerActive,
    setIsResolvingQr,
    showToast,
    onAssetResolved: handleQrAssetResolved,
  });

  const {
    handleCreateTicket,
    actualizarTicket,
    resolverTicket,
    agregarComentarioTicket,
    eliminarTicket,
    cargarAdjuntoTicket,
    descargarAdjuntoTicket,
    eliminarAdjuntoTicket,
  } = useTicketActions({
    sessionUser,
    backendConnected,
    refreshAppData: refreshData,
    showToast,
    showConfirm,
    tickets,
    setTickets,
    canEdit,
    canCreateTickets,
    canCreateComments: canCreateTickets,
    isValidTicketBranchValue,
    ticketAssetOptionsCount: ticketAssetOptions.length,
    ticketAssetOptionsIncludes: (tag) => ticketAssetOptions.some((option) => option.tag === tag),
    setTicketCommentDrafts,
    ticketCommentDrafts,
    setTicketAttachmentLoadingId,
  });

  const descargarQrActivoSeleccionado = useCallback(() => {
    if (!selectedAsset) return;
    if (selectedAssetQrMode !== 'signed' || !selectedAssetQrValue) {
      showToast('El QR firmado no está disponible para descargar.', 'warning');
      return;
    }
    const qrCanvas = document.getElementById(buildAssetQrCanvasId(selectedAsset.id));
    if (!(qrCanvas instanceof HTMLCanvasElement)) {
      showToast('No se pudo generar el QR del activo', 'warning');
      return;
    }
    const fileToken = sanitizeFileToken(selectedAsset.tag || String(selectedAsset.id));
    const link = document.createElement('a');
    link.href = qrCanvas.toDataURL('image/png');
    link.download = `qr_${fileToken}.png`;
    link.click();
    showToast('QR descargado', 'success');
  }, [selectedAssetQrValue, selectedAsset, selectedAssetQrMode, showToast]);

  const imprimirEtiquetaQrActivoSeleccionado = useCallback(() => {
    if (!selectedAsset) return;
    if (selectedAssetQrMode !== 'signed' || !selectedAssetQrValue) {
      showToast('El QR firmado no está disponible para imprimir.', 'warning');
      return;
    }
    const qrCanvas = document.getElementById(buildAssetQrCanvasId(selectedAsset.id));
    if (!(qrCanvas instanceof HTMLCanvasElement)) {
      showToast('No se pudo preparar la etiqueta QR', 'warning');
      return;
    }

    const html = buildAssetQrLabelHtml(selectedAsset, qrCanvas.toDataURL('image/png'), activeTicketBranchCodes);
    if (!openAutoPrintLabelWindow(html)) {
      showToast('Permite ventanas emergentes para imprimir etiquetas', 'warning');
    }
  }, [activeTicketBranchCodes, selectedAssetQrValue, selectedAsset, selectedAssetQrMode, showToast]);

  const { fetchAuditHistory, loadAllAuditRows } = useAuditActions({
    hasSession: Boolean(sessionUser),
    backendConnected,
    isRequesterOnlyUser,
    view,
    auditFilters,
    auditPage,
    auditPageSize,
    clearSession,
    showToast,
    setAuditRemoteRows,
    setAuditPagination,
    setAuditSummary,
    setAuditIntegrity,
    setAuditAlerts,
    setIsAuditLoading,
  });

  useEffect(() => {
    fetchAuditHistoryRef.current = fetchAuditHistory;
  }, [fetchAuditHistory]);

  useEffect(() => {
    let cancelled = false;

    if (view !== 'reports' || !sessionUser || !backendConnected || isRequesterOnlyUser) {
      setReportAuditRowsRemote(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const result = await loadAllAuditRows(
        { from: reportDateFrom, to: reportDateTo },
        { notifyGenericError: true },
      );
      if (cancelled) return;
      if (result.status === 'ok') {
        setReportAuditRowsRemote(result.rows);
      } else if (result.status === 'error') {
        setReportAuditRowsRemote(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnected,
    isRequesterOnlyUser,
    loadAllAuditRows,
    reportDateFrom,
    reportDateTo,
    sessionUser,
    setReportAuditRowsRemote,
    view,
  ]);

  useEffect(() => {
    if (!selectedSupplyHistoryItem) return;
    const exists = insumos.some((item) => item.id === selectedSupplyHistoryItem.id);
    if (!exists) setSelectedSupplyHistoryItem(null);
  }, [insumos, selectedSupplyHistoryItem, setSelectedSupplyHistoryItem]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedSupplyHistoryItem) {
      setSelectedSupplyHistoryRemoteMovements(null);
      return () => {
        cancelled = true;
      };
    }
    if (!sessionUser || !backendConnected || isRequesterOnlyUser) {
      setSelectedSupplyHistoryRemoteMovements(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const result = await loadAllAuditRows({
        module: 'insumos',
        entity: 'insumo',
        entityId: selectedSupplyHistoryItem.id,
      });
      if (cancelled) return;
      if (result.status === 'ok') {
        const grouped = buildSupplyAuditMovementsByInsumoId(result.rows, insumos);
        setSelectedSupplyHistoryRemoteMovements(grouped[selectedSupplyHistoryItem.id] || []);
      } else if (result.status === 'error') {
        setSelectedSupplyHistoryRemoteMovements(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnected,
    insumos,
    isRequesterOnlyUser,
    loadAllAuditRows,
    selectedSupplyHistoryItem,
    sessionUser,
    setSelectedSupplyHistoryRemoteMovements,
  ]);

  useEffect(() => {
    if (showModal !== 'ticket') return;
    const currentTag = String(formData.activoTag || '').trim().toUpperCase();
    if (!currentTag) return;
    const validInBranch = ticketAssetOptions.some((option) => option.tag === currentTag);
    if (validInBranch) return;
    setFormData((prev) => {
      const prevTag = String(prev.activoTag || '').trim().toUpperCase();
      if (!prevTag || prevTag !== currentTag) return prev;
      return { ...prev, activoTag: '' };
    });
  }, [formData.activoTag, setFormData, showModal, ticketAssetOptions]);

  useEffect(() => {
    if (!roleCatalogOptions.some((role) => role.value === newUserForm.rol)) {
      const fallbackRole = roleCatalogOptions[0]?.value;
      if (fallbackRole && isUserRole(fallbackRole)) {
        setNewUserForm((prev) => ({ ...prev, rol: fallbackRole }));
      }
    }
  }, [newUserForm.rol, roleCatalogOptions, setNewUserForm]);


  const resetNewUserForm = useCallback(() => {
    const fallbackRoleRaw = roleCatalogOptions[0]?.value;
    const fallbackRole = fallbackRoleRaw && isUserRole(fallbackRoleRaw) ? fallbackRoleRaw : 'solicitante';
    setNewUserForm({
      nombre: '',
      username: '',
      password: '',
      departamento: '',
      rol: fallbackRole,
    });
    setEditingUserId(null);
  }, [roleCatalogOptions, setEditingUserId, setNewUserForm]);

  const {
    handleCreateUser,
    handleEditUser,
    handleToggleUserActive,
    handleDeleteUser,
  } = useUserActions({
    sessionUser,
    users,
    backendConnected,
    refreshAppData: refreshData,
    showToast,
    showConfirm,
    canManageUsers,
    editingUserId,
    newUserForm,
    setNewUserForm,
    setIsCreatingUser,
    setEditingUserId,
    setUserActionLoadingId,
    resetNewUserForm,
  });

  const {
    handleImportInventory,
    exportImportIssuesCsv,
    applyImportDraft,
  } = useInventoryImport({
    isReadOnly,
    sessionUser,
    importDraft,
    isApplyingImport,
    ensureBackendConnected,
    refreshData,
    showToast,
    setImportDraft,
    setIsApplyingImport,
    setIsImportingInventory,
  });

  const handleSave = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isModalSaving) return;

    const modalType = showModal;
    if (!modalType) return;

    const isTicketModal = modalType === 'ticket';
    if (isTicketModal) {
      if (!canCreateTickets) {
        showToast('Tu rol no permite crear tickets', 'warning');
        return;
      }
    } else if (!canEdit) {
      showToast('Tu rol no permite esta acción', 'warning');
      return;
    }

    if (!ensureBackendConnected(isTicketModal ? 'Crear tickets' : 'Guardar cambios')) return;

    setIsModalSaving(true);
    try {
      if (modalType === 'activo') {
        const ok = await handleSaveActivo(formData, editingAssetId);
        if (!ok) return;
      } else if (modalType === 'insumo') {
        const ok = await handleSaveInsumo(insumoFormValidation, editingInsumoId);
        if (!ok) return;
      } else if (modalType === 'ticket') {
        const ok = await handleCreateTicket(formData);
        if (!ok) return;
      }

      closeModal();
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el registro', 'error');
    } finally {
      setIsModalSaving(false);
    }
  }, [canCreateTickets, canEdit, closeModal, editingAssetId, editingInsumoId, ensureBackendConnected, formData, handleCreateTicket, handleSaveActivo, handleSaveInsumo, insumoFormValidation, isModalSaving, setIsModalSaving, showModal, showToast]);

  const updateAuditFilters = useCallback((updates: Partial<AuditFiltersState>) => {
    setAuditFilters((prev) => ({ ...prev, ...updates }));
    setAuditPage(1);
  }, [setAuditFilters, setAuditPage]);

  const resetAuditFilters = useCallback(() => {
    setAuditFilters(buildDefaultAuditFilters());
    setAuditPage(1);
  }, [setAuditFilters, setAuditPage]);

  const applyInventoryFocus = useCallback((focus: 'FALLA' | InventoryRiskFilter) => {
    setInventoryDepartmentFilter('TODOS');
    setInventoryEquipmentFilter('TODOS');
    clearGlobalSearchTerm();
    if (focus === 'FALLA') {
      setInventoryStatusFilter('Falla');
      setInventoryRiskFilter('TODOS');
      return;
    }
    setInventoryStatusFilter('TODOS');
    setInventoryRiskFilter(focus);
  }, [clearGlobalSearchTerm, setInventoryDepartmentFilter, setInventoryEquipmentFilter, setInventoryRiskFilter, setInventoryStatusFilter]);

  const updateInventorySort = useCallback((field: InventorySortField) => {
    if (inventorySortField === field) {
      setInventorySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setInventorySortField(field);
    setInventorySortDirection('asc');
  }, [inventorySortField, setInventorySortDirection, setInventorySortField]);

  const getInventorySortIndicator = useCallback((field: InventorySortField) => {
    if (inventorySortField !== field) return '<>';
    return inventorySortDirection === 'asc' ? '^' : 'v';
  }, [inventorySortField, inventorySortDirection]);

  const {
    localRiskSummary,
    departamentoOptions,
    equipoOptions,
    filteredActivos,
    sortedFilteredActivos,
  } = useAssetDirectoryData({
    activos,
    searchTokens: headerSearchTokens,
    departmentFilter: inventoryDepartmentFilter,
    equipmentFilter: inventoryEquipmentFilter,
    statusFilter: inventoryStatusFilter,
    riskFilter: inventoryRiskFilter,
    sortField: inventorySortField,
    sortDirection: inventorySortDirection,
  });
  const duplicateIpEntries = localRiskSummary.duplicateIpEntries;
  const duplicateMacEntries = localRiskSummary.duplicateMacEntries;

  const {
    sortedUsers,
    activeUsersCount,
    ticketEligibleUsersCount,
  } = useUserDirectoryData({
    users,
    searchTokens: userSearchTokens,
    roleFilter: userRoleFilter,
    statusFilter: userStatusFilter,
    departmentFilter: userDepartmentFilter,
    roleLabelByValue,
    rolePermissionsByValue,
    userCargoLabelByValue,
  });

  const activosConIp = localRiskSummary.activosConIp;
  const activosEvaluablesIp = localRiskSummary.activosEvaluablesIp;
  const activosConMac = localRiskSummary.activosConMac;
  const activosEvaluablesMac = localRiskSummary.activosEvaluablesMac;
  const activosEvaluablesResponsable = localRiskSummary.activosEvaluablesResponsable;
  const activosSinResponsable = localRiskSummary.activosSinResponsable;
  const activosVidaAlta = localRiskSummary.activosVidaAlta;
  const activosEnFalla = localRiskSummary.activosEnFalla;

  const exportarInventarioFiltrado = useCallback(() => {
    if (filteredActivos.length === 0) {
      showToast('No hay activos para exportar', 'warning');
      return;
    }

    downloadInventoryCsv(filteredActivos);
  }, [filteredActivos, showToast]);

  const {
    supplySummary,
    supplyCategoryOptions,
    filteredSupplies,
  } = useSupplyDirectoryData({
    insumos,
    searchTokens: supplySearchTokens,
    categoryFilter: supplyCategoryFilter,
    statusFilter: supplyStatusFilter,
  });

  const importIssueRows = useMemo(
    () =>
      importDraft
        ? [...(importDraft.preview.details || []), ...importDraft.localInvalidDetails].filter(
          (detail) => detail.status === 'invalid' || detail.status === 'skipped',
        )
        : [],
    [importDraft],
  );

  const effectiveAuditRows = useMemo(
    () => (view === 'history' && auditRemoteRows !== null ? auditRemoteRows : auditoria),
    [auditRemoteRows, auditoria, view],
  );
  const normalizedAuditRows = useMemo(
    () =>
      effectiveAuditRows.map((log) => {
        const modulo = resolveAuditModule(log);
        return { ...log, modulo } as RegistroAuditoria;
      }),
    [effectiveAuditRows],
  );
  const supplyAuditMovementsByInsumoId = useMemo(
    () => buildSupplyAuditMovementsByInsumoId(normalizedAuditRows, insumos),
    [insumos, normalizedAuditRows],
  );
  const selectedSupplyMovements = useMemo(() => {
    if (!selectedSupplyHistoryItem) return [] as SupplyAuditMovement[];
    if (selectedSupplyHistoryRemoteMovements !== null) return selectedSupplyHistoryRemoteMovements;
    return supplyAuditMovementsByInsumoId[selectedSupplyHistoryItem.id] || [];
  }, [selectedSupplyHistoryItem, selectedSupplyHistoryRemoteMovements, supplyAuditMovementsByInsumoId]);
  const auditRowsForHistory = useMemo(() => {
    if (view !== 'history') return normalizedAuditRows;
    if (auditRemoteRows !== null) return normalizedAuditRows;
    return filterAuditRowsClient(normalizedAuditRows, auditFilters);
  }, [
    auditFilters,
    auditRemoteRows,
    normalizedAuditRows,
    view,
  ]);

  const descargarAuditoria = useCallback((module?: AuditModule) => {
    const sourceBase = view === 'history' ? auditRowsForHistory : normalizedAuditRows;
    const rowsSource = module
      ? sourceBase.filter((log) => log.modulo === module)
      : sourceBase;
    if (rowsSource.length === 0) {
      const label = module ? auditModuleLabel(module) : 'auditoría';
      showToast(`No hay registros para exportar en ${label}`, 'warning');
      return;
    }

    downloadAuditCsv(rowsSource, module);
  }, [auditRowsForHistory, normalizedAuditRows, showToast, view]);

  const auditRowsForGrouping = useMemo(
    () => (view === 'history' ? auditRowsForHistory : normalizedAuditRows),
    [view, auditRowsForHistory, normalizedAuditRows],
  );
  const auditByModule = useMemo(() => {
    const grouped: Record<AuditModule, RegistroAuditoria[]> = {
      activos: [],
      insumos: [],
      tickets: [],
      otros: [],
    };
    auditRowsForGrouping.forEach((log) => {
      const modulo = log.modulo || 'otros';
      grouped[modulo].push(log);
    });
    return grouped;
  }, [auditRowsForGrouping]);
  const auditModuleTotals = useMemo(
    () =>
      auditSummary?.byModule || {
        activos: auditByModule.activos.length,
        insumos: auditByModule.insumos.length,
        tickets: auditByModule.tickets.length,
        otros: auditByModule.otros.length,
      },
    [auditByModule, auditSummary],
  );
  const auditResultTotals = useMemo(
    () =>
      auditSummary?.byResult || {
        ok: auditRowsForGrouping.filter((log) => (log.resultado || 'ok') === 'ok').length,
        error: auditRowsForGrouping.filter((log) => (log.resultado || 'ok') === 'error').length,
      },
    [auditRowsForGrouping, auditSummary],
  );

  const {
    canDeleteTicket,
    getSlaStatusForCurrentTime,
    scopedTickets,
    openTicketsCount,
    slaExpiredCount,
    criticalTicketsCount,
    unassignedTicketsCount,
    filteredTickets,
  } = useTicketDirectoryData({
    tickets,
    sessionUser,
    isRequesterOnlyUser,
    canEdit,
    liveNow,
    searchTokens: headerSearchTokens,
    lifecycleFilter: ticketLifecycleFilter,
    stateFilter: ticketStateFilter,
    priorityFilter: ticketPriorityFilter,
    assignmentFilter: ticketAssignmentFilter,
    slaFilter: ticketSlaFilter,
    formatTicketBranch: formatTicketBranchFromCatalog,
  });

  const {
    dashboardWindow,
    dashboardOpenTicketsCurrent,
    dashboardCriticalTicketsCurrent,
    dashboardUnassignedCount,
    dashboardInProcessCount,
    dashboardRecentTickets,
    dashboardTopOwners,
    dashboardStateBars,
    dashboardBranchBars,
    dashboardAgingBars,
    dashboardSlaTotalCount,
    dashboardSlaExpiredCount,
    dashboardSlaCompliantCount,
    dashboardSlaCompliancePct,
    dashboardOpenTrend,
    dashboardCriticalTrend,
    dashboardSlaTrend,
    dashboardStateMax,
    dashboardBranchMax,
    dashboardOwnerMax,
    dashboardAgingMax,
  } = useDashboardMetrics({
    scopedTickets,
    dashboardRange,
    liveNow,
    isDashboardView,
    formatTicketBranch: formatTicketBranchFromCatalog,
  });

  const {
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
  } = useReportTicketData({
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
  });
  const {
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
  } = useTravelReportData({
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
  });
  const {
    reportTrendMode,
    reportLifecycleTrend,
    reportLifecycleTrendMax,
    reportCreatedInPeriodCount,
    reportClosedInPeriodCount,
  } = useReportLifecycleTrendData({
    isReportsView,
    reportStartMs,
    reportEndMs,
    reportScopedTicketsByFilters,
  });
  const {
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
  } = useReportKpiData({
    reportTickets,
    reportPreviousTickets,
    hasComparisonWindow: Boolean(reportComparisonWindow),
    liveNow,
  });
  const reportStateBars = TICKET_STATES.map((state) => ({
    label: state,
    count: reportTickets.filter((ticket) => ticket.estado === state).length,
  }));
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

  useEffect(() => {
    if (reportBranchFilter !== 'TODAS' && !reportBranchOptions.includes(reportBranchFilter)) {
      setReportBranchFilter('TODAS');
    }
  }, [reportBranchFilter, reportBranchOptions, setReportBranchFilter]);

  useEffect(() => {
    if (reportAreaFilter !== 'TODAS' && !reportAreaOptions.some((area) => normalizeForCompare(area) === normalizeForCompare(reportAreaFilter))) {
      setReportAreaFilter('TODAS');
    }
  }, [reportAreaFilter, reportAreaOptions, setReportAreaFilter]);

  useEffect(() => {
    if (reportTechnicianFilter === 'TODOS' || reportTechnicianFilter === 'SIN_ASIGNAR') return;
    const exists = reportTechnicianOptions.some((name) => normalizeForCompare(name) === normalizeForCompare(reportTechnicianFilter));
    if (!exists) setReportTechnicianFilter('TODOS');
  }, [reportTechnicianFilter, reportTechnicianOptions, setReportTechnicianFilter]);
  useEffect(() => {
    if (travelReportTechnician === 'TODOS' || travelReportTechnician === 'SIN_ASIGNAR') return;
    const exists = travelTechnicianOptions.some((name) => normalizeForCompare(name) === normalizeForCompare(travelReportTechnician));
    if (!exists) setTravelReportTechnician('TODOS');
  }, [setTravelReportTechnician, travelReportTechnician, travelTechnicianOptions]);

  const applyTicketFocus = useCallback((focus: 'ABIERTOS' | 'SLA' | 'CRITICA' | 'SIN_ASIGNAR' | 'EN_PROCESO') => {
    setView('tickets');
    clearGlobalSearchTerm();
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    if (focus === 'ABIERTOS') { setTicketLifecycleFilter('ABIERTOS'); return; }
    if (focus === 'SLA') { setTicketLifecycleFilter('ABIERTOS'); setTicketSlaFilter('VENCIDO'); return; }
    if (focus === 'CRITICA') { setTicketPriorityFilter('CRITICA'); return; }
    if (focus === 'SIN_ASIGNAR') { setTicketLifecycleFilter('ABIERTOS'); setTicketAssignmentFilter('SIN_ASIGNAR'); return; }
    setTicketLifecycleFilter('ABIERTOS');
    setTicketStateFilter('En Proceso');
  }, [
    clearGlobalSearchTerm, setTicketAssignmentFilter, setTicketLifecycleFilter,
    setTicketPriorityFilter, setTicketSlaFilter, setTicketStateFilter, setView,
  ]);
  const applyReportDrillDown = useCallback((filters: {
    estado?: TicketEstado;
    prioridad?: PrioridadTicket;
    sucursalCode?: string;
    area?: string;
    asignadoA?: string;
  }) => {
    setView('tickets');
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    clearGlobalSearchTerm();
    if (filters.estado) setTicketStateFilter(filters.estado);
    if (filters.prioridad) setTicketPriorityFilter(filters.prioridad);
    if (filters.asignadoA) { setTicketAssignmentFilter('ASIGNADOS'); setGlobalSearchTerm(filters.asignadoA); }
    if (filters.sucursalCode) setGlobalSearchTerm(formatTicketBranchFromCatalog(filters.sucursalCode));
    if (filters.area) setGlobalSearchTerm(filters.area);
  }, [
    clearGlobalSearchTerm, formatTicketBranchFromCatalog, setGlobalSearchTerm,
    setTicketAssignmentFilter, setTicketLifecycleFilter, setTicketPriorityFilter,
    setTicketSlaFilter, setTicketStateFilter, setView,
  ]);

  const applyReportIncidentCauseDrillDown = useCallback((area: string, cause: string) => {
    setView('tickets');
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    setGlobalSearchTerm(`${area} ${cause}`.trim() || area || cause);
  }, [
    setGlobalSearchTerm, setTicketAssignmentFilter, setTicketLifecycleFilter,
    setTicketPriorityFilter, setTicketSlaFilter, setTicketStateFilter, setView,
  ]);
  const reportCurrentFilterSnapshot = useMemo<ReportFilterSnapshot>(
    () => ({
      dateFrom: reportDateFrom,
      dateTo: reportDateTo,
      branch: reportBranchFilter,
      area: reportAreaFilter,
      state: reportStateFilter,
      priority: reportPriorityFilter,
      attention: reportAttentionFilter,
      technician: reportTechnicianFilter,
    }),
    [reportAreaFilter, reportAttentionFilter, reportBranchFilter, reportDateFrom, reportDateTo, reportPriorityFilter, reportStateFilter, reportTechnicianFilter],
  );
  const resetReportFilters = useCallback(() => {
    applyReportFilterSnapshot(buildDefaultReportFilterSnapshot());
  }, [applyReportFilterSnapshot]);
  const applyReportFilterPreset = useCallback((preset: ReportFilterPreset) => {
    const snapshot = normalizeReportFilterSnapshot(preset.filters);
    applyReportFilterSnapshot(snapshot);
    showToast(`Preset aplicado: ${preset.name}`, 'success');
  }, [applyReportFilterSnapshot, showToast]);
  const saveCurrentReportFilterPreset = useCallback(() => {
    if (!sessionUser) {
      showToast('Inicia sesión para guardar presets', 'warning');
      return;
    }
    const name = String(reportPresetName || '').trim();
    if (!name) {
      showToast('Escribe un nombre para el preset', 'warning');
      return;
    }
    const normalizedName = normalizeForCompare(name);
    const existing = reportFilterPresets.find((item) => normalizeForCompare(item.name) === normalizedName);
    const nextPreset: ReportFilterPreset = {
      id: existing?.id || `rp-${Date.now()}`,
      name,
      createdAt: existing?.createdAt || new Date().toISOString(),
      filters: { ...reportCurrentFilterSnapshot },
    };
    const next = [nextPreset, ...reportFilterPresets.filter((item) => item.id !== nextPreset.id)].slice(0, 30);
    setReportFilterPresets(next);
    writeStoredReportFilterPresets(sessionUser, next);
    setReportPresetName('');
    showToast(existing ? 'Preset actualizado' : 'Preset guardado', 'success');
  }, [reportCurrentFilterSnapshot, reportFilterPresets, reportPresetName, sessionUser, setReportFilterPresets, setReportPresetName, showToast]);
  const deleteReportFilterPreset = useCallback(async (preset: ReportFilterPreset) => {
    if (!sessionUser) return;
    const confirmed = showConfirm
      ? await showConfirm(`Eliminar preset "${preset.name}"?`)
      : window.confirm(`Eliminar preset "${preset.name}"?`);
    if (!confirmed) return;
    setReportFilterPresets((prev) => {
      const next = prev.filter((item) => item.id !== preset.id);
      writeStoredReportFilterPresets(sessionUser, next);
      return next;
    });
    showToast('Preset eliminado', 'success');
  }, [sessionUser, setReportFilterPresets, showConfirm, showToast]);
  const buildReportPresentationHtml = (): string => buildExecutiveReportHtml({
    reportDateFrom,
    reportDateTo,
    reportBranchFilter,
    reportAreaFilter,
    reportStateFilter,
    reportPriorityFilter,
    reportAttentionFilter,
    reportTechnicianFilter,
    reportPreviousPeriodLabel,
    reportTrendMode,
    hasComparisonWindow: Boolean(reportComparisonWindow),
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
    reportTickets,
    reportStateBars,
    reportBranchBars,
    reportAreaBars,
    reportIncidentCauseBars,
    reportLifecycleTrend,
    reportAuditModuleBars,
    reportOpenCount,
    reportClosedCount,
    reportSlaCompliancePct,
    reportSlaCompliantCount,
    reportSlaTotalCount,
    reportSlaExpiredCount,
    reportInventorySnapshot,
    reportSupplySnapshot,
    sessionUserName: sessionUser?.nombre || 'Sistema',
    nowMs: liveNow,
    formatTicketBranchFromCatalog,
  });
  const openReportPresentationWindow = (autoPrint = false) => {
    openHtmlReportWindow(buildReportPresentationHtml(), {
      autoPrint,
      notify: showToast,
      messages: {
        popupFallback: 'Popup bloqueado. Se abrio un reporte alterno en otra pestana.',
        openError: 'No se pudo abrir ventana de presentacion/reportes',
        openErrorLevel: 'warning',
        renderError: 'No se pudo renderizar la presentacion/reportes',
      },
    });
  };
  const exportReportExcel = async () => {
    if (reportTickets.length === 0 && reportClosedInPeriodCount === 0) {
      showToast('No hay datos de tickets para exportar en el periodo seleccionado', 'warning');
      return;
    }
    try {
      await downloadReportExcelWorkbook({
        reportDateFrom,
        reportDateTo,
        reportBranchFilter,
        reportAreaFilter,
        reportStateFilter,
        reportPriorityFilter,
        reportAttentionFilter,
        reportTechnicianFilter,
        reportPreviousPeriodLabel,
        reportTrendMode,
        hasComparisonWindow: Boolean(reportComparisonWindow),
        reportTickets,
        reportPreviousTicketsCount: reportPreviousTickets.length,
        reportTicketsTrend,
        reportOpenCount,
        reportPreviousOpenCount,
        reportOpenTrend,
        reportClosedCount,
        reportCreatedInPeriodCount,
        reportClosedInPeriodCount,
        reportSlaCompliancePct,
        reportPreviousSlaCompliancePct,
        reportSlaComplianceTrend,
        reportSlaExpiredCount,
        reportCriticalCount,
        reportAvgResolutionHours,
        reportPreviousAvgResolutionHours,
        reportMedianResolutionHours,
        reportPreviousMedianResolutionHours,
        reportMttrMedianTrend,
        reportP90ResolutionHours,
        reportPreviousP90ResolutionHours,
        reportP90ResolutionTrend,
        reportInventorySnapshot,
        reportSupplySnapshot,
        reportStateBars,
        reportBranchBars,
        reportAreaBars,
        reportTechBars,
        reportIncidentCauseBars,
        reportLifecycleTrend,
        reportAuditRows,
        nowMs: liveNow,
        formatTicketBranchFromCatalog,
      });
      showToast('Reporte Excel generado', 'success');
    } catch {
      showToast('No se pudo exportar el reporte en Excel', 'error');
    }
  };
  const exportReportPdf = () => {
    openReportPresentationWindow(true);
  };
  const openReportExecutivePresentation = () => {
    openReportPresentationWindow(false);
  };
  const openTravelMovementSheetWindow = (autoPrint = false) => {
    if (!travelMonthRange) {
      showToast('Selecciona un mes valido para generar el formato', 'warning');
      return;
    }
    if (travelReportRows.length === 0) {
      showToast('No hay tickets para el mes/filtros seleccionados. Se abrira formato en blanco.', 'warning');
    }

    const html = buildTravelSheetHtml({
      department: travelReportDepartment,
      monthLabel: travelMonthLabel,
      reporterName: effectiveTravelReporterName,
      authorizer: travelReportAuthorizer,
      finance: travelReportFinance,
      fuelEfficiencyValue: travelFuelEfficiencyValue,
      fuelLiters: travelFuelLiters,
      rows: travelReportRows,
      destinationRules: travelDestinationRules,
      suggestedTripsByCode: travelSuggestedTripsByCode,
      totalTrips: travelTotalTrips,
      totalKms: travelTotalKms,
    });
    openHtmlReportWindow(html, {
      autoPrint,
      notify: showToast,
      messages: {
        popupFallback: 'Popup bloqueado. Se abrio el formato en otra pestana.',
        openError: 'No se pudo abrir el formato mensual de movilidad',
        openErrorLevel: 'error',
        renderError: 'No se pudo renderizar el formato mensual de movilidad',
      },
    });
  };
  const openTravelMovementSheet = () => {
    openTravelMovementSheetWindow(false);
  };
  const printTravelMovementSheet = () => {
    openTravelMovementSheetWindow(true);
  };
  const selectedIssueArea = String(formData.areaAfectada || '').trim();
  const issueOptionsForSelectedArea = useMemo(() => {
    return buildSuggestedTicketIssues(selectedIssueArea, selectedTicketAsset, activeTicketBranchCodes);
  }, [activeTicketBranchCodes, selectedIssueArea, selectedTicketAsset]);

  useEffect(() => {
    if (showModal !== 'ticket') return;
    const currentIssue = String(formData.fallaComun || '').trim();
    if (!currentIssue) return;
    const stillValid = issueOptionsForSelectedArea.some((issue) => issue === currentIssue);
    if (stillValid) return;

    setFormData((prev) => {
      const prevIssue = String(prev.fallaComun || '').trim();
      if (!prevIssue || prevIssue !== currentIssue) return prev;
      return { ...prev, fallaComun: '' };
    });
  }, [formData.fallaComun, issueOptionsForSelectedArea, setFormData, showModal]);

  const systemHealth = useMemo(
    () => activos.length > 0
      ? Math.round((activos.filter((a) => a.estado === 'Operativo').length / activos.length) * 100)
      : 100,
    [activos],
  );
  const protectedViewOptions = { canManageUsers, isRequesterOnlyUser, defaultViewPath };

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const openSidebar = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);
  const logoutHandler = useCallback(() => { void handleLogout(); }, [handleLogout]);
  const openTicketModal = useCallback(() => openModal('ticket'), [openModal]);

  const handleTicketStateFilterChange = useCallback(
    (value: string) => setTicketStateFilter(value as TicketEstado | 'TODOS'),
    [setTicketStateFilter],
  );
  const handleTicketPriorityFilterChange = useCallback(
    (value: string) => setTicketPriorityFilter(value as PrioridadTicket | 'TODAS'),
    [setTicketPriorityFilter],
  );
  const resetTicketFilters = useCallback(() => {
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    clearGlobalSearchTerm();
  }, [clearGlobalSearchTerm, setTicketAssignmentFilter, setTicketLifecycleFilter, setTicketPriorityFilter, setTicketSlaFilter, setTicketStateFilter]);

  const handleStatusChange = useCallback(
    (ticketId: number, estado: string) => { void actualizarTicket(ticketId, { estado: estado as TicketEstado }); },
    [actualizarTicket],
  );
  const handleAttentionChange = useCallback(
    (ticketId: number, atencionTipo: string) => {
      const value = normalizeTicketAttentionType(atencionTipo);
      if (!value) return;
      void actualizarTicket(ticketId, { atencionTipo: value });
    },
    [actualizarTicket],
  );
  const handleTravelChange = useCallback(
    (ticketId: number, trasladoRequerido: boolean) => { void actualizarTicket(ticketId, { trasladoRequerido }); },
    [actualizarTicket],
  );
  const handleAssigneeChange = useCallback(
    (ticketId: number, asignadoA: string) => { void actualizarTicket(ticketId, { asignadoA }); },
    [actualizarTicket],
  );
  const handleViewAssetFromTicket = useCallback(
    (tag: string) => { setView('inventory'); setGlobalSearchTerm(tag); },
    [setGlobalSearchTerm, setView],
  );
  const handleResolveTicket = useCallback(
    (ticketId: number) => { void resolverTicket(ticketId); },
    [resolverTicket],
  );
  const handleDeleteTicket = useCallback(
    (ticketId: number) => { void eliminarTicket(ticketId); },
    [eliminarTicket],
  );
  const handleUploadAttachment = useCallback(
    (ticketId: number, files: FileList | null) => { void cargarAdjuntoTicket(ticketId, files); },
    [cargarAdjuntoTicket],
  );
  const handleDownloadAttachment = useCallback(
    (ticketId: number, attachment: TicketAttachment) => { void descargarAdjuntoTicket(ticketId, attachment); },
    [descargarAdjuntoTicket],
  );
  const handleDeleteAttachment = useCallback(
    (ticketId: number, attachment: TicketAttachment) => { void eliminarAdjuntoTicket(ticketId, attachment); },
    [eliminarAdjuntoTicket],
  );
  const handleCommentDraftChange = useCallback(
    (ticketId: number, value: string) => {
      setTicketCommentDrafts((prev) => ({ ...prev, [ticketId]: value }));
    },
    [setTicketCommentDrafts],
  );
  const handleSaveComment = useCallback(
    (ticketId: number) => { void agregarComentarioTicket(ticketId); },
    [agregarComentarioTicket],
  );

  if (!sessionUser) {
    return (
      <Routes>
        <Route path="*" element={
          <LoginView
            theme={theme}
            toggleTheme={toggleTheme}
            handleLogin={handleLogin}
            loginLoading={loginLoading}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            AUTHOR_SIGNATURE={AUTHOR_SIGNATURE}
            toast={toast}
            setToast={setToast}
          />
        } />
      </Routes>
    );
  }


  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-700 overflow-x-hidden">
      <AppSidebar
        navItems={visibleNavItems}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={closeSidebar}
        authorBrand={AUTHOR_BRAND}
        getItemHref={getViewPath}
        onLogout={logoutHandler}
      />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <AppHeader
          searchTerm={searchTerm}
          onSearchChange={setGlobalSearchTerm}
          onOpenSidebar={openSidebar}
          authorBrand={AUTHOR_BRAND}
          theme={theme}
          onToggleTheme={toggleTheme}
          backendConnected={backendConnected}
          isSyncing={isSyncing}
          lastSync={lastSync}
          sessionUser={sessionUser}
        />

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
          {isSyncing && (
            <div className="max-w-7xl mx-auto mb-4 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl bg-lime-50 border border-lime-200 text-lime-700 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
              Sincronizando datos con backend...
            </div>
          )}
          <div className="max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">



            <Routes>
              <Route path="/" element={<Navigate to={defaultViewPath} replace />} />
              <Route
                path={VIEW_PATHS.dashboard}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Dashboard...',
                    <LazyDashboardView
                      dashboardWindow={dashboardWindow}
                      dashboardOpenTicketsCurrent={dashboardOpenTicketsCurrent}
                      dashboardCriticalTicketsCurrent={dashboardCriticalTicketsCurrent}
                      dashboardUnassignedCount={dashboardUnassignedCount}
                      dashboardRange={dashboardRange}
                      setDashboardRange={setDashboardRange}
                      systemHealth={systemHealth}
                      insumos={insumos}
                      dashboardOpenTrend={dashboardOpenTrend}
                      activos={activos}
                      dashboardCriticalTrend={dashboardCriticalTrend}
                      dashboardSlaExpiredCount={dashboardSlaExpiredCount}
                      dashboardSlaTrend={dashboardSlaTrend}
                      setView={setView}
                      applyTicketFocus={applyTicketFocus}
                      dashboardRecentTickets={dashboardRecentTickets}
                      setSearchTerm={setGlobalSearchTerm}
                      dashboardTopOwners={dashboardTopOwners}
                      dashboardOwnerMax={dashboardOwnerMax}
                      dashboardInProcessCount={dashboardInProcessCount}
                      applyInventoryFocus={applyInventoryFocus}
                      activosSinResponsable={activosSinResponsable}
                      activosVidaAlta={activosVidaAlta}
                      effectiveRiskSummary={localRiskSummary}
                      dashboardStateBars={dashboardStateBars}
                      dashboardStateMax={dashboardStateMax}
                      dashboardBranchBars={dashboardBranchBars}
                      dashboardBranchMax={dashboardBranchMax}
                      dashboardSlaCompliancePct={dashboardSlaCompliancePct}
                      dashboardSlaCompliantCount={dashboardSlaCompliantCount}
                      dashboardSlaTotalCount={dashboardSlaTotalCount}
                      dashboardAgingBars={dashboardAgingBars}
                      dashboardAgingMax={dashboardAgingMax}
                    />,
                  ),
                  protectedViewOptions,
                )}
              />
              <Route
                path={VIEW_PATHS.reports}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Reporteria...',
                    <LazyReportsView
                      openReportExecutivePresentation={openReportExecutivePresentation}
                      exportReportExcel={() => {
                        void exportReportExcel();
                      }}
                      exportReportPdf={exportReportPdf}
                      reportDateFrom={reportDateFrom}
                      setReportDateFrom={setReportDateFrom}
                      reportDateTo={reportDateTo}
                      setReportDateTo={setReportDateTo}
                      reportBranchFilter={reportBranchFilter}
                      setReportBranchFilter={setReportBranchFilter}
                      reportBranchOptions={reportBranchOptions}
                      formatTicketBranchFromCatalog={formatTicketBranchFromCatalog}
                      reportAreaFilter={reportAreaFilter}
                      setReportAreaFilter={setReportAreaFilter}
                      reportAreaOptions={reportAreaOptions}
                      reportStateFilter={reportStateFilter}
                      setReportStateFilter={setReportStateFilter}
                      ticketStates={TICKET_STATES}
                      reportPriorityFilter={reportPriorityFilter}
                      setReportPriorityFilter={setReportPriorityFilter}
                      reportAttentionFilter={reportAttentionFilter}
                      setReportAttentionFilter={setReportAttentionFilter}
                      ticketAttentionTypes={TICKET_ATTENTION_TYPES}
                      formatTicketAttentionType={formatTicketAttentionType}
                      reportTechnicianFilter={reportTechnicianFilter}
                      setReportTechnicianFilter={setReportTechnicianFilter}
                      reportTechnicianOptions={reportTechnicianOptions}
                      resetReportFilters={resetReportFilters}
                      reportPresetName={reportPresetName}
                      setReportPresetName={setReportPresetName}
                      saveCurrentReportFilterPreset={() => {
                        void saveCurrentReportFilterPreset();
                      }}
                      reportFilterPresets={reportFilterPresets}
                      applyReportFilterPreset={applyReportFilterPreset}
                      deleteReportFilterPreset={deleteReportFilterPreset}
                      openTravelMovementSheet={openTravelMovementSheet}
                      printTravelMovementSheet={printTravelMovementSheet}
                      travelReportMonth={travelReportMonth}
                      setTravelReportMonth={setTravelReportMonth}
                      travelReportTechnician={travelReportTechnician}
                      setTravelReportTechnician={setTravelReportTechnician}
                      travelTechnicianOptions={travelTechnicianOptions}
                      travelReportName={travelReportName}
                      setTravelReportName={setTravelReportName}
                      travelReportDepartment={travelReportDepartment}
                      setTravelReportDepartment={setTravelReportDepartment}
                      travelReportFuelEfficiency={travelReportFuelEfficiency}
                      setTravelReportFuelEfficiency={setTravelReportFuelEfficiency}
                      travelReportAuthorizer={travelReportAuthorizer}
                      setTravelReportAuthorizer={setTravelReportAuthorizer}
                      travelReportFinance={travelReportFinance}
                      setTravelReportFinance={setTravelReportFinance}
                      travelDestinationRules={travelDestinationRules}
                      travelSuggestedTripsByCode={travelSuggestedTripsByCode}
                      travelMonthLabel={travelMonthLabel}
                      effectiveTravelReporterName={effectiveTravelReporterName}
                      travelTotalTrips={travelTotalTrips}
                      travelTotalKms={travelTotalKms}
                      formatTravelNumber={formatTravelNumber}
                      travelFuelEfficiencyValue={travelFuelEfficiencyValue}
                      travelFuelLiters={travelFuelLiters}
                      reportTicketsCount={reportTickets.length}
                      hasReportComparison={!!reportComparisonWindow}
                      reportTicketsTrend={reportTicketsTrend}
                      reportOpenCount={reportOpenCount}
                      reportOpenTrend={reportOpenTrend}
                      reportClosedCount={reportClosedCount}
                      reportSlaCompliancePct={reportSlaCompliancePct}
                      reportSlaCompliantCount={reportSlaCompliantCount}
                      reportSlaTotalCount={reportSlaTotalCount}
                      reportSlaComplianceTrend={reportSlaComplianceTrend}
                      reportSlaExpiredCount={reportSlaExpiredCount}
                      reportTrendMode={reportTrendMode}
                      reportCreatedInPeriodCount={reportCreatedInPeriodCount}
                      reportClosedInPeriodCount={reportClosedInPeriodCount}
                      reportLifecycleTrend={reportLifecycleTrend}
                      reportLifecycleTrendMax={reportLifecycleTrendMax}
                      reportStateBars={reportStateBars}
                      applyReportDrillDown={applyReportDrillDown}
                      reportStateMax={reportStateMax}
                      reportBranchBars={reportBranchBars}
                      reportBranchMax={reportBranchMax}
                      reportAreaBars={reportAreaBars}
                      reportAreaMax={reportAreaMax}
                      reportTechBars={reportTechBars}
                      reportTechMax={reportTechMax}
                      reportAuditModuleBars={reportAuditModuleBars}
                      reportAuditMax={reportAuditMax}
                      reportAuditRowsCount={reportAuditRows.length}
                      reportAuditTotalCount={reportAuditTotalCount}
                      reportIncidentCauseBars={reportIncidentCauseBars}
                      applyReportIncidentCauseDrillDown={applyReportIncidentCauseDrillDown}
                      reportIncidentCauseMax={reportIncidentCauseMax}
                      reportTravelCount={reportTravelCount}
                      reportAttentionBars={reportAttentionBars}
                      reportAttentionMax={reportAttentionMax}
                      reportInventorySnapshot={reportInventorySnapshot}
                      reportSupplySnapshot={reportSupplySnapshot}
                    />,
                  ),
                  protectedViewOptions,
                )}
              />
              <Route
                path={VIEW_PATHS.inventory}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Inventario...',
                    <LazyInventoryView
                      inventoryImportInputRef={inventoryImportInputRef}
                      handleImportInventory={handleImportInventory}
                      canEdit={canEdit}
                      isImportingInventory={isImportingInventory}
                      exportarInventarioFiltrado={exportarInventarioFiltrado}
                      setQrManualInput={setQrManualInput}
                      setQrScannerStatus={setQrScannerStatus}
                      setShowQrScanner={setShowQrScanner}
                      canManageUsers={canManageUsers}
                      activos={activos}
                      eliminarTodosActivos={eliminarTodosActivos}
                      openModal={openModal}
                      activosConIp={activosConIp}
                      activosEvaluablesIp={activosEvaluablesIp}
                      activosConMac={activosConMac}
                      activosEvaluablesMac={activosEvaluablesMac}
                      activosSinResponsable={activosSinResponsable}
                      activosEvaluablesResponsable={activosEvaluablesResponsable}
                      activosVidaAlta={activosVidaAlta}
                      inventoryDepartmentFilter={inventoryDepartmentFilter}
                      setInventoryDepartmentFilter={setInventoryDepartmentFilter}
                      departamentoOptions={departamentoOptions}
                      inventoryEquipmentFilter={inventoryEquipmentFilter}
                      setInventoryEquipmentFilter={setInventoryEquipmentFilter}
                      equipoOptions={equipoOptions}
                      inventoryStatusFilter={inventoryStatusFilter}
                      setInventoryStatusFilter={setInventoryStatusFilter}
                      inventoryRiskFilter={inventoryRiskFilter}
                      setInventoryRiskFilter={setInventoryRiskFilter}
                      inventorySortField={inventorySortField}
                      setInventorySortField={setInventorySortField}
                      inventorySortDirection={inventorySortDirection}
                      setInventorySortDirection={setInventorySortDirection}
                      setSearchTerm={setGlobalSearchTerm}
                      applyInventoryFocus={applyInventoryFocus}
                      activosEnFalla={activosEnFalla}
                      duplicateIpEntries={duplicateIpEntries}
                      duplicateMacEntries={duplicateMacEntries}
                      updateInventorySort={updateInventorySort}
                      getInventorySortIndicator={getInventorySortIndicator}
                      sortedFilteredActivos={sortedFilteredActivos}
                      selectedAsset={selectedAsset}
                      setSelectedAsset={setSelectedAsset}
                      selectedAssetQrLoading={selectedAssetQrLoading}
                      selectedAssetQrMode={selectedAssetQrMode}
                      selectedAssetQrIssuedAt={selectedAssetQrIssuedAt}
                      effectiveSelectedAssetQrValue={selectedAssetQrValue}
                      LazyQRCodeCanvas={LazyQRCodeCanvas}
                      buildAssetQrCanvasId={buildAssetQrCanvasId}
                      formatDateTime={formatDateTime}
                      openAssetEditModal={openAssetEditModal}
                      descargarQrActivoSeleccionado={descargarQrActivoSeleccionado}
                      imprimirEtiquetaQrActivoSeleccionado={imprimirEtiquetaQrActivoSeleccionado}
                      eliminarActivo={eliminarActivo}
                      showQrScanner={showQrScanner}
                      qrScannerVideoRef={qrScannerVideoRef}
                      isQrScannerActive={isQrScannerActive}
                      isQrCameraSupported={isQrCameraSupported}
                      qrScannerStatus={qrScannerStatus}
                      qrManualInput={qrManualInput}
                      isResolvingQr={isResolvingQr}
                      resolveQrFromManualInput={resolveQrFromManualInput}
                      importPreviewOpen={!!importDraft}
                      importPreviewFileName={importDraft?.fileName || ''}
                      importPreviewSummary={importDraft?.preview || {
                        totalRows: 0,
                        created: 0,
                        updated: 0,
                        skipped: 0,
                        invalid: 0,
                      }}
                      importPreviewLocalInvalidCount={importDraft?.localInvalidDetails?.length || 0}
                      importIssueRows={importIssueRows}
                      isApplyingImport={isApplyingImport}
                      closeImportPreview={() => setImportDraft(null)}
                      exportImportIssuesCsv={exportImportIssuesCsv}
                      applyImportDraft={() => {
                        void applyImportDraft();
                      }}
                      assetFormModal={{
                        isOpen: isAssetModalOpen,
                        title: getModalTitle('activo', editingAssetId, editingInsumoId),
                        submitLabel: getModalSubmitLabel('activo', isModalSaving, editingAssetId, editingInsumoId),
                        formData,
                        isSaving: isModalSaving,
                        canSubmit: canEdit && !isModalSaving,
                        onClose: closeModal,
                        onSubmit: handleSave,
                        onChange: updateFormData,
                      }}
                    />,
                  ),
                  protectedViewOptions,
                )}
              />
              <Route
                path={VIEW_PATHS.supplies}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Insumos...',
                    <LazySuppliesView
                      canEdit={canEdit}
                      openModal={openModal}
                      supplySummary={supplySummary}
                      supplySearchTerm={supplySearchTerm}
                      setSupplySearchTerm={setSupplySearchTerm}
                      supplyCategoryFilter={supplyCategoryFilter}
                      setSupplyCategoryFilter={setSupplyCategoryFilter}
                      supplyCategoryOptions={supplyCategoryOptions}
                      supplyStatusFilter={supplyStatusFilter}
                      setSupplyStatusFilter={setSupplyStatusFilter}
                      filteredSupplies={filteredSupplies}
                      insumos={insumos}
                      reponerCriticos={reponerCriticos}
                      getSupplyHealthStatus={getSupplyHealthStatus}
                      supplyAuditMovementsByInsumoId={supplyAuditMovementsByInsumoId}
                      openInsumoEditModal={openInsumoEditModal}
                      eliminarInsumo={eliminarInsumo}
                      formatDateTime={formatDateTime}
                      selectedSupplyHistoryItem={selectedSupplyHistoryItem}
                      setSelectedSupplyHistoryItem={setSelectedSupplyHistoryItem}
                      selectedSupplyMovements={selectedSupplyMovements}
                      ajustarStock={ajustarStock}
                      supplyStockDrafts={supplyStockDrafts}
                      setSupplyStockDrafts={setSupplyStockDrafts}
                      confirmarStockManual={confirmarStockManual}
                      insumoFormModal={{
                        isOpen: isSupplyModalOpen,
                        title: getModalTitle('insumo', editingAssetId, editingInsumoId),
                        submitLabel: getModalSubmitLabel('insumo', isModalSaving, editingAssetId, editingInsumoId),
                        formData,
                        isSaving: isModalSaving,
                        canSubmit: canSubmitInsumo,
                        insumoTouched,
                        validationErrors: insumoFormValidation.errors,
                        onClose: closeModal,
                        onSubmit: handleSave,
                        onChange: updateFormData,
                        onTouchField: markInsumoTouched,
                      }}
                    />,
                  ),
                  protectedViewOptions,
                )}
              />
              <Route
                path={VIEW_PATHS.history}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Historial...',
                    <LazyAuditView
                      isAuditLoading={isAuditLoading}
                      auditRowsForGrouping={auditRowsForGrouping}
                      resetAuditFilters={resetAuditFilters}
                      fetchAuditHistory={fetchAuditHistory}
                      descargarAuditoria={descargarAuditoria}
                      auditFilters={auditFilters}
                      updateAuditFilters={updateAuditFilters}
                      auditModuleTotals={auditModuleTotals}
                      auditResultTotals={auditResultTotals}
                      auditIntegrity={auditIntegrity}
                      auditAlerts={auditAlerts}
                      auditByModule={auditByModule}
                      backendConnected={backendConnected}
                      isRequesterOnlyUser={isRequesterOnlyUser}
                      setAuditPage={setAuditPage}
                      auditPagination={auditPagination}
                      auditPageSize={auditPageSize}
                      setAuditPageSize={setAuditPageSize}
                    />,
                  ),
                  protectedViewOptions,
                )}
              />
              <Route
                path={VIEW_PATHS.users}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Usuarios...',
                    <LazyUsersView
                      canManageUsers={canManageUsers}
                      users={users}
                      activeUsersCount={activeUsersCount}
                      ticketEligibleUsersCount={ticketEligibleUsersCount}
                      handleCreateUser={handleCreateUser}
                      editingUserId={editingUserId}
                      newUserForm={newUserForm}
                      setNewUserForm={setNewUserForm}
                      userCargoOptions={userCargoOptions}
                      roleCatalogOptions={roleCatalogOptions}
                      roleFilterOptions={roleFilterOptions}
                      isCreatingUser={isCreatingUser}
                      resetNewUserForm={resetNewUserForm}
                      sortedUsers={sortedUsers}
                      userSearchTerm={userSearchTerm}
                      setUserSearchTerm={setUserSearchTerm}
                      userRoleFilter={userRoleFilter}
                      setUserRoleFilter={setUserRoleFilter}
                      userStatusFilter={userStatusFilter}
                      setUserStatusFilter={setUserStatusFilter}
                      userDepartmentFilter={userDepartmentFilter}
                      setUserDepartmentFilter={setUserDepartmentFilter}
                      formatCargoFromCatalog={formatCargoFromCatalog}
                      roleLabelByValue={roleLabelByValue}
                      rolePermissionsByValue={rolePermissionsByValue}
                      sessionUser={sessionUser}
                      userActionLoadingId={userActionLoadingId}
                      handleEditUser={handleEditUser}
                      handleToggleUserActive={async (user) => {
                        await handleToggleUserActive(user);
                      }}
                      handleDeleteUser={async (user) => {
                        await handleDeleteUser(user);
                      }}
                    />,
                  ),
                  { ...protectedViewOptions, requiresUserManagement: true },
                )}
              />
              <Route
                path={VIEW_PATHS.tickets}
                element={(
                  <TicketsView
                    canCreateTickets={canCreateTickets}
                    canCreateComments={canCreateTickets}
                    canEdit={canEdit}
                    canRequesterDelete={isRequesterOnlyUser}
                    openTicketsCount={openTicketsCount}
                    criticalTicketsCount={criticalTicketsCount}
                    unassignedTicketsCount={unassignedTicketsCount}
                    slaExpiredCount={slaExpiredCount}
                    ticketLifecycleFilter={ticketLifecycleFilter}
                    ticketStateFilter={ticketStateFilter}
                    ticketPriorityFilter={ticketPriorityFilter}
                    ticketAssignmentFilter={ticketAssignmentFilter}
                    ticketSlaFilter={ticketSlaFilter}
                    filteredTickets={filteredTickets}
                    technicians={users}
                    ticketStates={TICKET_STATES}
                    ticketAttentionTypes={TICKET_ATTENTION_TYPES}
                    ticketAttachmentLoadingId={ticketAttachmentLoadingId}
                    ticketCommentDrafts={ticketCommentDrafts}
                    formatTicketBranchFromCatalog={formatTicketBranchFromCatalog}
                    formatCargoFromCatalog={formatCargoFromCatalog}
                    formatDateTime={formatDateTime}
                    formatBytes={formatBytes}
                    normalizeTicketAttentionType={normalizeTicketAttentionType}
                    formatTicketAttentionType={formatTicketAttentionType}
                    getSlaStatus={getSlaStatusForCurrentTime}
                    canDeleteTicket={canDeleteTicket}
                    onOpenTicketModal={openTicketModal}
                    onApplyTicketFocus={applyTicketFocus}
                    onTicketLifecycleFilterChange={setTicketLifecycleFilter}
                    onTicketStateFilterChange={handleTicketStateFilterChange}
                    onTicketPriorityFilterChange={handleTicketPriorityFilterChange}
                    onTicketAssignmentFilterChange={setTicketAssignmentFilter}
                    onTicketSlaFilterChange={setTicketSlaFilter}
                    onResetFilters={resetTicketFilters}
                    onStatusChange={handleStatusChange}
                    onAttentionChange={handleAttentionChange}
                    onTravelChange={handleTravelChange}
                    onAssigneeChange={handleAssigneeChange}
                    onViewAsset={handleViewAssetFromTicket}
                    onResolveTicket={handleResolveTicket}
                    onDeleteTicket={handleDeleteTicket}
                    onUploadAttachment={handleUploadAttachment}
                    onDownloadAttachment={handleDownloadAttachment}
                    onDeleteAttachment={handleDeleteAttachment}
                    onCommentDraftChange={handleCommentDraftChange}
                    onSaveComment={handleSaveComment}
                    ticketFormModal={{
                      isOpen: isTicketModalOpen,
                      title: getModalTitle('ticket', editingAssetId, editingInsumoId),
                      submitLabel: getModalSubmitLabel('ticket', isModalSaving, editingAssetId, editingInsumoId),
                      formData,
                      isSaving: isModalSaving,
                      canSubmit: canCreateTickets && !isModalSaving,
                      activeTicketBranches,
                      ticketAssetOptions,
                      selectedIssueArea,
                      issueOptionsForSelectedArea,
                      selectedTicketAssetContext,
                      sessionUser,
                      onClose: closeModal,
                      onSubmit: handleSave,
                      onChange: updateFormData,
                    }}
                  />
                )}
              />
              <Route path="*" element={<Navigate to={defaultViewPath} replace />} />
            </Routes>
          </div>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          title={confirmState.title}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={onConfirmAccept}
          onCancel={onConfirmCancel}
        />
      )}
      {promptState && (
        <PromptDialog
          message={promptState.message}
          title={promptState.title}
          defaultValue={promptState.defaultValue}
          onConfirm={onPromptAccept}
          onCancel={onPromptCancel}
        />
      )}

    </div>
  );
}
