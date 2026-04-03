import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Moon,
  Save,
  Sun,
  User,
  X,
} from 'lucide-react';
import { LogoGigantes } from './components/brand/LogoGigantes';
import { useAppStore } from './store/useAppStore';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { AssetDetailModal } from './components/modals/AssetDetailModal';
import { ImportPreviewModal } from './components/modals/ImportPreviewModal';
import { QrScannerModal } from './components/modals/QrScannerModal';
import { SupplyHistoryModal } from './components/modals/SupplyHistoryModal';

import { Toast } from './components/ui/Toast';
import { TicketsView } from './components/views/TicketsView';
import {
  AUTHOR_BRAND,
  AUTHOR_SIGNATURE,
  CATEGORIAS_INSUMO,
  CLIENT_ATTACHMENT_MAX_BYTES,
  CLIENT_ATTACHMENT_MAX_COUNT,
  COMMON_TICKET_ISSUES,

  DEFAULT_CATALOGS,
  NAV_ITEMS,
  NORMALIZED_API_BASE_URL,
  SLA_POLICY,
  SUPPLY_UNIT_OPTIONS,
  TICKET_AREA_OPTIONS,
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
  AssetQrResolveResponse,
  AssetQrTokenResponse,
  AssetRiskSummary,
  AuditAlertsState,
  AuditFiltersState,
  AuditHistoryResponse,
  AuditIntegrityState,
  AuditModule,
  AuditPaginationState,
  AuditSummaryState,
  BootstrapResponse,
  CatalogBranch,
  CatalogState,
  DashboardRange,
  EstadoActivo,
  FormDataState,
  ImportAssetDetail,
  ImportAssetsResponse,
  ImportDraftState,
  Insumo,
  InsumoErrors,
  InsumoField,
  InsumoTouchedState,
  InventoryRiskFilter,
  InventorySortDirection,
  InventorySortField,
  LoginResponse,
  ModalType,
  PrioridadTicket,
  RegistroAuditoria,
  ReportAttentionFilter,
  ReportFilterPreset,
  ReportFilterSnapshot,
  ReportPriorityFilter,
  ReportStateFilter,
  SupplyAuditMovement,
  SupplyStatusFilter,
  ToastState,
  ToastType,
  TicketAttentionType,
  TicketAttachment,
  TicketAttachmentUploadResponse,
  TicketEstado,
  TicketItem,
  TravelDestinationRule,

  TravelReportRow,
  UserItem,
  UserRole,
} from './types/app';
import {
  ApiError,
  apiRequest,
  applyThemeToDocument,
  buildApiUrl,
  buildCurrentMonthInputValue,
  buildDefaultAuditFilters,
  buildDefaultAuditPagination,
  buildDefaultReportFilterSnapshot,
  buildDefaultTravelKmsByBranch,
  createEmptyInsumoTouched,
  getStoredSessionToken,
  normalizeReportFilterSnapshot,
  readStoredReportFilterPresets,
  writeStoredReportFilterPresets,
} from './utils/app';
import {
  auditModuleLabel,
  filterAuditRowsClient,
  getAuditRowTimestampMs,
  resolveAuditModule,
} from './utils/audit';
import {
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  calculateAssetRiskSummary,
  formatTicketBranch,
  formatUserCargo,
  isUserRole,
  normalizeCatalogState,
  normalizeIpAddress,
  normalizeMacAddress,

  parseAssetLifeYears,
  resolveAssetBranchCode,
  spreadsheetCellToText,
} from './utils/assets';
import {
  digitsOnly,
  escapeHtml,
  formatBytes,
  formatDateTime,
  includesAllSearchTokens,
  normalizeForCompare,
  parseDateToTimestamp,
  preventInvalidIntegerInputKeys,
  sanitizeFileToken,
  tokenizeSearchQuery,
} from './utils/format';
import {
  buildTicketDescription,
  buildTicketHistoryEntry,
  formatTicketAttentionType,
  getSlaStatus,
  isTicketSlaExpired,
  isTicketClosed,
  normalizeTicketAttentionType,
} from './utils/tickets';


import {
  buildAssetQrCanvasId,
  extractSignedQrToken,
  toActivoFromQrLookup,
} from './utils/qrTokens';

import {
  ticketTimestamp,
  ticketCreatedTimestamp,
  parseMonthInputRange,
  formatMonthInputLabel,
  formatTravelDate,
  compactBranchLabel,
  parseNonNegativeNumber,
  roundToTwoDecimals,
  formatTravelNumber,
  parseTicketTravelCreatedAt,
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
  buildInitialFormDataForModal,
  getModalTitle,
  getModalSubmitLabel,
  getSupplyHealthStatus,
  getSupplyCriticalityRank,
  parseInventoryRow,
} from './utils/appHelpers';

const LazyUsersView = lazy(() => import('./components/views/UsersView'));
const LazyDashboardView = lazy(() => import('./components/views/DashboardView'));
const LazyInventoryView = lazy(() => import('./components/views/InventoryView'));
const LazySuppliesView = lazy(() => import('./components/views/SuppliesView'));
const LazyAuditView = lazy(() => import('./components/views/AuditView'));

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

function parseNetworkSheetRows(rows: NetworkSheetRow[]): Array<{ macAddress: string; ipAddress: string; deviceLabel: string }> {
  return rows
    .map((row) => {
      const rawMac = spreadsheetCellToText(row[0]);
      const rawIp = spreadsheetCellToText(row[1]);
      const rawLabel = spreadsheetCellToText(row[2]);
      const macAddress = normalizeMacAddress(rawMac);
      const ipAddress = normalizeIpAddress(rawIp);
      const label = rawLabel.trim();
      const isHeader =
        normalizeForCompare(rawMac).includes('mac') ||
        normalizeForCompare(rawIp).includes('ip') ||
        normalizeForCompare(rawLabel).includes('nombre');

      return { macAddress, ipAddress, deviceLabel: label, isHeader };
    })
    .filter((row) => !row.isHeader)
    .filter((row) => !!row.macAddress || !!row.ipAddress || !!row.deviceLabel)
    .map((row) => ({
      macAddress: row.macAddress,
      ipAddress: row.ipAddress,
      deviceLabel: row.deviceLabel,
    }));
}

function enrichAssetsWithNetworkSheet(
  parsedRows: Array<{ rowNumber: number; item: Omit<Activo, 'id'> }>,
  networkRows: Array<{ macAddress: string; ipAddress: string; deviceLabel: string }>,
): Array<{ rowNumber: number; item: Omit<Activo, 'id'> }> {
  if (networkRows.length === 0 || parsedRows.length === 0) return parsedRows;

  const byMac = new Map<string, { macAddress: string; ipAddress: string; deviceLabel: string }>();
  const byIp = new Map<string, { macAddress: string; ipAddress: string; deviceLabel: string }>();

  networkRows.forEach((row) => {
    if (row.macAddress) byMac.set(normalizeForCompare(row.macAddress), row);
    if (row.ipAddress) byIp.set(normalizeForCompare(row.ipAddress), row);
  });

  return parsedRows.map((entry) => {
    const macKey = normalizeForCompare(entry.item.macAddress || '');
    const ipKey = normalizeForCompare(entry.item.ipAddress || '');
    const match = (macKey ? byMac.get(macKey) : undefined) || (ipKey ? byIp.get(ipKey) : undefined);
    if (!match) return entry;

    return {
      rowNumber: entry.rowNumber,
      item: {
        ...entry.item,
        macAddress: entry.item.macAddress || match.macAddress,
        ipAddress: entry.item.ipAddress || match.ipAddress,
        responsable: entry.item.responsable || match.deviceLabel,
      },
    };
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const payload = result.includes(',') ? result.split(',')[1] : result;
      if (!payload) {
        reject(new Error('No se pudo codificar el archivo.'));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function formatRetryDelay(seconds: number): string {
  const totalSeconds = Math.max(1, Math.trunc(seconds));
  if (totalSeconds < 60) {
    return `${totalSeconds} segundo${totalSeconds === 1 ? '' : 's'}`;
  }

  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes} minuto${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.ceil(minutes / 60);
  return `${hours} hora${hours === 1 ? '' : 's'}`;
}

function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '';
  const message = error.message || '';
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message) || /load failed/i.test(message)) {
    return `No se pudo conectar al backend (${NORMALIZED_API_BASE_URL}).`;
  }
  const trimmed = message.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const apiError = parsed?.error ? String(parsed.error) : '';
      const retryAfterSec = Number(parsed?.retryAfterSec);
      if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        const waitLabel = formatRetryDelay(retryAfterSec);
        if (apiError) return `${apiError} Intenta de nuevo en ${waitLabel}.`;
        return `Demasiados intentos. Intenta de nuevo en ${waitLabel}.`;
      }
      if (apiError) return apiError;
    } catch {
      return message;
    }
  }
  return message;
}

function isRouteNotFoundApiError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 404) return false;
  const message = normalizeForCompare(getApiErrorMessage(error));
  return message.includes('ruta no encontrada');
}

// --- APP PRINCIPAL ---

