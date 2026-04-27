import type {
  Activo,
  AuditFiltersState,
  AuditPaginationState,
  Insumo,
  InsumoTouchedState,
  ReportAttentionFilter,
  ReportFilterPreset,
  ReportFilterSnapshot,
  ReportPriorityFilter,
  ReportStateFilter,
  StoredSession,
  ThemeMode,
  TicketEstado,
  TicketItem,
  UserSession,
  RegistroAuditoria,
} from '../types/app';
import {
  API_REQUEST_TIMEOUT_MS,
  INSUMOS_INICIALES,
  INVENTARIO_ACTIVOS_INICIAL,
  NORMALIZED_API_BASE_URL,
  REPORT_FILTER_PRESETS_STORAGE_PREFIX,
  SESSION_STORAGE_KEY,
  TICKETS_INICIALES,
  THEME_STORAGE_KEY,
  TICKET_ATTENTION_TYPES,
  TICKET_STATES,
  TRAVEL_DESTINATION_PRESETS,
  AUDITORIA_INICIAL,
} from '../constants/app';

export function createEmptyInsumoTouched(): InsumoTouchedState {
  return {
    nombre: false,
    unidad: false,
    stock: false,
    min: false,
    categoria: false,
    ubicacion: false,
    proveedor: false,
  };
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function cloneInitialActivos(): Activo[] {
  return INVENTARIO_ACTIVOS_INICIAL.map((item) => ({ ...item }));
}

export function cloneInitialInsumos(): Insumo[] {
  return INSUMOS_INICIALES.map((item) => ({ ...item }));
}

export function cloneInitialTickets(): TicketItem[] {
  return TICKETS_INICIALES.map((item) => ({
    ...item,
    historial: item.historial ? item.historial.map((entry) => ({ ...entry })) : undefined,
    attachments: item.attachments ? item.attachments.map((attachment) => ({ ...attachment })) : undefined,
  }));
}

export function cloneInitialAuditoria(): RegistroAuditoria[] {
  return AUDITORIA_INICIAL.map((item) => ({ ...item }));
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  let raw = '';
  try {
    raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.user || typeof parsed.user !== 'object') return null;
    if (typeof parsed.token !== 'string' || !parsed.token.trim()) return null;

    return {
      user: parsed.user as UserSession,
      token: parsed.token,
      loggedAt: typeof parsed.loggedAt === 'string' ? parsed.loggedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage permission/quota issues to avoid breaking runtime.
  }
}

export function getStoredSessionToken(): string {
  return readStoredSession()?.token || '';
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  let raw = '';
  try {
    raw = String(window.localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase();
  } catch {
    raw = '';
  }
  if (raw === 'light' || raw === 'dark') return raw;
  const prefersDark = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  return prefersDark ? 'dark' : 'light';
}

export function writeStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage permission/quota issues to avoid breaking runtime.
  }
}

export function buildDefaultTravelKmsByBranch(): Record<string, string> {
  const rows: Record<string, string> = {};
  TRAVEL_DESTINATION_PRESETS.forEach((item) => {
    rows[item.code] = String(item.defaultKms);
  });
  return rows;
}

export function buildCurrentMonthInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function buildDefaultReportFilterSnapshot(): ReportFilterSnapshot {
  return {
    dateFrom: '',
    dateTo: '',
    branch: 'TODAS',
    area: 'TODAS',
    state: 'TODOS',
    priority: 'TODAS',
    attention: 'TODAS',
    technician: 'TODOS',
  };
}

export function buildDefaultAuditFilters(): AuditFiltersState {
  return {
    module: '',
    result: '',
    user: '',
    entity: '',
    action: '',
    q: '',
    from: '',
    to: '',
  };
}

export function buildDefaultAuditPagination(pageSize = 25): AuditPaginationState {
  return {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  };
}

