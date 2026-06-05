import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import { useAuthActions } from './hooks/actions/useAuthActions';
import { useSessionActions } from './hooks/actions/useSessionActions';
import { useSupplyActions } from './hooks/actions/useSupplyActions';
import { useTicketActions } from './hooks/actions/useTicketActions';
import { useUserActions } from './hooks/actions/useUserActions';
import { useDialogs } from './hooks/useDialogs';
import { useSupplyMetrics } from './hooks/metrics/useSupplyMetrics';
import { useInventoryMetrics } from './hooks/metrics/useInventoryMetrics';
import { useUserMetrics } from './hooks/metrics/useUserMetrics';
import { useInventoryImport } from './hooks/useInventoryImport';
import { useReportExports } from './hooks/useReportExports';
import { useDashboardMetrics } from './hooks/metrics/useDashboardMetrics';
import { useReportMetrics } from './hooks/metrics/useReportMetrics';

import { Toast } from './components/ui/Toast';
import { ConfirmDialog } from './components/modals/ConfirmDialog';
import { PromptDialog } from './components/modals/PromptDialog';
import { LoginView } from './components/views/LoginView';
import { TicketsView } from './components/views/TicketsView';
import {
  AUTHOR_BRAND,
  AUTHOR_SIGNATURE,
  DEFAULT_CATALOGS,
  NAV_ITEMS,
  TICKET_ATTENTION_TYPES,
  TICKET_STATES,
  USER_ROLE_LABEL,
  USER_ROLE_PERMISSIONS,
} from './constants/app';
import type {
  Activo,
  AssetQrTokenResponse,
  AuditFiltersState,
  AuditHistoryResponse,
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
  TicketItem,
  ViewType,
  UserRole,
} from './types/app';
import {
  apiRequest,
  applyThemeToDocument,
  buildDefaultAuditFilters,
  buildDefaultAuditPagination,
  buildDefaultReportFilterSnapshot,
  normalizeReportFilterSnapshot,
  readStoredReportFilterPresets,
  writeStoredReportFilterPresets,
} from './utils/app';
import {
  auditModuleLabel,
  buildSupplyAuditMovementsByInsumoId,
  filterAuditRowsClient,
  resolveAuditModule,
} from './utils/audit';
import {
  formatTicketBranch,
  formatUserCargo,
  resolveAssetBranchCode,
} from './utils/assets';
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
  includesAllSearchTokens,
  isRouteNotFoundApiError,
  isSessionRejectedApiError,
  normalizeForCompare,
  sanitizeFileToken,
  tokenizeSearchQuery,
} from './utils/format';
import {
  buildSuggestedTicketIssues,
  buildTicketAssetContextSummary,
  formatTicketAttentionType,
  getSlaStatus,
  isTicketSlaExpired,
  isTicketClosed,
  normalizeTicketAttentionType,
} from './utils/tickets';


import {
  buildAssetQrCanvasId,
} from './utils/qrTokens';

import {
  ticketTimestamp,
  formatTravelNumber,
  ticketBelongsToSessionUser,
  getModalTitle,
  getModalSubmitLabel,
  getSupplyHealthStatus,
} from './utils/appHelpers';
import { buildAssetLabelHtml } from './utils/printing/assetLabel';

const LazyUsersView = lazy(() => import('./components/views/UsersView'));
const LazyDashboardView = lazy(() => import('./components/views/DashboardView'));
const LazyReportsView = lazy(() => import('./components/views/ReportsView'));
const LazyInventoryView = lazy(() => import('./components/views/InventoryView'));
const LazySuppliesView = lazy(() => import('./components/views/SuppliesView'));
const LazyAuditView = lazy(() => import('./components/views/AuditView'));

const VIEW_PATHS: Record<ViewType, string> = {
  dashboard: '/dashboard',
  reports: '/reports',
  inventory: '/inventory',
  supplies: '/supplies',
  tickets: '/tickets',
  history: '/history',
  users: '/users',
};

function getViewPath(view: ViewType): string {
  return VIEW_PATHS[view];
}

