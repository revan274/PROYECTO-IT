import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { Toast } from './components/ui/Toast';
import { LoginView } from './components/views/LoginView';
import { TicketsView } from './components/views/TicketsView';
import {
  AUTHOR_BRAND,
  AUTHOR_SIGNATURE,
  CATEGORIAS_INSUMO,
  DEFAULT_CATALOGS,
  NAV_ITEMS,
  TICKET_ATTENTION_TYPES,
  TICKET_STATES,
  TRAVEL_DEFAULT_AUTHORIZER,
  TRAVEL_DEFAULT_DEPARTMENT,
  TRAVEL_DEFAULT_FINANCE,
  TRAVEL_DEFAULT_FUEL_EFFICIENCY,
  TRAVEL_DESTINATION_PRESETS,
  TRAVEL_REPORT_MIN_ROWS,
  USER_ROLE_LABEL,
  USER_ROLE_PERMISSIONS,
} from './constants/app';
import type {
  Activo,
  AssetQrTokenResponse,
  AuditFiltersState,
  AuditHistoryResponse,
  AuditModule,
  CatalogBranch,
  DashboardRange,
  ImportAssetDetail,
  ImportAssetsResponse,
  InventoryRiskFilter,
  InventorySortField,
  ModalType,
  PrioridadTicket,
  RegistroAuditoria,
  ReportFilterPreset,
  ReportFilterSnapshot,
  SupplyAuditMovement,
  TicketEstado,
  TicketItem,
  TravelDestinationRule,
  TravelTripAdjustment,
  TravelTripAdjustmentResponse,
  ViewType,
  TravelReportRow,
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
  getAuditRowTimestampMs,
  resolveAuditModule,
} from './utils/audit';
import {
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  calculateAssetRiskSummary,
  enrichAssetsWithNetworkSheet,
  formatTicketBranch,
  formatUserCargo,
  isUserRole,
  parseNetworkSheetRows,
  parseAssetLifeYears,
  resolveAssetBranchCode,
  spreadsheetCellToText,
} from './utils/assets';
import {
  escapeHtml,
  formatBytes,
  formatDateTime,
  getApiErrorMessage,
  includesAllSearchTokens,
  isRouteNotFoundApiError,
  isSessionRejectedApiError,
  normalizeForCompare,
  parseDateToTimestamp,
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
  ticketCreatedTimestamp,
  parseMonthInputRange,
  formatMonthInputLabel,
  formatTravelDate,
  compactBranchLabel,
  buildTravelReportRowsFromActualTrips,
  parseNonNegativeNumber,
  roundToTwoDecimals,
  formatTravelNumber,
  parseTicketTravelCreatedAt,
  resolveTravelTechnicianScope,
  resolveTicketTravelDestinationCode,
  getTicketAreaLabel,
  extractTicketIssueDescription,
  normalizeIncidentCause,
  matchesReportBranch,
  matchesReportArea,
  matchesReportState,
  matchesReportPriority,
  matchesReportAttention,
  matchesReportTechnician,
  collectResolutionHours,
  startOfLocalDayTimestamp,
  startOfLocalWeekTimestamp,
  resolveDashboardRangeWindow,
  formatDashboardTrend,
  formatMetricTrend,
  roundHours,
  calculatePercentile,
  calculateMedian,
  ticketBelongsToSessionUser,
  getModalTitle,
  getModalSubmitLabel,
  getSupplyHealthStatus,
  getSupplyCriticalityRank,
  parseInventoryRow,
} from './utils/appHelpers';

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

type SpreadsheetRow = Record<string, unknown>;
type NetworkSheetRow = unknown[];

const LazyQRCodeCanvas = lazy(async () => {
  const module = await import('qrcode.react');
  return { default: module.QRCodeCanvas };
});