export function normalizeReportFilterSnapshot(value: Partial<ReportFilterSnapshot> | null | undefined): ReportFilterSnapshot {
  const defaults = buildDefaultReportFilterSnapshot();
  const branch = String(value?.branch || '').trim().toUpperCase() || defaults.branch;
  const area = String(value?.area || '').trim() || defaults.area;
  const stateRaw = String(value?.state || '').trim();
  const state = stateRaw === 'TODOS' || TICKET_STATES.includes(stateRaw as TicketEstado)
    ? (stateRaw as ReportStateFilter)
    : defaults.state;
  const priorityRaw = String(value?.priority || '').trim().toUpperCase();
  const priority = (priorityRaw === 'TODAS' || priorityRaw === 'MEDIA' || priorityRaw === 'ALTA' || priorityRaw === 'CRITICA')
    ? (priorityRaw as ReportPriorityFilter)
    : defaults.priority;
  const attentionRaw = String(value?.attention || '').trim().toUpperCase();
  const isKnownAttention = TICKET_ATTENTION_TYPES.some((type) => type === attentionRaw);
  const attention = (attentionRaw === 'TODAS' || isKnownAttention)
    ? (attentionRaw as ReportAttentionFilter)
    : defaults.attention;
  const technician = String(value?.technician || '').trim() || defaults.technician;
  const dateFrom = String(value?.dateFrom || '').trim() || defaults.dateFrom;
  const dateTo = String(value?.dateTo || '').trim() || defaults.dateTo;

  return {
    dateFrom,
    dateTo,
    branch,
    area,
    state,
    priority,
    attention,
    technician,
  };
}

export function buildReportFilterPresetsStorageKey(user: UserSession | null): string | null {
  if (!user) return null;
  const base = String(user.username || user.id || '').trim().toLowerCase();
  const suffix = base.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
  return `${REPORT_FILTER_PRESETS_STORAGE_PREFIX}_${suffix}`;
}

export function readStoredReportFilterPresets(user: UserSession | null): ReportFilterPreset[] {
  if (typeof window === 'undefined') return [];
  const key = buildReportFilterPresetsStorageKey(user);
  if (!key) return [];

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const rows = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Partial<ReportFilterPreset>;
        const name = String(row.name || '').trim();
        if (!name) return null;
        const id = String(row.id || '').trim() || `report-preset-${Date.now()}`;
        const createdAt = String(row.createdAt || '').trim() || new Date().toISOString();
        const filters = normalizeReportFilterSnapshot((row.filters || {}) as Partial<ReportFilterSnapshot>);
        return {
          id,
          name,
          createdAt,
          filters,
        } as ReportFilterPreset;
      })
      .filter((item): item is ReportFilterPreset => !!item);
    return rows.slice(0, 30);
  } catch {
    return [];
  }
}

export function writeStoredReportFilterPresets(user: UserSession | null, presets: ReportFilterPreset[]): void {
  if (typeof window === 'undefined') return;
  const key = buildReportFilterPresetsStorageKey(user);
  if (!key) return;
  try {
    if (presets.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(presets.slice(0, 30)));
  } catch {
    // Ignore storage permission/quota issues to avoid breaking runtime.
  }
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
}

export function buildApiUrl(path: string): string {
  const rawPath = String(path || '').trim();
  if (!rawPath) return NORMALIZED_API_BASE_URL;
  if (rawPath.startsWith('?')) return `${NORMALIZED_API_BASE_URL}${rawPath}`;
  return `${NORMALIZED_API_BASE_URL}/${rawPath.replace(/^\/+/, '')}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const storedToken = getStoredSessionToken();
  const shouldAttachAuth = !!storedToken && !path.startsWith('/auth/login');
  const headers = new Headers(init?.headers);
  const body = init?.body;
  const isFormDataBody = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBinaryBody = typeof Blob !== 'undefined' && body instanceof Blob;
  const isUrlEncodedBody = typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams;
  if (body !== undefined && body !== null && !headers.has('Content-Type') && !isFormDataBody && !isBinaryBody && !isUrlEncodedBody) {
    headers.set('Content-Type', 'application/json');
  }
  if (shouldAttachAuth && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${storedToken}`);
  }

  const timeoutMs = Number.isFinite(API_REQUEST_TIMEOUT_MS) && API_REQUEST_TIMEOUT_MS > 0
    ? API_REQUEST_TIMEOUT_MS
    : 15000;
  const timeoutController = init?.signal ? null : new AbortController();
  const timeoutId = timeoutController
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers,
      signal: init?.signal || timeoutController?.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al conectar con backend (${NORMALIZED_API_BASE_URL}).`);
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }
  const payload = await response.text();
  if (!payload.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new Error('Respuesta JSON invalida del backend.');
  }
}