function getViewFromPathname(pathname: string): ViewType | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = (Object.entries(VIEW_PATHS) as Array<[ViewType, string]>)
    .find(([, path]) => path === normalized);
  return match?.[0] || null;
}


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
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sessionUser,
    globalSearchTerm,
    setGlobalSearchTerm,
    clearGlobalSearchTerm,
    theme,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
    backendConnected,
    toast,
    setToast,
    showToast,
    clearToast,
    showConfirm,
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
  const routeView = useMemo(
    () => getViewFromPathname(location.pathname),
    [location.pathname],
  );
  const defaultView: ViewType = isRequesterOnlyUser ? 'tickets' : 'dashboard';
  const accessibleRouteView = useMemo(() => {
    if (routeView === null) return null;
    if (routeView === 'users') return canManageUsers ? routeView : null;
    if (routeView !== 'tickets' && isRequesterOnlyUser) return null;
    return routeView;
  }, [canManageUsers, isRequesterOnlyUser, routeView]);
  const view: ViewType = accessibleRouteView ?? defaultView;
  const isDashboardView = view === 'dashboard';
  const isReportsView = view === 'reports';
  const setView = useCallback(
    (nextView: ViewType, options?: { replace?: boolean }) => {
      const nextPath = getViewPath(nextView);
      if (location.pathname === nextPath && !options?.replace) return;
      navigate(nextPath, { replace: options?.replace ?? false });
    },
    [location.pathname, navigate],
  );
  const activeTicketBranches = useMemo(
    () => catalogos.sucursales.filter((branch) => branch.activo !== false),
    [catalogos],
  );
  const activeTicketBranchCodes = useMemo(
    () => new Set(activeTicketBranches.map((branch) => branch.code)),
    [activeTicketBranches],
  );
  const ticketBranchLabelByCode = useMemo(() => {
    const labels: Record<string, string> = {};
    activeTicketBranches.forEach((branch) => {
      labels[branch.code] = `${branch.code} - ${branch.name}`;
    });
    return labels;
  }, [activeTicketBranches]);
  const ticketAssetOptions = useMemo(() => {
    const selectedBranch = String(formData.sucursal || '').trim().toUpperCase();
    if (!selectedBranch) return [] as Array<{ tag: string; label: string }>;

    const seenTags = new Set<string>();
    return activos
      .filter((asset) => resolveAssetBranchCode(asset, activeTicketBranchCodes) === selectedBranch)
      .sort((left, right) => String(left.tag || '').localeCompare(String(right.tag || '')))
      .map((asset) => {
        const tag = String(asset.tag || '').trim().toUpperCase();
        if (!tag || seenTags.has(tag)) return null;
        seenTags.add(tag);
        const tipo = String(asset.tipo || asset.equipo || 'EQUIPO').trim().toUpperCase() || 'EQUIPO';
        const ubicacion = String(asset.ubicacion || '').trim().toUpperCase() || 'SIN UBICACION';
        return {
          tag,
          label: `${tag} | ${tipo} | ${ubicacion}`,
        };
      })
      .filter((item): item is { tag: string; label: string } => !!item);
  }, [activos, activeTicketBranchCodes, formData.sucursal]);
  const selectedTicketAsset = useMemo(() => {
    const selectedBranch = String(formData.sucursal || '').trim().toUpperCase();
    const selectedTag = String(formData.activoTag || '').trim().toUpperCase();
    if (!selectedBranch || !selectedTag) return null;

    return activos.find((asset) => {
      const assetTag = String(asset.tag || '').trim().toUpperCase();
      return assetTag === selectedTag && resolveAssetBranchCode(asset, activeTicketBranchCodes) === selectedBranch;
    }) || null;
  }, [activos, activeTicketBranchCodes, formData.activoTag, formData.sucursal]);
  const selectedTicketAssetContext = useMemo(
    () => buildTicketAssetContextSummary(selectedTicketAsset, activeTicketBranchCodes),
    [activeTicketBranchCodes, selectedTicketAsset],
  );
  const userCargoOptions = useMemo(
    () =>
      catalogos.cargos
        .map((label) => {
          const text = String(label || '').trim();
          if (!text) return null;
          return {
            value: text.toUpperCase(),
            label: text,
          };
        })
        .filter((item): item is { value: string; label: string } => !!item),
    [catalogos],
  );
  const userCargoLabelByValue = useMemo(
    () =>
      userCargoOptions.reduce(
        (acc, cargo) => ({ ...acc, [cargo.value]: cargo.label }),
        {} as Record<string, string>,
      ),
    [userCargoOptions],
  );
  const roleCatalogOptions = useMemo(
    () => {
      const active = catalogos.roles.filter((role) => {
        const value = String(role.value || '').trim().toLowerCase();
        return isUserRole(value) && role.activo !== false;
      });
      return active.length > 0 ? active : DEFAULT_CATALOGS.roles;
    },
    [catalogos],
  );
  const roleFilterOptions = useMemo(
    () => {
      const known = catalogos.roles.filter((role) => {
        const value = String(role.value || '').trim().toLowerCase();
        return isUserRole(value);
      });
      return known.length > 0 ? known : DEFAULT_CATALOGS.roles;
    },
    [catalogos],
  );
  const roleLabelByValue = useMemo(
    () =>
      catalogos.roles.reduce((acc, role) => {
        const value = String(role.value || '').trim().toLowerCase();
        if (!isUserRole(value)) return acc;
        return {
          ...acc,
          [value]: String(role.label || USER_ROLE_LABEL[value]).trim() || USER_ROLE_LABEL[value],
        };
      }, {} as Record<UserRole, string>),
    [catalogos],
  );
  const rolePermissionsByValue = useMemo(
    () =>
      catalogos.roles.reduce((acc, role) => {
        const value = String(role.value || '').trim().toLowerCase();
        if (!isUserRole(value)) return acc;
        return {
          ...acc,
          [value]: String(role.permissions || USER_ROLE_PERMISSIONS[value]).trim() || USER_ROLE_PERMISSIONS[value],
        };
      }, {} as Record<UserRole, string>),
    [catalogos],
  );
  const isValidTicketBranchValue = useCallback(
    (value?: string) => {
      const code = String(value || '').trim().toUpperCase();
      return activeTicketBranches.some((branch) => branch.code === code);
    },
    [activeTicketBranches],
  );
  const formatTicketBranchFromCatalog = useCallback(
    (value?: string) => formatTicketBranch(value, ticketBranchLabelByCode),
    [ticketBranchLabelByCode],
  );
  const formatCargoFromCatalog = useCallback(
    (value?: string) => formatUserCargo(value, userCargoLabelByValue),
    [userCargoLabelByValue],
  );

  const visibleNavItems = useMemo(() => {
    if (isRequesterOnlyUser) return NAV_ITEMS.filter((item) => item.id === 'tickets');
    return canManageUsers ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.id !== 'users');
  }, [canManageUsers, isRequesterOnlyUser]);
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
  } = useAuthActions({ clearSession });

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
    onAfterBulkDelete: () => setSelectedAsset(null),
  });

  const {
    handleSaveInsumo,
    eliminarInsumo,
    ajustarStock,
    reponerCriticos,
    confirmarStockManual,
  } = useSupplyActions({
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

    const printWindow = window.open('', '_blank', 'width=580,height=420');
    if (!printWindow) {
      showToast('Permite ventanas emergentes para imprimir etiquetas', 'warning');
      return;
    }

    const qrDataUrl = qrCanvas.toDataURL('image/png');
    const html = buildAssetLabelHtml({
      asset: selectedAsset,
      branchCodes: activeTicketBranchCodes,
      qrDataUrl,
    });
    printWindow.document.write(html);
    printWindow.document.close();

    let didPrint = false;
    const triggerPrint = () => {
      if (didPrint) return;
      didPrint = true;
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };

    printWindow.onload = triggerPrint;
    window.setTimeout(triggerPrint, 450);
  }, [activeTicketBranchCodes, selectedAssetQrValue, selectedAsset, selectedAssetQrMode, showToast]);

  const fetchAllAuditRows = useCallback(async (filters: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const normalized = String(value).trim();
      if (!normalized) return;
      params.set(key, normalized);
    });
    params.set('all', '1');
    params.set('includeDiagnostics', '0');

    const query = params.toString();
    const data = await apiRequest<AuditHistoryResponse>(`/auditoria${query ? `?${query}` : ''}`);
    return Array.isArray(data.items) ? data.items : [];
  }, []);

  const fetchAuditHistory = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    if (!sessionUser) return;
    if (!backendConnected && !force) return;
    if (isRequesterOnlyUser) return;
    if (view !== 'history') return;

    setIsAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditFilters.module) params.set('module', auditFilters.module);
      if (auditFilters.result) params.set('result', auditFilters.result);
      if (auditFilters.user.trim()) params.set('user', auditFilters.user.trim());
      if (auditFilters.entity.trim()) params.set('entity', auditFilters.entity.trim());
      if (auditFilters.action.trim()) params.set('action', auditFilters.action.trim());
      if (auditFilters.q.trim()) params.set('q', auditFilters.q.trim());
      if (auditFilters.from) params.set('from', auditFilters.from);
      if (auditFilters.to) params.set('to', auditFilters.to);
      params.set('page', String(auditPage));
      params.set('pageSize', String(auditPageSize));

      const query = params.toString();
      const data = await apiRequest<AuditHistoryResponse>(`/auditoria${query ? `?${query}` : ''}`);
      setAuditRemoteRows(Array.isArray(data.items) ? data.items : []);
      setAuditPagination(data.pagination || buildDefaultAuditPagination(auditPageSize));
      setAuditSummary(data.summary || null);
      setAuditIntegrity(data.integrity || null);
      setAuditAlerts(data.alerts || null);
    } catch (error) {
      if (isSessionRejectedApiError(error)) {
        clearSession();
        showToast('La sesión ya no es válida. Inicia sesión nuevamente.', 'warning');
        return;
      }
      if (!isRouteNotFoundApiError(error)) {
        showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditoría', 'warning');
      }
      setAuditRemoteRows(null);
      setAuditPagination(buildDefaultAuditPagination(auditPageSize));
      setAuditSummary(null);
      setAuditIntegrity(null);
      setAuditAlerts(null);
    } finally {
      setIsAuditLoading(false);
    }
  }, [
    auditFilters.action,
    auditFilters.entity,
    auditFilters.from,
    auditFilters.module,
    auditFilters.q,
    auditFilters.result,
    auditFilters.to,
    auditFilters.user,
    auditPage,
    auditPageSize,
    backendConnected,
    clearSession,
    isRequesterOnlyUser,
    sessionUser,
    setAuditAlerts,
    setAuditIntegrity,
    setAuditPagination,
    setAuditRemoteRows,
    setAuditSummary,
    setIsAuditLoading,
    showToast,
    view,
  ]);

  useEffect(() => {
    fetchAuditHistoryRef.current = fetchAuditHistory;
  }, [fetchAuditHistory]);

  useEffect(() => {
    if (view !== 'history') return;
    void fetchAuditHistory();
  }, [view, fetchAuditHistory]);

  useEffect(() => {
    let cancelled = false;

    if (view !== 'reports' || !sessionUser || !backendConnected || isRequesterOnlyUser) {
      setReportAuditRowsRemote(null);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const rows = await fetchAllAuditRows({
          from: reportDateFrom,
          to: reportDateTo,
        });
        if (cancelled) return;
        setReportAuditRowsRemote(rows);
      } catch (error) {
        if (cancelled) return;
        if (isSessionRejectedApiError(error)) {
          clearSession();
          showToast('La sesión ya no es válida. Inicia sesión nuevamente.', 'warning');
          return;
        }
        if (!isRouteNotFoundApiError(error)) {
          showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditoría', 'warning');
        }
        setReportAuditRowsRemote(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnected,
    clearSession,
    fetchAllAuditRows,
    isRequesterOnlyUser,
    reportDateFrom,
    reportDateTo,
    sessionUser,
    setReportAuditRowsRemote,
    showToast,
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
      try {
        const rows = await fetchAllAuditRows({
          module: 'insumos',
          entity: 'insumo',
          entityId: selectedSupplyHistoryItem.id,
        });
        if (cancelled) return;
        const grouped = buildSupplyAuditMovementsByInsumoId(rows, insumos);
        setSelectedSupplyHistoryRemoteMovements(grouped[selectedSupplyHistoryItem.id] || []);
      } catch (error) {
        if (cancelled) return;
        if (isSessionRejectedApiError(error)) {
          clearSession();
          showToast('La sesión ya no es válida. Inicia sesión nuevamente.', 'warning');
          return;
        }
        setSelectedSupplyHistoryRemoteMovements(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnected,
    clearSession,
    fetchAllAuditRows,
    insumos,
    isRequesterOnlyUser,
    selectedSupplyHistoryItem,
    sessionUser,
    setSelectedSupplyHistoryRemoteMovements,
    showToast,
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
    importIssueRows,
  } = useInventoryImport({
    isReadOnly,
    ensureBackendConnected,
    sessionUser,
    importDraft,
    isApplyingImport,
    refreshData,
    setIsImportingInventory,
    setImportDraft,
    setIsApplyingImport,
    showToast,
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
    duplicateIpEntries,
    duplicateMacEntries,
    departamentoOptions,
    equipoOptions,
    filteredActivos,
    sortedFilteredActivos,
  } = useInventoryMetrics({
    activos,
    inventoryDepartmentFilter,
    inventoryEquipmentFilter,
    inventoryStatusFilter,
    inventoryRiskFilter,
    inventorySortField,
    inventorySortDirection,
    headerSearchTokens,
  });
  const { sortedUsers, activeUsersCount, ticketEligibleUsersCount } = useUserMetrics({
    users,
    userRoleFilter,
    userStatusFilter,
    userDepartmentFilter,
    userSearchTokens,
    userCargoLabelByValue,
    roleLabelByValue,
    rolePermissionsByValue,
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

    const headers = [
      'TAG',
      'SERIAL',
      'ID_INTERNO',
      'TIPO',
      'MARCA',
      'MODELO',
      'ESTADO',
      'RESPONSABLE',
      'DEPARTAMENTO',
      'UBICACION',
      'IP',
      'MAC',
      'CPU',
      'RAM',
      'DISCO',
      'ANIOS_VIDA',
      'COMENTARIOS',
    ];
    const rows = filteredActivos.map((asset) => [
      asset.tag,
      asset.serial,
      asset.idInterno || '',
      asset.tipo,
      asset.marca,
      asset.modelo || '',
      asset.estado,
      asset.responsable || '',
      asset.departamento || '',
      asset.ubicacion || '',
      asset.ipAddress || '',
      asset.macAddress || '',
      asset.cpu || '',
      asset.ram || '',
      asset.disco || '',
      asset.aniosVida || '',
      asset.comentarios || '',
    ]);
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [filteredActivos, showToast]);

  const { supplySummary, supplyCategoryOptions, filteredSupplies } = useSupplyMetrics({
    insumos,
    supplyCategoryFilter,
    supplyStatusFilter,
    supplySearchTokens,
  });


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

    const headers = ['Módulo', 'Fecha', 'Usuario', 'Acción', 'Item', 'Cantidad', 'Resultado', 'Entidad', 'RequestId'];
    const rows = rowsSource.map((log) => [
      auditModuleLabel(log.modulo || 'otros'),
      log.fecha,
      log.usuario,
      log.accion,
      log.item,
      String(log.cantidad),
      log.resultado || 'ok',
      log.entidad || '',
      log.requestId || '',
    ]);
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = module ? `_${module}` : '_general';
    link.download = `auditoria_it${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
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

  const canAccessTicketBySession = useCallback(
    (ticket: TicketItem) => ticketBelongsToSessionUser(ticket, sessionUser),
    [sessionUser],
  );
  const canDeleteTicket = useCallback(
    (ticket: TicketItem): boolean => {
      if (canEdit) return true;
      if (!isRequesterOnlyRole(sessionUser?.rol)) return false;
      if (!canAccessTicketBySession(ticket)) return false;
      return ticket.estado === 'Abierto';
    },
    [canAccessTicketBySession, canEdit, sessionUser?.rol],
  );
  const getSlaStatusForCurrentTime = useCallback(
    (ticket: TicketItem) => getSlaStatus(ticket, liveNow),
    [liveNow],
  );
  const scopedTickets = useMemo(
    () => (isRequesterOnlyUser ? tickets.filter(canAccessTicketBySession) : tickets),
    [canAccessTicketBySession, isRequesterOnlyUser, tickets],
  );

  const isTicketOpen = useCallback((ticket: TicketItem): boolean => !isTicketClosed(ticket), []);
  const openTickets = useMemo(
    () => scopedTickets.filter(isTicketOpen),
    [scopedTickets, isTicketOpen],
  );
  const openTicketsCount = openTickets.length;
  const slaExpiredCount = useMemo(
    () => openTickets.filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length,
    [openTickets, liveNow],
  );
  const criticalTicketsCount = useMemo(
    () => openTickets.filter((t) => t.prioridad === 'CRITICA').length,
    [openTickets],
  );
  const unassignedTicketsCount = useMemo(
    () => openTickets.filter((t) => !(t.asignadoA || '').trim()).length,
    [openTickets],
  );

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
    isTicketOpen,
    dashboardRange,
    liveNow,
    isDashboardView,
    formatTicketBranchFromCatalog,
  });

  const filteredTickets = useMemo(() => {
    const rows = scopedTickets.filter((ticket) => {
      if (ticketLifecycleFilter === 'ABIERTOS' && !isTicketOpen(ticket)) return false;
      if (ticketLifecycleFilter === 'CERRADOS' && isTicketOpen(ticket)) return false;
      if (ticketStateFilter !== 'TODOS' && ticket.estado !== ticketStateFilter) return false;
      if (ticketPriorityFilter !== 'TODAS' && ticket.prioridad !== ticketPriorityFilter) return false;
      if (ticketAssignmentFilter === 'ASIGNADOS' && !(ticket.asignadoA || '').trim()) return false;
      if (ticketAssignmentFilter === 'SIN_ASIGNAR' && (ticket.asignadoA || '').trim()) return false;
      if (ticketSlaFilter === 'VENCIDO' && !isTicketSlaExpired(ticket, liveNow)) return false;

      if (headerSearchTokens.length === 0) return true;
      const searchable = normalizeForCompare([
        ticket.activoTag,
        ticket.descripcion,
        ticket.asignadoA || '',
        formatTicketBranchFromCatalog(ticket.sucursal),
        formatTicketAttentionType(ticket.atencionTipo),
      ].join(' '));
      return includesAllSearchTokens(searchable, headerSearchTokens);
    });

    rows.sort((a, b) => {
      const leftExpired = isTicketSlaExpired(a, liveNow) ? 1 : 0;
      const rightExpired = isTicketSlaExpired(b, liveNow) ? 1 : 0;
      if (leftExpired !== rightExpired) return rightExpired - leftExpired;
      return ticketTimestamp(b) - ticketTimestamp(a);
    });
    return rows;
  }, [
    formatTicketBranchFromCatalog,
    headerSearchTokens,
    liveNow,
    scopedTickets,
    isTicketOpen,
    ticketAssignmentFilter,
    ticketLifecycleFilter,
    ticketPriorityFilter,
    ticketSlaFilter,
    ticketStateFilter,
  ]);

  const reportMetrics = useReportMetrics({
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
  });
  const {
    reportComparisonWindow,
    reportBranchOptions,
    reportAreaOptions,
    reportTechnicianOptions,
    travelTechnicianOptions,
    travelDestinationRules,
    effectiveTravelReporterName,
    travelSuggestedTripsByCode,
    travelTotalTrips,
    travelTotalKms,
    travelFuelEfficiencyValue,
    travelFuelLiters,
    travelMonthLabel,
    reportTickets,
    reportTrendMode,
    reportLifecycleTrend,
    reportLifecycleTrendMax,
    reportCreatedInPeriodCount,
    reportClosedInPeriodCount,
    reportOpenCount,
    reportClosedCount,
    reportSlaExpiredCount,
    reportSlaTotalCount,
    reportSlaCompliantCount,
    reportSlaCompliancePct,
    reportTicketsTrend,
    reportOpenTrend,
    reportSlaComplianceTrend,
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
  } = reportMetrics;

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
  const {
    exportReportExcel,
    exportReportPdf,
    openReportExecutivePresentation,
    openTravelMovementSheet,
    printTravelMovementSheet,
  } = useReportExports({
    metrics: reportMetrics,
    reportDateFrom,
    reportDateTo,
    reportBranchFilter,
    reportAreaFilter,
    reportStateFilter,
    reportPriorityFilter,
    reportAttentionFilter,
    reportTechnicianFilter,
    travelReportDepartment,
    travelReportAuthorizer,
    travelReportFinance,
    sessionUser,
    liveNow,
    formatTicketBranchFromCatalog,
    showToast,
  });
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
  const defaultViewPath = getViewPath(defaultView);
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
            <div className="max-w-7xl mx-auto mb-4 px-3 py-2 sm:px-4 sm:py-3 rounded-2xl bg-[#f4fce3] border border-[#d8f5a2] text-[#4a7f10] text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
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