export default function App() {
  const {
    sessionUser,
    setStoredSession,
    logout,
    theme,
    toggleTheme,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore();
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [view, setView] = useState('dashboard'); // temporal
  const isDashboardView = view === 'dashboard';
  const isReportsView = view === 'reports';

  // Estado de Datos
  const [activos, setActivos] = useState<Activo[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogState>(DEFAULT_CATALOGS);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [auditRemoteRows, setAuditRemoteRows] = useState<RegistroAuditoria[] | null>(null);
  const [auditFilters, setAuditFilters] = useState<AuditFiltersState>(() => buildDefaultAuditFilters());
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditPagination, setAuditPagination] = useState<AuditPaginationState>(() => buildDefaultAuditPagination(25));
  const [auditSummary, setAuditSummary] = useState<AuditSummaryState | null>(null);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditIntegrityState | null>(null);
  const [auditAlerts, setAuditAlerts] = useState<AuditAlertsState | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>('30D');
  const [reportDateFrom, setReportDateFrom] = useState(() => buildDefaultReportFilterSnapshot().dateFrom);
  const [reportDateTo, setReportDateTo] = useState(() => buildDefaultReportFilterSnapshot().dateTo);
  const [reportBranchFilter, setReportBranchFilter] = useState(() => buildDefaultReportFilterSnapshot().branch);
  const [reportAreaFilter, setReportAreaFilter] = useState(() => buildDefaultReportFilterSnapshot().area);
  const [reportStateFilter, setReportStateFilter] = useState<ReportStateFilter>(() => buildDefaultReportFilterSnapshot().state);
  const [reportPriorityFilter, setReportPriorityFilter] = useState<ReportPriorityFilter>(() => buildDefaultReportFilterSnapshot().priority);
  const [reportAttentionFilter, setReportAttentionFilter] = useState<ReportAttentionFilter>(() => buildDefaultReportFilterSnapshot().attention);
  const [reportTechnicianFilter, setReportTechnicianFilter] = useState(() => buildDefaultReportFilterSnapshot().technician);
  const [reportPresetName, setReportPresetName] = useState('');
  const [reportFilterPresets, setReportFilterPresets] = useState<ReportFilterPreset[]>([]);
  const [travelReportMonth, setTravelReportMonth] = useState(() => buildCurrentMonthInputValue());
  const [travelReportTechnician, setTravelReportTechnician] = useState('TODOS');
  const [travelReportName, setTravelReportName] = useState('');
  const [travelReportDepartment, setTravelReportDepartment] = useState(TRAVEL_DEFAULT_DEPARTMENT);
  const [travelReportFuelEfficiency, setTravelReportFuelEfficiency] = useState(String(TRAVEL_DEFAULT_FUEL_EFFICIENCY));
  const [travelReportAuthorizer, setTravelReportAuthorizer] = useState(TRAVEL_DEFAULT_AUTHORIZER);
  const [travelReportFinance, setTravelReportFinance] = useState(TRAVEL_DEFAULT_FINANCE);
  const [travelKmsByBranch, setTravelKmsByBranch] = useState<Record<string, string>>(() => buildDefaultTravelKmsByBranch());
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [selectedAsset, setSelectedAsset] = useState<Activo | null>(null);
  const [selectedSupplyHistoryItem, setSelectedSupplyHistoryItem] = useState<Insumo | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScannerStatus, setQrScannerStatus] = useState('Escanea un QR firmado (mtiqr1).');
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const [isResolvingQr, setIsResolvingQr] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');
  const [selectedAssetQrValue, setSelectedAssetQrValue] = useState('');
  const [selectedAssetQrMode, setSelectedAssetQrMode] = useState<'signed' | 'unavailable'>('unavailable');
  const [selectedAssetQrIssuedAt, setSelectedAssetQrIssuedAt] = useState('');
  const [selectedAssetQrLoading, setSelectedAssetQrLoading] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingInsumoId, setEditingInsumoId] = useState<number | null>(null);
  const [isModalSaving, setIsModalSaving] = useState(false);
  const [formData, setFormData] = useState<FormDataState>({});
  const [insumoTouched, setInsumoTouched] = useState<InsumoTouchedState>(() => createEmptyInsumoTouched());
  const [ticketLifecycleFilter, setTicketLifecycleFilter] = useState<'TODOS' | 'ABIERTOS' | 'CERRADOS'>('TODOS');
  const [ticketStateFilter, setTicketStateFilter] = useState<TicketEstado | 'TODOS'>('TODOS');
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<PrioridadTicket | 'TODAS'>('TODAS');
  const [ticketAssignmentFilter, setTicketAssignmentFilter] = useState<'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR'>('TODOS');
  const [ticketSlaFilter, setTicketSlaFilter] = useState<'TODOS' | 'VENCIDO'>('TODOS');
  const [ticketCommentDrafts, setTicketCommentDrafts] = useState<Record<number, string>>({});
  const [ticketAttachmentLoadingId, setTicketAttachmentLoadingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [supplyStockDrafts, setSupplyStockDrafts] = useState<Record<number, string>>({});
  const inventoryImportInputRef = useRef<HTMLInputElement | null>(null);
  const qrScannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrScannerStreamRef = useRef<MediaStream | null>(null);
  const qrScannerIntervalRef = useRef<number | null>(null);
  const qrScannerBusyRef = useRef(false);
  const fetchAuditHistoryRef = useRef<(options?: { force?: boolean }) => void>(() => { });
  const [isImportingInventory, setIsImportingInventory] = useState(false);
  const [inventoryDepartmentFilter, setInventoryDepartmentFilter] = useState('TODOS');
  const [inventoryEquipmentFilter, setInventoryEquipmentFilter] = useState('TODOS');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'TODOS' | EstadoActivo>('TODOS');
  const [inventoryRiskFilter, setInventoryRiskFilter] = useState<InventoryRiskFilter>('TODOS');
  const [inventorySortField, setInventorySortField] = useState<InventorySortField>('tag');
  const [inventorySortDirection, setInventorySortDirection] = useState<InventorySortDirection>('asc');
  const [supplySearchTerm, setSupplySearchTerm] = useState('');
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState<string>('TODAS');
  const [supplyStatusFilter, setSupplyStatusFilter] = useState<SupplyStatusFilter>('TODOS');
  const [importDraft, setImportDraft] = useState<ImportDraftState | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [, setAssetRiskSummary] = useState<AssetRiskSummary | null>(null);
  const [newUserForm, setNewUserForm] = useState<{
    nombre: string;
    username: string;
    password: string;
    departamento: string;
    rol: UserRole;
  }>({
    nombre: '',
    username: '',
    password: '',
    departamento: '',
    rol: 'solicitante',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userActionLoadingId, setUserActionLoadingId] = useState<number | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const debouncedSupplySearchTerm = useDebouncedValue(supplySearchTerm);
  const headerSearchTokens = useMemo(
    () => tokenizeSearchQuery(debouncedSearchTerm),
    [debouncedSearchTerm],
  );
  const supplySearchTokens = useMemo(
    () => tokenizeSearchQuery(debouncedSupplySearchTerm),
    [debouncedSupplySearchTerm],
  );
  const markInsumoTouched = useCallback((field: InsumoField) => {
    setInsumoTouched((prev) => {
      if (prev[field]) return prev;
      return { ...prev, [field]: true };
    });
  }, []);
  const insumoFormValidation = useMemo(() => {
    const nombre = String(formData.nombre || '').trim();
    const unidad = String(formData.unidad || '').trim();
    const categoria = String(formData.categoria || '').trim().toUpperCase();
    const stockInput = String(formData.stock ?? '').trim();
    const minInput = String(formData.min ?? '').trim();
    const errors: InsumoErrors = {};
    let stock: number | null = null;
    let min: number | null = null;

    if (!nombre) errors.nombre = 'Nombre requerido.';
    if (!unidad) errors.unidad = 'Unidad requerida.';
    if (!categoria) errors.categoria = 'Selecciona una categoría.';

    if (!stockInput) {
      errors.stock = 'Stock requerido.';
    } else {
      const value = Number(stockInput);
      if (!Number.isFinite(value)) errors.stock = 'Stock debe ser numérico.';
      else if (value < 0) errors.stock = 'Stock debe ser mayor o igual a 0.';
      else if (!Number.isInteger(value)) errors.stock = 'Stock debe ser entero.';
      else stock = Math.trunc(value);
    }

    if (!minInput) {
      errors.min = 'Mínimo requerido.';
    } else {
      const value = Number(minInput);
      if (!Number.isFinite(value)) errors.min = 'Mínimo debe ser numérico.';
      else if (value < 0) errors.min = 'Mínimo debe ser mayor o igual a 0.';
      else if (!Number.isInteger(value)) errors.min = 'Mínimo debe ser entero.';
      else min = Math.trunc(value);
    }

    if (stock !== null && min !== null && min > stock) {
      errors.min = 'El mínimo no puede ser mayor al stock inicial.';
    }

    if (!errors.nombre && nombre && categoria) {
      const duplicateLocal = insumos.some(
        (item) =>
          item.id !== editingInsumoId &&
          normalizeForCompare(item.nombre) === normalizeForCompare(nombre)
          && normalizeForCompare(item.categoria) === normalizeForCompare(categoria),
      );
      if (duplicateLocal) errors.nombre = 'Ya existe un insumo con ese nombre y categoría.';
    }

    const firstError = errors.nombre || errors.unidad || errors.stock || errors.min || errors.categoria || '';
    return {
      nombre,
      unidad,
      categoria,
      stock,
      min,
      errors,
      firstError,
      isValid: !firstError,
    };
  }, [editingInsumoId, formData.categoria, formData.min, formData.nombre, formData.stock, formData.unidad, insumos]);
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);
  const effectiveSelectedAssetQrValue = selectedAssetQrValue;
  const isQrCameraSupported = useMemo(
    () =>
      typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices?.getUserMedia
      && 'BarcodeDetector' in window,
    [],
  );

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
  }, [sessionUser]);

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
  }, [backendConnected, selectedAsset]);

  const canEdit = sessionUser?.rol === 'admin' || sessionUser?.rol === 'tecnico';
  const canCreateTickets = canEdit || sessionUser?.rol === 'solicitante';
  const canSubmitInsumo = canEdit && insumoFormValidation.isValid && !isModalSaving;
  const currentModal = showModal;
  const isAssetModal = currentModal === 'activo';
  const isSupplyModal = currentModal === 'insumo';
  const isTicketModal = currentModal === 'ticket';
  const canSubmitModal = isTicketModal
    ? canCreateTickets && !isModalSaving
    : isSupplyModal
      ? canSubmitInsumo
      : canEdit && !isModalSaving;
  const modalWidthClass = isAssetModal ? 'max-w-5xl' : 'max-w-lg';
  const modalTitle = getModalTitle(currentModal, editingAssetId, editingInsumoId);
  const modalSubmitLabel = getModalSubmitLabel(currentModal, isModalSaving, editingAssetId, editingInsumoId);
  const canManageUsers = sessionUser?.rol === 'admin';
  const isReadOnly = !canEdit;
  const isRequesterOnlyUser = sessionUser?.rol === 'solicitante';
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
  }, []);
  const clearSession = useCallback(() => {
    logout();
    setLoginForm({ username: '', password: '' });
    setView('dashboard');
    setActivos([]);
    setInsumos([]);
    setTickets([]);
    setAuditoria([]);
    setAuditRemoteRows(null);
    setAuditFilters(buildDefaultAuditFilters());
    setAuditPage(1);
    setAuditPageSize(25);
    setAuditPagination(buildDefaultAuditPagination(25));
    setAuditSummary(null);
    setAuditIntegrity(null);
    setAuditAlerts(null);
    setIsAuditLoading(false);
    setUsers([]);
    setCatalogos(DEFAULT_CATALOGS);
    setBackendConnected(false);
    setAssetRiskSummary(null);
    setLastSync(null);
    setImportDraft(null);
    setIsApplyingImport(false);
    setSupplyStockDrafts({});
    setSearchTerm('');
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
    setSelectedAsset(null);
    setSelectedSupplyHistoryItem(null);
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
  }, [applyReportFilterSnapshot, logout]);

  const ensureBackendConnected = useCallback((action: string) => {
    if (backendConnected) return true;
    showToast(`${action} requiere conexion con el backend.`, 'warning');
    return false;
  }, [backendConnected, showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignora error de logout remoto y limpia sesión local de todas formas.
    }
    clearSession();
  }, [clearSession]);

  const handleLogin = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      showToast('Usuario y password son requeridos', 'warning');
      return;
    }
    setLoginLoading(true);

    try {
      const auth = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });
      setStoredSession({
        user: auth.user,
        token: auth.token,
        loggedAt: auth.loggedAt,
      });
      showToast(`Bienvenido ${auth.user.nombre}`, 'success');
    } catch (error) {
      const message = getApiErrorMessage(error);
      showToast(message || 'No se pudo conectar con el backend', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const updateFormData = (updates: Partial<FormDataState>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const openModal = (modal: Exclude<ModalType, null>) => {
    setEditingAssetId(null);
    setEditingInsumoId(null);
    setIsModalSaving(false);
    setInsumoTouched(createEmptyInsumoTouched());
    setFormData(buildInitialFormDataForModal(modal, activeTicketBranches[0]?.code || ''));
    setShowModal(modal);
  };

  const closeModal = () => {
    setIsModalSaving(false);
    setShowModal(null);
    setEditingAssetId(null);
    setEditingInsumoId(null);
    setFormData({});
    setInsumoTouched(createEmptyInsumoTouched());
  };

  const openAssetEditModal = useCallback(() => {
    if (!selectedAsset) return;
    if (!canEdit) {
      showToast('Tu rol no permite editar activos', 'warning');
      return;
    }

    setEditingInsumoId(null);
    setEditingAssetId(selectedAsset.id);
    setFormData({
      tag: selectedAsset.tag || '',
      tipo: selectedAsset.tipo || '',
      marca: selectedAsset.marca || '',
      modelo: selectedAsset.modelo || '',
      ubicacion: selectedAsset.ubicacion || '',
      serial: selectedAsset.serial || '',
      fechaCompra: selectedAsset.fechaCompra || '',
      estado: selectedAsset.estado || 'Operativo',
      idInterno: selectedAsset.idInterno || '',
      equipo: selectedAsset.equipo || selectedAsset.tipo || '',
      cpu: selectedAsset.cpu || '',
      ram: selectedAsset.ram || '',
      ramTipo: selectedAsset.ramTipo || '',
      disco: selectedAsset.disco || '',
      tipoDisco: selectedAsset.tipoDisco || '',
      macAddress: selectedAsset.macAddress || '',
      ipAddress: selectedAsset.ipAddress || '',
      responsable: selectedAsset.responsable || '',
      departamento: selectedAsset.departamento || '',
      anydesk: selectedAsset.anydesk || '',
      aniosVida: selectedAsset.aniosVida || '',
      comentarios: selectedAsset.comentarios || '',
    });
    setSelectedAsset(null);
    setShowModal('activo');
  }, [canEdit, selectedAsset, showToast]);

  const openInsumoEditModal = useCallback((insumo: Insumo) => {
    if (!canEdit) {
      showToast('Tu rol no permite editar insumos', 'warning');
      return;
    }

    setEditingAssetId(null);
    setEditingInsumoId(insumo.id);
    setIsModalSaving(false);
    setInsumoTouched(createEmptyInsumoTouched());
    setFormData({
      nombre: insumo.nombre || '',
      unidad: insumo.unidad || 'Piezas',
      stock: String(insumo.stock),
      min: String(insumo.min),
      categoria: insumo.categoria || '',
    });
    setShowModal('insumo');
  }, [canEdit, showToast]);

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

    const printWindow = window.open('', '_blank', 'width=520,height=360');
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
    const headerLabelRaw = 'Activo fijo';
    const footerNoteRaw = 'Propiedad corporativa - No remover';

    const tag = escapeHtml(tagRaw);
    const ubicacion = escapeHtml(ubicacionFullRaw);
    const serial = escapeHtml(serialRaw);
    const equipo = escapeHtml(equipmentRaw);
    const idAsset = escapeHtml(idAssetRaw);
    const headerLabel = escapeHtml(headerLabelRaw);
    const footerNote = escapeHtml(footerNoteRaw);
    const internalCode = escapeHtml(internalCodeRaw);

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta QR ${tag}</title>
  <style>
    @page { size: 55mm 35mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 55mm;
      height: 35mm;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
    }
    * {
      box-sizing: border-box;
    }
    .label {
      width: 55mm;
      height: 35mm;
      padding: 1.65mm 1.65mm 1.35mm;
      border: 0.3mm solid #111827;
      border-radius: 1.2mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      margin: 0;
      font-size: 3.9pt;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #4b5563;
      white-space: nowrap;
    }
    .content {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 10.8mm;
      gap: 0.85mm;
      align-items: start;
      margin-top: 0.55mm;
    }
    .info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55mm;
    }
    .tag {
      margin: 0;
      font-size: 8.7pt;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0;
      text-transform: uppercase;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-height: 9.4mm;
    }
    .divider {
      height: 0.22mm;
      background: #111827;
      margin: 0;
    }
    .meta {
      margin: 0;
      font-size: 3.9pt;
      line-height: 1.02;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #374151;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 0.35mm;
      min-width: 0;
    }
    .row {
      min-width: 0;
      display: grid;
      grid-template-columns: 5.4mm minmax(0, 1fr);
      gap: 0.55mm;
      align-items: center;
      padding-bottom: 0.18mm;
      border-bottom: 0.14mm solid #dbe2ea;
    }
    .k {
      display: block;
      margin: 0;
      font-size: 3.05pt;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .v {
      display: block;
      margin: 0;
      font-size: 4.3pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .qr-panel {
      min-width: 0;
    }
    .badge-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.35mm;
    }
    .qr-frame {
      border: 0.25mm solid #111827;
      border-radius: 0.7mm;
      padding: 0.45mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    .qr {
      width: 8.7mm;
      height: 8.7mm;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .footer {
      margin-top: auto;
      padding-top: 0.55mm;
      border-top: 0.18mm solid #111827;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.55mm;
    }
    .footer-note {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 3.2pt;
      line-height: 1.02;
      font-weight: 900;
      text-transform: uppercase;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .code {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.55mm;
      font-size: 3.2pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #111827;
    }
    .code-badge {
      width: 5.9mm;
      height: 4mm;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #111827;
      color: #ffffff;
      font-size: 4.85pt;
      font-weight: 900;
      line-height: 1;
      border-radius: 0.35mm;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="label">
    <p class="header">${headerLabel}</p>
    <div class="content">
      <div class="info">
        <p class="tag">${tag}</p>
        <div class="divider"></div>
        <p class="meta">S/N: ${serial}</p>
        <div class="rows">
          <div class="row">
            <span class="k">EQP:</span>
            <span class="v">${equipo}</span>
          </div>
          <div class="row">
            <span class="k">LOC:</span>
            <span class="v">${ubicacion}</span>
          </div>
        </div>
      </div>
      <div class="qr-panel">
        <div class="badge-wrap">
          <span class="code-badge">${internalCode}</span>
        </div>
        <div class="qr-frame">
          <img class="qr" src="${qrDataUrl}" alt="QR ${tag}" />
        </div>
      </div>
    </div>
    <div class="footer">
      <p class="footer-note">${footerNote}</p>
      <span class="code">ID ${idAsset}</span>
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

  const refreshData = useCallback(async (silent = false) => {
    if (!sessionUser) return;
    if (!silent) setIsSyncing(true);

    try {
      const data = await apiRequest<BootstrapResponse>('/bootstrap');
      setActivos(data.activos);
      setInsumos(data.insumos);
      setTickets(data.tickets);
      setAuditoria(data.auditoria);
      setAuditSummary(null);
      setAuditIntegrity(null);
      setAuditAlerts(null);
      setAuditPagination(buildDefaultAuditPagination(auditPageSize));
      setUsers(data.users || []);
      setCatalogos(normalizeCatalogState(data.catalogos));
      if (data.riskSummary) {
        setAssetRiskSummary(data.riskSummary);
      } else {
        setAssetRiskSummary(calculateAssetRiskSummary(data.activos));
      }
      setBackendConnected(true);
      setLastSync(new Date().toLocaleTimeString());
      fetchAuditHistoryRef.current({ force: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        if (!silent) showToast('Sesión expirada. Inicia sesión nuevamente.', 'warning');
        return;
      }
      setBackendConnected(false);
      setAuditRemoteRows(null);
      setAuditSummary(null);
      setAuditIntegrity(null);
      setAuditAlerts(null);
      setAuditPagination(buildDefaultAuditPagination(auditPageSize));
      showToast(getApiErrorMessage(error) || 'No se pudo sincronizar con el backend', 'warning');
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [auditPageSize, clearSession, sessionUser, showToast]);

  useEffect(() => {
    if (!sessionUser) return;
    void refreshData(true);
  }, [refreshData, sessionUser]);

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
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        showToast('Sesión expirada. Inicia sesión nuevamente.', 'warning');
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
    if (view === 'users' && !canManageUsers) {
      setView('dashboard');
    }
  }, [canManageUsers, view]);

  useEffect(() => {
    if (!selectedSupplyHistoryItem) return;
    const exists = insumos.some((item) => item.id === selectedSupplyHistoryItem.id);
    if (!exists) setSelectedSupplyHistoryItem(null);
  }, [insumos, selectedSupplyHistoryItem]);

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
  }, [formData.activoTag, showModal, ticketAssetOptions]);

  useEffect(() => {
    if (isRequesterOnlyUser && view !== 'tickets') {
      setView('tickets');
    }
  }, [isRequesterOnlyUser, view]);

  useEffect(() => {
    if (!roleCatalogOptions.some((role) => role.value === newUserForm.rol)) {
      const fallbackRole = roleCatalogOptions[0]?.value;
      if (fallbackRole && isUserRole(fallbackRole)) {
        setNewUserForm((prev) => ({ ...prev, rol: fallbackRole }));
      }
    }
  }, [newUserForm.rol, roleCatalogOptions]);


  const stopQrCameraScan = useCallback(() => {
    if (qrScannerIntervalRef.current !== null) {
      window.clearInterval(qrScannerIntervalRef.current);
      qrScannerIntervalRef.current = null;
    }
    const stream = qrScannerStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      qrScannerStreamRef.current = null;
    }
    if (qrScannerVideoRef.current) {
      qrScannerVideoRef.current.srcObject = null;
    }
    qrScannerBusyRef.current = false;
    setIsQrScannerActive(false);
  }, []);

  const resolveQrPayload = useCallback(async (rawInput: string): Promise<boolean> => {
    const raw = String(rawInput || '').trim();
    if (!raw) {
      showToast('QR vacío. Intenta de nuevo.', 'warning');
      return false;
    }

    const signedToken = extractSignedQrToken(raw);
    if (!signedToken) {
      showToast('QR no reconocido. Solo se aceptan QR firmados (mtiqr1).', 'warning');
      return false;
    }

    if (!backendConnected) {
        showToast('El QR firmado requiere backend online para validación', 'warning');
        return false;
      }

      setIsResolvingQr(true);
      try {
        const result = await apiRequest<AssetQrResolveResponse>(`/qr/resolve/${encodeURIComponent(signedToken)}`);
        const resolvedFromApi = toActivoFromQrLookup(result.asset || {});
        if (!resolvedFromApi) {
          showToast('QR válido pero sin datos de activo', 'warning');
          return false;
        }

        const localMatch = activos.find((asset) => Number(asset.id) === Number(resolvedFromApi.id));
        const nextAsset = localMatch || resolvedFromApi;
        setView('inventory');
        setSearchTerm(nextAsset.tag);
        setSelectedAsset(nextAsset);
        showToast(`Activo ${nextAsset.tag} resuelto por QR`, 'success');
        return true;
      } catch (error) {
        showToast(getApiErrorMessage(error) || 'No se pudo resolver el QR firmado', 'error');
        return false;
      } finally {
        setIsResolvingQr(false);
      }

  }, [activos, backendConnected, showToast]);

  const resolveQrFromManualInput = useCallback(async () => {
    const ok = await resolveQrPayload(qrManualInput);
    if (ok) setShowQrScanner(false);
  }, [qrManualInput, resolveQrPayload]);

  useEffect(() => {
    if (!showQrScanner) {
      stopQrCameraScan();
      setQrScannerStatus('Escanea un QR firmado (mtiqr1).');
      return;
    }

    if (!backendConnected) {
      stopQrCameraScan();
      setQrScannerStatus('La validacion QR requiere backend online.');
      return;
    }

    if (!isQrCameraSupported) {
      setQrScannerStatus('Escaneo por cámara no disponible en este navegador. Usa resolución manual.');
      return;
    }

    let cancelled = false;
    setQrScannerStatus('Solicitando acceso a cámara...');

    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }

        qrScannerStreamRef.current = media;
        const video = qrScannerVideoRef.current;
        if (!video) {
          media.getTracks().forEach((track) => track.stop());
          qrScannerStreamRef.current = null;
          setQrScannerStatus('No se pudo inicializar la vista de cámara.');
          return;
        }

        video.srcObject = media;
        await video.play().catch(() => undefined);

        const detectorCtor = (window as unknown as {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
          };
        }).BarcodeDetector;

        if (!detectorCtor) {
          setQrScannerStatus('Detector QR no disponible en este navegador.');
          return;
        }

        const detector = new detectorCtor({ formats: ['qr_code'] });
        setIsQrScannerActive(true);
        setQrScannerStatus('Apunta la cámara al QR...');

        qrScannerIntervalRef.current = window.setInterval(() => {
          void (async () => {
            const currentVideo = qrScannerVideoRef.current;
            if (!currentVideo || currentVideo.readyState < 2) return;
            if (qrScannerBusyRef.current || isResolvingQr) return;

            qrScannerBusyRef.current = true;
            try {
              const detected = await detector.detect(currentVideo);
              const rawValue = String(detected?.[0]?.rawValue || '').trim();
              if (!rawValue) return;

              setQrManualInput(rawValue);
              setQrScannerStatus('QR detectado, resolviendo...');
              stopQrCameraScan();

              const ok = await resolveQrPayload(rawValue);
              if (ok) {
                setShowQrScanner(false);
              } else {
                setQrScannerStatus('No se pudo resolver. Solo se aceptan QR firmados (mtiqr1).');
              }
            } catch {
              // Ignora errores intermitentes del detector/cámara.
            } finally {
              qrScannerBusyRef.current = false;
            }
          })();
        }, 420);
      } catch {
        setQrScannerStatus('No se pudo acceder a la cámara. Usa resolución manual.');
      }
    })();

    return () => {
      cancelled = true;
      stopQrCameraScan();
    };
  }, [backendConnected, isQrCameraSupported, isResolvingQr, resolveQrPayload, showQrScanner, stopQrCameraScan]);

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

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageUsers) {
      showToast('Solo administradores pueden crear usuarios', 'warning');
      return;
    }

    const isEditing = editingUserId !== null;
    const nombre = newUserForm.nombre.trim();
    const username = newUserForm.username.trim().toLowerCase();
    const password = newUserForm.password;
    const departamento = newUserForm.departamento.trim().toUpperCase();
    const rol = newUserForm.rol;

    if (!nombre || !username || !departamento) {
      showToast('Completa nombre, usuario y cargo', 'warning');
      return;
    }
    if (!isEditing && !password) {
      showToast('Password requerido para nuevo usuario', 'warning');
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      showToast('Usuario inválido: usa a-z, 0-9, ., _, - (3 a 32)', 'warning');
      return;
    }
    if (password && password.length < 6) {
      showToast('El password debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (users.some((u) => normalizeForCompare(u.username) === normalizeForCompare(username) && (!isEditing || u.id !== editingUserId))) {
      showToast('El usuario ya existe', 'warning');
      return;
    }
    if (!ensureBackendConnected('Guardar usuarios')) return;

    setIsCreatingUser(true);
    try {
      if (isEditing && editingUserId !== null) {
        const payload: Record<string, unknown> = { nombre, username, departamento, rol };
        if (password) payload.password = password;
        await apiRequest<UserItem>(`/users/${editingUserId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest<UserItem>('/users', {
          method: 'POST',
          body: JSON.stringify({
            nombre,
            username,
            password,
            departamento,
            rol,
          }),
        });
      }
      await refreshData(true);
      showToast(isEditing ? `Usuario ${username} actualizado` : `Usuario ${username} creado`, 'success');
      resetNewUserForm();
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el usuario', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = (user: UserItem) => {
    if (!canManageUsers) return;
    const currentCargo = String(user.departamento || '').trim().toUpperCase();
    const isKnownCargo = userCargoOptions.some((cargo) => cargo.value === currentCargo);
    setEditingUserId(user.id);
    setNewUserForm({
      nombre: user.nombre,
      username: user.username,
      password: '',
      departamento: isKnownCargo ? currentCargo : '',
      rol: user.rol,
    });
  };

  const handleToggleUserActive = async (user: UserItem) => {
    if (!canManageUsers) return;
    if (sessionUser && user.id === sessionUser.id) {
      showToast('No puedes desactivar tu propio usuario', 'warning');
      return;
    }

    const nextActive = user.activo === false;
    if (!ensureBackendConnected('Actualizar usuarios')) return;
    setUserActionLoadingId(user.id);
    try {
      await apiRequest<UserItem>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: nextActive }),
      });
      await refreshData(true);
      showToast(nextActive ? 'Usuario activado' : 'Usuario desactivado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el estado del usuario', 'error');
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (!canManageUsers) return;
    if (sessionUser && user.id === sessionUser.id) {
      showToast('No puedes eliminar tu propio usuario', 'warning');
      return;
    }
    const ok = window.confirm(`Eliminar usuario ${user.username}?`);
    if (!ok) return;

    if (!ensureBackendConnected('Eliminar usuarios')) return;
    setUserActionLoadingId(user.id);
    try {
      await apiRequest<{ ok: boolean }>(`/users/${user.id}`, {
        method: 'DELETE',
      });
      await refreshData(true);

      if (editingUserId === user.id) {
        resetNewUserForm();
      }
      showToast('Usuario eliminado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el usuario', 'error');
    } finally {
      setUserActionLoadingId(null);
    }
  };

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
        showToast('El archivo está vacío', 'warning');
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
            reason: 'Fila inválida o sin identificador utilizable.',
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
            ? `No se importaron filas válidas. Inválidas: ${invalidRows}`
            : 'No se encontraron equipos válidos',
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
        `inválidos: ${invalidTotal}`,
      ];
      showToast(parts.join(' | '), invalidTotal > 0 ? 'warning' : 'success');
      setImportDraft(null);
    } catch (error) {
      const message = getApiErrorMessage(error) || 'No se pudo confirmar la importación';
      showToast(message, 'error');
    } finally {
      setIsApplyingImport(false);
    }
  };

  const registrarLog = (
    accion: string,
    item: string,
    cantidad: number,
    modulo: AuditModule,
    extra: Partial<RegistroAuditoria> = {},
  ) => {
    const now = new Date();
    const nuevoLog: RegistroAuditoria = {
      id: Date.now(),
      accion,
      item,
      cantidad,
      fecha: now.toLocaleString(),
      timestamp: now.toISOString(),
      usuario: sessionUser?.nombre || 'Sistema',
      modulo,
      ...extra,
    };
    setAuditoria((prev) => [nuevoLog, ...prev]);
  };

  const ajustarStock = async (id: number, cantidad: number) => {
    setSupplyStockDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }
    if (!ensureBackendConnected('Actualizar stock')) return;

    try {
      await apiRequest(`/insumos/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          delta: cantidad,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
    } catch {
      showToast('No se pudo actualizar el stock', 'error');
    }
  };

  const reponerCriticos = async (cantidad = 5) => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }

    const target = insumos.filter((item) => getSupplyHealthStatus(item) !== 'OK');
    if (target.length === 0) {
      showToast('No hay insumos criticos para reponer', 'warning');
      return;
    }

    if (!ensureBackendConnected('Reponer insumos')) return;

    try {
      await Promise.all(
        target.map((item) =>
          apiRequest(`/insumos/${item.id}/stock`, {
            method: 'PATCH',
            body: JSON.stringify({
              delta: cantidad,
              usuario: sessionUser?.nombre || 'Admin IT',
              rol: sessionUser?.rol || 'admin',
            }),
          }),
        ),
      );
      await refreshData(true);
      showToast(`Reposicion aplicada a ${target.length} insumos criticos`, 'success');
    } catch {
      showToast('No se pudo ejecutar la reposicion masiva', 'error');
    }
  };

  const establecerStockManual = async (id: number, valor: string): Promise<boolean> => {
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return false;
    }

    const rawValue = valor.trim();
    if (!rawValue) return false;
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) return false;
    const nuevaCantidad = Math.trunc(parsedValue);
    if (!ensureBackendConnected('Establecer stock manual')) return false;

    try {
      await apiRequest(`/insumos/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          stock: nuevaCantidad,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      return true;
    } catch {
      showToast('No se pudo establecer el stock', 'error');
      return false;
    }
  };

  const confirmarStockManual = async (id: number) => {
    const draft = supplyStockDrafts[id];
    if (draft === undefined) return;

    const item = insumos.find((s) => s.id === id);
    const clearDraft = () =>
      setSupplyStockDrafts((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

    if (!item) {
      clearDraft();
      return;
    }

    const normalized = draft.trim();
    if (!normalized) {
      clearDraft();
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast('Ingresa un stock válido (0 o mayor)', 'warning');
      clearDraft();
      return;
    }

    const nextStock = String(Math.trunc(parsed));
    if (nextStock === String(item.stock)) {
      clearDraft();
      return;
    }

    const updated = await establecerStockManual(id, nextStock);
    if (updated) clearDraft();
  };

  const eliminarInsumo = async (id: number, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.stopPropagation();
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return;
    }
    const itemToDelete = insumos.find((i) => i.id === id);
    if (!itemToDelete) return;

    const confirmacion = window.confirm(`Estas seguro de eliminar "${itemToDelete.nombre}"?`);
    if (!confirmacion) return;
    if (!ensureBackendConnected('Eliminar insumos')) return;

    try {
      await apiRequest(`/insumos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      showToast('Insumo eliminado', 'success');
    } catch {
      showToast('No se pudo eliminar el insumo', 'error');
    }
  };

  const eliminarActivo = async (id: number, e?: React.MouseEvent<HTMLElement>): Promise<boolean> => {
    if (e) e.stopPropagation();
    if (isReadOnly) {
      showToast('Tu rol es solo consulta', 'warning');
      return false;
    }
    const activoToDelete = activos.find((a) => a.id === id);
    if (!activoToDelete) return false;

    const confirmacion = window.confirm(`Eliminar activo ${activoToDelete.tag}?`);
    if (!confirmacion) return false;
    if (!ensureBackendConnected('Eliminar activos')) return false;

    try {
      await apiRequest(`/activos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      showToast(`Activo ${activoToDelete.tag} dado de baja`, 'success');
      return true;
    } catch {
      showToast('No se pudo eliminar el activo', 'error');
      return false;
    }
  };

  const eliminarTodosActivos = async (): Promise<boolean> => {
    if (!canManageUsers) {
      showToast('Solo administradores pueden borrar todos los activos', 'warning');
      return false;
    }
    if (activos.length === 0) {
      showToast('No hay activos para eliminar', 'warning');
      return false;
    }

    const confirmacionInicial = window.confirm(`Se eliminaran ${activos.length} activos de forma permanente. Continuar?`);
    if (!confirmacionInicial) return false;
    const confirmacionFinal = window.confirm('Esta accion no se puede deshacer. Confirmas borrar TODO el inventario de activos IT?');
    if (!confirmacionFinal) return false;
    if (!ensureBackendConnected('Eliminar el inventario completo')) return false;

    try {
      const result = await apiRequest<{ ok: boolean; removedCount?: number }>('/activos', {
        method: 'DELETE',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      setSelectedAsset(null);
      const removedCount = Number(result?.removedCount || 0);
      if (removedCount <= 0) {
        showToast('No habia activos para eliminar', 'warning');
      } else {
        showToast(`Se eliminaron ${removedCount} activos`, 'success');
      }
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        showToast('Sesion expirada. Inicia sesion nuevamente.', 'warning');
        return false;
      }
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el inventario de activos', 'error');
      return false;
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
      showToast('Tu rol no permite esta acción', 'warning');
      return;
    }
    if (!ensureBackendConnected(isTicketModal ? 'Crear tickets' : 'Guardar cambios')) return;
    const prioridad = formData.prioridad || 'MEDIA';
    setIsModalSaving(true);

    try {
      if (modalType === 'activo') {
        const isEditingAsset = editingAssetId !== null;
        const activoPayload = {
          tag: formData.tag || '',
          tipo: formData.tipo || '',
          marca: formData.marca || '',
          modelo: formData.modelo || '',
          ubicacion: formData.ubicacion || '',
          serial: formData.serial || '',
          fechaCompra: formData.fechaCompra || '',
          estado: formData.estado || 'Operativo',
          idInterno: formData.idInterno || '',
          equipo: formData.equipo || formData.tipo || '',
          cpu: formData.cpu || '',
          ram: formData.ram || '',
          ramTipo: formData.ramTipo || '',
          disco: formData.disco || '',
          tipoDisco: formData.tipoDisco || '',
          macAddress: formData.macAddress || '',
          ipAddress: formData.ipAddress || '',
          responsable: formData.responsable || '',
          departamento: formData.departamento || '',
          anydesk: formData.anydesk || '',
          aniosVida: formData.aniosVida || '',
          comentarios: formData.comentarios || '',
        };

        const method = isEditingAsset ? 'PATCH' : 'POST';
        const path = isEditingAsset ? `/activos/${editingAssetId}` : '/activos';
        await apiRequest(path, {
          method,
          body: JSON.stringify({
            ...activoPayload,
            usuario: sessionUser?.nombre || 'Admin IT',
            rol: sessionUser?.rol || 'admin',
          }),
        });
        await refreshData(true);
        showToast(editingAssetId !== null ? 'Activo actualizado' : 'Activo registrado', 'success');
      } else if (modalType === 'insumo') {
        setInsumoTouched({
          nombre: true,
          unidad: true,
          stock: true,
          min: true,
          categoria: true,
        });
        if (!insumoFormValidation.isValid) {
          showToast(insumoFormValidation.firstError || 'Completa los campos requeridos', 'warning');
          return;
        }
        const nombre = insumoFormValidation.nombre;
        const unidad = insumoFormValidation.unidad;
        const categoria = insumoFormValidation.categoria;
        const stock = insumoFormValidation.stock as number;
        const min = insumoFormValidation.min as number;
        const isEditingInsumo = editingInsumoId !== null;

        await apiRequest(isEditingInsumo ? `/insumos/${editingInsumoId}` : '/insumos', {
          method: isEditingInsumo ? 'PATCH' : 'POST',
          body: JSON.stringify({
            nombre,
            unidad,
            stock,
            min,
            categoria,
            usuario: sessionUser?.nombre || 'Admin IT',
            rol: sessionUser?.rol || 'admin',
          }),
        });
        await refreshData(true);
        showToast(editingInsumoId !== null ? 'Insumo actualizado' : 'Insumo añadido', 'success');
      } else if (modalType === 'ticket') {
        const activoTag = String(formData.activoTag || '').trim().toUpperCase();
        const sucursal = String(formData.sucursal || '').trim().toUpperCase();
        const areaAfectada = String(formData.areaAfectada || '').trim();
        const atencionTipo = normalizeTicketAttentionType(formData.atencionTipo);
        const descripcionBase = String(formData.descripcion || '').trim();
        const ticketValidationError = !isValidTicketBranchValue(sucursal)
          ? 'Selecciona una sucursal válida para el ticket'
          : ticketAssetOptions.length === 0
            ? 'No hay activos registrados en la sucursal seleccionada'
            : !activoTag
              ? 'Selecciona un TAG del equipo'
              : !ticketAssetOptions.some((option) => option.tag === activoTag)
                ? 'Selecciona un TAG válido para la sucursal elegida'
                : !areaAfectada
                  ? 'Selecciona área afectada'
                  : !atencionTipo
                    ? 'Selecciona si la atención fue presencial o remota'
                    : !descripcionBase
                      ? 'Agrega la descripción de la falla'
                      : '';
        if (ticketValidationError) {
          showToast(ticketValidationError, 'warning');
          return;
        }
        const descripcionFinal = buildTicketDescription(areaAfectada, descripcionBase);

        await apiRequest('/tickets', {
          method: 'POST',
          body: JSON.stringify({
            activoTag,
            descripcion: descripcionFinal,
            sucursal,
            prioridad,
            atencionTipo,
            asignadoA: canEdit ? (formData.asignadoA || '') : '',
            usuario: sessionUser?.nombre || 'Admin IT',
            rol: sessionUser?.rol || 'admin',
            departamento: sessionUser?.departamento || '',
          }),
        });
        await refreshData(true);
        showToast('Ticket creado', 'success');
      }

      closeModal();
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el registro', 'error');
    } finally {
      setIsModalSaving(false);
    }
  };

  const resolverTicket = async (id: number) => {
    if (!canEdit) {
      showToast('Tu rol no permite resolver tickets', 'warning');
      return;
    }
    if (!ensureBackendConnected('Resolver tickets')) return;

    try {
      await apiRequest(`/tickets/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      showToast('Ticket cerrado', 'success');
    } catch {
      showToast('No se pudo cerrar el ticket', 'error');
    }
  };

  const eliminarTicket = async (ticketId: number) => {
    const ticketToDelete = tickets.find((ticket) => ticket.id === ticketId);
    if (!ticketToDelete) return;
    if (!canDeleteTicket(ticketToDelete)) {
      showToast('No autorizado para eliminar este ticket', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `Eliminar ticket #${ticketToDelete.id} (${ticketToDelete.activoTag})? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) return;
    if (!ensureBackendConnected('Eliminar tickets')) return;

    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: 'DELETE',
      });
      await refreshData(true);
      showToast('Ticket eliminado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el ticket', 'error');
    }
  };

  const actualizarTicket = async (ticketId: number, updates: { estado?: TicketEstado; asignadoA?: string; comentario?: string; atencionTipo?: TicketAttentionType }) => {
    if (!canEdit) {
      showToast('Tu rol no permite editar tickets', 'warning');
      return;
    }
    if (!ensureBackendConnected('Actualizar tickets')) return;

    try {
      await apiRequest(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...updates,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      await refreshData(true);
      showToast('Ticket actualizado', 'success');
    } catch {
      showToast('No se pudo actualizar el ticket', 'error');
    }
  };

  const agregarComentarioTicket = async (ticketId: number) => {
    if (!canCreateTickets) {
      showToast('Tu rol no permite comentar tickets', 'warning');
      return;
    }
    const comentario = String(ticketCommentDrafts[ticketId] || '').trim();
    if (!comentario) {
      showToast('Escribe un comentario para guardar', 'warning');
      return;
    }

    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) return;
    if (!canAccessTicketBySession(target)) {
      showToast('Solo puedes comentar tus propios tickets', 'warning');
      return;
    }
    if (!ensureBackendConnected('Agregar comentarios')) return;

    try {
      const updatedTicket = await apiRequest<TicketItem>(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comentario,
          usuario: sessionUser?.nombre || 'Sistema',
          rol: sessionUser?.rol || 'consulta',
        }),
      });
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket)));
      setTicketCommentDrafts((prev) => ({
        ...prev,
        [ticketId]: '',
      }));
      showToast('Comentario agregado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el comentario', 'error');
    }
  };

  const cargarAdjuntoTicket = async (ticketId: number, files: FileList | null) => {
    if (!canCreateTickets) {
      showToast('Tu rol no permite adjuntar archivos', 'warning');
      return;
    }
    const file = files?.[0];
    if (!file) return;

    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) return;
    if (!canAccessTicketBySession(target)) {
      showToast('Solo puedes adjuntar archivos a tus propios tickets', 'warning');
      return;
    }
    const currentAttachments = target.attachments || [];
    if (currentAttachments.length >= CLIENT_ATTACHMENT_MAX_COUNT) {
      showToast(`Limite de ${CLIENT_ATTACHMENT_MAX_COUNT} adjuntos por ticket alcanzado`, 'warning');
      return;
    }
    if (file.size > CLIENT_ATTACHMENT_MAX_BYTES) {
      const maxMb = Math.round((CLIENT_ATTACHMENT_MAX_BYTES / (1024 * 1024)) * 10) / 10;
      showToast(`Adjunto excede limite de ${maxMb} MB`, 'warning');
      return;
    }
    if (!ensureBackendConnected('Adjuntar archivos')) return;

    setTicketAttachmentLoadingId(ticketId);
    try {
      const contentBase64 = await fileToBase64(file);
      const response = await apiRequest<TicketAttachmentUploadResponse>(`/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          usuario: sessionUser?.nombre || 'Sistema',
          rol: sessionUser?.rol || 'consulta',
        }),
      });
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? response.ticket : ticket)));
      showToast('Adjunto agregado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo adjuntar el archivo', 'error');
    } finally {
      setTicketAttachmentLoadingId(null);
    }
  };

  const descargarAdjuntoTicket = async (ticketId: number, attachment: TicketAttachment) => {
    try {
      const targetTicket = tickets.find((ticket) => ticket.id === ticketId);
      if (targetTicket && !canAccessTicketBySession(targetTicket)) {
        showToast('Solo puedes descargar adjuntos de tus propios tickets', 'warning');
        return;
      }
      if (backendConnected && !attachment.localOnly) {
        const token = getStoredSessionToken();
        const response = await fetch(buildApiUrl(`/tickets/${ticketId}/attachments/${attachment.id}/download`), {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          const raw = await response.text();
          throw new ApiError(response.status, raw || `HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName || `adjunto_${attachment.id}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }

      if (attachment.localUrl) {
        const link = document.createElement('a');
        link.href = attachment.localUrl;
        link.download = attachment.fileName || `adjunto_${attachment.id}`;
        link.click();
        return;
      }

      showToast('Adjunto no disponible para descarga', 'warning');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo descargar el adjunto', 'error');
    }
  };

  const eliminarAdjuntoTicket = async (ticketId: number, attachment: TicketAttachment) => {
    if (!canEdit) {
      showToast('Tu rol no permite eliminar adjuntos', 'warning');
      return;
    }
    const target = tickets.find((ticket) => ticket.id === ticketId);
    if (!target) return;
    const confirmacion = window.confirm(`Eliminar adjunto "${attachment.fileName}" del ticket #${ticketId}?`);
    if (!confirmacion) return;
    if (!ensureBackendConnected('Eliminar adjuntos')) return;

    try {
      if (backendConnected && !attachment.localOnly) {
        const updatedTicket = await apiRequest<TicketItem>(`/tickets/${ticketId}/attachments/${attachment.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            usuario: sessionUser?.nombre || 'Sistema',
            rol: sessionUser?.rol || 'tecnico',
          }),
        });
        setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket)));
      } else {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId
              ? {
                ...ticket,
                attachments: (ticket.attachments || []).filter((item) => item.id !== attachment.id),
                historial: [
                  buildTicketHistoryEntry('Adjunto eliminado', ticket.estado, sessionUser?.nombre || 'Sistema', attachment.fileName),
                  ...(ticket.historial || []),
                ],
              }
              : ticket,
          ),
        );
        registrarLog('Adjunto Ticket', `${target.activoTag} | ${attachment.fileName} | eliminado`, 1, 'tickets');
      }
      showToast('Adjunto eliminado', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el adjunto', 'error');
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
    setSearchTerm('');
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
  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        const deptCompare = normalizeForCompare(left.departamento || '').localeCompare(normalizeForCompare(right.departamento || ''));
        if (deptCompare !== 0) return deptCompare;
        return normalizeForCompare(left.nombre).localeCompare(normalizeForCompare(right.nombre));
      }),
    [users],
  );
  const activeUsersCount = useMemo(
    () => users.filter((user) => user.activo !== false).length,
    [users],
  );
  const requesterUsersCount = useMemo(
    () => users.filter((user) => user.rol === 'solicitante').length,
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
  const supplyAuditMovementsByInsumoId = useMemo(() => {
    const insumoById = new Map(insumos.map((item) => [item.id, item]));
    const insumoIdByName = new Map(
      insumos.map((item) => [normalizeForCompare(item.nombre), item.id]),
    );
    const grouped: Record<number, SupplyAuditMovement[]> = {};

    normalizedAuditRows.forEach((log) => {
      if (resolveAuditModule(log) !== 'insumos') return;

      const action = normalizeForCompare(log.accion || '');
      const isSupplyMovement =
        action.includes('entrada')
        || action.includes('salida')
        || action.includes('ajuste')
        || action.includes('registro nuevo')
        || action.includes('edicion insumo')
        || action.includes('baja logica')
        || action.includes('baja');
      if (!isSupplyMovement) return;

      let insumoId: number | null = null;
      const entityId = Number(log.entidadId);
      if (Number.isFinite(entityId) && insumoById.has(Math.trunc(entityId))) {
        insumoId = Math.trunc(entityId);
      } else {
        const fallbackId = insumoIdByName.get(normalizeForCompare(log.item || ''));
        if (typeof fallbackId === 'number') insumoId = fallbackId;
      }
      if (insumoId === null) return;

      const movement: SupplyAuditMovement = {
        logId: Math.trunc(Number(log.id) || 0),
        insumoId,
        accion: String(log.accion || 'Movimiento'),
        cantidad: Math.max(0, Math.trunc(Number(log.cantidad) || 0)),
        usuario: String(log.usuario || log.username || 'Sistema').trim() || 'Sistema',
        fecha: String(log.timestamp || log.fecha || '').trim(),
        timestampMs: getAuditRowTimestampMs(log) || 0,
        resultado: String(log.resultado || 'ok').toLowerCase() === 'error' ? 'error' : 'ok',
      };

      if (!grouped[insumoId]) grouped[insumoId] = [];
      grouped[insumoId].push(movement);
    });

    Object.values(grouped).forEach((rows) => {
      rows.sort((left, right) => {
        if (left.timestampMs !== right.timestampMs) return right.timestampMs - left.timestampMs;
        return right.logId - left.logId;
      });
    });

    return grouped;
  }, [insumos, normalizedAuditRows]);
  const selectedSupplyMovements = useMemo(() => {
    if (!selectedSupplyHistoryItem) return [] as SupplyAuditMovement[];
    return supplyAuditMovementsByInsumoId[selectedSupplyHistoryItem.id] || [];
  }, [selectedSupplyHistoryItem, supplyAuditMovementsByInsumoId]);
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
  const travelMonthRange = useMemo(
    () => parseMonthInputRange(travelReportMonth),
    [travelReportMonth],
  );
  const effectiveTravelReporterName = useMemo(() => {
    const manual = String(travelReportName || '').trim();
    if (manual) return manual;
    if (travelReportTechnician !== 'TODOS' && travelReportTechnician !== 'SIN_ASIGNAR') {
      const selected = String(travelReportTechnician || '').trim();
      if (selected) return selected;
    }
    const sessionName = String(sessionUser?.nombre || '').trim();
    return sessionName || 'SIN NOMBRE';
  }, [sessionUser?.nombre, travelReportName, travelReportTechnician]);
  const travelReportRows = useMemo(() => {
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
  const travelTripsByCode = useMemo(() => {
    const counts = new Map<string, number>();
    travelReportRows.forEach((row) => {
      counts.set(row.destinationCode, (counts.get(row.destinationCode) || 0) + 1);
    });
    return counts;
  }, [travelReportRows]);
  const travelTotalTrips = travelReportRows.length;
  const travelTotalKms = useMemo(
    () => travelReportRows.reduce((sum, row) => sum + row.kms, 0),
    [travelReportRows],
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
  const reportIncidentCauseMax = Math.max(1, ...reportIncidentCauseBars.map((item) => item.count));
  const reportAuditRows = useMemo(
    () =>
      normalizedAuditRows.filter((log) => {
        const timestamp = getAuditRowTimestampMs(log);
        if (timestamp === null) return false;
        if (reportStartMs !== null && timestamp < reportStartMs) return false;
        if (reportEndMs !== null && timestamp > reportEndMs) return false;
        return true;
      }),
    [normalizedAuditRows, reportEndMs, reportStartMs],
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
  }, [reportBranchFilter, reportBranchOptions]);

  useEffect(() => {
    if (reportAreaFilter !== 'TODAS' && !reportAreaOptions.some((area) => normalizeForCompare(area) === normalizeForCompare(reportAreaFilter))) {
      setReportAreaFilter('TODAS');
    }
  }, [reportAreaFilter, reportAreaOptions]);

  useEffect(() => {
    if (reportTechnicianFilter === 'TODOS' || reportTechnicianFilter === 'SIN_ASIGNAR') return;
    const exists = reportTechnicianOptions.some((name) => normalizeForCompare(name) === normalizeForCompare(reportTechnicianFilter));
    if (!exists) setReportTechnicianFilter('TODOS');
  }, [reportTechnicianFilter, reportTechnicianOptions]);
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
  }, [activeTicketBranches]);
  useEffect(() => {
    if (travelReportTechnician === 'TODOS' || travelReportTechnician === 'SIN_ASIGNAR') return;
    const exists = travelTechnicianOptions.some((name) => normalizeForCompare(name) === normalizeForCompare(travelReportTechnician));
    if (!exists) setTravelReportTechnician('TODOS');
  }, [travelReportTechnician, travelTechnicianOptions]);

  const applyTicketFocus = (focus: 'ABIERTOS' | 'SLA' | 'CRITICA' | 'SIN_ASIGNAR' | 'EN_PROCESO') => {
    setView('tickets');
    setSearchTerm('');
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
    setSearchTerm('');

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
  }, [reportCurrentFilterSnapshot, reportFilterPresets, reportPresetName, sessionUser, showToast]);
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
  }, [sessionUser, showToast]);
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
    if (!selectedIssueArea) return [] as string[];
    const match = COMMON_TICKET_ISSUES.find((group) => group.area === selectedIssueArea);
    return match ? [...match.issues] : [];
  }, [selectedIssueArea]);

  const systemHealth = activos.length > 0 ? Math.round((activos.filter(a => a.estado === 'Operativo').length / activos.length) * 100) : 100;

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          className="fixed top-4 right-4 z-20 w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="bg-white w-full max-w-md rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 p-8 sm:p-12 text-center">
          <div className="flex justify-center mb-6"><LogoGigantes className="w-20 h-20 sm:w-24 sm:h-24 animate-bounce" /></div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F58220]">LOS GIGANTES</h1>
          <p className="text-[#8CC63F] font-bold text-sm tracking-[0.2em] uppercase mb-8">IT Management System</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Usuario</label>
              <input
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none"
                value={loginForm.username}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Password</label>
              <input
                type="password"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none"
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Ingresa tu password"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full bg-[#F58220] text-white font-black py-4 rounded-3xl shadow-xl hover:scale-[1.02] transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              <User size={18} /> {loginLoading ? 'Entrando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-left text-[10px] text-slate-400 font-black uppercase tracking-wider">
            <p>Solicita tus credenciales al administrador del sistema.</p>
            <p className="mt-2 text-[9px] font-semibold normal-case tracking-normal text-slate-300">{AUTHOR_SIGNATURE}</p>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-700 overflow-x-hidden">
      <AppSidebar
        view={view}
        navItems={visibleNavItems}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        authorBrand={AUTHOR_BRAND}
        onSelectView={(nextView) => {
          setView(nextView);
          setSidebarOpen(false);
        }}
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



            {/* VISTA DASHBOARD */}
            {view === 'dashboard' && (
              <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Cargando Dashboard...</div>}>
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
                />
              </React.Suspense>
            )}

            {/* VISTA REPORTERIA */}
            {view === 'reports' && (
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analitica Operativa</p>
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Reporteria Ejecutiva</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={openReportExecutivePresentation}
                        className="px-4 py-3 rounded-2xl border border-indigo-200 bg-indigo-50 text-xs font-black uppercase text-indigo-700 hover:bg-indigo-100"
                      >
                        Abrir Presentacion
                      </button>
                      <button
                        onClick={() => void exportReportExcel()}
                        className="px-4 py-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs font-black uppercase text-emerald-700 hover:bg-emerald-100"
                      >
                        Exportar Excel
                      </button>
                      <button
                        onClick={exportReportPdf}
                        className="px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50 text-xs font-black uppercase text-blue-700 hover:bg-blue-100"
                      >
                        Exportar PDF
                      </button>
                    </div>
                  </div>

                  <div className="p-8 border-b border-slate-50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-9 gap-3">
                      <input
                        type="date"
                        value={reportDateFrom}
                        onChange={(e) => setReportDateFrom(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <input
                        type="date"
                        value={reportDateTo}
                        onChange={(e) => setReportDateTo(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <select
                        value={reportBranchFilter}
                        onChange={(e) => setReportBranchFilter(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODAS">Sucursal: todas</option>
                        {reportBranchOptions.map((code) => (
                          <option key={`rep-branch-${code}`} value={code}>
                            {formatTicketBranchFromCatalog(code)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={reportAreaFilter}
                        onChange={(e) => setReportAreaFilter(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODAS">Area: todas</option>
                        {reportAreaOptions.map((area) => (
                          <option key={`rep-area-${area}`} value={area}>{area}</option>
                        ))}
                      </select>
                      <select
                        value={reportStateFilter}
                        onChange={(e) => setReportStateFilter(e.target.value as ReportStateFilter)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODOS">Estado: todos</option>
                        {TICKET_STATES.map((state) => (
                          <option key={`rep-state-${state}`} value={state}>{state}</option>
                        ))}
                      </select>
                      <select
                        value={reportPriorityFilter}
                        onChange={(e) => setReportPriorityFilter(e.target.value as ReportPriorityFilter)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODAS">Prioridad: todas</option>
                        <option value="MEDIA">Media</option>
                        <option value="ALTA">Alta</option>
                        <option value="CRITICA">Critica</option>
                      </select>
                      <select
                        value={reportAttentionFilter}
                        onChange={(e) => setReportAttentionFilter(e.target.value as ReportAttentionFilter)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODAS">Atencion: todas</option>
                        {TICKET_ATTENTION_TYPES.map((type) => (
                          <option key={`rep-attention-${type}`} value={type}>{formatTicketAttentionType(type)}</option>
                        ))}
                      </select>
                      <select
                        value={reportTechnicianFilter}
                        onChange={(e) => setReportTechnicianFilter(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODOS">Tecnico: todos</option>
                        <option value="SIN_ASIGNAR">Tecnico: sin asignar</option>
                        {reportTechnicianOptions.map((name) => (
                          <option key={`rep-tech-${name}`} value={name}>{name}</option>
                        ))}
                      </select>
                      <button
                        onClick={resetReportFilters}
                        className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                      >
                        Limpiar
                      </button>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={reportPresetName}
                          onChange={(e) => setReportPresetName(e.target.value)}
                          placeholder="Nombre del preset"
                          className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                        />
                        <button
                          onClick={saveCurrentReportFilterPreset}
                          className="px-4 py-3 rounded-2xl border border-indigo-200 bg-indigo-50 text-xs font-black uppercase text-indigo-700 hover:bg-indigo-100"
                        >
                          Guardar Preset
                        </button>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 self-center">
                        Presets guardados: {reportFilterPresets.length}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {reportFilterPresets.map((preset) => (
                        <div key={preset.id} className="flex items-center rounded-2xl border border-slate-200 overflow-hidden bg-white">
                          <button
                            onClick={() => applyReportFilterPreset(preset)}
                            className="px-3 py-2 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-50"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deleteReportFilterPreset(preset)}
                            className="px-3 py-2 text-[10px] font-black uppercase text-red-500 border-l border-slate-200 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                      {reportFilterPresets.length === 0 && (
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          No hay presets guardados para este usuario.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
                  <div className="p-8 border-b border-slate-50 bg-amber-50/30 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Movilidad y combustible</p>
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Formato Mensual de Viajes IT</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={openTravelMovementSheet}
                        className="px-4 py-3 rounded-2xl border border-amber-300 bg-amber-100 text-xs font-black uppercase text-amber-800 hover:bg-amber-200"
                      >
                        Abrir Formato
                      </button>
                      <button
                        onClick={printTravelMovementSheet}
                        className="px-4 py-3 rounded-2xl border border-orange-300 bg-orange-100 text-xs font-black uppercase text-orange-800 hover:bg-orange-200"
                      >
                        Imprimir Formato
                      </button>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                      <input
                        type="month"
                        value={travelReportMonth}
                        onChange={(e) => setTravelReportMonth(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <select
                        value={travelReportTechnician}
                        onChange={(e) => setTravelReportTechnician(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      >
                        <option value="TODOS">Tecnico: todos</option>
                        <option value="SIN_ASIGNAR">Tecnico: sin asignar</option>
                        {travelTechnicianOptions.map((name) => (
                          <option key={`travel-tech-${name}`} value={name}>{name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={travelReportName}
                        onChange={(e) => setTravelReportName(e.target.value)}
                        placeholder="Nombre en formato"
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <input
                        type="text"
                        value={travelReportDepartment}
                        onChange={(e) => setTravelReportDepartment(e.target.value.toUpperCase())}
                        placeholder="Departamento"
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <input
                        type="text"
                        value={travelReportFuelEfficiency}
                        onChange={(e) => setTravelReportFuelEfficiency(e.target.value)}
                        placeholder="Rendimiento km/l"
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <input
                        type="text"
                        value={travelReportAuthorizer}
                        onChange={(e) => setTravelReportAuthorizer(e.target.value.toUpperCase())}
                        placeholder="Autoriza"
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                      <input
                        type="text"
                        value={travelReportFinance}
                        onChange={(e) => setTravelReportFinance(e.target.value.toUpperCase())}
                        placeholder="Finanzas"
                        className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Tabla de rutas / kms base (editable)
                        </p>
                        <div className="space-y-2">
                          {travelDestinationRules.map((row) => (
                            <div key={`travel-kms-${row.code}`} className="grid grid-cols-[42px_1fr_88px_66px] items-center gap-2">
                              <div className="text-xs font-black uppercase text-slate-500 text-center">#{row.index}</div>
                              <div className="text-xs font-black uppercase text-slate-700">{row.label}</div>
                              <input
                                value={travelKmsByBranch[row.code] ?? String(row.kms)}
                                onChange={(e) =>
                                  setTravelKmsByBranch((prev) => ({
                                    ...prev,
                                    [row.code]: e.target.value,
                                  }))
                                }
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-700 text-center"
                              />
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">
                                Viajes: {travelTripsByCode.get(row.code) || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-amber-50/50 p-5 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Resumen del formato</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Mes</p>
                            <p className="text-sm font-black uppercase text-slate-800">{travelMonthLabel}</p>
                          </div>
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Reporta</p>
                            <p className="text-sm font-black uppercase text-slate-800">{effectiveTravelReporterName}</p>
                          </div>
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total viajes</p>
                            <p className="text-2xl font-black text-slate-800">{travelTotalTrips}</p>
                          </div>
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total kms</p>
                            <p className="text-2xl font-black text-slate-800">{formatTravelNumber(travelTotalKms)}</p>
                          </div>
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Rendimiento</p>
                            <p className="text-sm font-black uppercase text-slate-800">{travelFuelEfficiencyValue} km/l</p>
                          </div>
                          <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Litros</p>
                            <p className="text-2xl font-black text-slate-800">{travelFuelEfficiencyValue > 0 ? travelFuelLiters.toFixed(1) : 'N/D'}</p>
                          </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          El formato toma tickets del mes seleccionado y respeta filtros de sucursal, area, estado y prioridad.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tickets</p>
                    <p className="text-3xl font-black text-slate-800">{reportTickets.length}</p>
                    {reportComparisonWindow && (
                      <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportTicketsTrend.toneClass}`}>{reportTicketsTrend.label}</p>
                    )}
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
                    <p className="text-3xl font-black text-blue-600">{reportOpenCount}</p>
                    {reportComparisonWindow && (
                      <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportOpenTrend.toneClass}`}>{reportOpenTrend.label}</p>
                    )}
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cerrados</p>
                    <p className="text-3xl font-black text-green-600">{reportClosedCount}</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Cumplimiento SLA</p>
                    <p className="text-3xl font-black text-green-700">{reportSlaCompliancePct}%</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-600">
                      {reportSlaCompliantCount}/{reportSlaTotalCount} en tiempo
                    </p>
                    {reportComparisonWindow && (
                      <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${reportSlaComplianceTrend.toneClass}`}>{reportSlaComplianceTrend.label}</p>
                    )}
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SLA Vencido</p>
                    <p className="text-3xl font-black text-red-600">{reportSlaExpiredCount}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h4 className="text-base font-black uppercase text-slate-800">
                        Tendencia {reportTrendMode === 'SEMANAL' ? 'Semanal' : 'Diaria'}: Creados vs Cerrados
                      </h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Creado por fecha de alta y cerrado por fecha de cierre
                      </p>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Creados: {reportCreatedInPeriodCount} | Cerrados: {reportClosedInPeriodCount}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {reportLifecycleTrend.map((item) => (
                      <div key={`report-trend-${item.key}`} className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <span>{item.label}</span>
                          <span>Cre: {item.created} | Cer: {item.closed}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="rounded-xl border border-blue-100 bg-blue-50 p-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-blue-700">
                              <span>Creados</span>
                              <span>{item.created}</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-blue-100 overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{ width: `${Math.round((item.created / reportLifecycleTrendMax) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-700">
                              <span>Cerrados</span>
                              <span>{item.closed}</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-emerald-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${Math.round((item.closed / reportLifecycleTrendMax) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {reportLifecycleTrend.length === 0 && (
                      <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Sin datos para tendencia en este periodo.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black uppercase text-slate-800">Tickets por Estado</h4>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drill-down</span>
                    </div>
                    {reportStateBars.map((item) => (
                      <button
                        key={`report-state-${item.label}`}
                        onClick={() => applyReportDrillDown({ estado: item.label as TicketEstado })}
                        className="w-full text-left space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#F58220]"
                            style={{ width: `${Math.round((item.count / reportStateMax) * 100)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black uppercase text-slate-800">Tickets por Sucursal</h4>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drill-down</span>
                    </div>
                    {reportBranchBars.map((item) => (
                      <button
                        key={`report-branch-${item.code}`}
                        onClick={() => applyReportDrillDown({ sucursalCode: item.code })}
                        className="w-full text-left space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${Math.round((item.count / reportBranchMax) * 100)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                    {reportBranchBars.length === 0 && (
                      <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Sin datos de sucursal para este periodo.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
                    <h4 className="text-base font-black uppercase text-slate-800">Top Areas</h4>
                    {reportAreaBars.slice(0, 8).map((item) => (
                      <button
                        key={`report-area-${item.label}`}
                        onClick={() => applyReportDrillDown({ area: item.label })}
                        className="w-full text-left space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.round((item.count / reportAreaMax) * 100)}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
                    <h4 className="text-base font-black uppercase text-slate-800">Carga por Tecnico</h4>
                    {reportTechBars.slice(0, 8).map((item) => (
                      <button
                        key={`report-tech-${item.label}`}
                        onClick={() => item.label !== 'SIN ASIGNAR' && applyReportDrillDown({ asignadoA: item.label })}
                        className="w-full text-left space-y-1 disabled:cursor-not-allowed"
                        disabled={item.label === 'SIN ASIGNAR'}
                      >
                        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${Math.round((item.count / reportTechMax) * 100)}%` }} />
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
                    <h4 className="text-base font-black uppercase text-slate-800">Auditoria por Modulo</h4>
                    {reportAuditModuleBars.map((item) => (
                      <div key={`report-audit-${item.module}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-600">
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: `${Math.round((item.count / reportAuditMax) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Logs filtrados: {reportAuditRows.length} | Total auditoria: {normalizedAuditRows.length}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-black uppercase text-slate-800">Top Causas Recurrentes</h4>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Area + Falla</span>
                  </div>
                  {reportIncidentCauseBars.map((item) => (
                    <button
                      key={`report-cause-${item.key}`}
                      onClick={() => applyReportIncidentCauseDrillDown(item.area, item.cause)}
                      className="w-full text-left space-y-1"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.area}</p>
                      <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-700">
                        <span>{item.cause}</span>
                        <span>{item.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-fuchsia-500"
                          style={{ width: `${Math.round((item.count / reportIncidentCauseMax) * 100)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                  {reportIncidentCauseBars.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-2xl p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Sin incidencias recurrentes para este periodo.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventario</p>
                    <p className="text-sm font-black text-slate-700">Activos: {reportInventorySnapshot.totalActivos} | En falla: {reportInventorySnapshot.activosEnFalla} | Sin responsable: {reportInventorySnapshot.sinResponsable}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Insumos</p>
                    <p className="text-sm font-black text-slate-700">Total: {reportSupplySnapshot.total} | Agotados: {reportSupplySnapshot.agotados} | Bajo minimo: {reportSupplySnapshot.bajoMinimo}</p>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA INVENTARIO */}
            {view === 'inventory' && (
              <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Cargando Inventario...</div>}>
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
                  setSelectedAsset={setSelectedAsset}
                  eliminarActivo={eliminarActivo}
                />
              </React.Suspense>
            )}
            {/* VISTA INSUMOS */}
            {view === 'supplies' && (
              <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Cargando Insumos...</div>}>
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
                  setSelectedSupplyHistoryItem={setSelectedSupplyHistoryItem}
                  ajustarStock={ajustarStock}
                  supplyStockDrafts={supplyStockDrafts}
                  setSupplyStockDrafts={setSupplyStockDrafts}
                  confirmarStockManual={confirmarStockManual}
                />
              </React.Suspense>
            )}
            {/* VISTA AUDITORÍA */}
            {view === 'history' && (
              <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Cargando Historial...</div>}>
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
                />
              </React.Suspense>
            )}

            {/* VISTA USUARIOS */}
            {view === 'users' && (
              <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase text-xs">Cargando Usuarios...</div>}>
                <LazyUsersView
                  canManageUsers={canManageUsers}
                  users={users}
                  activeUsersCount={activeUsersCount}
                  requesterUsersCount={requesterUsersCount}
                  handleCreateUser={handleCreateUser}
                  editingUserId={editingUserId}
                  newUserForm={newUserForm}
                  setNewUserForm={setNewUserForm}
                  userCargoOptions={userCargoOptions}
                  roleCatalogOptions={roleCatalogOptions}
                  isCreatingUser={isCreatingUser}
                  resetNewUserForm={resetNewUserForm}
                  sortedUsers={sortedUsers}
                  formatCargoFromCatalog={formatCargoFromCatalog}
                  roleLabelByValue={roleLabelByValue}
                  rolePermissionsByValue={rolePermissionsByValue}
                  sessionUser={sessionUser}
                  userActionLoadingId={userActionLoadingId}
                  handleEditUser={handleEditUser}
                  handleToggleUserActive={handleToggleUserActive}
                  handleDeleteUser={handleDeleteUser}
                />
              </React.Suspense>
            )}

            {/* VISTA TICKETS */}
            {view === 'tickets' && (
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
                  setSearchTerm('');
                }}
                onStatusChange={(ticketId, estado) => {
                  void actualizarTicket(ticketId, { estado: estado as TicketEstado });
                }}
                onAttentionChange={(ticketId, atencionTipo) => {
                  const value = normalizeTicketAttentionType(atencionTipo);
                  if (!value) return;
                  void actualizarTicket(ticketId, { atencionTipo: value });
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
              />
            )}

          </div>
        </div>
      </main>

      {/* MODAL UNIVERSAL */}
      {currentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className={`bg-white w-full ${modalWidthClass} rounded-[3rem] shadow-2xl overflow-hidden`}>
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 font-black uppercase text-sm">
              {modalTitle}
              <button
                type="button"
                onClick={closeModal}
                disabled={isModalSaving}
                className="text-slate-300 hover:text-red-500 disabled:opacity-40"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-4 max-h-[72vh] overflow-y-auto">
              {isAssetModal && (
                <>
                  <div className="space-y-6">
                    <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Datos Base</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Requeridos: Tag, Tipo, Marca, Serial, Ubicacion</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          required
                          placeholder="TAG *"
                          value={formData.tag || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ tag: e.target.value })}
                        />
                        <input
                          placeholder="ID INTERNO"
                          value={formData.idInterno || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ idInterno: e.target.value })}
                        />
                        <input
                          required
                          placeholder="SERIAL *"
                          value={formData.serial || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ serial: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          required
                          placeholder="TIPO *"
                          value={formData.tipo || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ tipo: e.target.value })}
                        />
                        <input
                          required
                          placeholder="MARCA *"
                          value={formData.marca || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ marca: e.target.value })}
                        />
                        <input
                          placeholder="MODELO"
                          value={formData.modelo || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ modelo: e.target.value })}
                        />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicacion y Estado</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          required
                          placeholder="UBICACION *"
                          value={formData.ubicacion || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ ubicacion: e.target.value })}
                        />
                        <input
                          placeholder="DEPARTAMENTO"
                          value={formData.departamento || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ departamento: e.target.value })}
                        />
                        <input
                          placeholder="RESPONSABLE"
                          value={formData.responsable || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ responsable: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="date"
                          value={formData.fechaCompra || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ fechaCompra: e.target.value })}
                        />
                        <select
                          value={formData.estado || 'Operativo'}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ estado: e.target.value as EstadoActivo })}
                        >
                          <option value="Operativo">Operativo</option>
                          <option value="Falla">Falla</option>
                        </select>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Red y Acceso</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          placeholder="IP ADDRESS"
                          value={formData.ipAddress || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ ipAddress: e.target.value })}
                        />
                        <input
                          placeholder="MAC ADDRESS"
                          value={formData.macAddress || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ macAddress: e.target.value })}
                        />
                        <input
                          placeholder="ANYDESK"
                          value={formData.anydesk || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ anydesk: e.target.value })}
                        />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hardware y Ciclo de Vida</p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input
                          placeholder="CPU"
                          value={formData.cpu || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ cpu: e.target.value })}
                        />
                        <input
                          placeholder="RAM"
                          value={formData.ram || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ ram: e.target.value })}
                        />
                        <input
                          placeholder="TIPO RAM"
                          value={formData.ramTipo || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ ramTipo: e.target.value })}
                        />
                        <input
                          placeholder="DISCO"
                          value={formData.disco || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ disco: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          placeholder="TIPO DISCO"
                          value={formData.tipoDisco || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ tipoDisco: e.target.value })}
                        />
                        <input
                          placeholder="ANOS DE VIDA"
                          value={formData.aniosVida || ''}
                          className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => updateFormData({ aniosVida: e.target.value })}
                        />
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
                      <textarea
                        placeholder="COMENTARIOS"
                        value={formData.comentarios || ''}
                        className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase h-24 outline-none"
                        onChange={(e) => updateFormData({ comentarios: e.target.value })}
                      />
                    </section>
                  </div>
                </>
              )}
              {isSupplyModal && (
                <>
                  <div className="space-y-1">
                    <input
                      required
                      autoFocus
                      placeholder="NOMBRE"
                      value={formData.nombre || ''}
                      onBlur={() => markInsumoTouched('nombre')}
                      onChange={(e) => updateFormData({ nombre: e.target.value })}
                      className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${insumoTouched.nombre && insumoFormValidation.errors.nombre
                          ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                          : 'bg-slate-50 border border-slate-100'
                        }`}
                    />
                    {insumoTouched.nombre && insumoFormValidation.errors.nombre && (
                      <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                        {insumoFormValidation.errors.nombre}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <input
                      required
                      placeholder="UNIDAD"
                      value={formData.unidad || ''}
                      onBlur={() => markInsumoTouched('unidad')}
                      onChange={(e) => updateFormData({ unidad: e.target.value })}
                      list="supply-unit-options"
                      className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${insumoTouched.unidad && insumoFormValidation.errors.unidad
                          ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                          : 'bg-slate-50 border border-slate-100'
                        }`}
                    />
                    <datalist id="supply-unit-options">
                      {SUPPLY_UNIT_OPTIONS.map((unidad) => (
                        <option key={unidad} value={unidad} />
                      ))}
                    </datalist>
                    {insumoTouched.unidad && insumoFormValidation.errors.unidad && (
                      <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                        {insumoFormValidation.errors.unidad}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <input
                        required
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        placeholder="STOCK"
                        value={String(formData.stock ?? '')}
                        onBlur={() => markInsumoTouched('stock')}
                        onKeyDown={preventInvalidIntegerInputKeys}
                        onChange={(e) => updateFormData({ stock: digitsOnly(e.target.value) })}
                        className={`w-full p-5 rounded-2xl text-sm font-black outline-none ${insumoTouched.stock && insumoFormValidation.errors.stock
                            ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                            : 'bg-slate-50 border border-slate-100'
                          }`}
                      />
                      {insumoTouched.stock && insumoFormValidation.errors.stock && (
                        <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                          {insumoFormValidation.errors.stock}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <input
                        required
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        placeholder="MÍNIMO"
                        value={String(formData.min ?? '')}
                        onBlur={() => markInsumoTouched('min')}
                        onKeyDown={preventInvalidIntegerInputKeys}
                        onChange={(e) => updateFormData({ min: digitsOnly(e.target.value) })}
                        className={`w-full p-5 rounded-2xl text-sm font-black outline-none ${insumoTouched.min && insumoFormValidation.errors.min
                            ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                            : 'bg-slate-50 border border-slate-100'
                          }`}
                      />
                      {insumoTouched.min && insumoFormValidation.errors.min && (
                        <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                          {insumoFormValidation.errors.min}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <select
                      required
                      value={formData.categoria || ''}
                      onBlur={() => markInsumoTouched('categoria')}
                      onChange={(e) => updateFormData({ categoria: e.target.value.toUpperCase() })}
                      className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${insumoTouched.categoria && insumoFormValidation.errors.categoria
                          ? 'bg-red-50/40 border border-red-200 text-red-700'
                          : 'bg-slate-50 border border-slate-100 text-slate-700'
                        }`}
                    >
                      <option value="" disabled>Selecciona categoría...</option>
                      {CATEGORIAS_INSUMO.map((categoria) => (
                        <option key={categoria} value={categoria}>{categoria}</option>
                      ))}
                    </select>
                    {insumoTouched.categoria && insumoFormValidation.errors.categoria && (
                      <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                        {insumoFormValidation.errors.categoria}
                      </p>
                    )}
                  </div>
                </>
              )}
              {isTicketModal && (
                <>
                  <select
                    required
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                    value={formData.sucursal || ''}
                    onChange={e => updateFormData({ sucursal: e.target.value.toUpperCase() })}
                  >
                    {activeTicketBranches.length === 0 ? (
                      <option value="">Sin sucursales configuradas</option>
                    ) : (
                      activeTicketBranches.map((branch) => (
                        <option key={branch.code} value={branch.code}>{branch.code} - {branch.name}</option>
                      ))
                    )}
                  </select>
                  <select
                    required
                    disabled={!formData.sucursal || ticketAssetOptions.length === 0}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none disabled:opacity-50"
                    value={formData.activoTag || ''}
                    onChange={e => updateFormData({ activoTag: e.target.value.toUpperCase() })}
                  >
                    <option value="">
                      {!formData.sucursal
                        ? 'Primero selecciona sucursal...'
                        : ticketAssetOptions.length === 0
                          ? 'Sin activos registrados en esta sucursal'
                          : 'Selecciona TAG equipo...'}
                    </option>
                    {ticketAssetOptions.map((assetOption) => (
                      <option key={assetOption.tag} value={assetOption.tag}>
                        {assetOption.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 font-black uppercase">
                    Activos en sucursal seleccionada: {ticketAssetOptions.length}
                  </p>
                  <select
                    required
                    value={formData.areaAfectada || ''}
                    onChange={e => updateFormData({ areaAfectada: e.target.value, fallaComun: '' })}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                  >
                    <option value="">Área afectada...</option>
                    {TICKET_AREA_OPTIONS.map((area) => (
                      <option key={`afe-${area}`} value={area}>{area}</option>
                    ))}
                  </select>
                  <select
                    required
                    value={formData.atencionTipo || ''}
                    onChange={(e) => {
                      const value = normalizeTicketAttentionType(e.target.value);
                      updateFormData({ atencionTipo: value || undefined });
                    }}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                  >
                    <option value="">Tipo de atención...</option>
                    {TICKET_ATTENTION_TYPES.map((type) => (
                      <option key={`ticket-attention-${type}`} value={type}>{formatTicketAttentionType(type)}</option>
                    ))}
                  </select>
                  <textarea
                    required
                    placeholder="DESCRIPCIÓN DE LA FALLA"
                    value={formData.descripcion || ''}
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase h-24 outline-none"
                    onChange={e => updateFormData({ descripcion: e.target.value })}
                  />
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Falla común por área
                    </p>
                    <select
                      value={formData.fallaComun || ''}
                      disabled={!selectedIssueArea || issueOptionsForSelectedArea.length === 0}
                      onChange={(e) =>
                        updateFormData({
                          fallaComun: e.target.value,
                          descripcion: e.target.value,
                        })
                      }
                      className="w-full p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedIssueArea
                          ? 'Primero selecciona área afectada'
                          : issueOptionsForSelectedArea.length === 0
                            ? 'Sin fallas configuradas para esta área'
                            : 'Selecciona una falla común...'}
                      </option>
                      {issueOptionsForSelectedArea.map((issue) => (
                        <option key={`${selectedIssueArea}-${issue}`} value={issue}>{issue}</option>
                      ))}
                    </select>
                  </div>

                  <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none" value={formData.prioridad || 'MEDIA'} onChange={e => updateFormData({ prioridad: e.target.value as PrioridadTicket })}>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                  {canEdit ? (
                    <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none" value={formData.asignadoA || ''} onChange={e => updateFormData({ asignadoA: e.target.value })}>
                      <option value="">Asignar técnico...</option>
                      {users
                        .filter((u) => (u.rol === 'tecnico' || u.rol === 'admin') && u.activo !== false)
                        .map((u) => (
                          <option key={u.id} value={u.nombre}>{u.nombre}</option>
                        ))}
                    </select>
                  ) : (
                    <div className="w-full p-5 bg-amber-50 border border-amber-100 rounded-2xl text-xs font-black uppercase text-amber-700">
                      El ticket se registrará sin asignación inicial.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      disabled
                      value={sessionUser?.nombre || ''}
                      className="w-full p-4 bg-slate-100 border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-500 outline-none"
                    />
                    <input
                      disabled
                      value={formatTicketBranchFromCatalog(formData.sucursal)}
                      className="w-full p-4 bg-slate-100 border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase">
                    Cargo solicitante: {formatCargoFromCatalog(sessionUser?.departamento)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-black uppercase">
                    SLA estimado: {SLA_POLICY[formData.prioridad || 'MEDIA']} horas
                  </p>
                </>
              )}
              {isSupplyModal ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isModalSaving}
                    className="w-full py-5 border border-slate-200 text-slate-600 rounded-2xl font-black uppercase hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!canSubmitModal}
                    type="submit"
                    className="w-full py-5 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl hover:opacity-90 flex justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={18} /> {modalSubmitLabel}
                  </button>
                </div>
              ) : (
                <button
                  disabled={!canSubmitModal}
                  type="submit"
                  className="w-full py-5 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl hover:opacity-90 mt-4 flex justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} /> {modalSubmitLabel}
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL INSUMO */}
      <SupplyHistoryModal
        item={selectedSupplyHistoryItem}
        movements={selectedSupplyMovements}
        formatDateTime={formatDateTime}
        onClose={() => setSelectedSupplyHistoryItem(null)}
      />

      {/* MODAL PREVIEW IMPORTACION */}
      <ImportPreviewModal
        open={!!importDraft}
        fileName={importDraft?.fileName || ''}
        preview={importDraft?.preview || {
          totalRows: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          invalid: 0,
        }}
        localInvalidCount={importDraft?.localInvalidDetails?.length || 0}
        issues={importIssueRows}
        isApplying={isApplyingImport}
        onClose={() => setImportDraft(null)}
        onExportIssues={exportImportIssuesCsv}
        onConfirm={() => {
          void applyImportDraft();
        }}
      />

      {/* MODAL ESCANER QR */}
      <QrScannerModal
        open={showQrScanner}
        videoRef={qrScannerVideoRef}
        isScannerActive={isQrScannerActive}
        isCameraSupported={isQrCameraSupported}
        scannerStatus={qrScannerStatus}
        manualInput={qrManualInput}
        isResolving={isResolvingQr}
        onClose={() => setShowQrScanner(false)}
        onManualInputChange={setQrManualInput}
        onResolve={resolveQrFromManualInput}
        onClear={() => setQrManualInput('')}
      />

      {/* MODAL DETALLE ACTIVO */}
      <AssetDetailModal
        asset={selectedAsset}
        canEdit={canEdit}
        selectedAssetQrLoading={selectedAssetQrLoading}
        selectedAssetQrMode={selectedAssetQrMode}
        selectedAssetQrIssuedAt={selectedAssetQrIssuedAt}
        effectiveSelectedAssetQrValue={effectiveSelectedAssetQrValue}
        LazyQRCodeCanvas={LazyQRCodeCanvas}
        buildAssetQrCanvasId={buildAssetQrCanvasId}
        formatDateTime={formatDateTime}
        onClose={() => setSelectedAsset(null)}
        onEdit={openAssetEditModal}
        onDownloadQr={descargarQrActivoSeleccionado}
        onPrintQr={imprimirEtiquetaQrActivoSeleccionado}
        onDeleteAsset={eliminarActivo}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

    </div>
  );
}