function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
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
  } = useAppStore();
  const searchTerm = globalSearchTerm;
  const setSearchTerm = setGlobalSearchTerm;
  const clearSearchTerm = clearGlobalSearchTerm;

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
    travelKmsByBranch,
    setTravelKmsByBranch,
    travelAdjustments,
    setTravelAdjustments,
    travelTripDrafts,
    setTravelTripDrafts,
    travelSavingCode,
    setTravelSavingCode,
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
  const effectiveSelectedAssetQrValue = selectedAssetQrValue;

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    setLiveNow(Date.now());
    const intervalId = window.setInterval(() => setLiveNow(Date.now()), 60000);
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
        if (!token) throw new Error('QR token vacÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­o');

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

  const canEdit = sessionUser?.rol === 'admin' || sessionUser?.rol === 'tecnico';
  const canCreateTickets = canEdit || sessionUser?.rol === 'solicitante';
  const canSubmitInsumo = canEdit && insumoFormValidation.isValid && !isModalSaving;
  const isAssetModalOpen = showModal === 'activo';
  const isSupplyModalOpen = showModal === 'insumo';
  const isTicketModalOpen = showModal === 'ticket';
  const canManageUsers = sessionUser?.rol === 'admin';
  const isReadOnly = !canEdit;
  const isRequesterOnlyUser = sessionUser?.rol === 'solicitante';
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
    setTravelKmsByBranch,
    setTravelAdjustments,
    setTravelTripDrafts,
    setTravelSavingCode,
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
    setTravelAdjustments,
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
    setSearchTerm(asset.tag);
    setSelectedAsset(asset);
  }, [setSearchTerm, setSelectedAsset, setView]);

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
    if (selectedAssetQrMode !== 'signed' || !effectiveSelectedAssetQrValue) {
      showToast('El QR firmado no esta disponible para descargar.', 'warning');
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
  }, [effectiveSelectedAssetQrValue, selectedAsset, selectedAssetQrMode, showToast]);

  const imprimirEtiquetaQrActivoSeleccionado = useCallback(() => {
    if (!selectedAsset) return;
    if (selectedAssetQrMode !== 'signed' || !effectiveSelectedAssetQrValue) {
      showToast('El QR firmado no esta disponible para imprimir.', 'warning');
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
    const tagRaw = String(selectedAsset.tag || `ID-${selectedAsset.id}`).trim();
    const ubicacionRaw = String(selectedAsset.ubicacion || '').trim() || 'Ubicacion no registrada';
    const serialRaw = String(selectedAsset.serial || '').trim() || 'Sin serie';
    const equipmentRaw = [
      String(selectedAsset.equipo || '').trim(),
      String(selectedAsset.marca || '').trim(),
      String(selectedAsset.modelo || '').trim(),
    ].filter(Boolean).join(' ') || 'Sin especificacion';
    const branchCode = resolveAssetBranchCode(selectedAsset, activeTicketBranchCodes);
    const branchRaw = branchCode || String(selectedAsset.departamento || '').trim().toUpperCase();
    const ubicacionFullRaw = [branchRaw, ubicacionRaw]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(' | ') || ubicacionRaw;
    const idAssetRaw = String(selectedAsset.id || 'N/D');
    const internalCodeSourceRaw = String(selectedAsset.idInterno || '').trim() || idAssetRaw;
    const internalCodeDigits = (internalCodeSourceRaw.match(/\d+/g) || []).join('');
    const internalCodeRaw = (internalCodeDigits || String(selectedAsset.id || '0')).slice(-2).padStart(2, '0');
    const headerLabelRaw = 'Activo IT';
    const brandLabelRaw = 'Los Gigantes';
    const footerNoteRaw = 'Escanea para identificar';

    const tag = escapeHtml(tagRaw);
    const ubicacion = escapeHtml(ubicacionFullRaw);
    const serial = escapeHtml(serialRaw);
    const equipo = escapeHtml(equipmentRaw);
    const idAsset = escapeHtml(idAssetRaw);
    const headerLabel = escapeHtml(headerLabelRaw);
    const brandLabel = escapeHtml(brandLabelRaw);
    const footerNote = escapeHtml(footerNoteRaw);
    const internalCode = escapeHtml(internalCodeRaw);

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta QR ${tag}</title>
  <style>
    @page { size: 60mm 40mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 60mm;
      height: 40mm;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
    }
    * {
      box-sizing: border-box;
    }
    .label {
      width: 60mm;
      height: 40mm;
      padding: 1.3mm 1.35mm 1.15mm;
      border: 0.25mm solid #111827;
      border-radius: 1.2mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background:
        linear-gradient(180deg, #fff7ed 0, #fff7ed 5.8mm, #ffffff 5.8mm, #ffffff 100%);
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1mm;
      margin-bottom: 1mm;
    }
    .header-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35mm;
    }
    .eyebrow {
      margin: 0;
      font-size: 2.95pt;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #f97316;
      line-height: 1;
    }
    .brand {
      margin: 0;
      font-size: 5.8pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .brand-sub {
      margin: 0;
      font-size: 3pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
    }
    .code-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 10.8mm;
      height: 4.9mm;
      padding: 0 1.35mm;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 3.25pt;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .main {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 21.2mm;
      gap: 1.3mm;
      align-items: stretch;
    }
    .details {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65mm;
    }
    .tag-wrap {
      min-width: 0;
      padding: 0.75mm 0.95mm 0.8mm;
      border: 0.18mm solid #e2e8f0;
      border-radius: 0.95mm;
      background: #ffffff;
    }
    .tag-caption {
      margin: 0 0 0.35mm;
      font-size: 2.7pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #94a3b8;
    }
    .tag {
      margin: 0;
      font-size: 10.9pt;
      font-weight: 900;
      line-height: 0.92;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 10.6mm;
      max-height: 11.8mm;
      color: #0f172a;
    }
    .detail-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.55mm;
    }
    .detail-card {
      min-width: 0;
      border: 0.18mm solid #dbe2ea;
      border-radius: 0.9mm;
      padding: 0.7mm 0.85mm;
      background: #f8fafc;
    }
    .detail-k {
      margin: 0 0 0.28mm;
      font-size: 2.75pt;
      line-height: 1;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748b;
    }
    .detail-v {
      margin: 0;
      font-size: 4.55pt;
      line-height: 1.04;
      font-weight: 900;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0f172a;
    }
    .equipment {
      min-width: 0;
      margin: 0;
      font-size: 3.35pt;
      line-height: 1.1;
      font-weight: 900;
      text-transform: uppercase;
      color: #475569;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 4.2mm;
    }
    .qr-panel {
      min-height: 0;
      border: 0.22mm solid #111827;
      border-radius: 1.05mm;
      background: #ffffff;
      padding: 0.8mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 0.6mm;
    }
    .qr-frame {
      flex: 1;
      width: 100%;
      min-height: 0;
      border: 0.16mm solid #cbd5e1;
      border-radius: 0.8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.55mm;
      background: #ffffff;
    }
    .qr {
      width: 19.2mm;
      height: 19.2mm;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .qr-label {
      margin: 0;
      font-size: 2.8pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #64748b;
    }
    .scan-pill {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 4.1mm;
      padding: 0 1mm;
      border-radius: 999px;
      background: #f97316;
      color: #ffffff;
      font-size: 2.95pt;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .footer {
      margin-top: auto;
      padding-top: 0.6mm;
      border-top: 0.16mm solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8mm;
    }
    .footer-note {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 3.1pt;
      line-height: 1.05;
      font-weight: 900;
      text-transform: uppercase;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .id-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 11.1mm;
      height: 4.5mm;
      padding: 0 1.25mm;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 3.25pt;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="header-copy">
        <p class="eyebrow">${headerLabel}</p>
        <p class="brand">${brandLabel}</p>
        <p class="brand-sub">Mesa IT</p>
      </div>
      <span class="code-chip">#${internalCode}</span>
    </div>
    <div class="main">
      <div class="details">
        <div class="tag-wrap">
          <p class="tag-caption">Tag del activo</p>
          <p class="tag">${tag}</p>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <p class="detail-k">Serie</p>
            <p class="detail-v">${serial}</p>
          </div>
          <div class="detail-card">
            <p class="detail-k">Ubicacion</p>
            <p class="detail-v">${ubicacion}</p>
          </div>
        </div>
        <p class="equipment">${equipo}</p>
      </div>
      <div class="qr-panel">
        <p class="qr-label">QR firmado</p>
        <div class="qr-frame">
          <img class="qr" src="${qrDataUrl}" alt="QR ${tag}" />
        </div>
        <span class="scan-pill">Escanear</span>
      </div>
    </div>
    <div class="footer">
      <p class="footer-note">${footerNote}</p>
      <span class="id-chip">ID ${idAsset}</span>
    </div>
  </div>
</body>
</html>`);
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
  }, [activeTicketBranchCodes, effectiveSelectedAssetQrValue, selectedAsset, selectedAssetQrMode, showToast]);

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
        showToast('La sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ya no es vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lida. Inicia sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n nuevamente.', 'warning');
        return;
      }
      if (!isRouteNotFoundApiError(error)) {
        showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a', 'warning');
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
          showToast('La sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ya no es vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lida. Inicia sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n nuevamente.', 'warning');
          return;
        }
        if (!isRouteNotFoundApiError(error)) {
          showToast(getApiErrorMessage(error) || 'No se pudo cargar la auditorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a para reportes', 'warning');
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
          showToast('La sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ya no es vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lida. Inicia sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n nuevamente.', 'warning');
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


  const resetNewUserForm = () => {
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
  };

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

  const handleImportInventory = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ensureBackendConnected('Importar inventario')) return;

    setIsImportingInventory(true);
    setImportDraft(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        showToast('El archivo no tiene hojas para importar', 'warning');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: '' });
      if (rows.length === 0) {
        showToast('El archivo estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ vacÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­o', 'warning');
        return;
      }

      let parsedRows: Array<{ rowNumber: number; item: Omit<Activo, 'id'> }> = [];
      let invalidRows = 0;
      const localInvalidDetails: ImportAssetDetail[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const item = parseInventoryRow(row, rowNumber);
        if (!item) {
          invalidRows += 1;
          localInvalidDetails.push({
            rowNumber,
            status: 'invalid',
            reason: 'Fila invÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lida o sin identificador utilizable.',
          });
          return;
        }
        parsedRows.push({ rowNumber, item });
      });

      const candidateSheetNames = workbook.SheetNames.slice(1);
      const sheetByName = candidateSheetNames.find((name) => {
        const normalized = normalizeForCompare(name);
        return normalized.includes('hoja2') || normalized.includes('red') || normalized.includes('network');
      });
      const sheetByHeader = candidateSheetNames.find((name) => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return false;
        const rows = XLSX.utils.sheet_to_json<NetworkSheetRow>(sheet, { header: 1, defval: '' });
        const header = Array.isArray(rows[0]) ? rows[0] : [];
        const normalizedHeader = header.map((cell) => normalizeForCompare(spreadsheetCellToText(cell))).join(' ');
        return normalizedHeader.includes('mac') && normalizedHeader.includes('ip');
      });
      const secondSheetName = sheetByName || sheetByHeader;
      if (secondSheetName) {
        const secondSheet = workbook.Sheets[secondSheetName];
        const secondRows = XLSX.utils.sheet_to_json<NetworkSheetRow>(secondSheet, { header: 1, defval: '' });
        const networkRows = parseNetworkSheetRows(secondRows);
        parsedRows = enrichAssetsWithNetworkSheet(parsedRows, networkRows);
      }

      if (parsedRows.length === 0) {
        showToast(
          invalidRows > 0
            ? `No se importaron filas validas. Invalidas: ${invalidRows}`
            : 'No se encontraron equipos validos',
          'warning',
        );
        return;
      }

      const payloadItems = parsedRows.map(({ rowNumber, item }) => ({ ...item, rowNumber }));
      const preview = await apiRequest<ImportAssetsResponse>('/activos/import', {
        method: 'POST',
        body: JSON.stringify({
          items: payloadItems,
          dryRun: true,
          upsert: true,
          fileName: file.name,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      setImportDraft({
        fileName: file.name,
        payloadItems,
        preview,
        localInvalidDetails,
      });
      const summary = [
        `Vista previa lista`,
        `nuevos: ${preview.created}`,
        `actualizados: ${preview.updated}`,
        `omitidos: ${preview.skipped}`,
        `invalidos: ${preview.invalid + invalidRows}`,
      ];
      showToast(summary.join(' | '), preview.created + preview.updated > 0 ? 'success' : 'warning');
    } catch (error) {
      const message = getApiErrorMessage(error) || 'No se pudo leer/importar el archivo';
      showToast(message, 'error');
    } finally {
      setIsImportingInventory(false);
    }
  };

  const exportImportIssuesCsv = () => {
    if (!importDraft) return;

    const issues = [
      ...(importDraft.preview.details || []),
      ...importDraft.localInvalidDetails,
    ].filter((detail) => detail.status === 'invalid' || detail.status === 'skipped');

    if (issues.length === 0) {
      showToast('No hay incidencias para exportar', 'warning');
      return;
    }

    const headers = ['Fila', 'Estado', 'TAG', 'Motivo'];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = issues.map((issue) => [
      String(issue.rowNumber || ''),
      issue.status || '',
      issue.tag || '',
      issue.reason || '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import_issues_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const applyImportDraft = async () => {
    if (!importDraft || isApplyingImport) return;
    const draft = importDraft;
    setIsApplyingImport(true);

    try {
      const result = await apiRequest<ImportAssetsResponse>('/activos/import', {
        method: 'POST',
        body: JSON.stringify({
          items: draft.payloadItems,
          dryRun: false,
          upsert: true,
          fileName: draft.fileName,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      const invalidTotal = result.invalid + draft.localInvalidDetails.length;
      const parts = [
        `Creados: ${result.created}`,
        `actualizados: ${result.updated}`,
        `omitidos: ${result.skipped}`,
        `invalidos: ${invalidTotal}`,
      ];
      showToast(parts.join(' | '), invalidTotal > 0 ? 'warning' : 'success');
      setImportDraft(null);
    } catch (error) {
      const message = getApiErrorMessage(error) || 'No se pudo confirmar la importaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n';
      showToast(message, 'error');
    } finally {
      setIsApplyingImport(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
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
      showToast('Tu rol no permite esta accion', 'warning');
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
  };

  const updateAuditFilters = (updates: Partial<AuditFiltersState>) => {
    setAuditFilters((prev) => ({ ...prev, ...updates }));
    setAuditPage(1);
  };

  const resetAuditFilters = () => {
    setAuditFilters(buildDefaultAuditFilters());
    setAuditPage(1);
  };

  const descargarAuditoria = (module?: AuditModule) => {
    const sourceBase = view === 'history' ? auditRowsForHistory : normalizedAuditRows;
    const rowsSource = module
      ? sourceBase.filter((log) => log.modulo === module)
      : sourceBase;
    if (rowsSource.length === 0) {
      const label = module ? auditModuleLabel(module) : 'auditorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a';
      showToast(`No hay registros para exportar en ${label}`, 'warning');
      return;
    }

    const headers = ['MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³dulo', 'Fecha', 'Usuario', 'AcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n', 'Item', 'Cantidad', 'Resultado', 'Entidad', 'RequestId'];
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
  };

  const exportarInventarioFiltrado = () => {
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
  };

  const applyInventoryFocus = (focus: 'FALLA' | InventoryRiskFilter) => {
    setInventoryDepartmentFilter('TODOS');
    setInventoryEquipmentFilter('TODOS');
    clearSearchTerm();
    if (focus === 'FALLA') {
      setInventoryStatusFilter('Falla');
      setInventoryRiskFilter('TODOS');
      return;
    }
    setInventoryStatusFilter('TODOS');
    setInventoryRiskFilter(focus);
  };

  const updateInventorySort = (field: InventorySortField) => {
    if (inventorySortField === field) {
      setInventorySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setInventorySortField(field);
    setInventorySortDirection('asc');
  };

  const getInventorySortIndicator = (field: InventorySortField) => {
    if (inventorySortField !== field) return '<>';
    return inventorySortDirection === 'asc' ? '^' : 'v';
  };

  const networkIpCounts = useMemo(
    () =>
      activos.reduce<Record<string, number>>((acc, asset) => {
        const ip = (asset.ipAddress || '').trim();
        if (ip) acc[ip] = (acc[ip] || 0) + 1;
        return acc;
      }, {}),
    [activos],
  );
  const networkMacCounts = useMemo(
    () =>
      activos.reduce<Record<string, number>>((acc, asset) => {
        const mac = (asset.macAddress || '').trim().toLowerCase();
        if (mac) acc[mac] = (acc[mac] || 0) + 1;
        return acc;
      }, {}),
    [activos],
  );
  const hasNetworkDuplication = useCallback((asset: Activo): boolean => {
    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    return (ip ? (networkIpCounts[ip] || 0) > 1 : false) || (mac ? (networkMacCounts[mac] || 0) > 1 : false);
  }, [networkIpCounts, networkMacCounts]);
  const localRiskSummary = useMemo(() => calculateAssetRiskSummary(activos), [activos]);
  const effectiveRiskSummary = localRiskSummary;
  const duplicateIpEntries = effectiveRiskSummary.duplicateIpEntries;
  const duplicateMacEntries = effectiveRiskSummary.duplicateMacEntries;

  const departamentoOptions = useMemo(
    () =>
      Array.from(
        new Set(activos.map((asset) => (asset.departamento || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [activos],
  );
  const equipoOptions = useMemo(
    () =>
      Array.from(
        new Set(activos.map((asset) => (asset.tipo || asset.equipo || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [activos],
  );
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (userRoleFilter !== 'TODOS' && user.rol !== userRoleFilter) {
          return false;
        }
        if (userStatusFilter === 'ACTIVOS' && user.activo === false) {
          return false;
        }
        if (userStatusFilter === 'INACTIVOS' && user.activo !== false) {
          return false;
        }
        if (
          userDepartmentFilter !== 'TODOS'
          && normalizeForCompare(user.departamento || '') !== normalizeForCompare(userDepartmentFilter)
        ) {
          return false;
        }

        if (userSearchTokens.length === 0) return true;
        const searchable = normalizeForCompare([
          user.nombre,
          user.username,
          user.departamento,
          userCargoLabelByValue[String(user.departamento || '').trim().toUpperCase()] || '',
          roleLabelByValue[user.rol] || USER_ROLE_LABEL[user.rol],
          rolePermissionsByValue[user.rol] || USER_ROLE_PERMISSIONS[user.rol],
          user.activo !== false ? 'activo' : 'inactivo',
        ].join(' '));
        return includesAllSearchTokens(searchable, userSearchTokens);
      }),
    [
      roleLabelByValue,
      rolePermissionsByValue,
      userCargoLabelByValue,
      userDepartmentFilter,
      userRoleFilter,
      userSearchTokens,
      userStatusFilter,
      users,
    ],
  );
  const sortedUsers = useMemo(
    () =>
      [...filteredUsers].sort((left, right) => {
        const deptCompare = normalizeForCompare(left.departamento || '').localeCompare(normalizeForCompare(right.departamento || ''));
        if (deptCompare !== 0) return deptCompare;
        return normalizeForCompare(left.nombre).localeCompare(normalizeForCompare(right.nombre));
      }),
    [filteredUsers],
  );
  const activeUsersCount = useMemo(
    () => users.filter((user) => user.activo !== false).length,
    [users],
  );
  const ticketEligibleUsersCount = useMemo(
    () => users.filter((user) => user.activo !== false && user.rol !== 'consulta').length,
    [users],
  );

  const activosConIp = effectiveRiskSummary.activosConIp;
  const activosEvaluablesIp = effectiveRiskSummary.activosEvaluablesIp;
  const activosConMac = effectiveRiskSummary.activosConMac;
  const activosEvaluablesMac = effectiveRiskSummary.activosEvaluablesMac;
  const activosEvaluablesResponsable = effectiveRiskSummary.activosEvaluablesResponsable;
  const activosSinResponsable = effectiveRiskSummary.activosSinResponsable;
  const activosVidaAlta = effectiveRiskSummary.activosVidaAlta;
  const activosEnFalla = effectiveRiskSummary.activosEnFalla;

  const filteredActivos = useMemo(
    () =>
      activos.filter((asset) => {
        if (inventoryDepartmentFilter !== 'TODOS' && normalizeForCompare(asset.departamento || '') !== normalizeForCompare(inventoryDepartmentFilter)) {
          return false;
        }
        if (inventoryEquipmentFilter !== 'TODOS' && normalizeForCompare(asset.tipo || asset.equipo || '') !== normalizeForCompare(inventoryEquipmentFilter)) {
          return false;
        }
        if (inventoryStatusFilter !== 'TODOS' && asset.estado !== inventoryStatusFilter) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_IP' && (!assetRequiresNetworkIdentity(asset) || (asset.ipAddress || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_MAC' && (!assetRequiresNetworkIdentity(asset) || (asset.macAddress || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_RESP' && (!assetRequiresResponsible(asset) || (asset.responsable || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'DUP_RED' && !hasNetworkDuplication(asset)) {
          return false;
        }
        if (inventoryRiskFilter === 'VIDA_ALTA') {
          const years = parseAssetLifeYears(asset.aniosVida);
          if (years === null || years < 4) return false;
        }

        if (headerSearchTokens.length === 0) return true;
        const searchable = normalizeForCompare([
          asset.tag,
          asset.tipo,
          asset.marca,
          asset.modelo,
          asset.serial,
          asset.idInterno,
          asset.responsable,
          asset.departamento,
          asset.ubicacion,
          asset.ipAddress,
          asset.macAddress,
          asset.cpu,
          asset.ram,
          asset.disco,
        ].join(' '));
        return includesAllSearchTokens(searchable, headerSearchTokens);
      }),
    [
      activos,
      hasNetworkDuplication,
      headerSearchTokens,
      inventoryDepartmentFilter,
      inventoryEquipmentFilter,
      inventoryRiskFilter,
      inventoryStatusFilter,
    ],
  );
  const sortedFilteredActivos = useMemo(() => {
    const compareText = (left?: string, right?: string) => {
      const a = normalizeForCompare(left || '');
      const b = normalizeForCompare(right || '');
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    };

    const rows = [...filteredActivos];
    rows.sort((left, right) => {
      let base = 0;
      if (inventorySortField === 'aniosVida') {
        const leftYears = parseAssetLifeYears(left.aniosVida);
        const rightYears = parseAssetLifeYears(right.aniosVida);
        if (leftYears === null && rightYears === null) base = 0;
        else if (leftYears === null) base = 1;
        else if (rightYears === null) base = -1;
        else base = leftYears - rightYears;
      } else if (inventorySortField === 'tag') {
        base = compareText(left.tag, right.tag);
      } else if (inventorySortField === 'tipo') {
        base = compareText(left.tipo || left.equipo || '', right.tipo || right.equipo || '');
      } else if (inventorySortField === 'estado') {
        base = compareText(left.estado, right.estado);
      } else if (inventorySortField === 'responsable') {
        base = compareText(left.responsable || '', right.responsable || '');
      } else {
        base = compareText(left.ubicacion || '', right.ubicacion || '');
      }
      return inventorySortDirection === 'asc' ? base : -base;
    });

    return rows;
  }, [filteredActivos, inventorySortDirection, inventorySortField]);

  const supplySummary = useMemo(() => {
    let agotados = 0;
    let bajoMinimo = 0;
    let ok = 0;
    let totalUnidades = 0;

    insumos.forEach((item) => {
      const status = getSupplyHealthStatus(item);
      totalUnidades += item.stock;
      if (status === 'AGOTADO') agotados += 1;
      else if (status === 'BAJO') bajoMinimo += 1;
      else ok += 1;
    });

    return {
      totalInsumos: insumos.length,
      agotados,
      bajoMinimo,
      ok,
      totalUnidades,
    };
  }, [insumos]);

  const supplyCategoryOptions = useMemo(
    () =>
      Array.from(new Set([...CATEGORIAS_INSUMO, ...insumos.map((item) => (item.categoria || '').trim()).filter(Boolean)]))
        .sort((a, b) => a.localeCompare(b)),
    [insumos],
  );

  const filteredSupplies = useMemo(() => {
    const rows = insumos.filter((item) => {
      if (supplyCategoryFilter !== 'TODAS' && item.categoria !== supplyCategoryFilter) return false;

      const status = getSupplyHealthStatus(item);
      if (supplyStatusFilter !== 'TODOS' && status !== supplyStatusFilter) return false;

      if (supplySearchTokens.length === 0) return true;
      const searchable = normalizeForCompare(`${item.nombre} ${item.categoria} ${item.unidad}`);
      return includesAllSearchTokens(searchable, supplySearchTokens);
    });

    rows.sort((left, right) => {
      const leftStatus = getSupplyHealthStatus(left);
      const rightStatus = getSupplyHealthStatus(right);
      const rankDiff = getSupplyCriticalityRank(leftStatus) - getSupplyCriticalityRank(rightStatus);
      if (rankDiff !== 0) return rankDiff;

      const leftCoverage = left.min > 0 ? left.stock / left.min : left.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
      const rightCoverage = right.min > 0 ? right.stock / right.min : right.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
      if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;

      return left.nombre.localeCompare(right.nombre);
    });

    return rows;
  }, [insumos, supplyCategoryFilter, supplySearchTokens, supplyStatusFilter]);

  const importIssueRows = importDraft
    ? [...(importDraft.preview.details || []), ...importDraft.localInvalidDetails].filter(
      (detail) => detail.status === 'invalid' || detail.status === 'skipped',
    )
    : [];

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
  const auditRowsForGrouping = view === 'history' ? auditRowsForHistory : normalizedAuditRows;
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
      if (sessionUser?.rol !== 'solicitante') return false;
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

  const isTicketOpen = (ticket: TicketItem): boolean => !isTicketClosed(ticket);
  const openTickets = scopedTickets.filter(isTicketOpen);
  const openTicketsCount = openTickets.length;
  const slaExpiredCount = openTickets.filter((ticket) => isTicketSlaExpired(ticket, liveNow)).length;
  const criticalTicketsCount = openTickets.filter((t) => t.prioridad === 'CRITICA').length;
  const unassignedTicketsCount = openTickets.filter((t) => !(t.asignadoA || '').trim()).length;

  const dashboardWindow = useMemo(
    () => resolveDashboardRangeWindow(dashboardRange, liveNow),
    [dashboardRange, liveNow],
  );
  const dashboardTicketsCurrent = useMemo(
    () =>
      !isDashboardView
        ? []
        :
        scopedTickets.filter((ticket) => {
          const ts = ticketCreatedTimestamp(ticket);
          return ts >= dashboardWindow.startMs && ts <= dashboardWindow.endMs;
        }),
    [dashboardWindow.endMs, dashboardWindow.startMs, isDashboardView, scopedTickets],
  );
  const dashboardTicketsPrevious = useMemo(
    () =>
      !isDashboardView
        ? []
        :
        scopedTickets.filter((ticket) => {
          const ts = ticketCreatedTimestamp(ticket);
          return ts >= dashboardWindow.previousStartMs && ts <= dashboardWindow.previousEndMs;
        }),
    [dashboardWindow.previousEndMs, dashboardWindow.previousStartMs, isDashboardView, scopedTickets],
  );
  const dashboardOpenTicketsCurrent = useMemo(
    () => dashboardTicketsCurrent.filter(isTicketOpen),
    [dashboardTicketsCurrent],
  );
  const dashboardOpenTicketsPrevious = useMemo(
    () => dashboardTicketsPrevious.filter(isTicketOpen),
    [dashboardTicketsPrevious],
  );
  const dashboardCriticalTicketsCurrent = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => ticket.prioridad === 'CRITICA'),
    [dashboardOpenTicketsCurrent],
  );
  const dashboardCriticalTicketsPrevious = useMemo(
    () => dashboardOpenTicketsPrevious.filter((ticket) => ticket.prioridad === 'CRITICA'),
    [dashboardOpenTicketsPrevious],
  );
  const dashboardSlaExpiredCurrent = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => isTicketSlaExpired(ticket, liveNow)),
    [dashboardOpenTicketsCurrent, liveNow],
  );
  const dashboardSlaExpiredPrevious = useMemo(
    () => dashboardOpenTicketsPrevious.filter((ticket) => isTicketSlaExpired(ticket, liveNow)),
    [dashboardOpenTicketsPrevious, liveNow],
  );
  const dashboardUnassignedCount = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => !(ticket.asignadoA || '').trim()).length,
    [dashboardOpenTicketsCurrent],
  );
  const dashboardInProcessCount = useMemo(
    () => dashboardOpenTicketsCurrent.filter((ticket) => ticket.estado === 'En Proceso').length,
    [dashboardOpenTicketsCurrent],
  );
  const dashboardRecentTickets = useMemo(
    () => [...dashboardTicketsCurrent].sort((a, b) => ticketTimestamp(b) - ticketTimestamp(a)).slice(0, 5),
    [dashboardTicketsCurrent],
  );
  const dashboardTopOwners = useMemo(() => {
    const counts = new Map<string, number>();
    dashboardOpenTicketsCurrent.forEach((ticket) => {
      const assignee = String(ticket.asignadoA || '').trim();
      if (!assignee) return;
      counts.set(assignee, (counts.get(assignee) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [dashboardOpenTicketsCurrent]);
  const dashboardStateBars = useMemo(
    () => TICKET_STATES.map((state) => ({
      label: state,
      count: dashboardTicketsCurrent.filter((ticket) => ticket.estado === state).length,
    })),
    [dashboardTicketsCurrent],
  );
  const dashboardBranchBars = useMemo(() => {
    const counts = new Map<string, number>();
    dashboardTicketsCurrent.forEach((ticket) => {
      const label = formatTicketBranchFromCatalog(ticket.sucursal);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [dashboardTicketsCurrent, formatTicketBranchFromCatalog]);
  const dashboardAgingBars = useMemo(() => {
    const buckets = [
      { label: '0-4h', minHours: 0, maxHours: 4, count: 0 },
      { label: '4-8h', minHours: 4, maxHours: 8, count: 0 },
      { label: '8-24h', minHours: 8, maxHours: 24, count: 0 },
      { label: '>24h', minHours: 24, maxHours: Number.POSITIVE_INFINITY, count: 0 },
    ];
    const nowMs = liveNow;
    dashboardOpenTicketsCurrent.forEach((ticket) => {
      const ageHours = Math.max(0, (nowMs - ticketCreatedTimestamp(ticket)) / (60 * 60 * 1000));
      const target = buckets.find((bucket) => ageHours >= bucket.minHours && ageHours < bucket.maxHours);
      if (target) target.count += 1;
    });
    return buckets;
  }, [dashboardOpenTicketsCurrent, liveNow]);
  const dashboardSlaTotalCount = dashboardTicketsCurrent.length;
  const dashboardSlaExpiredCount = dashboardSlaExpiredCurrent.length;
  const dashboardSlaCompliantCount = Math.max(0, dashboardSlaTotalCount - dashboardSlaExpiredCount);
  const dashboardSlaCompliancePct = dashboardSlaTotalCount > 0
    ? Math.round((dashboardSlaCompliantCount / dashboardSlaTotalCount) * 100)
    : 100;
  const dashboardOpenTrend = useMemo(
    () => formatDashboardTrend(dashboardOpenTicketsCurrent.length, dashboardOpenTicketsPrevious.length, false),
    [dashboardOpenTicketsCurrent.length, dashboardOpenTicketsPrevious.length],
  );
  const dashboardCriticalTrend = useMemo(
    () => formatDashboardTrend(dashboardCriticalTicketsCurrent.length, dashboardCriticalTicketsPrevious.length, false),
    [dashboardCriticalTicketsCurrent.length, dashboardCriticalTicketsPrevious.length],
  );
  const dashboardSlaTrend = useMemo(
    () => formatDashboardTrend(dashboardSlaExpiredCurrent.length, dashboardSlaExpiredPrevious.length, false),
    [dashboardSlaExpiredCurrent.length, dashboardSlaExpiredPrevious.length],
  );
  const dashboardStateMax = useMemo(
    () => Math.max(1, ...dashboardStateBars.map((item) => item.count)),
    [dashboardStateBars],
  );
  const dashboardBranchMax = useMemo(
    () => Math.max(1, ...dashboardBranchBars.map((item) => item.count)),
    [dashboardBranchBars],
  );
  const dashboardOwnerMax = useMemo(
    () => Math.max(1, ...dashboardTopOwners.map((item) => item[1])),
    [dashboardTopOwners],
  );
  const dashboardAgingMax = useMemo(
    () => Math.max(1, ...dashboardAgingBars.map((item) => item.count)),
    [dashboardAgingBars],
  );

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
    ticketAssignmentFilter,
    ticketLifecycleFilter,
    ticketPriorityFilter,
    ticketSlaFilter,
    ticketStateFilter,
  ]);

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
        kms: parseNonNegativeNumber(travelKmsByBranch[code], preset.defaultKms),
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
          kms: parseNonNegativeNumber(travelKmsByBranch[code], 0),
        });
        usedCodes.add(code);
        nextIndex += 1;
      });

    return rows.sort((a, b) => a.index - b.index);
  }, [activeTicketBranches, travelKmsByBranch]);
  const travelDestinationRuleByCode = useMemo(
    () => new Map(travelDestinationRules.map((row) => [row.code, row])),
    [travelDestinationRules],
  );
  const travelDestinationCodesKey = useMemo(
    () => travelDestinationRules.map((row) => row.code).join('|'),
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
  const travelCurrentAdjustmentByCode = useMemo(() => {
    const map = new Map<string, TravelTripAdjustment>();
    travelAdjustments.forEach((adjustment) => {
      if (adjustment.month !== travelReportMonth) return;
      if (adjustment.technicianScopeKey !== currentTravelScope.key) return;
      map.set(adjustment.destinationCode, adjustment);
    });
    return map;
  }, [currentTravelScope.key, travelAdjustments, travelReportMonth]);
  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    const destinationCodes = travelDestinationCodesKey ? travelDestinationCodesKey.split('|') : [];
    destinationCodes.forEach((destinationCode) => {
      const adjustment = travelCurrentAdjustmentByCode.get(destinationCode);
      nextDrafts[destinationCode] = adjustment ? String(adjustment.trips) : '';
    });
    setTravelTripDrafts(nextDrafts);
  }, [setTravelTripDrafts, travelCurrentAdjustmentByCode, travelDestinationCodesKey]);
  const travelTripsByCode = useMemo(() => {
    const counts = new Map<string, number>();
    const destinationCodes = new Set<string>([
      ...travelDestinationRules.map((row) => row.code),
      ...travelSuggestedTripsByCode.keys(),
      ...travelCurrentAdjustmentByCode.keys(),
    ]);
    destinationCodes.forEach((destinationCode) => {
      const adjustment = travelCurrentAdjustmentByCode.get(destinationCode);
      const suggested = travelSuggestedTripsByCode.get(destinationCode) || 0;
      counts.set(destinationCode, adjustment ? adjustment.trips : suggested);
    });
    return counts;
  }, [travelCurrentAdjustmentByCode, travelDestinationRules, travelSuggestedTripsByCode]);
  const travelReportRows = useMemo(
    () => buildTravelReportRowsFromActualTrips(
      travelTicketRows,
      travelTripsByCode,
      travelDestinationRuleByCode,
      effectiveTravelReporterName,
      travelMonthRange,
    ),
    [
      effectiveTravelReporterName,
      travelDestinationRuleByCode,
      travelMonthRange,
      travelTicketRows,
      travelTripsByCode,
    ],
  );
  const travelTotalTrips = useMemo(
    () => Array.from(travelTripsByCode.values()).reduce((sum, trips) => sum + trips, 0),
    [travelTripsByCode],
  );
  const travelTotalKms = useMemo(
    () => Array.from(travelTripsByCode.entries()).reduce((sum, [destinationCode, trips]) => {
      const destinationRule = travelDestinationRuleByCode.get(destinationCode);
      return sum + ((destinationRule?.kms || 0) * trips);
    }, 0),
    [travelDestinationRuleByCode, travelTripsByCode],
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
  const saveTravelTripAdjustment = useCallback(async (destinationCode: string, rawValue?: string) => {
    if (!canEdit) {
      showToast('Solo administradores y tecnicos pueden guardar viajes reales.', 'warning');
      return;
    }
    if (!ensureBackendConnected('Guardar viajes reales')) return;
    if (!travelMonthRange) {
      showToast('Selecciona un mes valido para registrar viajes reales.', 'warning');
      return;
    }

    const draftValue = String(rawValue ?? travelTripDrafts[destinationCode] ?? '').trim();
    let trips: number | null = null;
    if (draftValue) {
      if (!/^\d+$/.test(draftValue)) {
        showToast('Los viajes reales deben capturarse como enteros mayores o iguales a cero.', 'warning');
        return;
      }
      trips = Math.max(0, Math.trunc(Number(draftValue)));
    }

    setTravelSavingCode(destinationCode);
    try {
      const response = await apiRequest<TravelTripAdjustmentResponse>('/travel-adjustments', {
        method: 'PUT',
        body: JSON.stringify({
          month: travelReportMonth,
          technicianScopeKey: currentTravelScope.key,
          technicianScopeLabel: currentTravelScope.label,
          destinationCode,
          trips,
        }),
      });
      setTravelAdjustments((prev) => {
        const filtered = prev.filter((item) => !(
          item.month === travelReportMonth
          && item.technicianScopeKey === currentTravelScope.key
          && item.destinationCode === destinationCode
        ));
        return response.adjustment ? [...filtered, response.adjustment] : filtered;
      });
      showToast(
        trips === null
          ? 'Viajes reales restablecidos al conteo sugerido por tickets.'
          : 'Viajes reales guardados para control de gasolina.',
        'success',
      );
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudieron guardar los viajes reales.', 'error');
    } finally {
      setTravelSavingCode((current) => (current === destinationCode ? null : current));
    }
  }, [
    canEdit,
    currentTravelScope.key,
    currentTravelScope.label,
    ensureBackendConnected,
    setTravelAdjustments,
    setTravelSavingCode,
    showToast,
    travelMonthRange,
    travelReportMonth,
    travelTripDrafts,
  ]);
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
    setTravelKmsByBranch((prev) => {
      let changed = false;
      const next = { ...prev };
      activeTicketBranches.forEach((branch) => {
        const code = String(branch.code || '').trim().toUpperCase();
        if (!code || Object.prototype.hasOwnProperty.call(next, code)) return;
        const preset = TRAVEL_DESTINATION_PRESETS.find((item) => item.code === code);
        next[code] = String(preset?.defaultKms ?? 0);
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [activeTicketBranches, setTravelKmsByBranch]);
  useEffect(() => {
    if (travelReportTechnician === 'TODOS' || travelReportTechnician === 'SIN_ASIGNAR') return;
    const exists = travelTechnicianOptions.some((name) => normalizeForCompare(name) === normalizeForCompare(travelReportTechnician));
    if (!exists) setTravelReportTechnician('TODOS');
  }, [setTravelReportTechnician, travelReportTechnician, travelTechnicianOptions]);

  const applyTicketFocus = (focus: 'ABIERTOS' | 'SLA' | 'CRITICA' | 'SIN_ASIGNAR' | 'EN_PROCESO') => {
    setView('tickets');
    clearSearchTerm();
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    if (focus === 'ABIERTOS') {
      setTicketLifecycleFilter('ABIERTOS');
      return;
    }
    if (focus === 'SLA') {
      setTicketLifecycleFilter('ABIERTOS');
      setTicketSlaFilter('VENCIDO');
      return;
    }
    if (focus === 'CRITICA') {
      setTicketPriorityFilter('CRITICA');
      return;
    }
    if (focus === 'SIN_ASIGNAR') {
      setTicketLifecycleFilter('ABIERTOS');
      setTicketAssignmentFilter('SIN_ASIGNAR');
      return;
    }
    setTicketLifecycleFilter('ABIERTOS');
    setTicketStateFilter('En Proceso');
  };
  const applyReportDrillDown = (filters: {
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
    clearSearchTerm();

    if (filters.estado) setTicketStateFilter(filters.estado);
    if (filters.prioridad) setTicketPriorityFilter(filters.prioridad);
    if (filters.asignadoA) {
      setTicketAssignmentFilter('ASIGNADOS');
      setSearchTerm(filters.asignadoA);
    }
    if (filters.sucursalCode) {
      setSearchTerm(formatTicketBranchFromCatalog(filters.sucursalCode));
    }
    if (filters.area) {
      setSearchTerm(filters.area);
    }
  };
  const applyReportIncidentCauseDrillDown = (area: string, cause: string) => {
    setView('tickets');
    setTicketLifecycleFilter('TODOS');
    setTicketStateFilter('TODOS');
    setTicketPriorityFilter('TODAS');
    setTicketAssignmentFilter('TODOS');
    setTicketSlaFilter('TODOS');
    const composed = `${area} ${cause}`.trim();
    setSearchTerm(composed || area || cause);
  };
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
      showToast('Inicia sesion para guardar presets', 'warning');
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
  const deleteReportFilterPreset = useCallback((preset: ReportFilterPreset) => {
    if (!sessionUser) return;
    const confirmed = window.confirm(`Eliminar preset "${preset.name}"?`);
    if (!confirmed) return;
    setReportFilterPresets((prev) => {
      const next = prev.filter((item) => item.id !== preset.id);
      writeStoredReportFilterPresets(sessionUser, next);
      return next;
    });
    showToast('Preset eliminado', 'success');
  }, [sessionUser, setReportFilterPresets, showToast]);
  const buildReportPresentationHtml = (): string => {
    const periodLabel = `${reportDateFrom || 'N/D'} a ${reportDateTo || 'N/D'}`;
    const branchLabel = reportBranchFilter === 'TODAS' ? 'Todas las sucursales' : formatTicketBranchFromCatalog(reportBranchFilter);
    const areaLabel = reportAreaFilter === 'TODAS' ? 'Todas las areas' : reportAreaFilter;
    const stateLabel = reportStateFilter === 'TODOS' ? 'Todos los estados' : reportStateFilter;
    const priorityLabel = reportPriorityFilter === 'TODAS' ? 'Todas las prioridades' : reportPriorityFilter;
    const attentionLabel = reportAttentionFilter === 'TODAS'
      ? 'Todas las atenciones'
      : formatTicketAttentionType(reportAttentionFilter);
    const technicianLabel = reportTechnicianFilter === 'TODOS'
      ? 'Todos los tecnicos'
      : reportTechnicianFilter === 'SIN_ASIGNAR'
        ? 'Sin asignar'
        : reportTechnicianFilter;
    const filterSummary = `Sucursal: ${branchLabel} | Area: ${areaLabel} | Estado: ${stateLabel} | Prioridad: ${priorityLabel} | Atencion: ${attentionLabel} | Tecnico: ${technicianLabel}`;
    const generatedAt = new Date().toLocaleString();
    const safePeriod = escapeHtml(periodLabel);
    const safeFilterSummary = escapeHtml(filterSummary);
    const safePreviousPeriod = escapeHtml(reportPreviousPeriodLabel);
    const safeTrendMode = escapeHtml(reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria');
    const safeGeneratedAt = escapeHtml(generatedAt);
    const safeUser = escapeHtml(sessionUser?.nombre || 'Sistema');
    const safeTicketsTrend = escapeHtml(reportTicketsTrend.label);
    const safeOpenTrend = escapeHtml(reportOpenTrend.label);
    const safeSlaTrend = escapeHtml(reportSlaComplianceTrend.label);
    const previousPeriodMeta = reportComparisonWindow
      ? `<p class="meta"><strong>Periodo anterior:</strong> ${safePreviousPeriod}</p>`
      : '';
    const ticketsTrendHtml = reportComparisonWindow ? `<div class="delta">${safeTicketsTrend}</div>` : '';
    const openTrendHtml = reportComparisonWindow ? `<div class="delta">${safeOpenTrend}</div>` : '';
    const slaTrendHtml = reportComparisonWindow ? `<div class="delta">${safeSlaTrend}</div>` : '';
    const ticketRows = reportTickets.slice(0, 40).map((ticket) => {
      const area = getTicketAreaLabel(ticket);
      const branch = formatTicketBranchFromCatalog(ticket.sucursal);
      const attention = formatTicketAttentionType(ticket.atencionTipo);
      const sla = isTicketSlaExpired(ticket, liveNow) ? 'Vencido' : 'En tiempo';
      return `
        <tr>
          <td>${ticket.id}</td>
          <td>${escapeHtml(formatDateTime(ticket.fechaCreacion || ticket.fecha))}</td>
          <td>${escapeHtml(branch)}</td>
          <td>${escapeHtml(area)}</td>
          <td>${escapeHtml(ticket.activoTag)}</td>
          <td>${escapeHtml(ticket.prioridad)}</td>
          <td>${escapeHtml(ticket.estado)}</td>
          <td>${escapeHtml(attention)}</td>
          <td>${escapeHtml(sla)}</td>
          <td>${escapeHtml(ticket.asignadoA || 'Sin asignar')}</td>
        </tr>
      `;
    }).join('');
    const stateRows = reportStateBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
    const branchRows = reportBranchBars.slice(0, 10).map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
    const areaRows = reportAreaBars.slice(0, 10).map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
    const causeRows = reportIncidentCauseBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.area)}</td>
        <td>${escapeHtml(item.cause)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
    const trendRows = reportLifecycleTrend.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.created}</td>
        <td>${item.closed}</td>
      </tr>
    `).join('');
    const auditRows = reportAuditModuleBars.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${item.count}</td>
      </tr>
    `).join('');
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte Ejecutivo IT</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1, h2 { margin: 0; }
    .cover { padding: 12mm; border: 2px solid #e2e8f0; border-radius: 12px; }
    .meta { margin-top: 10px; font-size: 12px; color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .kpi { font-size: 28px; font-weight: 800; margin-top: 4px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: .05em; }
    .delta { margin-top: 6px; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: .04em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; }
    .section-title { margin-top: 14px; font-size: 14px; font-weight: 800; text-transform: uppercase; }
  </style>
</head>
<body>
  <section class="page cover">
    <h1>Reporte Ejecutivo IT</h1>
    <p class="meta"><strong>Periodo:</strong> ${safePeriod}</p>
    <p class="meta"><strong>Filtros:</strong> ${safeFilterSummary}</p>
    ${previousPeriodMeta}
    <p class="meta"><strong>Tendencia:</strong> ${safeTrendMode}</p>
    <p class="meta"><strong>Generado:</strong> ${safeGeneratedAt}</p>
    <p class="meta"><strong>Usuario:</strong> ${safeUser}</p>
    <div class="grid">
      <div class="card"><div class="label">Tickets</div><div class="kpi">${reportTickets.length}</div>${ticketsTrendHtml}</div>
      <div class="card"><div class="label">Abiertos</div><div class="kpi">${reportOpenCount}</div>${openTrendHtml}</div>
      <div class="card"><div class="label">Cerrados</div><div class="kpi">${reportClosedCount}</div></div>
      <div class="card"><div class="label">SLA cumplido</div><div class="kpi">${reportSlaCompliancePct}%</div><div class="delta">${reportSlaCompliantCount}/${reportSlaTotalCount} en tiempo</div>${slaTrendHtml}</div>
      <div class="card"><div class="label">SLA vencido</div><div class="kpi">${reportSlaExpiredCount}</div></div>
    </div>
    <div class="grid">
      <div class="card"><div class="label">Activos totales</div><div class="kpi">${reportInventorySnapshot.totalActivos}</div></div>
      <div class="card"><div class="label">Activos en falla</div><div class="kpi">${reportInventorySnapshot.activosEnFalla}</div></div>
      <div class="card"><div class="label">Insumos total</div><div class="kpi">${reportSupplySnapshot.total}</div></div>
      <div class="card"><div class="label">Insumos criticos</div><div class="kpi">${reportSupplySnapshot.agotados + reportSupplySnapshot.bajoMinimo}</div></div>
    </div>
  </section>

  <section class="page">
    <h2>Distribucion Operativa</h2>
    <p class="section-title">Tickets por estado</p>
    <table>
      <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
      <tbody>${stateRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tickets por sucursal</p>
    <table>
      <thead><tr><th>Sucursal</th><th>Cantidad</th></tr></thead>
      <tbody>${branchRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tickets por area</p>
    <table>
      <thead><tr><th>Area</th><th>Cantidad</th></tr></thead>
      <tbody>${areaRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Top causas recurrentes</p>
    <table>
      <thead><tr><th>Area</th><th>Causa</th><th>Tickets</th></tr></thead>
      <tbody>${causeRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Tendencia ${safeTrendMode} de tickets (creados vs cerrados)</p>
    <table>
      <thead><tr><th>Periodo</th><th>Creados</th><th>Cerrados</th></tr></thead>
      <tbody>${trendRows || '<tr><td colspan="3">Sin datos</td></tr>'}</tbody>
    </table>
    <p class="section-title">Auditoria por modulo</p>
    <table>
      <thead><tr><th>Modulo</th><th>Movimientos</th></tr></thead>
      <tbody>${auditRows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody>
    </table>
  </section>

  <section class="page">
    <h2>Detalle de Tickets (${reportTickets.length})</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Fecha</th>
          <th>Sucursal</th>
          <th>Area</th>
          <th>Tag</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Atencion</th>
          <th>SLA</th>
          <th>Asignado</th>
        </tr>
      </thead>
      <tbody>
        ${ticketRows || '<tr><td colspan="10">Sin tickets para los filtros seleccionados.</td></tr>'}
      </tbody>
    </table>
  </section>
</body>
</html>`;
  };
  const openReportPresentationWindow = (autoPrint = false) => {
    const html = buildReportPresentationHtml();
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(fallbackUrl), 2000);
        showToast('Popup bloqueado. Se abrio un reporte alterno en otra pestana.', 'warning');
      } catch {
        showToast('No se pudo abrir ventana de presentacion/reportes', 'warning');
      }
      return;
    }

    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      try {
        win.close();
      } catch {
        // no-op
      }
      showToast('No se pudo renderizar la presentacion/reportes', 'error');
      return;
    }

    if (autoPrint) {
      let printed = false;
      const trigger = () => {
        if (printed || win.closed) return;
        if (win.document.readyState !== 'complete') return;
        printed = true;
        win.focus();
        win.print();
      };
      win.addEventListener('load', () => {
        window.setTimeout(trigger, 250);
      }, { once: true });
      window.setTimeout(trigger, 1200);
    }
  };
  const exportReportExcel = async () => {
    if (reportTickets.length === 0 && reportClosedInPeriodCount === 0) {
      showToast('No hay datos de tickets para exportar en el periodo seleccionado', 'warning');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        { Indicador: 'Periodo', Valor: `${reportDateFrom || 'N/D'} a ${reportDateTo || 'N/D'}` },
        { Indicador: 'Filtro sucursal', Valor: reportBranchFilter === 'TODAS' ? 'Todas las sucursales' : formatTicketBranchFromCatalog(reportBranchFilter) },
        { Indicador: 'Filtro area', Valor: reportAreaFilter === 'TODAS' ? 'Todas las areas' : reportAreaFilter },
        { Indicador: 'Filtro estado', Valor: reportStateFilter === 'TODOS' ? 'Todos los estados' : reportStateFilter },
        { Indicador: 'Filtro prioridad', Valor: reportPriorityFilter === 'TODAS' ? 'Todas las prioridades' : reportPriorityFilter },
        {
          Indicador: 'Filtro atencion',
          Valor: reportAttentionFilter === 'TODAS'
            ? 'Todas las atenciones'
            : formatTicketAttentionType(reportAttentionFilter),
        },
        {
          Indicador: 'Filtro tecnico',
          Valor: reportTechnicianFilter === 'TODOS'
            ? 'Todos los tecnicos'
            : reportTechnicianFilter === 'SIN_ASIGNAR'
              ? 'Sin asignar'
              : reportTechnicianFilter,
        },
        { Indicador: 'Periodo anterior', Valor: reportPreviousPeriodLabel },
        { Indicador: 'Tendencia agrupada', Valor: reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria' },
        { Indicador: 'Tickets', Valor: reportTickets.length },
        { Indicador: 'Tickets periodo anterior', Valor: reportComparisonWindow ? reportPreviousTickets.length : 'N/D' },
        { Indicador: 'Comparativo tickets', Valor: reportTicketsTrend.label },
        { Indicador: 'Abiertos', Valor: reportOpenCount },
        { Indicador: 'Abiertos periodo anterior', Valor: reportComparisonWindow ? reportPreviousOpenCount : 'N/D' },
        { Indicador: 'Comparativo abiertos', Valor: reportOpenTrend.label },
        { Indicador: 'Cerrados', Valor: reportClosedCount },
        { Indicador: 'Tickets creados en periodo', Valor: reportCreatedInPeriodCount },
        { Indicador: 'Tickets cerrados en periodo', Valor: reportClosedInPeriodCount },
        { Indicador: 'Causas recurrentes detectadas', Valor: reportIncidentCauseBars.length },
        { Indicador: 'Cumplimiento SLA (%)', Valor: reportSlaCompliancePct },
        { Indicador: 'Cumplimiento SLA previo (%)', Valor: reportComparisonWindow ? reportPreviousSlaCompliancePct : 'N/D' },
        { Indicador: 'Comparativo cumplimiento SLA', Valor: reportSlaComplianceTrend.label },
        { Indicador: 'SLA vencido', Valor: reportSlaExpiredCount },
        { Indicador: 'Criticos', Valor: reportCriticalCount },
        { Indicador: 'MTTR promedio (horas)', Valor: reportAvgResolutionHours ?? 'N/D' },
        { Indicador: 'MTTR promedio previo (horas)', Valor: reportComparisonWindow ? (reportPreviousAvgResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'MTTR mediana (horas)', Valor: reportMedianResolutionHours ?? 'N/D' },
        { Indicador: 'MTTR mediana previa (horas)', Valor: reportComparisonWindow ? (reportPreviousMedianResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'Comparativo MTTR mediana', Valor: reportMttrMedianTrend.label },
        { Indicador: 'P90 resolucion (horas)', Valor: reportP90ResolutionHours ?? 'N/D' },
        { Indicador: 'P90 resolucion previo (horas)', Valor: reportComparisonWindow ? (reportPreviousP90ResolutionHours ?? 'N/D') : 'N/D' },
        { Indicador: 'Comparativo P90 resolucion', Valor: reportP90ResolutionTrend.label },
        { Indicador: 'Activos totales', Valor: reportInventorySnapshot.totalActivos },
        { Indicador: 'Activos en falla', Valor: reportInventorySnapshot.activosEnFalla },
        { Indicador: 'Insumos total', Valor: reportSupplySnapshot.total },
        { Indicador: 'Insumos agotados', Valor: reportSupplySnapshot.agotados },
        { Indicador: 'Insumos bajo minimo', Valor: reportSupplySnapshot.bajoMinimo },
      ];
      const detailRows = reportTickets.map((ticket) => ({
        ID: ticket.id,
        Fecha: formatDateTime(ticket.fechaCreacion || ticket.fecha),
        Sucursal: formatTicketBranchFromCatalog(ticket.sucursal),
        Area: getTicketAreaLabel(ticket),
        Tag: ticket.activoTag,
        Prioridad: ticket.prioridad,
        Estado: ticket.estado,
        Atencion: formatTicketAttentionType(ticket.atencionTipo),
        SLA: isTicketSlaExpired(ticket, liveNow) ? 'VENCIDO' : 'EN TIEMPO',
        Asignado: ticket.asignadoA || 'Sin asignar',
        SolicitadoPor: ticket.solicitadoPor || '',
        Departamento: ticket.departamento || '',
        Descripcion: ticket.descripcion,
      }));
      const stateRows = reportStateBars.map((row) => ({ Estado: row.label, Cantidad: row.count }));
      const branchRows = reportBranchBars.map((row) => ({ Sucursal: row.label, Cantidad: row.count }));
      const areaRows = reportAreaBars.map((row) => ({ Area: row.label, Cantidad: row.count }));
      const techRows = reportTechBars.map((row) => ({ Tecnico: row.label, Cantidad: row.count }));
      const causeRows = reportIncidentCauseBars.map((row) => ({
        Area: row.area,
        Causa: row.cause,
        Cantidad: row.count,
      }));
      const trendRows = reportLifecycleTrend.map((row) => ({
        Periodo: row.label,
        Creados: row.created,
        Cerrados: row.closed,
      }));
      const auditRows = reportAuditRows.map((row) => ({
        Fecha: row.fecha,
        Usuario: row.usuario,
        Modulo: auditModuleLabel(row.modulo || 'otros'),
        Accion: row.accion,
        Item: row.item,
        Cantidad: row.cantidad,
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Resumen');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Tickets');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stateRows), 'Estado');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(branchRows), 'Sucursal');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(areaRows), 'Area');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(techRows), 'Tecnico');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(causeRows), 'Causas');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trendRows), 'Tendencia');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(auditRows), 'Auditoria');
      const suffix = `${reportDateFrom || 'inicio'}_${reportDateTo || 'fin'}`.replace(/[^0-9A-Za-z_-]/g, '-');
      XLSX.writeFile(workbook, `reporteria_it_${suffix}.xlsx`);
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
  const buildTravelMovementSheetHtml = (): string => {
    const safeDepartment = escapeHtml(String(travelReportDepartment || TRAVEL_DEFAULT_DEPARTMENT).trim().toUpperCase());
    const safeMonth = escapeHtml(travelMonthLabel);
    const safeReporter = escapeHtml(effectiveTravelReporterName.toUpperCase());
    const safeAuthorizer = escapeHtml(String(travelReportAuthorizer || TRAVEL_DEFAULT_AUTHORIZER).trim().toUpperCase());
    const safeFinance = escapeHtml(String(travelReportFinance || TRAVEL_DEFAULT_FINANCE).trim().toUpperCase());
    const safeGeneratedAt = escapeHtml(new Date().toLocaleString('es-MX'));
    const litersLabel = travelFuelEfficiencyValue > 0 ? travelFuelLiters.toFixed(1) : 'N/D';

    const rowHtml = travelReportRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.nombre.toUpperCase())}</td>
        <td class="center">${row.routeIndex || ''}</td>
        <td>${escapeHtml(row.destinationLabel)}</td>
        <td class="center">${formatTravelNumber(row.kms)}</td>
        <td class="center">${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.motivo)}</td>
      </tr>
    `).join('');
    const blankRowHtml = Array.from({ length: Math.max(0, TRAVEL_REPORT_MIN_ROWS - travelReportRows.length) })
      .map(() => `
        <tr class="blank">
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        </tr>
      `)
      .join('');
    const routeRowsHtml = travelDestinationRules.map((row) => `
      <tr>
        <td class="center">${row.index}</td>
        <td>${escapeHtml(row.label)}</td>
        <td class="center">${formatTravelNumber(row.kms)}</td>
        <td class="center">${travelTripsByCode.get(row.code) || 0}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Formato Mensual Movilidad IT</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #d8d8d8; color: #111827; }
    .sheet {
      width: 100%;
      min-height: 100vh;
      padding: 8px;
      background: #d8d8d8;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 6px;
    }
    .logo-box {
      width: 86px;
      height: 86px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      border: 2px solid #f59e0b;
      font-weight: 900;
      color: #f97316;
      font-size: 30px;
    }
    .header-main h1 {
      margin: 0;
      font-size: 38px;
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .meta {
      margin-top: 8px;
      display: grid;
      grid-template-columns: auto auto;
      gap: 4px 12px;
      font-size: 13px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .meta .label { color: #374151; }
    .meta .value { color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
      background: #f9fafb;
    }
    th, td {
      border: 1px solid #111827;
      padding: 3px 5px;
      vertical-align: middle;
      line-height: 1.15;
    }
    thead th {
      background: #fbbf24;
      color: #111827;
      text-align: left;
      font-size: 10px;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .main-table tbody tr:nth-child(odd) td {
      background: #f5f5dc;
    }
    .main-table tbody tr.blank td {
      color: transparent;
    }
    .main-table .center,
    .route-table .center {
      text-align: center;
    }
    .main-table tfoot td {
      background: #e5f000;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 13px;
    }
    .main-table tfoot td.label {
      text-align: left;
    }
    .subgrid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 16px;
      align-items: start;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .route-table {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .route-table th {
      background: #fbbf24;
      font-size: 10px;
    }
    .signatures {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .signature-row {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      align-items: end;
      gap: 10px;
      text-transform: uppercase;
      font-size: 16px;
      font-weight: 800;
      line-height: 1;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .signature-row .label {
      white-space: nowrap;
      letter-spacing: .04em;
    }
    .signature-row .line {
      border-bottom: 1px solid #111827;
      min-height: 24px;
      padding: 0 6px 2px;
      display: flex;
      align-items: flex-end;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      font-size: 14px;
    }
    .generated {
      margin-top: 10px;
      font-size: 11px;
      text-transform: uppercase;
      color: #4b5563;
      letter-spacing: .04em;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="logo-box">G</div>
      <div class="header-main">
        <h1>Supermercado Los Gigantes</h1>
        <div class="meta">
          <span class="label">Departamento:</span><span class="value">${safeDepartment}</span>
          <span class="label">Reporte del mes:</span><span class="value">${safeMonth}</span>
        </div>
      </div>
    </div>

    <table class="main-table">
      <colgroup>
        <col style="width: 28%;" />
        <col style="width: 4%;" />
        <col style="width: 12%;" />
        <col style="width: 8%;" />
        <col style="width: 12%;" />
        <col style="width: 36%;" />
      </colgroup>
      <thead>
        <tr>
          <th>NOMBRE</th>
          <th>#</th>
          <th>DESTINO</th>
          <th>KMS</th>
          <th>FECHA</th>
          <th>MOTIVO</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml || ''}
        ${blankRowHtml}
      </tbody>
      <tfoot>
        <tr>
          <td class="label">TOTAL DE VIAJES</td>
          <td class="center">${travelTotalTrips}</td>
          <td class="label">KMS</td>
          <td class="center">${formatTravelNumber(travelTotalKms)}</td>
          <td class="label">LITROS</td>
          <td class="center">${escapeHtml(litersLabel)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="subgrid">
      <table class="route-table">
        <thead>
          <tr>
            <th>#</th>
            <th>DESTINO</th>
            <th>KMS</th>
            <th>VIAJES</th>
          </tr>
        </thead>
        <tbody>
          ${routeRowsHtml}
        </tbody>
      </table>
      <div class="signatures">
        <div class="signature-row">
          <div class="label">PRESENTA</div>
          <div class="line">${safeReporter}</div>
        </div>
        <div class="signature-row">
          <div class="label">AUTORIZA</div>
          <div class="line">${safeAuthorizer}</div>
        </div>
        <div class="signature-row">
          <div class="label">FINANZAS</div>
          <div class="line">${safeFinance}</div>
        </div>
      </div>
    </div>

    <div class="generated">Generado: ${safeGeneratedAt}</div>
  </div>
</body>
</html>`;
  };
  const openTravelMovementSheetWindow = (autoPrint = false) => {
    if (!travelMonthRange) {
      showToast('Selecciona un mes valido para generar el formato', 'warning');
      return;
    }
    if (travelReportRows.length === 0) {
      showToast('No hay tickets para el mes/filtros seleccionados. Se abrira formato en blanco.', 'warning');
    }

    const html = buildTravelMovementSheetHtml();
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) {
      try {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const fallbackUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fallbackUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(fallbackUrl), 2000);
        showToast('Popup bloqueado. Se abrio el formato en otra pestana.', 'warning');
      } catch {
        showToast('No se pudo abrir el formato mensual de movilidad', 'error');
      }
      return;
    }

    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      try {
        win.close();
      } catch {
        // no-op
      }
      showToast('No se pudo renderizar el formato mensual de movilidad', 'error');
      return;
    }

    if (autoPrint) {
      let printed = false;
      const trigger = () => {
        if (printed || win.closed) return;
        if (win.document.readyState !== 'complete') return;
        printed = true;
        win.focus();
        win.print();
      };
      win.addEventListener('load', () => {
        window.setTimeout(trigger, 250);
      }, { once: true });
      window.setTimeout(trigger, 1200);
    }
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

  const systemHealth = activos.length > 0 ? Math.round((activos.filter(a => a.estado === 'Operativo').length / activos.length) * 100) : 100;
  const defaultViewPath = getViewPath(defaultView);
  const renderLazyView = (loadingLabel: string, content: React.ReactNode) => (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">{loadingLabel}</div>}>
      {content}
    </React.Suspense>
  );
  const renderProtectedView = (
    content: React.ReactNode,
    options?: { allowRequester?: boolean; requiresUserManagement?: boolean },
  ) => {
    if (options?.requiresUserManagement && !canManageUsers) {
      return <Navigate to={defaultViewPath} replace />;
    }
    if (!options?.allowRequester && isRequesterOnlyUser) {
      return <Navigate to={defaultViewPath} replace />;
    }
    return content;
  };


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
        onCloseSidebar={() => setSidebarOpen(false)}
        authorBrand={AUTHOR_BRAND}
        getItemHref={getViewPath}
        onLogout={() => {
          void handleLogout();
        }}
      />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <AppHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenSidebar={() => setSidebarOpen(true)}
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
                      setSearchTerm={setSearchTerm}
                      dashboardTopOwners={dashboardTopOwners}
                      dashboardOwnerMax={dashboardOwnerMax}
                      dashboardInProcessCount={dashboardInProcessCount}
                      applyInventoryFocus={applyInventoryFocus}
                      activosSinResponsable={activosSinResponsable}
                      activosVidaAlta={activosVidaAlta}
                      effectiveRiskSummary={effectiveRiskSummary}
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
                )}
              />
              <Route
                path={VIEW_PATHS.reports}
                element={renderProtectedView(
                  renderLazyView(
                    'Cargando Reporteria...',
                    <LazyReportsView
                      canEditTravelTrips={canEdit}
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
                      travelKmsByBranch={travelKmsByBranch}
                      setTravelKmsByBranch={setTravelKmsByBranch}
                      travelSuggestedTripsByCode={travelSuggestedTripsByCode}
                      travelTripsByCode={travelTripsByCode}
                      travelTripDrafts={travelTripDrafts}
                      setTravelTripDrafts={setTravelTripDrafts}
                      travelSavingCode={travelSavingCode}
                      saveTravelTripAdjustment={saveTravelTripAdjustment}
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
                      setSearchTerm={setSearchTerm}
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
                      effectiveSelectedAssetQrValue={effectiveSelectedAssetQrValue}
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
                  { requiresUserManagement: true },
                )}
              />
              <Route
                path={VIEW_PATHS.tickets}
                element={(
                  <TicketsView
                    canCreateTickets={canCreateTickets}
                    canCreateComments={canCreateTickets}
                    canEdit={canEdit}
                    canRequesterDelete={sessionUser?.rol === 'solicitante'}
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
                    onOpenTicketModal={() => openModal('ticket')}
                    onApplyTicketFocus={applyTicketFocus}
                    onTicketLifecycleFilterChange={setTicketLifecycleFilter}
                    onTicketStateFilterChange={(value) => setTicketStateFilter(value as TicketEstado | 'TODOS')}
                    onTicketPriorityFilterChange={(value) => setTicketPriorityFilter(value as PrioridadTicket | 'TODAS')}
                    onTicketAssignmentFilterChange={setTicketAssignmentFilter}
                    onTicketSlaFilterChange={setTicketSlaFilter}
                    onResetFilters={() => {
                      setTicketLifecycleFilter('TODOS');
                      setTicketStateFilter('TODOS');
                      setTicketPriorityFilter('TODAS');
                      setTicketAssignmentFilter('TODOS');
                      setTicketSlaFilter('TODOS');
                      clearSearchTerm();
                    }}
                    onStatusChange={(ticketId, estado) => {
                      void actualizarTicket(ticketId, { estado: estado as TicketEstado });
                    }}
                    onAttentionChange={(ticketId, atencionTipo) => {
                      const value = normalizeTicketAttentionType(atencionTipo);
                      if (!value) return;
                      void actualizarTicket(ticketId, { atencionTipo: value });
                    }}
                    onTravelChange={(ticketId, trasladoRequerido) => {
                      void actualizarTicket(ticketId, { trasladoRequerido });
                    }}
                    onAssigneeChange={(ticketId, asignadoA) => {
                      void actualizarTicket(ticketId, { asignadoA });
                    }}
                    onViewAsset={(tag) => {
                      setView('inventory');
                      setSearchTerm(tag);
                    }}
                    onResolveTicket={(ticketId) => {
                      void resolverTicket(ticketId);
                    }}
                    onDeleteTicket={(ticketId) => {
                      void eliminarTicket(ticketId);
                    }}
                    onUploadAttachment={(ticketId, files) => {
                      void cargarAdjuntoTicket(ticketId, files);
                    }}
                    onDownloadAttachment={(ticketId, attachment) => {
                      void descargarAdjuntoTicket(ticketId, attachment);
                    }}
                    onDeleteAttachment={(ticketId, attachment) => {
                      void eliminarAdjuntoTicket(ticketId, attachment);
                    }}
                    onCommentDraftChange={(ticketId, value) => {
                      setTicketCommentDrafts((prev) => ({
                        ...prev,
                        [ticketId]: value,
                      }));
                    }}
                    onSaveComment={(ticketId) => {
                      void agregarComentarioTicket(ticketId);
                    }}
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

    </div>
  );
}
