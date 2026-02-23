import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  LayoutDashboard, 
  Monitor, 
  Ticket, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Plus, 
  PlusCircle, 
  MinusCircle, 
  X, 
  Package, 
  History, 
  LogOut,
  ChevronRight,
  Menu,
  User,
  Users,
  Save,
  Download,
  Upload,
  Trash2,
  Moon,
  Sun,
  QrCode,
  Printer,
  ScanLine,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

type EstadoActivo = 'Operativo' | 'Falla';
type PrioridadTicket = 'MEDIA' | 'ALTA' | 'CRITICA';
type TicketEstado = 'Abierto' | 'En Proceso' | 'En Espera' | 'Resuelto' | 'Cerrado';
type UserRole = 'admin' | 'tecnico' | 'consulta' | 'solicitante';
type ToastType = 'success' | 'error' | 'warning';
type ModalType = 'activo' | 'insumo' | 'ticket' | null;
type ViewType = 'dashboard' | 'inventory' | 'supplies' | 'tickets' | 'history' | 'users';
type SupplyStatusFilter = 'TODOS' | 'AGOTADO' | 'BAJO' | 'OK';
type InventoryRiskFilter = 'TODOS' | 'SIN_IP' | 'SIN_MAC' | 'SIN_RESP' | 'DUP_RED' | 'VIDA_ALTA';
type InventorySortField = 'tag' | 'tipo' | 'estado' | 'responsable' | 'ubicacion' | 'aniosVida';
type InventorySortDirection = 'asc' | 'desc';
type AuditModule = 'activos' | 'insumos' | 'tickets' | 'otros';
type ThemeMode = 'light' | 'dark';

interface Activo {
  id: number;
  tag: string;
  tipo: string;
  marca: string;
  modelo?: string;
  ubicacion: string;
  estado: EstadoActivo;
  serial: string;
  fechaCompra: string;
  idInterno?: string;
  equipo?: string;
  cpu?: string;
  ram?: string;
  ramTipo?: string;
  disco?: string;
  tipoDisco?: string;
  macAddress?: string;
  ipAddress?: string;
  responsable?: string;
  departamento?: string;
  edo?: string;
  anydesk?: string;
  passwordRemota?: string;
  aniosVida?: string;
  comentarios?: string;
}

interface ImportAssetDetail {
  rowNumber: number;
  status: 'created' | 'updated' | 'skipped' | 'invalid';
  reason?: string;
  tag?: string;
}

interface ImportAssetsResponse {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  upsert: boolean;
  dryRun: boolean;
  details?: ImportAssetDetail[];
}

interface ImportDraftState {
  fileName: string;
  payloadItems: Array<Record<string, unknown>>;
  preview: ImportAssetsResponse;
  localInvalidDetails: ImportAssetDetail[];
}

interface DuplicateRiskItem {
  value: string;
  count: number;
}

interface AssetRiskSummary {
  totalActivos: number;
  activosConIp: number;
  activosSinIp: number;
  activosConMac: number;
  activosSinMac: number;
  activosSinResponsable: number;
  activosVidaAlta: number;
  activosEnFalla: number;
  duplicateIpCount: number;
  duplicateMacCount: number;
  duplicateIpEntries: DuplicateRiskItem[];
  duplicateMacEntries: DuplicateRiskItem[];
  generatedAt?: string;
}

interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  min: number;
  categoria: string;
  activo?: boolean;
}

interface TicketAttachment {
  id: number;
  fileName: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  localOnly?: boolean;
  localUrl?: string;
}

interface TicketItem {
  id: number;
  activoTag: string;
  descripcion: string;
  sucursal?: string;
  prioridad: PrioridadTicket;
  estado: TicketEstado;
  fecha: string;
  asignadoA?: string;
  fechaCreacion?: string;
  fechaLimite?: string;
  fechaCierre?: string;
  solicitadoPor?: string;
  solicitadoPorId?: number | null;
  solicitadoPorUsername?: string;
  departamento?: string;
  slaVencido?: boolean;
  slaRestanteMin?: number | null;
  historial?: Array<{
    fecha: string;
    usuario: string;
    accion: string;
    estado: TicketEstado;
    comentario?: string;
  }>;
  attachments?: TicketAttachment[];
}

interface RegistroAuditoria {
  id: number;
  accion: string;
  item: string;
  cantidad: number;
  fecha: string;
  usuario: string;
  modulo?: AuditModule;
}

interface ToastState {
  message: string;
  type: ToastType;
}

interface FormDataState {
  tag?: string;
  tipo?: string;
  marca?: string;
  modelo?: string;
  ubicacion?: string;
  serial?: string;
  fechaCompra?: string;
  estado?: EstadoActivo;
  idInterno?: string;
  equipo?: string;
  cpu?: string;
  ram?: string;
  ramTipo?: string;
  disco?: string;
  tipoDisco?: string;
  macAddress?: string;
  ipAddress?: string;
  responsable?: string;
  departamento?: string;
  edo?: string;
  anydesk?: string;
  passwordRemota?: string;
  aniosVida?: string;
  comentarios?: string;
  nombre?: string;
  stock?: string | number;
  min?: string | number;
  categoria?: string;
  activoTag?: string;
  descripcion?: string;
  sucursal?: string;
  areaAfectada?: string;
  fallaComun?: string;
  prioridad?: PrioridadTicket;
  asignadoA?: string;
  comentario?: string;
}

interface UserItem {
  id: number;
  nombre: string;
  username: string;
  rol: UserRole;
  departamento?: string;
  activo: boolean;
}

interface UserSession {
  id: number;
  nombre: string;
  username: string;
  rol: UserRole;
  departamento?: string;
}

interface CatalogBranch {
  code: string;
  name: string;
  activo?: boolean;
}

interface CatalogRole {
  value: string;
  label: string;
  permissions: string;
  activo?: boolean;
}

interface CatalogState {
  sucursales: CatalogBranch[];
  cargos: string[];
  roles: CatalogRole[];
}

interface NavItem {
  id: ViewType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// --- COMPONENTE LOGO SVG ---
const LogoGigantes = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 25C40 25 30 20 25 35C25 35 25 45 40 40C40 40 45 50 55 45C55 45 60 35 50 30C50 30 45 20 40 25Z" fill="#8CC63F" />
    <circle cx="55" cy="55" r="35" fill="#F58220" />
    <path d="M72 55C72 64.3888 64.3888 72 55 72C45.6112 72 38 64.3888 38 55C38 45.6112 45.6112 38 55 38V46C50.0294 46 46 50.0294 46 55C46 59.9706 50.0294 64 55 64C59.9706 64 64 59.9706 64 55H55V48H72V55Z" fill="white" />
  </svg>
);

// --- DATOS INICIALES ---
const INVENTARIO_ACTIVOS_INICIAL: Activo[] = [
  { id: 1, tag: 'POS-001', tipo: 'POS', marca: 'IBM SurePOS', ubicacion: 'Caja Rápida 1', estado: 'Operativo', serial: 'SN-99201', fechaCompra: '2022-01-15' },
  { id: 2, tag: 'POS-002', tipo: 'POS', marca: 'IBM SurePOS', ubicacion: 'Caja Rápida 2', estado: 'Operativo', serial: 'SN-99202', fechaCompra: '2022-01-15' },
  { id: 3, tag: 'BAS-010', tipo: 'Báscula', marca: 'Datalogic', ubicacion: 'Frutas y Verduras', estado: 'Falla', serial: 'SN-10293', fechaCompra: '2023-05-10' },
  { id: 4, tag: 'SRV-001', tipo: 'Servidor', marca: 'Dell PowerEdge', ubicacion: 'Site', estado: 'Operativo', serial: 'SN-SRV-01', fechaCompra: '2021-11-20' },
];

const INSUMOS_INICIALES: Insumo[] = [
  { id: 1, nombre: 'Cable Ethernet Cat6', unidad: 'Metros', stock: 150, min: 50, categoria: 'REDES', activo: true },
  { id: 2, nombre: 'Papel Térmico 80mm', unidad: 'Rollos', stock: 12, min: 20, categoria: 'CONSUMIBLES', activo: true },
  { id: 3, nombre: 'Conectores RJ45', unidad: 'Piezas', stock: 100, min: 30, categoria: 'REDES', activo: true },
  { id: 4, nombre: 'Teclado USB', unidad: 'Piezas', stock: 5, min: 5, categoria: 'HARDWARE', activo: true },
];

const TICKETS_INICIALES: TicketItem[] = [
  {
    id: 101,
    activoTag: 'BAS-010',
    descripcion: 'Falla en el pesaje',
    prioridad: 'CRITICA',
    estado: 'Abierto',
    fecha: '2023-10-24 09:00',
    asignadoA: 'Técnico 1',
    fechaCreacion: '2023-10-24T09:00:00.000Z',
    fechaLimite: '2023-10-24T11:00:00.000Z',
  }
];
const AUDITORIA_INICIAL: RegistroAuditoria[] = [
  { id: 1, accion: 'Entrada', item: 'Papel Térmico', cantidad: 50, fecha: '2024-05-20 10:30', usuario: 'Admin IT', modulo: 'insumos' }
];

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'inventory', icon: Monitor, label: 'Inventario' },
  { id: 'supplies', icon: Package, label: 'Insumos' },
  { id: 'tickets', icon: Ticket, label: 'Tickets' },
  { id: 'history', icon: History, label: 'Auditoría' },
  { id: 'users', icon: Users, label: 'Usuarios' },
];

const CATEGORIAS_INSUMO = ['REDES', 'CONSUMIBLES', 'HARDWARE'] as const;
const TICKET_STATES: TicketEstado[] = ['Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado'];
const SLA_POLICY: Record<PrioridadTicket, number> = {
  MEDIA: 24,
  ALTA: 8,
  CRITICA: 2,
};
const TICKET_BRANCHES = [
  { code: 'TJ01', name: 'Sucursal Estrella' },
  { code: 'TC01', name: 'Sucursal Camargo' },
  { code: 'TJ02', name: 'Sucursal CBtis' },
  { code: 'TJ03', name: 'Sucursal Sor Juana' },
  { code: 'CEDIS', name: 'CeDis' },
] as const;
const TICKET_BRANCH_LABEL_BY_CODE: Record<string, string> = TICKET_BRANCHES.reduce(
  (acc, branch) => ({ ...acc, [branch.code]: `${branch.code} - ${branch.name}` }),
  {} as Record<string, string>,
);
const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  consulta: 'Consulta',
  solicitante: 'Solicitante',
};
const USER_ROLE_PERMISSIONS: Record<UserRole, string> = {
  admin: 'Acceso total',
  tecnico: 'Operación IT + tickets',
  consulta: 'Solo consulta',
  solicitante: 'Crear tickets',
};
const USER_CARGO_OPTIONS = [
  { value: 'COORDINADOR DE SISTEMAS', label: 'Coordinador de Sistemas' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'DESARROLLADOR', label: 'Desarrollador' },
  { value: 'AUXILIAR DE SISTEMAS', label: 'Auxiliar de Sistemas' },
  { value: 'CEDIS', label: 'CeDis' },
] as const;
const USER_CARGO_LABEL_BY_VALUE: Record<string, string> = USER_CARGO_OPTIONS.reduce(
  (acc, cargo) => ({ ...acc, [cargo.value]: cargo.label }),
  {} as Record<string, string>,
);
const DEFAULT_CATALOGS: CatalogState = {
  sucursales: TICKET_BRANCHES.map((branch) => ({ ...branch, activo: true })),
  cargos: USER_CARGO_OPTIONS.map((item) => item.label),
  roles: [
    { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
    { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: true },
    { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
    { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
  ],
};
const TICKET_AREA_OPTIONS = ['Recibos', 'Gerencia', 'Línea de cajas', 'Tienda', 'Mantenimiento'] as const;
const COMMON_TICKET_ISSUES = [
  {
    area: 'Línea de cajas',
    issues: [
      'No muestra peso',
      'Falla del monitor',
      'Lector de códigos no enciende',
      'No funciona la impresora de tickets',
      'POS lento o trabado',
      'Terminal bancaria sin conexión',
    ],
  },
  {
    area: 'Recibos',
    issues: [
      'No funciona la impresora',
      'No imprime ticket',
      'Impresión borrosa o incompleta',
      'Atasco de papel en impresora',
      'Sin papel térmico',
      'Error de conexión con impresora',
      'No acceso al servidor remoto',
      'Lentitud en módulo de recibos',
      'Falla de teclado',
      'Falla de ratón',
    ],
  },
  {
    area: 'Gerencia',
    issues: [
      'No se genera reporte diario',
      'Dashboard no actualiza',
      'Sin acceso a indicadores',
      'Sistema administrativo lento',
      'No abre reportes de ventas',
      'Error al exportar reportes (Excel/PDF)',
      'Datos de ventas no sincronizados',
      'No carga KPI por sucursal',
      'Error de permisos en módulo gerencial',
      'No acceso al servidor remoto de gerencia',
    ],
  },
  {
    area: 'Tienda',
    issues: [
      'No abre sistema en tienda',
      'Sin internet en tienda',
      'Sin Wi-Fi',
      'Sistema lento en tienda',
      'No se sincronizan ventas',
      'No funciona equipo de piso',
    ],
  },
  {
    area: 'Mantenimiento',
    issues: [
      'Mantenimiento preventivo',
      'Limpieza de equipo programada',
      'Actualización de software programada',
      'Revisión preventiva de red',
    ],
  },
] as const;

const AUTHOR_BRAND = String(import.meta.env.VITE_AUTHOR_BRAND || 'Inge Juan Carlos R. P.').trim() || 'Inge Juan Carlos R. P.';
const AUTHOR_SIGNATURE = `Desarrollado por ${AUTHOR_BRAND}`;
const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';
const API_BASE_URL = String(import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL).trim();
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);
const CLIENT_ATTACHMENT_MAX_BYTES = Math.max(
  64 * 1024,
  Math.trunc(Number(import.meta.env.VITE_TICKET_ATTACHMENT_MAX_BYTES || 5 * 1024 * 1024)),
);
const CLIENT_ATTACHMENT_MAX_COUNT = Math.max(
  1,
  Math.trunc(Number(import.meta.env.VITE_TICKET_ATTACHMENT_MAX_COUNT || 10)),
);
const SESSION_STORAGE_KEY = 'mesa_it_session';
const THEME_STORAGE_KEY = 'mesa_it_theme';

interface StoredSession {
  user: UserSession;
  token: string;
  loggedAt: string;
}

interface BootstrapResponse {
  activos: Activo[];
  insumos: Insumo[];
  tickets: TicketItem[];
  auditoria: RegistroAuditoria[];
  users?: UserItem[];
  catalogos?: CatalogState;
  riskSummary?: AssetRiskSummary;
  ticketStates?: TicketEstado[];
  slaPolicyHours?: Record<PrioridadTicket, number>;
}

interface LoginResponse {
  user: UserSession;
  token: string;
  loggedAt: string;
}

interface TicketAttachmentUploadResponse {
  attachment: TicketAttachment;
  ticket: TicketItem;
}

interface AssetQrTokenResponse {
  token: string;
  scheme?: string;
  issuedAt?: string;
  assetId?: number;
}

interface AssetQrResolveResponse {
  ok: boolean;
  verified?: boolean;
  scheme?: string;
  token?: {
    version?: number;
    type?: string;
    assetId?: number;
    issuedAt?: string;
  };
  asset?: {
    id?: number;
    tag?: string;
    tipo?: string;
    marca?: string;
    modelo?: string;
    serial?: string;
    estado?: string;
    ubicacion?: string;
    responsable?: string;
    departamento?: string;
  };
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function cloneInitialActivos(): Activo[] {
  return INVENTARIO_ACTIVOS_INICIAL.map((item) => ({ ...item }));
}

function cloneInitialInsumos(): Insumo[] {
  return INSUMOS_INICIALES.map((item) => ({ ...item }));
}

function cloneInitialTickets(): TicketItem[] {
  return TICKETS_INICIALES.map((item) => ({
    ...item,
    historial: item.historial ? item.historial.map((entry) => ({ ...entry })) : undefined,
    attachments: item.attachments ? item.attachments.map((attachment) => ({ ...attachment })) : undefined,
  }));
}

function cloneInitialAuditoria(): RegistroAuditoria[] {
  return AUDITORIA_INICIAL.map((item) => ({ ...item }));
}

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
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

function writeStoredSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function getStoredSessionToken(): string {
  return readStoredSession()?.token || '';
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const raw = String(window.localStorage.getItem(THEME_STORAGE_KEY) || '').trim().toLowerCase();
  if (raw === 'light' || raw === 'dark') return raw;
  const prefersDark = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  return prefersDark ? 'dark' : 'light';
}

function writeStoredTheme(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
}

function buildApiUrl(path: string): string {
  const rawPath = String(path || '').trim();
  if (!rawPath) return NORMALIZED_API_BASE_URL;
  if (rawPath.startsWith('?')) return `${NORMALIZED_API_BASE_URL}${rawPath}`;
  return `${NORMALIZED_API_BASE_URL}/${rawPath.replace(/^\/+/, '')}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const storedToken = getStoredSessionToken();
  const shouldAttachAuth = !!storedToken && !path.startsWith('/auth/login');
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
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

  return (await response.json()) as T;
}

function calculateSlaDeadline(prioridad: PrioridadTicket): string {
  const hours = SLA_POLICY[prioridad] || SLA_POLICY.MEDIA;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function getSlaStatus(ticket: TicketItem): { label: string; className: string } {
  if (ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado') {
    return { label: 'SLA CERRADO', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  const remaining = ticket.slaRestanteMin;
  if (ticket.slaVencido || (typeof remaining === 'number' && remaining <= 0)) {
    return { label: 'SLA VENCIDO', className: 'bg-red-50 text-red-600 border-red-200' };
  }
  if (typeof remaining === 'number' && remaining <= 60) {
    return { label: `SLA ${remaining} MIN`, className: 'bg-amber-50 text-amber-600 border-amber-200' };
  }
  if (typeof remaining === 'number') {
    const hours = Math.ceil(remaining / 60);
    return { label: `SLA ${hours} H`, className: 'bg-green-50 text-green-600 border-green-200' };
  }

  return { label: 'SLA N/D', className: 'bg-slate-100 text-slate-500 border-slate-200' };
}

function formatTicketBranch(value?: string, labels: Record<string, string> = TICKET_BRANCH_LABEL_BY_CODE): string {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return 'Sin sucursal';
  return labels[code] || code;
}

function formatUserCargo(value?: string, labels: Record<string, string> = USER_CARGO_LABEL_BY_VALUE): string {
  const cargo = String(value || '').trim().toUpperCase();
  if (!cargo) return 'Sin cargo';
  return labels[cargo] || value || 'Sin cargo';
}

function normalizeAuditModule(value?: string): AuditModule | null {
  const raw = normalizeForCompare(value || '');
  if (raw === 'activos') return 'activos';
  if (raw === 'insumos') return 'insumos';
  if (raw === 'tickets') return 'tickets';
  if (raw === 'otros') return 'otros';
  return null;
}

function inferAuditModule(accion: string, item = ''): AuditModule {
  const action = normalizeForCompare(accion || '');
  const subject = normalizeForCompare(item || '');
  if (
    action.includes('ticket')
    || action.includes('asignacion')
    || action.includes('sla')
    || subject.startsWith('tk-')
  ) {
    return 'tickets';
  }
  if (
    action.includes('activo')
    || action.includes('inventario')
    || action.includes('equipo')
  ) {
    return 'activos';
  }
  if (
    action.includes('insumo')
    || action.includes('stock')
    || action.includes('entrada')
    || action.includes('salida')
    || action.includes('ajuste')
    || action.includes('baja logica')
    || action.includes('registro nuevo')
  ) {
    return 'insumos';
  }
  return 'otros';
}

function resolveAuditModule(log: Pick<RegistroAuditoria, 'accion' | 'item' | 'modulo'>): AuditModule {
  return normalizeAuditModule(log.modulo) || inferAuditModule(log.accion, log.item);
}

function auditModuleLabel(module: AuditModule): string {
  if (module === 'activos') return 'Activos IT';
  if (module === 'insumos') return 'Insumos';
  if (module === 'tickets') return 'Tickets';
  return 'Otros';
}

function formatDateTime(value?: string): string {
  if (!value) return 'N/D';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatBytes(value?: number): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round((size / 1024) * 10) / 10} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFileToken(value: string): string {
  const normalized = normalizeForCompare(value).replace(/[^a-z0-9]+/g, '-');
  const compact = normalized.replace(/^-+|-+$/g, '');
  return compact || 'activo';
}

function buildAssetQrCanvasId(assetId: number): string {
  return `asset-qr-${assetId}`;
}

function buildAssetQrPayload(asset: Activo): string {
  return JSON.stringify({
    app: 'mesa-it',
    entity: 'activo',
    version: 1,
    id: Number(asset.id) || 0,
    tag: String(asset.tag || '').trim().toUpperCase(),
    tipo: String(asset.tipo || '').trim().toUpperCase(),
    serial: String(asset.serial || '').trim().toUpperCase(),
    ubicacion: String(asset.ubicacion || '').trim(),
    responsable: String(asset.responsable || '').trim(),
    departamento: String(asset.departamento || '').trim().toUpperCase(),
  });
}

function extractSignedQrToken(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const tokenPattern = /mtiqr1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  const direct = raw.match(tokenPattern);
  if (direct) return direct[0];

  try {
    const url = new URL(raw);
    const tokenFromQuery = String(url.searchParams.get('token') || '').trim();
    if (tokenFromQuery && tokenPattern.test(tokenFromQuery)) return tokenFromQuery;
    const fromPath = decodeURIComponent(url.pathname).match(tokenPattern);
    if (fromPath) return fromPath[0];
  } catch {
    return '';
  }

  return '';
}

function toActivoFromQrLookup(lookup: AssetQrResolveResponse['asset'] | Record<string, unknown>): Activo | null {
  if (!lookup || typeof lookup !== 'object') return null;
  const id = Number((lookup as { id?: unknown }).id);
  const tag = String((lookup as { tag?: unknown }).tag || '').trim().toUpperCase();
  const tipo = String((lookup as { tipo?: unknown }).tipo || '').trim().toUpperCase() || 'EQUIPO';
  const marca = String((lookup as { marca?: unknown }).marca || '').trim() || 'SIN MARCA';
  const serial = String((lookup as { serial?: unknown }).serial || '').trim().toUpperCase();
  const estadoRaw = String((lookup as { estado?: unknown }).estado || '').trim().toLowerCase();
  const estado: EstadoActivo = estadoRaw.includes('falla') ? 'Falla' : 'Operativo';
  const ubicacion = String((lookup as { ubicacion?: unknown }).ubicacion || '').trim() || 'SIN UBICACION';
  const responsable = String((lookup as { responsable?: unknown }).responsable || '').trim();
  const departamento = String((lookup as { departamento?: unknown }).departamento || '').trim().toUpperCase();
  const modelo = String((lookup as { modelo?: unknown }).modelo || '').trim();
  if (!Number.isFinite(id) || id <= 0 || !tag) return null;

  return {
    id: Math.trunc(id),
    tag,
    tipo,
    marca,
    modelo,
    ubicacion,
    estado,
    serial: serial || `${tag}-SN`,
    fechaCompra: '',
    responsable,
    departamento,
  };
}

function ticketTimestamp(ticket: TicketItem): number {
  const source = ticket.fechaCreacion || ticket.fechaCierre || ticket.fecha;
  if (!source) return Number(ticket.id || 0);
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return Number(ticket.id || 0);
  return parsed.getTime();
}

function ticketBelongsToSessionUser(ticket: TicketItem, user: UserSession | null): boolean {
  if (!user) return false;
  if (user.rol !== 'solicitante') return true;

  const userId = Number(user.id);
  const ticketUserId = Number(ticket.solicitadoPorId);
  if (Number.isFinite(userId) && Number.isFinite(ticketUserId) && userId === ticketUserId) {
    return true;
  }

  const userName = normalizeForCompare(user.nombre || '');
  const userUsername = normalizeForCompare(user.username || '');
  const ticketName = normalizeForCompare(ticket.solicitadoPor || '');
  const ticketUsername = normalizeForCompare(ticket.solicitadoPorUsername || '');
  if (userUsername && ticketUsername && userUsername === ticketUsername) return true;
  if (userName && ticketName && userName === ticketName) return true;
  return false;
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getSupplyHealthStatus(item: Insumo): Exclude<SupplyStatusFilter, 'TODOS'> {
  if (item.stock <= 0) return 'AGOTADO';
  if (item.stock <= item.min) return 'BAJO';
  return 'OK';
}

function getSupplyCriticalityRank(status: Exclude<SupplyStatusFilter, 'TODOS'>): number {
  if (status === 'AGOTADO') return 0;
  if (status === 'BAJO') return 1;
  return 2;
}

type SpreadsheetRow = Record<string, unknown>;
type NetworkSheetRow = [unknown, unknown, unknown];

function normalizeSpreadsheetKey(value: string): string {
  return normalizeForCompare(value).replace(/[^a-z0-9]/g, '');
}

function spreadsheetCellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, '');
  }
  return String(value).trim();
}

function normalizeMacAddress(value: string): string {
  const compact = value.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!compact) return '';
  if (compact.length !== 12) return '';
  return compact.match(/.{1,2}/g)?.join(':') || '';
}

function normalizeIpAddress(value: string): string {
  if (!value) return '';
  const parts = value.split('.');
  if (parts.length !== 4) return '';
  const normalized = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return '';
    const n = Number(part);
    if (!Number.isFinite(n) || n < 0 || n > 255) return '';
    normalized.push(String(n));
  }
  return normalized.join('.');
}

function parseInventoryRow(row: SpreadsheetRow, rowNumber: number): Omit<Activo, 'id'> | null {
  const values = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    values.set(normalizeSpreadsheetKey(key), spreadsheetCellToText(value));
  });

  const pick = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = values.get(normalizeSpreadsheetKey(alias));
      if (!value) continue;
      const clean = value.trim();
      if (!clean || clean.toUpperCase() === 'NA' || clean.toUpperCase() === 'N/A') continue;
      return clean;
    }
    return '';
  };

  const numero = pick('NUM', 'NUMERO');
  const idInterno = pick('ID INTERNO', 'ID_INTERNO', 'ID');
  const equipo = pick('EQUIPO', 'TIPO EQUIPO', 'TIPO');
  const marca = pick('MARCA');
  const modelo = pick('MODELO');
  const serialBase = pick('S/N', 'SN', 'SERIAL', 'NO SERIE');
  const cpu = pick('CPU');
  const ram = pick('RAM');
  const ramTipo = pick('TIPORAM', 'TIPO RAM', 'RAM TIPO', 'TIPO_RAM');
  const disco = pick('DD', 'DISCO', 'HDD', 'SSD');
  const tipoDisco = pick('TIPO_1', 'TIPODISCO', 'TIPO DISCO', 'TIPOALMACENAMIENTO');
  const macAddress = normalizeMacAddress(pick('MAC ADDRESS', 'MAC', 'MACADDRESS'));
  const ipAddress = normalizeIpAddress(pick('IP'));
  const departamento = pick('DEPTO', 'DEPARTAMENTO');
  const ubicacion = pick('UBIC.', 'UBICACION', 'UBIC');
  const responsable = pick('RESP', 'RESPONSABLE');
  const estadoRaw = pick('EDO', 'ESTADO');
  const anydesk = pick('ANYDESK');
  const passwordRemota = pick('PASS', 'PASSWORD');
  const aniosVida = pick('AÑOS DE VIDA', 'ANOS DE VIDA', 'AÑOS', 'ANOS');
  const comentarios = pick('COMENTARIOS');
  const tagSource = idInterno || pick('TAG') || [equipo, numero].filter(Boolean).join('-') || `INV-${rowNumber}`;
  const tipo = (equipo || 'EQUIPO').toUpperCase();
  const tag = tagSource
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 80);

  if (!tag) return null;

  const marcaFinal = marca || 'SIN MARCA';
  const ubicacionFinal = [departamento, ubicacion].filter(Boolean).join(' | ').trim() || 'SIN UBICACION';
  const serial = (serialBase || idInterno || `${tag}-SN`).toUpperCase();
  const estado: EstadoActivo = /falla|dan|malo|fuera|off|inoper|down|bad/i.test(normalizeForCompare(estadoRaw))
    ? 'Falla'
    : 'Operativo';

  return {
    tag,
    tipo,
    marca: marcaFinal,
    modelo,
    ubicacion: ubicacionFinal,
    estado,
    serial,
    fechaCompra: new Date().toISOString().slice(0, 10),
    idInterno: idInterno.toUpperCase(),
    equipo: tipo,
    cpu: cpu.toUpperCase(),
    ram: ram.toUpperCase(),
    ramTipo: ramTipo.toUpperCase(),
    disco: disco.toUpperCase(),
    tipoDisco: tipoDisco.toUpperCase(),
    macAddress,
    ipAddress,
    responsable,
    departamento: departamento.toUpperCase(),
    edo: estadoRaw.toUpperCase(),
    anydesk,
    passwordRemota,
    aniosVida: aniosVida.toUpperCase(),
    comentarios,
  };
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

function parseAssetLifeYears(value?: string): number | null {
  const raw = normalizeForCompare(value || '');
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const years = Number(match[0]);
  if (!Number.isFinite(years)) return null;
  return years;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('No se pudo leer el archivo.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function isUserRole(value: string): value is UserRole {
  return value === 'admin' || value === 'tecnico' || value === 'consulta' || value === 'solicitante';
}

function normalizeCatalogState(value?: Partial<CatalogState>): CatalogState {
  const branchSource = Array.isArray(value?.sucursales) && value.sucursales.length > 0
    ? value.sucursales
    : DEFAULT_CATALOGS.sucursales;
  const branchMap = new Map<string, CatalogBranch>();
  branchSource.forEach((branch) => {
    const code = String(branch?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = String(branch?.name || '').trim();
    if (!code || !name) return;
    branchMap.set(code, {
      code,
      name,
      activo: branch?.activo !== false,
    });
  });
  const sucursales = branchMap.size > 0
    ? Array.from(branchMap.values())
    : DEFAULT_CATALOGS.sucursales.map((branch) => ({ ...branch }));

  const cargoSource = Array.isArray(value?.cargos) && value.cargos.length > 0
    ? value.cargos
    : DEFAULT_CATALOGS.cargos;
  const cargoMap = new Map<string, string>();
  cargoSource.forEach((cargo) => {
    const label = String(cargo || '').trim();
    if (!label) return;
    const key = normalizeForCompare(label);
    if (!cargoMap.has(key)) cargoMap.set(key, label);
  });
  const cargos = cargoMap.size > 0 ? Array.from(cargoMap.values()) : [...DEFAULT_CATALOGS.cargos];

  const roleSource = Array.isArray(value?.roles) && value.roles.length > 0
    ? value.roles
    : DEFAULT_CATALOGS.roles;
  const roleMap = new Map<UserRole, CatalogRole>();
  roleSource.forEach((role) => {
    const rawValue = String(role?.value || '').trim().toLowerCase();
    if (!isUserRole(rawValue)) return;
    roleMap.set(rawValue, {
      value: rawValue,
      label: String(role?.label || USER_ROLE_LABEL[rawValue]).trim() || USER_ROLE_LABEL[rawValue],
      permissions: String(role?.permissions || USER_ROLE_PERMISSIONS[rawValue]).trim() || USER_ROLE_PERMISSIONS[rawValue],
      activo: role?.activo !== false,
    });
  });
  const roles: CatalogRole[] = (['admin', 'tecnico', 'consulta', 'solicitante'] as UserRole[]).map((role) => (
    roleMap.get(role) || {
      value: role,
      label: USER_ROLE_LABEL[role],
      permissions: USER_ROLE_PERMISSIONS[role],
      activo: true,
    }
  ));

  return { sucursales, cargos, roles };
}

function calculateAssetRiskSummary(activos: Activo[]): AssetRiskSummary {
  const ipCounts = new Map<string, number>();
  const macCounts = new Map<string, number>();
  let activosSinIp = 0;
  let activosSinMac = 0;
  let activosSinResponsable = 0;
  let activosVidaAlta = 0;
  let activosEnFalla = 0;

  activos.forEach((asset) => {
    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    const responsable = (asset.responsable || '').trim();
    const years = parseAssetLifeYears(asset.aniosVida);

    if (!ip) activosSinIp += 1;
    if (!mac) activosSinMac += 1;
    if (!responsable) activosSinResponsable += 1;
    if (years !== null && years >= 4) activosVidaAlta += 1;
    if (asset.estado === 'Falla') activosEnFalla += 1;

    if (ip) ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    if (mac) macCounts.set(mac, (macCounts.get(mac) || 0) + 1);
  });

  const duplicateIpEntries = Array.from(ipCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
  const duplicateMacEntries = Array.from(macCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));

  return {
    totalActivos: activos.length,
    activosConIp: activos.length - activosSinIp,
    activosSinIp,
    activosConMac: activos.length - activosSinMac,
    activosSinMac,
    activosSinResponsable,
    activosVidaAlta,
    activosEnFalla,
    duplicateIpCount: duplicateIpEntries.length,
    duplicateMacCount: duplicateMacEntries.length,
    duplicateIpEntries,
    duplicateMacEntries,
  };
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

// --- COMPONENTES UI ---

const Toast = ({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-[#8CC63F]' : type === 'error' ? 'bg-red-500' : 'bg-[#F58220]';

  return (
    <div className={`fixed bottom-6 right-6 ${bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
      <span className="font-black text-xs uppercase tracking-wide">{message}</span>
    </div>
  );
};

const Badge = ({ children, variant }: { children: React.ReactNode; variant?: string }) => {
  const styles: Record<string, string> = {
    critica: 'bg-orange-100 text-orange-700 border-orange-200',
    operativo: 'bg-[#f4fce3] text-[#4a7f10] border-[#d8f5a2]',
    falla: 'bg-red-50 text-red-700 border-red-100',
    abierto: 'bg-blue-50 text-blue-700 border-blue-100',
    'en proceso': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'en espera': 'bg-amber-50 text-amber-700 border-amber-100',
    resuelto: 'bg-green-50 text-green-700 border-green-100',
    cerrado: 'bg-slate-100 text-slate-600 border-slate-200',
    entrada: 'bg-green-50 text-green-700 border-green-100',
    salida: 'bg-amber-50 text-amber-700 border-amber-100',
    baja: 'bg-slate-100 text-slate-600 border-slate-300',
    'baja logica': 'bg-slate-100 text-slate-600 border-slate-300',
    'baja activo': 'bg-slate-100 text-slate-600 border-slate-300',
    'baja usuario': 'bg-slate-100 text-slate-600 border-slate-300',
    'alta activo': 'bg-green-50 text-green-700 border-green-100',
    'alta usuario': 'bg-green-50 text-green-700 border-green-100',
    'registro nuevo': 'bg-green-50 text-green-700 border-green-100',
    'nuevo ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'ticket creado': 'bg-blue-50 text-blue-700 border-blue-100',
    'ticket en proceso': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'ticket en espera': 'bg-amber-50 text-amber-700 border-amber-100',
    'ticket resuelto': 'bg-green-50 text-green-700 border-green-100',
    'ticket cerrado': 'bg-slate-100 text-slate-600 border-slate-300',
    'ticket eliminado': 'bg-red-50 text-red-700 border-red-100',
    'asignacion ticket': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'comentario ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'adjunto ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'catalogos actualizados': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'importacion activos': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'importacion inventario': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  };
  const key = normalizeForCompare(String(variant || 'default'));
  let style = styles[key];
  if (!style) {
    if (key.includes('baja')) style = 'bg-slate-100 text-slate-600 border-slate-300';
    else if (key.includes('error') || key.includes('elimin')) style = 'bg-red-50 text-red-700 border-red-100';
    else if (key.includes('entrada') || key.includes('alta') || key.includes('resuelto')) style = 'bg-green-50 text-green-700 border-green-100';
    else if (key.includes('salida') || key.includes('espera')) style = 'bg-amber-50 text-amber-700 border-amber-100';
    else if (key.includes('proceso') || key.includes('asign')) style = 'bg-indigo-50 text-indigo-700 border-indigo-100';
    else style = 'bg-slate-100 text-slate-700 border-slate-300';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${style}`}>
      {children}
    </span>
  );
};

const AppSidebar = ({
  view,
  navItems,
  sidebarOpen,
  onSelectView,
  onLogout
}: {
  view: ViewType;
  navItems: NavItem[];
  sidebarOpen: boolean;
  onSelectView: (view: ViewType) => void;
  onLogout: () => void;
}) => (
  <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white flex flex-col border-r border-slate-100 transform transition-transform duration-300 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="p-10 flex items-center gap-3">
      <LogoGigantes className="w-10 h-10" />
      <h1 className="text-xl font-black text-[#F58220]">GIGANTES</h1>
    </div>
    <nav className="flex-1 px-6 space-y-2">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectView(item.id)}
          className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-wider ${view === item.id ? 'bg-[#F58220] text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </button>
      ))}
    </nav>
    <div className="p-8">
      <p className="mb-4 text-[9px] font-semibold tracking-[0.08em] text-slate-300">
        {AUTHOR_BRAND}
      </p>
      <button onClick={onLogout} className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600">
        <LogOut size={14} /> Cerrar Sistema
      </button>
    </div>
  </aside>
);

const AppHeader = ({
  searchTerm,
  onSearchChange,
  onOpenSidebar,
  theme,
  onToggleTheme,
  backendConnected,
  isSyncing,
  lastSync,
  sessionUser,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenSidebar: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  backendConnected: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  sessionUser: UserSession | null;
}) => (
  <header className="bg-white border-b border-slate-100 px-6 py-4 lg:px-10 lg:py-6 flex justify-between items-center z-20">
    <div className="flex items-center gap-4 w-full">
      <button className="lg:hidden text-slate-400" onClick={onOpenSidebar}><Menu /></button>
      <div className="relative max-w-md w-full hidden md:block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          type="text"
          placeholder="Buscar..."
          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider ${backendConnected ? 'text-[#8CC63F] bg-[#f4fce3] border-[#d8f5a2]' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
        <span>{backendConnected ? 'Backend Online' : 'Backend Offline'}</span>
        {isSyncing && <span className="text-slate-400">SYNC...</span>}
        {!isSyncing && lastSync && backendConnected && <span className="text-slate-400">({lastSync})</span>}
      </div>
      <div className="hidden md:block text-right">
        <p className="text-[10px] font-black text-slate-400 uppercase">{sessionUser?.rol || 'sin rol'}</p>
        <p className="text-xs font-black text-slate-700">{sessionUser?.nombre || 'Invitado'}</p>
        <p className="text-[8px] font-semibold text-slate-300 tracking-[0.05em] normal-case">{AUTHOR_BRAND}</p>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-[#f4fce3] flex items-center justify-center text-[#8CC63F] font-black border-2 border-white shadow-sm ring-2 ring-slate-50">
        {sessionUser?.nombre?.slice(0, 2).toUpperCase() || 'IT'}
      </div>
    </div>
  </header>
);

// --- APP PRINCIPAL ---

export default function App() {
  const [sessionUser, setSessionUser] = useState<UserSession | null>(() => readStoredSession()?.user || null);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Estado de Datos
  const [activos, setActivos] = useState<Activo[]>(() => cloneInitialActivos());
  const [insumos, setInsumos] = useState<Insumo[]>(() => cloneInitialInsumos());
  const [tickets, setTickets] = useState<TicketItem[]>(() => cloneInitialTickets());
  const [users, setUsers] = useState<UserItem[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogState>(DEFAULT_CATALOGS);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>(() => cloneInitialAuditoria());
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [selectedAsset, setSelectedAsset] = useState<Activo | null>(null); 
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScannerStatus, setQrScannerStatus] = useState('Escanea un QR firmado o pega el token manualmente.');
  const [isQrScannerActive, setIsQrScannerActive] = useState(false);
  const [isResolvingQr, setIsResolvingQr] = useState(false);
  const [qrManualInput, setQrManualInput] = useState('');
  const [selectedAssetQrValue, setSelectedAssetQrValue] = useState('');
  const [selectedAssetQrMode, setSelectedAssetQrMode] = useState<'signed' | 'legacy'>('legacy');
  const [selectedAssetQrIssuedAt, setSelectedAssetQrIssuedAt] = useState('');
  const [selectedAssetQrLoading, setSelectedAssetQrLoading] = useState(false);
  const [formData, setFormData] = useState<FormDataState>({});
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
  const [assetRiskSummary, setAssetRiskSummary] = useState<AssetRiskSummary | null>(null);
  const [assetRiskSource, setAssetRiskSource] = useState<'api' | 'local'>('local');
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

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);
  const selectedAssetFallbackQrPayload = useMemo(
    () => (selectedAsset ? buildAssetQrPayload(selectedAsset) : ''),
    [selectedAsset],
  );
  const effectiveSelectedAssetQrValue = selectedAssetQrValue || selectedAssetFallbackQrPayload;
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
    writeStoredTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAssetQrValue('');
      setSelectedAssetQrMode('legacy');
      setSelectedAssetQrIssuedAt('');
      setSelectedAssetQrLoading(false);
      return;
    }

    const fallbackPayload = buildAssetQrPayload(selectedAsset);
    if (!backendConnected) {
      setSelectedAssetQrValue(fallbackPayload);
      setSelectedAssetQrMode('legacy');
      setSelectedAssetQrIssuedAt('');
      setSelectedAssetQrLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedAssetQrValue(fallbackPayload);
    setSelectedAssetQrMode('legacy');
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
        setSelectedAssetQrValue(fallbackPayload);
        setSelectedAssetQrMode('legacy');
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
  const canManageUsers = sessionUser?.rol === 'admin';
  const isReadOnly = !canEdit;
  const isRequesterOnlyUser = sessionUser?.rol === 'solicitante';
  const activeTicketBranches = useMemo(
    () => catalogos.sucursales.filter((branch) => branch.activo !== false),
    [catalogos],
  );
  const ticketBranchLabelByCode = useMemo(
    () =>
      activeTicketBranches.reduce(
        (acc, branch) => ({ ...acc, [branch.code]: `${branch.code} - ${branch.name}` }),
        {} as Record<string, string>,
      ),
    [activeTicketBranches],
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
  const clearSession = useCallback(() => {
    writeStoredSession(null);
    setSessionUser(null);
    setLoginForm({ username: '', password: '' });
    setView('dashboard');
    setActivos(cloneInitialActivos());
    setInsumos(cloneInitialInsumos());
    setTickets(cloneInitialTickets());
    setAuditoria(cloneInitialAuditoria());
    setUsers([]);
    setCatalogos(DEFAULT_CATALOGS);
    setBackendConnected(false);
    setAssetRiskSummary(null);
    setAssetRiskSource('local');
    setLastSync(null);
    setImportDraft(null);
    setIsApplyingImport(false);
    setSupplyStockDrafts({});
    setSearchTerm('');
    setSelectedAsset(null);
    setFormData({});
    setTicketCommentDrafts({});
    setTicketAttachmentLoadingId(null);
  }, []);

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
      writeStoredSession({
        user: auth.user,
        token: auth.token,
        loggedAt: auth.loggedAt,
      });
      setSessionUser(auth.user);
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
    if (modal === 'ticket') {
      setFormData({
        prioridad: 'MEDIA',
        asignadoA: '',
        sucursal: activeTicketBranches[0]?.code || '',
        areaAfectada: '',
        fallaComun: '',
      });
    } else if (modal === 'activo') {
      setFormData({
        estado: 'Operativo',
        fechaCompra: new Date().toISOString().slice(0, 10),
      });
    } else {
      setFormData({});
    }
    setShowModal(modal);
  };

  const closeModal = () => {
    setShowModal(null);
    setFormData({});
  };

  const descargarQrActivoSeleccionado = useCallback(() => {
    if (!selectedAsset) return;
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
  }, [selectedAsset, showToast]);

  const imprimirEtiquetaQrActivoSeleccionado = useCallback(() => {
    if (!selectedAsset) return;
    const qrCanvas = document.getElementById(buildAssetQrCanvasId(selectedAsset.id));
    if (!(qrCanvas instanceof HTMLCanvasElement)) {
      showToast('No se pudo preparar la etiqueta QR', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=480,height=360');
    if (!printWindow) {
      showToast('Permite ventanas emergentes para imprimir etiquetas', 'warning');
      return;
    }

    const qrDataUrl = qrCanvas.toDataURL('image/png');
    const tag = escapeHtml(selectedAsset.tag || `ID-${selectedAsset.id}`);
    const tipo = escapeHtml(selectedAsset.tipo || 'N/D');
    const serial = escapeHtml(selectedAsset.serial || 'N/D');
    const ubicacion = escapeHtml(selectedAsset.ubicacion || 'N/D');
    const idAsset = escapeHtml(String(selectedAsset.id || 'N/D'));
    const qrModeLabel = escapeHtml(selectedAssetQrMode === 'signed' ? 'QR FIRMADO' : 'QR LOCAL');

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta QR ${tag}</title>
  <style>
    @page { size: 60mm 40mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: 60mm; height: 40mm; font-family: Arial, sans-serif; }
    .label { box-sizing: border-box; width: 60mm; height: 40mm; display: flex; gap: 2mm; align-items: center; padding: 2mm; }
    .qr { width: 22mm; height: 22mm; object-fit: contain; border: 0.2mm solid #d4d4d8; }
    .meta { flex: 1; min-width: 0; color: #0f172a; }
    .tag { font-size: 11pt; font-weight: 800; line-height: 1.1; margin: 0 0 1mm; }
    .line { margin: 0.5mm 0; font-size: 7pt; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="label">
    <img class="qr" src="${qrDataUrl}" alt="QR ${tag}" />
    <div class="meta">
      <p class="tag">${tag}</p>
      <p class="line">${tipo}</p>
      <p class="line">S/N: ${serial}</p>
      <p class="line">${ubicacion}</p>
      <p class="line">ID: ${idAsset}</p>
      <p class="line">${qrModeLabel}</p>
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
  }, [selectedAsset, selectedAssetQrMode, showToast]);

  const refreshData = useCallback(async (silent = false) => {
    if (!sessionUser) return;
    if (!silent) setIsSyncing(true);

    try {
      const data = await apiRequest<BootstrapResponse>('/bootstrap');
      setActivos(data.activos);
      setInsumos(data.insumos);
      setTickets(data.tickets);
      setAuditoria(data.auditoria);
      setUsers(data.users || []);
      setCatalogos(normalizeCatalogState(data.catalogos));
      if (data.riskSummary) {
        setAssetRiskSummary(data.riskSummary);
        setAssetRiskSource('api');
      } else {
        setAssetRiskSummary(calculateAssetRiskSummary(data.activos));
        setAssetRiskSource('local');
      }
      setBackendConnected(true);
      setLastSync(new Date().toLocaleTimeString());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        if (!silent) showToast('Sesión expirada. Inicia sesión nuevamente.', 'warning');
        return;
      }
      setBackendConnected(false);
      setActivos(cloneInitialActivos());
      setInsumos(cloneInitialInsumos());
      setTickets(cloneInitialTickets());
      setAuditoria(cloneInitialAuditoria());
      setAssetRiskSummary(null);
      setAssetRiskSource('local');
      setUsers([]);
      setCatalogos(DEFAULT_CATALOGS);
      if (!silent) {
        showToast('No se pudo sincronizar con el backend', 'warning');
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [clearSession, sessionUser, showToast]);

  useEffect(() => {
    if (!sessionUser) return;
    void refreshData(true);
  }, [refreshData, sessionUser]);

  useEffect(() => {
    if (view === 'users' && !canManageUsers) {
      setView('dashboard');
    }
  }, [canManageUsers, view]);

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
    if (signedToken) {
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
    }

    let parsedLegacy: unknown = null;
    try {
      parsedLegacy = JSON.parse(raw);
    } catch {
      parsedLegacy = null;
    }

    const legacyAsset = toActivoFromQrLookup(
      parsedLegacy && typeof parsedLegacy === 'object' ? (parsedLegacy as Record<string, unknown>) : {},
    );
    if (!legacyAsset) {
      showToast('QR no reconocido. Usa un QR firmado (mtiqr1...) o JSON legacy válido.', 'warning');
      return false;
    }

    const localMatch = activos.find((asset) => (
      Number(asset.id) === Number(legacyAsset.id)
      || normalizeForCompare(asset.tag || '') === normalizeForCompare(legacyAsset.tag || '')
      || normalizeForCompare(asset.serial || '') === normalizeForCompare(legacyAsset.serial || '')
    ));
    const nextAsset = localMatch || legacyAsset;
    setView('inventory');
    setSearchTerm(nextAsset.tag);
    setSelectedAsset(nextAsset);
    showToast('Activo resuelto con QR local', 'success');
    return true;
  }, [activos, backendConnected, showToast]);

  const resolveQrFromManualInput = useCallback(async () => {
    const ok = await resolveQrPayload(qrManualInput);
    if (ok) setShowQrScanner(false);
  }, [qrManualInput, resolveQrPayload]);

  useEffect(() => {
    if (!showQrScanner) {
      stopQrCameraScan();
      setQrScannerStatus('Escanea un QR firmado o pega el token manualmente.');
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
                setQrScannerStatus('No se pudo resolver. Puedes intentar de forma manual.');
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
  }, [isQrCameraSupported, isResolvingQr, resolveQrPayload, showQrScanner, stopQrCameraScan]);

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

    setIsCreatingUser(true);
    try {
      if (backendConnected) {
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
      } else {
        if (isEditing && editingUserId !== null) {
          const current = users.find((user) => user.id === editingUserId);
          const activeAdmins = users.filter((user) => user.activo !== false && user.rol === 'admin').length;
          if (current && current.id === sessionUser?.id && current.rol === 'admin' && rol !== 'admin') {
            showToast('No puedes quitarte el rol administrador', 'warning');
            return;
          }
          if (current && current.rol === 'admin' && current.activo !== false && rol !== 'admin' && activeAdmins <= 1) {
            showToast('Debe existir al menos un administrador activo', 'warning');
            return;
          }
          setUsers((prev) =>
            prev.map((user) =>
              user.id === editingUserId
                ? {
                    ...user,
                    nombre,
                    username,
                    departamento,
                    rol,
                  }
                : user,
            ),
          );
          showToast(`Usuario ${username} actualizado en modo local`, 'warning');
        } else {
          const localUser: UserItem = {
            id: Date.now(),
            nombre,
            username,
            rol,
            departamento,
            activo: true,
          };
          setUsers((prev) => [...prev, localUser]);
          showToast(`Usuario ${username} agregado en modo local`, 'warning');
        }
      }

      resetNewUserForm();
    } catch (error) {
      if (backendConnected && isEditing && editingUserId !== null && isRouteNotFoundApiError(error)) {
        const current = users.find((user) => user.id === editingUserId);
        const activeAdmins = users.filter((user) => user.activo !== false && user.rol === 'admin').length;
        if (current && current.id === sessionUser?.id && current.rol === 'admin' && rol !== 'admin') {
          showToast('No puedes quitarte el rol administrador', 'warning');
          return;
        }
        if (current && current.rol === 'admin' && current.activo !== false && rol !== 'admin' && activeAdmins <= 1) {
          showToast('Debe existir al menos un administrador activo', 'warning');
          return;
        }
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingUserId
              ? {
                  ...user,
                  nombre,
                  username,
                  departamento,
                  rol,
                }
              : user,
          ),
        );
        resetNewUserForm();
        showToast('Usuario actualizado en modo local. Reinicia backend para guardar cambios permanentes.', 'warning');
        return;
      }
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
    setUserActionLoadingId(user.id);
    try {
      if (backendConnected) {
        await apiRequest<UserItem>(`/users/${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ activo: nextActive }),
        });
        await refreshData(true);
      } else {
        const activeAdmins = users.filter((u) => u.activo !== false && u.rol === 'admin').length;
        if (!nextActive && user.rol === 'admin' && activeAdmins <= 1) {
          showToast('Debe existir al menos un administrador activo', 'warning');
          return;
        }
        setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, activo: nextActive } : item)));
      }
      showToast(nextActive ? 'Usuario activado' : 'Usuario desactivado', 'success');
    } catch (error) {
      if (backendConnected && isRouteNotFoundApiError(error)) {
        const activeAdmins = users.filter((u) => u.activo !== false && u.rol === 'admin').length;
        if (!nextActive && user.rol === 'admin' && activeAdmins <= 1) {
          showToast('Debe existir al menos un administrador activo', 'warning');
          return;
        }
        setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, activo: nextActive } : item)));
        showToast(`${nextActive ? 'Usuario activado' : 'Usuario desactivado'} en modo local. Reinicia backend para persistir.`, 'warning');
        return;
      }
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

    setUserActionLoadingId(user.id);
    try {
      if (backendConnected) {
        await apiRequest<{ ok: boolean }>(`/users/${user.id}`, {
          method: 'DELETE',
        });
        await refreshData(true);
      } else {
        const activeAdmins = users.filter((u) => u.activo !== false && u.rol === 'admin').length;
        if (user.rol === 'admin' && user.activo !== false && activeAdmins <= 1) {
          showToast('Debe existir al menos un administrador activo', 'warning');
          return;
        }
        setUsers((prev) => prev.filter((item) => item.id !== user.id));
      }

      if (editingUserId === user.id) {
        resetNewUserForm();
      }
      showToast('Usuario eliminado', 'success');
    } catch (error) {
      if (backendConnected && isRouteNotFoundApiError(error)) {
        const activeAdmins = users.filter((u) => u.activo !== false && u.rol === 'admin').length;
        if (user.rol === 'admin' && user.activo !== false && activeAdmins <= 1) {
          showToast('Debe existir al menos un administrador activo', 'warning');
          return;
        }
        setUsers((prev) => prev.filter((item) => item.id !== user.id));
        if (editingUserId === user.id) {
          resetNewUserForm();
        }
        showToast('Usuario eliminado en modo local. Reinicia backend para persistir.', 'warning');
        return;
      }
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

      if (backendConnected) {
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
          `inválidos: ${preview.invalid + invalidRows}`,
        ];
        showToast(summary.join(' | '), preview.created + preview.updated > 0 ? 'success' : 'warning');
      } else {
        const current = [...activos];
        const getKey = (value?: string) => normalizeForCompare(value || '');
        const findIndexByIdentity = (item: Omit<Activo, 'id'>): number => {
          const idInternoKey = getKey(item.idInterno);
          if (idInternoKey) {
            const idx = current.findIndex((asset) => getKey(asset.idInterno) === idInternoKey);
            if (idx >= 0) return idx;
          }

          const serialKey = getKey(item.serial);
          if (serialKey) {
            const idx = current.findIndex((asset) => getKey(asset.serial) === serialKey);
            if (idx >= 0) return idx;
          }

          const macKey = getKey(item.macAddress);
          if (macKey) {
            const idx = current.findIndex((asset) => getKey(asset.macAddress) === macKey);
            if (idx >= 0) return idx;
          }

          const tagKey = getKey(item.tag);
          if (tagKey) {
            const idx = current.findIndex((asset) => getKey(asset.tag) === tagKey);
            if (idx >= 0) return idx;
          }

          return -1;
        };

        const importFields: Array<keyof Omit<Activo, 'id'>> = [
          'tag',
          'tipo',
          'marca',
          'modelo',
          'ubicacion',
          'estado',
          'serial',
          'fechaCompra',
          'idInterno',
          'equipo',
          'cpu',
          'ram',
          'ramTipo',
          'disco',
          'tipoDisco',
          'macAddress',
          'ipAddress',
          'responsable',
          'departamento',
          'edo',
          'anydesk',
          'passwordRemota',
          'aniosVida',
          'comentarios',
        ];

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let idSeed = Date.now();

        parsedRows.forEach(({ item }) => {
          const idx = findIndexByIdentity(item);
          if (idx < 0) {
            current.push({ id: idSeed, ...item });
            idSeed += 1;
            created += 1;
            return;
          }

          const existing = current[idx];
          const merged: Activo = { ...existing };
          let changed = false;
          importFields.forEach((field) => {
            const incoming = item[field];
            if (incoming === undefined || incoming === null) return;
            if (typeof incoming === 'string' && incoming.trim() === '') return;
            if (merged[field] !== incoming) {
              (merged as unknown as Record<string, unknown>)[field] = incoming;
              changed = true;
            }
          });

          if (changed) {
            current[idx] = merged;
            updated += 1;
          } else {
            skipped += 1;
          }
        });

        setActivos(current);
        if (created + updated > 0) {
          registrarLog('Importación Inventario', file.name, created + updated, 'activos');
        }
        const parts = [
          `Creados: ${created}`,
          `actualizados: ${updated}`,
          `omitidos: ${skipped}`,
          `inválidos: ${invalidRows}`,
        ];
        showToast(parts.join(' | '), invalidRows > 0 ? 'warning' : 'success');
      }
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
    URL.revokeObjectURL(url);
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

  const registrarLog = (accion: string, item: string, cantidad: number, modulo: AuditModule) => {
    const nuevoLog: RegistroAuditoria = {
      id: Date.now(),
      accion,
      item,
      cantidad,
      fecha: new Date().toLocaleString(),
      usuario: sessionUser?.nombre || 'Sistema',
      modulo,
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

    if (!backendConnected) {
      setInsumos((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const nuevoStock = Math.max(0, item.stock + cantidad);
            const accion = cantidad > 0 ? 'Entrada' : 'Salida';
            if (nuevoStock !== item.stock) {
              registrarLog(accion, item.nombre, Math.abs(cantidad), 'insumos');
              if (nuevoStock < item.min && item.stock >= item.min) {
                showToast(`Alerta: ${item.nombre} bajo de stock`, 'warning');
              }
            }
            return { ...item, stock: nuevoStock };
          }
          return item;
        }),
      );
      return;
    }

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
      showToast('No hay insumos críticos para reponer', 'warning');
      return;
    }

    if (!backendConnected) {
      setInsumos((prev) =>
        prev.map((item) => {
          if (getSupplyHealthStatus(item) === 'OK') return item;
          registrarLog('Entrada', item.nombre, cantidad, 'insumos');
          return { ...item, stock: item.stock + cantidad };
        }),
      );
      showToast(`Reposición aplicada a ${target.length} insumos críticos`, 'success');
      return;
    }

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
      showToast(`Reposición aplicada a ${target.length} insumos críticos`, 'success');
    } catch {
      showToast('No se pudo ejecutar la reposición masiva', 'error');
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

    if (!backendConnected) {
      setInsumos((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            if (nuevaCantidad === item.stock) return item;
            const diferencia = nuevaCantidad - item.stock;
            const accion = diferencia > 0 ? 'Ajuste Entrada' : 'Ajuste Salida';
            registrarLog(accion, item.nombre, Math.abs(diferencia), 'insumos');

            if (nuevaCantidad < item.min && item.stock >= item.min) {
              showToast(`Alerta: ${item.nombre} bajo de stock`, 'warning');
            }

            return { ...item, stock: nuevaCantidad };
          }
          return item;
        }),
      );
      return true;
    }

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

    const confirmacion = window.confirm(`¿Estás seguro de eliminar "${itemToDelete.nombre}"?`);
    if (!confirmacion) return;

    if (!backendConnected) {
      setInsumos((prev) => prev.filter((i) => i.id !== id));
      registrarLog('Baja', itemToDelete.nombre, itemToDelete.stock, 'insumos');
      showToast('Insumo eliminado', 'error');
      return;
    }

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

    if (!backendConnected) {
      setActivos((prev) => prev.filter((a) => a.id !== id));
      registrarLog('Baja Activo', activoToDelete.tag, 1, 'activos');
      showToast(`Activo ${activoToDelete.tag} dado de baja`, 'error');
      return true;
    }

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

    const confirmacionInicial = window.confirm(`Se eliminarán ${activos.length} activos de forma permanente. ¿Continuar?`);
    if (!confirmacionInicial) return false;

    const confirmacionFinal = window.confirm('Esta acción no se puede deshacer. ¿Confirmas borrar TODO el inventario de activos IT?');
    if (!confirmacionFinal) return false;

    if (!backendConnected) {
      const removedCount = activos.length;
      setActivos([]);
      setSelectedAsset(null);
      registrarLog('Borrado Masivo Activos', 'Inventario completo', removedCount, 'activos');
      showToast(`Se eliminaron ${removedCount} activos en modo local`, 'warning');
      return true;
    }

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
        showToast('No había activos para eliminar', 'warning');
      } else {
        showToast(`Se eliminaron ${removedCount} activos`, 'success');
      }
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        showToast('Sesión expirada. Inicia sesión nuevamente.', 'warning');
        return false;
      }
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el inventario de activos', 'error');
      return false;
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const isTicketModal = showModal === 'ticket';
    if (isTicketModal) {
      if (!canCreateTickets) {
        showToast('Tu rol no permite crear tickets', 'warning');
        return;
      }
    } else if (!canEdit) {
      showToast('Tu rol no permite esta acción', 'warning');
      return;
    }
    const prioridad = formData.prioridad || 'MEDIA';

    try {
      if (showModal === 'activo') {
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
          passwordRemota: formData.passwordRemota || '',
          aniosVida: formData.aniosVida || '',
          comentarios: formData.comentarios || '',
        };

        if (backendConnected) {
          await apiRequest('/activos', {
            method: 'POST',
            body: JSON.stringify({
              ...activoPayload,
              usuario: sessionUser?.nombre || 'Admin IT',
              rol: sessionUser?.rol || 'admin',
            }),
          });
          await refreshData(true);
        } else {
          const id = Date.now();
          setActivos((prev) => [
            ...prev,
            {
              id,
              tag: (activoPayload.tag || '').trim().toUpperCase(),
              tipo: (activoPayload.tipo || '').trim().toUpperCase(),
              marca: (activoPayload.marca || '').trim(),
              modelo: (activoPayload.modelo || '').trim(),
              ubicacion: (activoPayload.ubicacion || '').trim(),
              serial: (activoPayload.serial || '').trim().toUpperCase(),
              estado: (activoPayload.estado as EstadoActivo) || 'Operativo',
              fechaCompra: activoPayload.fechaCompra || new Date().toISOString().split('T')[0],
              idInterno: (activoPayload.idInterno || '').trim().toUpperCase(),
              equipo: ((activoPayload.equipo || activoPayload.tipo) || '').trim().toUpperCase(),
              cpu: (activoPayload.cpu || '').trim().toUpperCase(),
              ram: (activoPayload.ram || '').trim().toUpperCase(),
              ramTipo: (activoPayload.ramTipo || '').trim().toUpperCase(),
              disco: (activoPayload.disco || '').trim().toUpperCase(),
              tipoDisco: (activoPayload.tipoDisco || '').trim().toUpperCase(),
              macAddress: normalizeMacAddress((activoPayload.macAddress || '').trim()),
              ipAddress: normalizeIpAddress((activoPayload.ipAddress || '').trim()),
              responsable: (activoPayload.responsable || '').trim(),
              departamento: (activoPayload.departamento || '').trim().toUpperCase(),
              edo: ((activoPayload.estado as EstadoActivo) || 'Operativo').toUpperCase(),
              anydesk: (activoPayload.anydesk || '').trim(),
              passwordRemota: (activoPayload.passwordRemota || '').trim(),
              aniosVida: (activoPayload.aniosVida || '').trim(),
              comentarios: (activoPayload.comentarios || '').trim(),
            },
          ]);
        }
        showToast('Activo registrado', 'success');
      }

      if (showModal === 'insumo') {
        const nombre = (formData.nombre || '').trim();
        const categoria = (formData.categoria || 'HARDWARE').trim().toUpperCase();
        const stockRaw = Number(formData.stock ?? NaN);
        const minRaw = Number(formData.min ?? NaN);

        if (!nombre) {
          showToast('Nombre de insumo requerido', 'warning');
          return;
        }
        if (!Number.isFinite(stockRaw) || !Number.isFinite(minRaw)) {
          showToast('Stock y mínimo deben ser numéricos', 'warning');
          return;
        }
        if (stockRaw < 0 || minRaw < 0) {
          showToast('Stock y mínimo deben ser mayores o iguales a 0', 'warning');
          return;
        }

        const stock = Math.trunc(stockRaw);
        const min = Math.trunc(minRaw);
        if (min > stock) {
          showToast('El mínimo no puede ser mayor al stock inicial', 'warning');
          return;
        }

        const duplicateLocal = insumos.some(
          (item) =>
            normalizeForCompare(item.nombre) === normalizeForCompare(nombre) &&
            normalizeForCompare(item.categoria) === normalizeForCompare(categoria),
        );
        if (duplicateLocal) {
          showToast('Ya existe un insumo con ese nombre y categoría', 'warning');
          return;
        }

        if (backendConnected) {
          await apiRequest('/insumos', {
            method: 'POST',
            body: JSON.stringify({
              nombre,
              unidad: 'Piezas',
              stock,
              min,
              categoria,
              usuario: sessionUser?.nombre || 'Admin IT',
              rol: sessionUser?.rol || 'admin',
            }),
          });
          await refreshData(true);
        } else {
          const id = Date.now();
          setInsumos((prev) => [
            ...prev,
            {
              id,
              nombre,
              unidad: 'Piezas',
              stock,
              min,
              categoria,
              activo: true,
            },
          ]);
          registrarLog('Registro Nuevo', nombre, stock, 'insumos');
        }
        showToast('Insumo añadido', 'success');
      }

      if (showModal === 'ticket') {
        const activoTag = String(formData.activoTag || '').trim().toUpperCase();
        const sucursal = String(formData.sucursal || '').trim().toUpperCase();
        const areaAfectada = String(formData.areaAfectada || '').trim();
        const descripcionBase = String(formData.descripcion || '').trim();
        const areaLabel = `Área afectada: ${areaAfectada}`;
        const descripcionFinal = descripcionBase.startsWith(areaLabel)
          ? descripcionBase
          : `${areaLabel} | ${descripcionBase}`;
        if (!activoTag) {
          showToast('Agrega el TAG del equipo', 'warning');
          return;
        }
        if (!isValidTicketBranchValue(sucursal)) {
          showToast('Selecciona una sucursal válida para el ticket', 'warning');
          return;
        }
        if (!areaAfectada) {
          showToast('Selecciona área afectada', 'warning');
          return;
        }
        if (!descripcionBase) {
          showToast('Agrega la descripción de la falla', 'warning');
          return;
        }

        if (backendConnected) {
          await apiRequest('/tickets', {
            method: 'POST',
            body: JSON.stringify({
              activoTag,
              descripcion: descripcionFinal,
              sucursal,
              prioridad,
              asignadoA: canEdit ? (formData.asignadoA || '') : '',
              usuario: sessionUser?.nombre || 'Admin IT',
              rol: sessionUser?.rol || 'admin',
              departamento: sessionUser?.departamento || '',
            }),
          });
          await refreshData(true);
        } else {
          const id = Date.now();
          const fechaLimite = calculateSlaDeadline(prioridad);
          const ticketTag = activoTag || `#${id}`;
          setTickets((prev) => [
            ...prev,
            {
              id,
              activoTag,
              descripcion: descripcionFinal,
              sucursal,
              prioridad,
              estado: 'Abierto',
              fecha: new Date().toLocaleString(),
              fechaCreacion: new Date().toISOString(),
              fechaLimite,
              asignadoA: canEdit ? (formData.asignadoA || '') : '',
              solicitadoPor: sessionUser?.nombre || 'Usuario',
              solicitadoPorId: sessionUser?.id || null,
              solicitadoPorUsername: (sessionUser?.username || '').trim().toLowerCase(),
              departamento: (sessionUser?.departamento || '').trim().toUpperCase(),
              slaVencido: false,
              slaRestanteMin: Math.ceil((new Date(fechaLimite).getTime() - Date.now()) / 60000),
              historial: [
                {
                  fecha: new Date().toLocaleString(),
                  usuario: sessionUser?.nombre || 'Admin IT',
                  accion: 'Ticket Creado',
                  estado: 'Abierto',
                  comentario: 'Registro inicial',
                },
              ],
            },
          ]);
          registrarLog('Nuevo Ticket', ticketTag, 1, 'tickets');
          if (prioridad === 'CRITICA') {
            setActivos((prev) =>
              prev.map((a) => (a.tag === activoTag ? { ...a, estado: 'Falla' } : a)),
            );
          }
        }
        showToast('Ticket creado', 'success');
      }

      closeModal();
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el registro', 'error');
    }
  };

  const resolverTicket = async (id: number) => {
    if (!canEdit) {
      showToast('Tu rol no permite resolver tickets', 'warning');
      return;
    }

    if (!backendConnected) {
      const ticketToResolve = tickets.find((ticket) => ticket.id === id);
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === id
            ? {
                ...ticket,
                estado: 'Resuelto',
                fechaCierre: ticket.fechaCierre || new Date().toISOString(),
                historial: [
                  {
                    fecha: new Date().toLocaleString(),
                    usuario: sessionUser?.nombre || 'Admin IT',
                    accion: 'Ticket Resuelto',
                    estado: 'Resuelto',
                    comentario: 'Resolucion en modo local',
                  },
                  ...(ticket.historial || []),
                ],
              }
            : ticket,
        ),
      );
      registrarLog('Ticket Resuelto', ticketToResolve?.activoTag || `#${id}`, 1, 'tickets');
      showToast('Ticket cerrado', 'success');
      return;
    }

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

    if (!backendConnected) {
      const remainingTickets = tickets.filter((ticket) => ticket.id !== ticketId);
      setTickets(remainingTickets);
      const hadOpenState = ticketToDelete.estado === 'Abierto' || ticketToDelete.estado === 'En Proceso';
      if (hadOpenState) {
        const hasRelatedOpenTickets = remainingTickets.some((ticket) => (
          normalizeForCompare(ticket.activoTag) === normalizeForCompare(ticketToDelete.activoTag)
          && (ticket.estado === 'Abierto' || ticket.estado === 'En Proceso')
        ));
        if (!hasRelatedOpenTickets) {
          setActivos((prev) => prev.map((asset) => (
            normalizeForCompare(asset.tag) === normalizeForCompare(ticketToDelete.activoTag)
              ? { ...asset, estado: 'Operativo' }
              : asset
          )));
        }
      }
      registrarLog('Ticket Eliminado', ticketToDelete.activoTag || `#${ticketId}`, 1, 'tickets');
      showToast('Ticket eliminado en modo local', 'warning');
      return;
    }

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

  const actualizarTicket = async (ticketId: number, updates: { estado?: TicketEstado; asignadoA?: string; comentario?: string }) => {
    if (!canEdit) {
      showToast('Tu rol no permite editar tickets', 'warning');
      return;
    }

    if (!backendConnected) {
      const ticketCurrent = tickets.find((ticket) => ticket.id === ticketId);
      setTickets((prev) =>
        prev.map((ticket) => {
          if (ticket.id !== ticketId) return ticket;
          const nextState = updates.estado || ticket.estado;
          return {
            ...ticket,
            estado: nextState,
            asignadoA: updates.asignadoA !== undefined ? updates.asignadoA : ticket.asignadoA,
            fechaCierre:
              nextState === 'Resuelto' || nextState === 'Cerrado'
                ? ticket.fechaCierre || new Date().toISOString()
                : ticket.fechaCierre,
          };
        }),
      );
      if (updates.estado) {
        registrarLog(`Ticket ${updates.estado}`, ticketCurrent?.activoTag || `#${ticketId}`, 1, 'tickets');
      } else if (updates.asignadoA !== undefined) {
        registrarLog('Asignación Ticket', ticketCurrent?.activoTag || `#${ticketId}`, 1, 'tickets');
      }
      showToast('Ticket actualizado en modo local', 'warning');
      return;
    }

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

    try {
      if (backendConnected) {
        const updatedTicket = await apiRequest<TicketItem>(`/tickets/${ticketId}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            comentario,
            usuario: sessionUser?.nombre || 'Sistema',
            rol: sessionUser?.rol || 'consulta',
          }),
        });
        setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updatedTicket : ticket)));
      } else {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId
              ? {
                  ...ticket,
                  historial: [
                    {
                      fecha: new Date().toLocaleString(),
                      usuario: sessionUser?.nombre || 'Sistema',
                      accion: 'Comentario',
                      estado: ticket.estado,
                      comentario,
                    },
                    ...(ticket.historial || []),
                  ],
                }
              : ticket,
          ),
        );
        registrarLog('Comentario Ticket', target.activoTag, 1, 'tickets');
      }

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

    setTicketAttachmentLoadingId(ticketId);
    try {
      if (backendConnected) {
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
      } else {
        const dataUrl = await fileToDataUrl(file);
        const attachment: TicketAttachment = {
          id: Date.now(),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: sessionUser?.nombre || 'Sistema',
          localOnly: true,
          localUrl: dataUrl,
        };
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId
              ? {
                  ...ticket,
                  attachments: [attachment, ...(ticket.attachments || [])],
                  historial: [
                    {
                      fecha: new Date().toLocaleString(),
                      usuario: sessionUser?.nombre || 'Sistema',
                      accion: 'Adjunto agregado',
                      estado: ticket.estado,
                      comentario: file.name,
                    },
                    ...(ticket.historial || []),
                  ],
                }
              : ticket,
          ),
        );
        registrarLog('Adjunto Ticket', `${target.activoTag} | ${file.name}`, 1, 'tickets');
      }
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
        URL.revokeObjectURL(url);
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
                    {
                      fecha: new Date().toLocaleString(),
                      usuario: sessionUser?.nombre || 'Sistema',
                      accion: 'Adjunto eliminado',
                      estado: ticket.estado,
                      comentario: attachment.fileName,
                    },
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

  const descargarAuditoria = (module?: AuditModule) => {
    const rowsSource = module
      ? normalizedAuditRows.filter((log) => log.modulo === module)
      : normalizedAuditRows;
    if (rowsSource.length === 0) {
      const label = module ? auditModuleLabel(module) : 'auditoría';
      showToast(`No hay registros para exportar en ${label}`, 'warning');
      return;
    }

    const headers = ['Módulo', 'Fecha', 'Usuario', 'Acción', 'Item', 'Cantidad'];
    const rows = rowsSource.map((log) => [
      auditModuleLabel(log.modulo || 'otros'),
      log.fecha,
      log.usuario,
      log.accion,
      log.item,
      String(log.cantidad),
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
    URL.revokeObjectURL(url);
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
    URL.revokeObjectURL(url);
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

  const assetSearch = normalizeForCompare(searchTerm);
  const networkIpCounts = activos.reduce<Record<string, number>>((acc, asset) => {
    const ip = (asset.ipAddress || '').trim();
    if (ip) acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {});
  const networkMacCounts = activos.reduce<Record<string, number>>((acc, asset) => {
    const mac = (asset.macAddress || '').trim().toLowerCase();
    if (mac) acc[mac] = (acc[mac] || 0) + 1;
    return acc;
  }, {});
  const hasNetworkDuplication = (asset: Activo): boolean => {
    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    return (ip ? (networkIpCounts[ip] || 0) > 1 : false) || (mac ? (networkMacCounts[mac] || 0) > 1 : false);
  };
  const localRiskSummary = useMemo(() => calculateAssetRiskSummary(activos), [activos]);
  const effectiveRiskSummary = assetRiskSource === 'api' && assetRiskSummary ? assetRiskSummary : localRiskSummary;
  const duplicateIpEntries = effectiveRiskSummary.duplicateIpEntries;
  const duplicateMacEntries = effectiveRiskSummary.duplicateMacEntries;

  const departamentoOptions = Array.from(
    new Set(activos.map((asset) => (asset.departamento || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const equipoOptions = Array.from(
    new Set(activos.map((asset) => (asset.tipo || asset.equipo || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        const deptCompare = normalizeForCompare(left.departamento || '').localeCompare(normalizeForCompare(right.departamento || ''));
        if (deptCompare !== 0) return deptCompare;
        return normalizeForCompare(left.nombre).localeCompare(normalizeForCompare(right.nombre));
      }),
    [users],
  );
  const activeUsersCount = users.filter((user) => user.activo !== false).length;
  const requesterUsersCount = users.filter((user) => user.rol === 'solicitante').length;

  const activosConIp = effectiveRiskSummary.activosConIp;
  const activosConMac = effectiveRiskSummary.activosConMac;
  const activosSinResponsable = effectiveRiskSummary.activosSinResponsable;
  const activosVidaAlta = effectiveRiskSummary.activosVidaAlta;
  const activosEnFalla = effectiveRiskSummary.activosEnFalla;

  const filteredActivos = activos.filter((asset) => {
    if (inventoryDepartmentFilter !== 'TODOS' && normalizeForCompare(asset.departamento || '') !== normalizeForCompare(inventoryDepartmentFilter)) {
      return false;
    }
    if (inventoryEquipmentFilter !== 'TODOS' && normalizeForCompare(asset.tipo || asset.equipo || '') !== normalizeForCompare(inventoryEquipmentFilter)) {
      return false;
    }
    if (inventoryStatusFilter !== 'TODOS' && asset.estado !== inventoryStatusFilter) {
      return false;
    }
    if (inventoryRiskFilter === 'SIN_IP' && (asset.ipAddress || '').trim()) {
      return false;
    }
    if (inventoryRiskFilter === 'SIN_MAC' && (asset.macAddress || '').trim()) {
      return false;
    }
    if (inventoryRiskFilter === 'SIN_RESP' && (asset.responsable || '').trim()) {
      return false;
    }
    if (inventoryRiskFilter === 'DUP_RED' && !hasNetworkDuplication(asset)) {
      return false;
    }
    if (inventoryRiskFilter === 'VIDA_ALTA') {
      const years = parseAssetLifeYears(asset.aniosVida);
      if (years === null || years < 4) return false;
    }

    if (!assetSearch) return true;
    const fields = [
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
    ];
    return fields.some((value) => normalizeForCompare(value || '').includes(assetSearch));
  });
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
    const normalizedSearch = normalizeForCompare(supplySearchTerm);
    const rows = insumos.filter((item) => {
      if (supplyCategoryFilter !== 'TODAS' && item.categoria !== supplyCategoryFilter) return false;

      const status = getSupplyHealthStatus(item);
      if (supplyStatusFilter !== 'TODOS' && status !== supplyStatusFilter) return false;

      if (!normalizedSearch) return true;
      return (
        normalizeForCompare(item.nombre).includes(normalizedSearch) ||
        normalizeForCompare(item.categoria).includes(normalizedSearch)
      );
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
  }, [insumos, supplyCategoryFilter, supplySearchTerm, supplyStatusFilter]);

  const importIssueRows = importDraft
    ? [...(importDraft.preview.details || []), ...importDraft.localInvalidDetails].filter(
        (detail) => detail.status === 'invalid' || detail.status === 'skipped',
      )
    : [];

  const normalizedAuditRows = useMemo(
    () =>
      auditoria.map((log) => {
        const modulo = resolveAuditModule(log);
        return { ...log, modulo } as RegistroAuditoria;
      }),
    [auditoria],
  );
  const auditByModule = useMemo(() => {
    const grouped: Record<AuditModule, RegistroAuditoria[]> = {
      activos: [],
      insumos: [],
      tickets: [],
      otros: [],
    };
    normalizedAuditRows.forEach((log) => {
      const modulo = log.modulo || 'otros';
      grouped[modulo].push(log);
    });
    return grouped;
  }, [normalizedAuditRows]);

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
  const scopedTickets = useMemo(
    () => (isRequesterOnlyUser ? tickets.filter(canAccessTicketBySession) : tickets),
    [canAccessTicketBySession, isRequesterOnlyUser, tickets],
  );

  const isTicketOpen = (ticket: TicketItem): boolean => ticket.estado !== 'Resuelto' && ticket.estado !== 'Cerrado';
  const openTickets = scopedTickets.filter(isTicketOpen);
  const openTicketsCount = openTickets.length;
  const slaExpiredCount = openTickets.filter((t) => t.slaVencido).length;
  const criticalTicketsCount = openTickets.filter((t) => t.prioridad === 'CRITICA').length;
  const unassignedTicketsCount = openTickets.filter((t) => !(t.asignadoA || '').trim()).length;
  const inProcessTicketsCount = openTickets.filter((t) => t.estado === 'En Proceso').length;

  const sortedTicketsByRecent = [...scopedTickets].sort((a, b) => ticketTimestamp(b) - ticketTimestamp(a));
  const recentTickets = sortedTicketsByRecent.slice(0, 5);
  const topTicketOwners = useMemo(() => {
    const counts = new Map<string, number>();
    scopedTickets.forEach((ticket) => {
      if (!isTicketOpen(ticket)) return;
      const assignee = (ticket.asignadoA || '').trim();
      if (!assignee) return;
      counts.set(assignee, (counts.get(assignee) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [scopedTickets]);

  const filteredTickets = scopedTickets
    .filter((t) => {
      if (ticketLifecycleFilter === 'ABIERTOS') return isTicketOpen(t);
      if (ticketLifecycleFilter === 'CERRADOS') return !isTicketOpen(t);
      return true;
    })
    .filter((t) => (ticketStateFilter === 'TODOS' ? true : t.estado === ticketStateFilter))
    .filter((t) => (ticketPriorityFilter === 'TODAS' ? true : t.prioridad === ticketPriorityFilter))
    .filter((t) => {
      if (ticketAssignmentFilter === 'ASIGNADOS') return !!(t.asignadoA || '').trim();
      if (ticketAssignmentFilter === 'SIN_ASIGNAR') return !(t.asignadoA || '').trim();
      return true;
    })
    .filter((t) => (ticketSlaFilter === 'VENCIDO' ? !!t.slaVencido : true))
    .filter(
      (t) =>
        t.activoTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.asignadoA || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatTicketBranchFromCatalog(t.sucursal).toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if ((a.slaVencido ? 1 : 0) !== (b.slaVencido ? 1 : 0)) return (b.slaVencido ? 1 : 0) - (a.slaVencido ? 1 : 0);
      return ticketTimestamp(b) - ticketTimestamp(a);
    });

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
        <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl border border-slate-100 p-12 text-center">
          <div className="flex justify-center mb-6"><LogoGigantes className="w-24 h-24 animate-bounce" /></div>
          <h1 className="text-3xl font-black text-[#F58220]">LOS GIGANTES</h1>
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
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-700">
      <AppSidebar
        view={view}
        navItems={visibleNavItems}
        sidebarOpen={sidebarOpen}
        onSelectView={(nextView) => {
          setView(nextView);
          setSidebarOpen(false);
        }}
        onLogout={() => {
          void handleLogout();
        }}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <AppHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenSidebar={() => setSidebarOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          backendConnected={backendConnected}
          isSyncing={isSyncing}
          lastSync={lastSync}
          sessionUser={sessionUser}
        />

        <div className="flex-1 overflow-auto p-6 lg:p-10">
          {isSyncing && (
            <div className="max-w-7xl mx-auto mb-4 px-4 py-3 rounded-2xl bg-[#f4fce3] border border-[#d8f5a2] text-[#4a7f10] text-[11px] font-black uppercase tracking-wider">
              Sincronizando datos con backend...
            </div>
          )}
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* VISTA DASHBOARD */}
            {view === 'dashboard' && (
              <div className="space-y-8">
                <div className="bg-slate-800 text-white p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden">
                   <div className="z-10">
                      <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Estado del Sistema</h2>
                      <p className="text-slate-400 text-sm">Resumen operativo general</p>
                      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-300">
                        Abiertos: {openTicketsCount} | Críticos: {criticalTicketsCount} | Sin Asignar: {unassignedTicketsCount}
                      </p>
                   </div>
                   <div className="z-10">
                      <div className="text-right">
                         <p className="text-5xl font-black">{systemHealth}%</p>
                         <p className="text-[10px] font-black text-[#8CC63F] uppercase tracking-widest">Salud IT</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-8">
                  <div onClick={() => setView('supplies')} className="bg-[#F58220] p-10 rounded-[2.5rem] text-white shadow-xl cursor-pointer">
                    <p className="text-xs font-black uppercase opacity-60 mb-2">Stock Bajo</p>
                    <h2 className="text-6xl font-black">{insumos.filter((i) => getSupplyHealthStatus(i) !== 'OK').length}</h2>
                  </div>
                  <div onClick={() => applyTicketFocus('ABIERTOS')} className="bg-white p-10 rounded-[2.5rem] text-slate-800 border border-slate-100 shadow-xl cursor-pointer">
                    <p className="text-xs font-black uppercase text-slate-400 mb-2">Tickets Abiertos</p>
                    <h2 className="text-6xl font-black text-[#F58220]">{openTicketsCount}</h2>
                  </div>
                  <div onClick={() => setView('inventory')} className="bg-[#8CC63F] p-10 rounded-[2.5rem] text-white shadow-xl cursor-pointer">
                    <p className="text-xs font-black uppercase opacity-60 mb-2">Activos</p>
                    <h2 className="text-6xl font-black">{activos.length}</h2>
                  </div>
                  <div onClick={() => applyTicketFocus('CRITICA')} className="bg-amber-50 p-10 rounded-[2.5rem] text-amber-700 border border-amber-100 shadow-xl cursor-pointer">
                    <p className="text-xs font-black uppercase opacity-60 mb-2">Críticos</p>
                    <h2 className="text-6xl font-black">{criticalTicketsCount}</h2>
                  </div>
                  <div onClick={() => applyTicketFocus('SLA')} className="bg-red-50 p-10 rounded-[2.5rem] text-red-600 border border-red-100 shadow-xl cursor-pointer">
                    <p className="text-xs font-black uppercase opacity-60 mb-2">SLA Vencido</p>
                    <h2 className="text-6xl font-black">{slaExpiredCount}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad Reciente</p>
                        <h3 className="text-lg font-black uppercase text-slate-800">Últimos Tickets</h3>
                      </div>
                      <button
                        onClick={() => setView('tickets')}
                        className="px-5 py-2 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                      >
                        Ver Todo
                      </button>
                    </div>

                    <div className="space-y-3">
                      {recentTickets.map((ticket) => (
                        <button
                          key={`recent-${ticket.id}`}
                          onClick={() => {
                            setView('tickets');
                            setSearchTerm(ticket.activoTag);
                          }}
                          className="w-full text-left border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant={ticket.prioridad}>{ticket.prioridad}</Badge>
                            <Badge variant={ticket.estado}>{ticket.estado}</Badge>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSlaStatus(ticket).className}`}>
                              {getSlaStatus(ticket).label}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">#{ticket.id}</span>
                          </div>
                          <p className="text-sm font-black uppercase text-slate-800">{ticket.activoTag} | {ticket.descripcion}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                            Asignado: {ticket.asignadoA || 'Sin asignar'} | Creado: {formatDateTime(ticket.fechaCreacion || ticket.fecha)}
                          </p>
                        </button>
                      ))}
                      {recentTickets.length === 0 && (
                        <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                          Sin actividad reciente de tickets.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga Operativa</p>
                      <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Tickets por Técnico</h3>
                      <div className="space-y-3">
                        {topTicketOwners.map(([owner, count]) => (
                          <div key={`owner-${owner}`} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                            <span className="text-xs font-black uppercase text-slate-700">{owner}</span>
                            <span className="text-xs font-black text-[#F58220]">{count}</span>
                          </div>
                        ))}
                        {topTicketOwners.length === 0 && (
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black uppercase text-slate-400">
                            Sin tickets asignados.
                          </div>
                        )}
                        <button
                          onClick={() => applyTicketFocus('SIN_ASIGNAR')}
                          className="w-full bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
                        >
                          Sin asignar: {unassignedTicketsCount}
                        </button>
                        <button
                          onClick={() => applyTicketFocus('EN_PROCESO')}
                          className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl px-4 py-3 text-xs font-black uppercase text-left"
                        >
                          En proceso: {inProcessTicketsCount}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl p-8">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Riesgos Inventario</p>
                      <h3 className="text-lg font-black uppercase text-slate-800 mb-5">Atencion Prioritaria</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            setView('inventory');
                            applyInventoryFocus('SIN_RESP');
                          }}
                          className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin Responsable</p>
                          <p className="text-xl font-black text-red-500">{activosSinResponsable}</p>
                        </button>
                        <button
                          onClick={() => {
                            setView('inventory');
                            applyInventoryFocus('VIDA_ALTA');
                          }}
                          className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vida Util Alta</p>
                          <p className="text-xl font-black text-amber-500">{activosVidaAlta}</p>
                        </button>
                        <button
                          onClick={() => {
                            setView('inventory');
                            applyInventoryFocus('DUP_RED');
                          }}
                          className="w-full border border-slate-100 rounded-2xl px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duplicados de Red</p>
                          <p className="text-xl font-black text-slate-700">{effectiveRiskSummary.duplicateIpCount + effectiveRiskSummary.duplicateMacCount}</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA INVENTARIO */}
            {view === 'inventory' && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">Activos IT</h3>
                  <div className="flex items-center gap-3">
                    <input
                      ref={inventoryImportInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(event) => void handleImportInventory(event)}
                    />
                    <button
                      disabled={!canEdit || isImportingInventory}
                      onClick={() => inventoryImportInputRef.current?.click()}
                      className="bg-slate-800 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
                    >
                      <Upload size={16} /> {isImportingInventory ? 'Importando...' : 'Importar Excel'}
                    </button>
                    <button
                      onClick={exportarInventarioFiltrado}
                      className="bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:bg-slate-50"
                    >
                      <Download size={16} /> Exportar CSV
                    </button>
                    <button
                      onClick={() => {
                        setQrManualInput('');
                        setQrScannerStatus('Escanea un QR firmado o pega el token manualmente.');
                        setShowQrScanner(true);
                      }}
                      className="bg-white border border-blue-200 text-blue-700 px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-50"
                    >
                      <ScanLine size={16} /> Escanear QR
                    </button>
                    {canManageUsers && (
                      <button
                        disabled={activos.length === 0}
                        onClick={() => void eliminarTodosActivos()}
                        className="bg-white border border-red-200 text-red-600 px-6 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={16} /> Vaciar Activos
                      </button>
                    )}
                    <button
                      disabled={!canEdit}
                      onClick={() => openModal('activo')}
                      className="bg-[#F58220] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
                    >
                      <Plus size={18} /> Nuevo Activo
                    </button>
                  </div>
                </div>
                <div className="p-8 border-b border-slate-50 bg-slate-50/40 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Con IP</p>
                      <p className="text-2xl font-black text-slate-800">{activosConIp} <span className="text-sm text-slate-400">/ {activos.length}</span></p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Con MAC</p>
                      <p className="text-2xl font-black text-slate-800">{activosConMac} <span className="text-sm text-slate-400">/ {activos.length}</span></p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sin Responsable</p>
                      <p className="text-2xl font-black text-red-500">{activosSinResponsable}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vida Util Alta (&gt;=4)</p>
                      <p className="text-2xl font-black text-amber-500">{activosVidaAlta}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
                    <select
                      value={inventoryDepartmentFilter}
                      onChange={(e) => setInventoryDepartmentFilter(e.target.value)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Todos los departamentos</option>
                      {departamentoOptions.map((departamento) => (
                        <option key={departamento} value={departamento}>{departamento}</option>
                      ))}
                    </select>
                    <select
                      value={inventoryEquipmentFilter}
                      onChange={(e) => setInventoryEquipmentFilter(e.target.value)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Todos los equipos</option>
                      {equipoOptions.map((equipo) => (
                        <option key={equipo} value={equipo}>{equipo}</option>
                      ))}
                    </select>
                    <select
                      value={inventoryStatusFilter}
                      onChange={(e) => setInventoryStatusFilter(e.target.value as 'TODOS' | EstadoActivo)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Todos los estados</option>
                      <option value="Operativo">Operativo</option>
                      <option value="Falla">Falla</option>
                    </select>
                    <select
                      value={inventoryRiskFilter}
                      onChange={(e) => setInventoryRiskFilter(e.target.value as InventoryRiskFilter)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Todos los riesgos</option>
                      <option value="SIN_IP">Sin IP</option>
                      <option value="SIN_MAC">Sin MAC</option>
                      <option value="SIN_RESP">Sin responsable</option>
                      <option value="DUP_RED">Duplicado de red</option>
                      <option value="VIDA_ALTA">Vida útil &gt;= 4</option>
                    </select>
                    <select
                      value={inventorySortField}
                      onChange={(e) => setInventorySortField(e.target.value as InventorySortField)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="tag">Orden: Tag</option>
                      <option value="tipo">Orden: Equipo</option>
                      <option value="estado">Orden: Estado</option>
                      <option value="responsable">Orden: Responsable</option>
                      <option value="ubicacion">Orden: Ubicacion</option>
                      <option value="aniosVida">Orden: Vida útil</option>
                    </select>
                    <select
                      value={inventorySortDirection}
                      onChange={(e) => setInventorySortDirection(e.target.value as InventorySortDirection)}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="asc">Ascendente</option>
                      <option value="desc">Descendente</option>
                    </select>
                    <button
                      onClick={() => {
                        setInventoryDepartmentFilter('TODOS');
                        setInventoryEquipmentFilter('TODOS');
                        setInventoryStatusFilter('TODOS');
                        setInventoryRiskFilter('TODOS');
                        setInventorySortField('tag');
                        setInventorySortDirection('asc');
                        setSearchTerm('');
                      }}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => applyInventoryFocus('FALLA')}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                        inventoryStatusFilter === 'Falla' && inventoryRiskFilter === 'TODOS'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Solo Fallas ({activosEnFalla})
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('SIN_RESP')}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                        inventoryRiskFilter === 'SIN_RESP'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Sin Responsable ({activosSinResponsable})
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('DUP_RED')}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                        inventoryRiskFilter === 'DUP_RED'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Duplicados Red ({duplicateIpEntries.length + duplicateMacEntries.length})
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('VIDA_ALTA')}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                        inventoryRiskFilter === 'VIDA_ALTA'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Vida &gt;=4 ({activosVidaAlta})
                    </button>
                  </div>
                </div>
                <div className="px-8 py-6 border-b border-slate-50 bg-red-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Riesgos Detectados</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fuente: {assetRiskSource.toUpperCase()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-black">
                    <button
                      onClick={() => applyInventoryFocus('DUP_RED')}
                      className="px-3 py-1 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      IP/MAC duplicadas: {duplicateIpEntries.length + duplicateMacEntries.length} | Ver afectados
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('SIN_IP')}
                      className="px-3 py-1 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Sin IP: {activos.length - activosConIp} | Ver afectados
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('SIN_MAC')}
                      className="px-3 py-1 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Sin MAC: {activos.length - activosConMac} | Ver afectados
                    </button>
                    <button
                      onClick={() => applyInventoryFocus('SIN_RESP')}
                      className="px-3 py-1 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Sin responsable: {activosSinResponsable} | Ver afectados
                    </button>
                  </div>
                  {(duplicateIpEntries.length > 0 || duplicateMacEntries.length > 0) && (
                    <div className="mt-3 text-[11px] font-bold text-red-500 space-y-1">
                      {duplicateIpEntries.length > 0 && (
                        <p>IPs en conflicto: {duplicateIpEntries.map((entry) => `${entry.value} (${entry.count})`).slice(0, 6).join(', ')}</p>
                      )}
                      {duplicateMacEntries.length > 0 && (
                        <p>MACs en conflicto: {duplicateMacEntries.map((entry) => `${entry.value} (${entry.count})`).slice(0, 6).join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[1200px]">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-6">
                          <button
                            onClick={() => updateInventorySort('tag')}
                            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            TAG / Serial <span>{getInventorySortIndicator('tag')}</span>
                          </button>
                        </th>
                        <th className="px-6 py-6">
                          <button
                            onClick={() => updateInventorySort('tipo')}
                            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            Equipo <span>{getInventorySortIndicator('tipo')}</span>
                          </button>
                        </th>
                        <th className="px-6 py-6">Hardware</th>
                        <th className="px-6 py-6">
                          <button
                            onClick={() => updateInventorySort('responsable')}
                            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            Red / Responsable <span>{getInventorySortIndicator('responsable')}</span>
                          </button>
                        </th>
                        <th className="px-6 py-6">
                          <button
                            onClick={() => updateInventorySort('ubicacion')}
                            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            Ubicacion <span>{getInventorySortIndicator('ubicacion')}</span>
                          </button>
                        </th>
                        <th className="px-6 py-6">
                          <button
                            onClick={() => updateInventorySort('estado')}
                            className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                          >
                            Estado <span>{getInventorySortIndicator('estado')}</span>
                          </button>
                        </th>
                        <th className="px-6 py-6 text-right">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedFilteredActivos.map(a => (
                        <tr key={a.id} onClick={() => setSelectedAsset(a)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                          <td className="px-6 py-6">
                            <p className="font-black text-slate-800 uppercase text-sm">{a.tag}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{a.serial}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{a.idInterno || 'SIN ID INTERNO'}</p>
                          </td>
                          <td className="px-6 py-6 text-xs">
                            <p className="font-black text-slate-700 uppercase">{a.tipo}</p>
                            <p className="font-bold text-slate-500 uppercase">
                              {a.marca}
                              {a.modelo ? ` | ${a.modelo}` : ''}
                            </p>
                          </td>
                          <td className="px-6 py-6 text-xs">
                            <p className="font-black text-slate-600 uppercase">
                              {a.cpu || 'CPU N/D'} | {a.ram ? `${a.ram}${a.ramTipo ? ` ${a.ramTipo}` : ''}` : 'RAM N/D'}
                            </p>
                            <p className="font-bold text-slate-500 uppercase">
                              {a.disco ? `${a.disco}${a.tipoDisco ? ` ${a.tipoDisco}` : ''}` : 'DISCO N/D'}
                            </p>
                          </td>
                          <td className="px-6 py-6 text-xs">
                            <p className="font-black text-slate-600">{a.ipAddress || 'IP N/D'} | {a.macAddress || 'MAC N/D'}</p>
                            <p className="font-bold text-slate-500 uppercase">
                              {a.responsable || 'SIN RESPONSABLE'}
                              {a.departamento ? ` | ${a.departamento}` : ''}
                            </p>
                          </td>
                          <td className="px-6 py-6 text-xs font-bold text-slate-500 uppercase">{a.ubicacion}</td>
                          <td className="px-6 py-6">
                            <Badge variant={a.estado}>{a.estado}</Badge>
                            <p className="text-[10px] mt-2 text-slate-400 font-black uppercase">{a.aniosVida || 'N/D'}</p>
                          </td>
                          <td className="px-6 py-6 text-right">
                             <div className="flex justify-end gap-3 items-center">
                                <button
                                  disabled={!canEdit}
                                  onClick={(e) => eliminarActivo(a.id, e)}
                                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all z-30 disabled:opacity-40"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <ChevronRight className="text-slate-300" />
                             </div>
                          </td>
                        </tr>
                      ))}
                      {sortedFilteredActivos.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                            No hay activos con los filtros actuales.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VISTA INSUMOS */}
            {view === 'supplies' && (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                  <h3 className="font-black text-slate-800 uppercase text-xl">Gestión de Stock</h3>
                  <button
                    disabled={!canEdit}
                    onClick={() => openModal('insumo')}
                    className="bg-[#8CC63F] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
                  >
                    <PlusCircle size={18} /> Registrar Insumo
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Insumos</p>
                    <p className="text-2xl font-black text-slate-800">{supplySummary.totalInsumos}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bajo Mínimo</p>
                    <p className="text-2xl font-black text-amber-500">{supplySummary.bajoMinimo}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Agotados</p>
                    <p className="text-2xl font-black text-red-500">{supplySummary.agotados}</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidades Totales</p>
                    <p className="text-2xl font-black text-slate-800">{supplySummary.totalUnidades}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input
                      value={supplySearchTerm}
                      onChange={(e) => setSupplySearchTerm(e.target.value)}
                      placeholder="Buscar insumo..."
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 outline-none"
                    />
                  </div>
                  <select
                    value={supplyCategoryFilter}
                    onChange={(e) => setSupplyCategoryFilter(e.target.value)}
                    className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                  >
                    <option value="TODAS">Todas categorías</option>
                    {supplyCategoryOptions.map((categoria) => (
                      <option key={categoria} value={categoria}>{categoria}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={supplyStatusFilter}
                      onChange={(e) => setSupplyStatusFilter(e.target.value as SupplyStatusFilter)}
                      className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Todos</option>
                      <option value="AGOTADO">Agotado</option>
                      <option value="BAJO">Bajo</option>
                      <option value="OK">OK</option>
                    </select>
                    <button
                      onClick={() => {
                        setSupplySearchTerm('');
                        setSupplyCategoryFilter('TODAS');
                        setSupplyStatusFilter('TODOS');
                      }}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Mostrando: {filteredSupplies.length} / {insumos.length}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Orden: Agotado &gt; Bajo &gt; OK
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSupplyStatusFilter('AGOTADO')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                      supplyStatusFilter === 'AGOTADO'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                    }`}
                  >
                    Ver agotados ({supplySummary.agotados})
                  </button>
                  <button
                    onClick={() => setSupplyStatusFilter('BAJO')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                      supplyStatusFilter === 'BAJO'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    Ver bajo mínimo ({supplySummary.bajoMinimo})
                  </button>
                  <button
                    onClick={() => setSupplyStatusFilter('TODOS')}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                      supplyStatusFilter === 'TODOS'
                        ? 'bg-slate-700 text-white border-slate-700'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Ver todos
                  </button>
                  <button
                    disabled={!canEdit}
                    onClick={() => void reponerCriticos(5)}
                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border bg-[#f4fce3] text-[#5e8f1d] border-[#d8f5a2] hover:bg-[#e8f9c8] disabled:opacity-50"
                  >
                    Reponer críticos +5
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredSupplies.map((item) => {
                    const supplyStatus = getSupplyHealthStatus(item);
                    const isLow = supplyStatus === 'BAJO' || supplyStatus === 'AGOTADO';
                    const progress =
                      item.min > 0
                        ? Math.max(0, Math.min(100, Math.round((item.stock / item.min) * 100)))
                        : item.stock > 0
                          ? 100
                          : 0;
                    const statusTone =
                      supplyStatus === 'AGOTADO'
                        ? 'text-red-500'
                        : supplyStatus === 'BAJO'
                          ? 'text-amber-500'
                          : 'text-slate-800';

                    return (
                      <div
                        key={item.id}
                        className={`bg-white p-8 rounded-[2.5rem] border ${isLow ? 'border-red-100 ring-2 ring-red-50' : 'border-slate-100'} shadow-xl relative`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {item.categoria}
                          </span>
                          <button
                            disabled={!canEdit}
                            onClick={(e) => eliminarInsumo(item.id, e)}
                            className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                            title="Eliminar insumo"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>

                        <h4 className="font-black text-slate-800 uppercase text-sm mb-4 h-10">{item.nombre}</h4>

                        <div className="mb-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              supplyStatus === 'AGOTADO'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : supplyStatus === 'BAJO'
                                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                                  : 'bg-green-50 text-green-600 border-green-200'
                            }`}
                          >
                            {supplyStatus}
                          </span>
                        </div>

                        <div className="mb-6">
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full ${supplyStatus === 'AGOTADO' ? 'bg-red-500' : supplyStatus === 'BAJO' ? 'bg-amber-500' : 'bg-[#8CC63F]'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Cobertura mín: {progress}% | Estado: {supplyStatus}
                          </p>
                        </div>

                        <div className="flex items-center justify-center gap-3 mb-2 h-16">
                          <button
                            disabled={!canEdit}
                            onClick={() => ajustarStock(item.id, -1)}
                            title="Reducir stock (-1)"
                            className="w-12 h-12 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all border border-red-100 shadow-sm disabled:opacity-40"
                          >
                            <MinusCircle size={24} />
                          </button>

                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              disabled={!canEdit}
                              className={`w-24 text-center text-4xl font-black bg-transparent outline-none ${statusTone}`}
                              value={supplyStockDrafts[item.id] ?? String(item.stock)}
                              onChange={(e) =>
                                setSupplyStockDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              onBlur={() => void confirmarStockManual(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') {
                                  setSupplyStockDrafts((prev) => {
                                    if (!(item.id in prev)) return prev;
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase -mt-1">Mín: {item.min}</span>
                          </div>

                          <button
                            disabled={!canEdit}
                            onClick={() => ajustarStock(item.id, 1)}
                            title="Incrementar stock (+1)"
                            className="w-12 h-12 flex items-center justify-center bg-[#f4fce3] hover:bg-[#e8f9c8] text-[#5e8f1d] rounded-xl transition-all border border-[#d8f5a2] shadow-sm disabled:opacity-40"
                          >
                            <PlusCircle size={24} />
                          </button>
                        </div>

                        <div className="flex justify-center gap-2">
                          <button
                            disabled={!canEdit}
                            onClick={() => ajustarStock(item.id, -5)}
                            className="px-3 py-1 rounded-lg border border-red-100 bg-red-50 text-red-600 text-[10px] font-black uppercase disabled:opacity-40"
                            title="Reducir stock (-5)"
                          >
                            -5
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => ajustarStock(item.id, 5)}
                            className="px-3 py-1 rounded-lg border border-lime-100 bg-[#f4fce3] text-[#5e8f1d] text-[10px] font-black uppercase disabled:opacity-40"
                            title="Incrementar stock (+5)"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredSupplies.length === 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
                    No hay insumos con los filtros actuales.
                  </div>
                )}
              </div>
            )}

            {/* VISTA AUDITORÍA */}
            {view === 'history' && (
              <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-8 md:p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trazabilidad</p>
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Auditoría por Módulo</h3>
                    </div>
                    <button
                      onClick={() => descargarAuditoria()}
                      className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Download size={16} /> Exportar Todo
                    </button>
                  </div>
                  <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Tickets</p>
                      <p className="text-3xl font-black text-blue-700">{auditByModule.tickets.length}</p>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Insumos</p>
                      <p className="text-3xl font-black text-green-700">{auditByModule.insumos.length}</p>
                    </div>
                    <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Activos IT</p>
                      <p className="text-3xl font-black text-orange-700">{auditByModule.activos.length}</p>
                    </div>
                  </div>
                </div>

                {([
                  { module: 'tickets' as AuditModule, title: 'Auditoría Tickets', rows: auditByModule.tickets },
                  { module: 'insumos' as AuditModule, title: 'Auditoría Insumos', rows: auditByModule.insumos },
                  { module: 'activos' as AuditModule, title: 'Auditoría Activos IT', rows: auditByModule.activos },
                ]).map((section) => (
                  <div key={`audit-${section.module}`} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">{section.title}</h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{section.rows.length} registros</span>
                      </div>
                      <button
                        onClick={() => descargarAuditoria(section.module)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Download size={14} /> CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[720px]">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-4">Fecha</th>
                            <th className="px-8 py-4">Usuario</th>
                            <th className="px-8 py-4">Acción</th>
                            <th className="px-8 py-4">Item</th>
                            <th className="px-8 py-4 text-right">Cant.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {section.rows.map((log) => (
                            <tr key={`${section.module}-${log.id}`}>
                              <td className="px-8 py-4 text-xs font-bold text-slate-500 tracking-tighter">{log.fecha}</td>
                              <td className="px-8 py-4 text-[10px] font-black text-[#8CC63F] uppercase tracking-widest">{log.usuario}</td>
                              <td className="px-8 py-4"><Badge variant={log.accion}>{log.accion}</Badge></td>
                              <td className="px-8 py-4 font-black text-slate-800 uppercase text-xs">{log.item}</td>
                              <td className="px-8 py-4 font-black text-slate-800 text-right">{log.cantidad}</td>
                            </tr>
                          ))}
                          {section.rows.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-8 py-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                                Sin movimientos registrados para {section.title.toLowerCase()}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {auditByModule.otros.length > 0 && (
                  <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                      <h4 className="font-black text-slate-800 uppercase tracking-tight">Auditoría Otros</h4>
                      <button
                        onClick={() => descargarAuditoria('otros')}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Download size={14} /> CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[720px]">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-4">Fecha</th>
                            <th className="px-8 py-4">Usuario</th>
                            <th className="px-8 py-4">Acción</th>
                            <th className="px-8 py-4">Item</th>
                            <th className="px-8 py-4 text-right">Cant.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {auditByModule.otros.map((log) => (
                            <tr key={`otros-${log.id}`}>
                              <td className="px-8 py-4 text-xs font-bold text-slate-500 tracking-tighter">{log.fecha}</td>
                              <td className="px-8 py-4 text-[10px] font-black text-[#8CC63F] uppercase tracking-widest">{log.usuario}</td>
                              <td className="px-8 py-4"><Badge variant={log.accion}>{log.accion}</Badge></td>
                              <td className="px-8 py-4 font-black text-slate-800 uppercase text-xs">{log.item}</td>
                              <td className="px-8 py-4 font-black text-slate-800 text-right">{log.cantidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VISTA USUARIOS */}
            {view === 'users' && (
              <div className="space-y-6">
                {!canManageUsers ? (
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
                    Solo administradores pueden gestionar usuarios.
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                      <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Control de Accesos</p>
                          <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Alta de Usuarios por Cargo</h3>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Usuarios que pueden generar tickets
                        </span>
                      </div>
                      <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Total Usuarios</p>
                          <p className="text-3xl font-black text-blue-700">{users.length}</p>
                        </div>
                        <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Activos</p>
                          <p className="text-3xl font-black text-green-700">{activeUsersCount}</p>
                        </div>
                        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Solicitantes</p>
                          <p className="text-3xl font-black text-orange-700">{requesterUsersCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                      <form onSubmit={handleCreateUser} className="xl:col-span-2 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 space-y-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{editingUserId !== null ? 'Editar Usuario' : 'Nuevo Usuario'}</p>
                          <h4 className="font-black text-slate-800 uppercase tracking-tight">{editingUserId !== null ? 'Actualizacion de Cuenta' : 'Registro de Cuenta'}</h4>
                        </div>
                        <input
                          required
                          placeholder="NOMBRE COMPLETO"
                          value={newUserForm.nombre}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => setNewUserForm((prev) => ({ ...prev, nombre: e.target.value }))}
                        />
                        <input
                          required
                          placeholder="USUARIO"
                          value={newUserForm.username}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black lowercase outline-none"
                          onChange={(e) => setNewUserForm((prev) => ({ ...prev, username: e.target.value }))}
                        />
                        <input
                          required={editingUserId === null}
                          type="password"
                          placeholder={editingUserId !== null ? 'PASSWORD (OPCIONAL)' : 'PASSWORD (MIN 6)'}
                          value={newUserForm.password}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none"
                          onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                        />
                        <select
                          required
                          value={newUserForm.departamento}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => setNewUserForm((prev) => ({ ...prev, departamento: e.target.value }))}
                        >
                          <option value="">Selecciona cargo...</option>
                          {userCargoOptions.map((cargo) => (
                            <option key={cargo.value} value={cargo.value}>{cargo.label}</option>
                          ))}
                        </select>
                        <select
                          value={newUserForm.rol}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                          onChange={(e) => setNewUserForm((prev) => ({ ...prev, rol: e.target.value as UserRole }))}
                        >
                          {roleCatalogOptions.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={isCreatingUser}
                          className="w-full py-4 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl disabled:opacity-50"
                        >
                          {isCreatingUser ? (editingUserId !== null ? 'Guardando...' : 'Creando...') : (editingUserId !== null ? 'Guardar Cambios' : 'Crear Usuario')}
                        </button>
                        {editingUserId !== null && (
                          <button
                            type="button"
                            onClick={resetNewUserForm}
                            className="w-full py-3 border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-50"
                          >
                            Cancelar Edicion
                          </button>
                        )}
                      </form>

                      <div className="xl:col-span-3 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                          <h4 className="font-black text-slate-800 uppercase tracking-tight">Usuarios Registrados</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left min-w-[720px]">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <tr>
                                <th className="px-8 py-4">Nombre</th>
                                <th className="px-8 py-4">Usuario</th>
                                <th className="px-8 py-4">Cargo</th>
                                <th className="px-8 py-4">Rol</th>
                                <th className="px-8 py-4">Permisos</th>
                                <th className="px-8 py-4">Estado</th>
                                <th className="px-8 py-4 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {sortedUsers.map((user) => (
                                <tr key={`user-${user.id}`}>
                                  <td className="px-8 py-4 text-xs font-black text-slate-800 uppercase">{user.nombre}</td>
                                  <td className="px-8 py-4 text-xs font-black text-slate-500">{user.username}</td>
                                  <td className="px-8 py-4 text-xs font-black text-slate-500">{formatCargoFromCatalog(user.departamento)}</td>
                                  <td className="px-8 py-4 text-xs font-black text-slate-500 uppercase">{roleLabelByValue[user.rol] || USER_ROLE_LABEL[user.rol]}</td>
                                  <td className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{rolePermissionsByValue[user.rol] || USER_ROLE_PERMISSIONS[user.rol]}</td>
                                  <td className="px-8 py-4">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.activo !== false ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                      {user.activo !== false ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-8 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        disabled={userActionLoadingId === user.id}
                                        onClick={() => handleEditUser(user)}
                                        className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        disabled={userActionLoadingId === user.id || (sessionUser?.id === user.id)}
                                        onClick={() => void handleToggleUserActive(user)}
                                        className="px-3 py-1 rounded-lg border border-amber-200 text-[10px] font-black uppercase text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40"
                                      >
                                        {user.activo !== false ? 'Desactivar' : 'Activar'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={userActionLoadingId === user.id || (sessionUser?.id === user.id)}
                                        onClick={() => void handleDeleteUser(user)}
                                        className="px-3 py-1 rounded-lg border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {sortedUsers.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="px-8 py-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                                    Sin usuarios registrados.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VISTA TICKETS */}
            {view === 'tickets' && (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operación y Seguimiento</p>
                    <h3 className="font-black text-slate-800 uppercase text-xl">Tickets IT</h3>
                  </div>
                  <button
                    disabled={!canCreateTickets}
                    onClick={() => openModal('ticket')}
                    className="bg-slate-800 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase disabled:opacity-50"
                  >
                    Nuevo Ticket
                  </button>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <button onClick={() => applyTicketFocus('ABIERTOS')} className="text-left bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-sm hover:border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abiertos</p>
                    <p className="text-3xl font-black text-[#F58220]">{openTicketsCount}</p>
                  </button>
                  <button onClick={() => applyTicketFocus('CRITICA')} className="text-left bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 shadow-sm hover:border-amber-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Críticos</p>
                    <p className="text-3xl font-black text-amber-700">{criticalTicketsCount}</p>
                  </button>
                  <button onClick={() => applyTicketFocus('SIN_ASIGNAR')} className="text-left bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 shadow-sm hover:border-indigo-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Sin Asignar</p>
                    <p className="text-3xl font-black text-indigo-700">{unassignedTicketsCount}</p>
                  </button>
                  <button onClick={() => applyTicketFocus('SLA')} className="text-left bg-red-50 border border-red-100 rounded-2xl px-5 py-4 shadow-sm hover:border-red-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500">SLA Vencido</p>
                    <p className="text-3xl font-black text-red-600">{slaExpiredCount}</p>
                  </button>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
                    <select
                      value={ticketLifecycleFilter}
                      onChange={(e) => setTicketLifecycleFilter(e.target.value as 'TODOS' | 'ABIERTOS' | 'CERRADOS')}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Ciclo: Todos</option>
                      <option value="ABIERTOS">Solo Abiertos</option>
                      <option value="CERRADOS">Solo Cerrados</option>
                    </select>
                    <select
                      value={ticketStateFilter}
                      onChange={(e) => setTicketStateFilter(e.target.value as TicketEstado | 'TODOS')}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Estado: Todos</option>
                      {TICKET_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <select
                      value={ticketPriorityFilter}
                      onChange={(e) => setTicketPriorityFilter(e.target.value as PrioridadTicket | 'TODAS')}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODAS">Prioridad: Todas</option>
                      <option value="MEDIA">Media</option>
                      <option value="ALTA">Alta</option>
                      <option value="CRITICA">Crítica</option>
                    </select>
                    <select
                      value={ticketAssignmentFilter}
                      onChange={(e) => setTicketAssignmentFilter(e.target.value as 'TODOS' | 'ASIGNADOS' | 'SIN_ASIGNAR')}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">Asignación: Todos</option>
                      <option value="ASIGNADOS">Solo Asignados</option>
                      <option value="SIN_ASIGNAR">Sin Asignar</option>
                    </select>
                    <select
                      value={ticketSlaFilter}
                      onChange={(e) => setTicketSlaFilter(e.target.value as 'TODOS' | 'VENCIDO')}
                      className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
                    >
                      <option value="TODOS">SLA: Todos</option>
                      <option value="VENCIDO">Solo Vencido</option>
                    </select>
                    <button
                      onClick={() => applyTicketFocus('EN_PROCESO')}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                      Ver En Proceso
                    </button>
                    <button
                      onClick={() => {
                        setTicketLifecycleFilter('TODOS');
                        setTicketStateFilter('TODOS');
                        setTicketPriorityFilter('TODAS');
                        setTicketAssignmentFilter('TODOS');
                        setTicketSlaFilter('TODOS');
                        setSearchTerm('');
                      }}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                    >
                      Limpiar Filtros
                    </button>
                  </div>
                </div>

                {filteredTickets.map((t) => {
                  const latestHistory = Array.isArray(t.historial) && t.historial.length > 0 ? t.historial[0] : null;
                  const attachments = Array.isArray(t.attachments) ? t.attachments : [];
                  const historyWithComment = (t.historial || [])
                    .filter((entry) => String(entry.comentario || '').trim().length > 0)
                    .slice(0, 4);
                  return (
                    <div key={t.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-6">
                      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-6">
                        <div className="flex items-start gap-6">
                          <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center text-[#F58220]"><Ticket size={32} /></div>
                          <div>
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <Badge variant={t.prioridad}>{t.prioridad}</Badge>
                              <Badge variant={t.estado}>{t.estado}</Badge>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSlaStatus(t).className}`}>
                                {getSlaStatus(t).label}
                              </span>
                              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">#{t.id}</span>
                            </div>
                            <h4 className="font-black text-slate-800 uppercase text-md">{t.activoTag} | {t.descripcion}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-2">
                              Asignado: {t.asignadoA || 'Sin asignar'} | Sucursal: {formatTicketBranchFromCatalog(t.sucursal)}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                              Creado: {formatDateTime(t.fechaCreacion || t.fecha)} | Fecha limite: {formatDateTime(t.fechaLimite)}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                              Solicitó: {t.solicitadoPor || 'N/D'} | Cargo: {formatCargoFromCatalog(t.departamento)}
                            </p>
                            {latestHistory?.comentario && (
                              <p className="text-xs font-bold text-slate-500 mt-2 line-clamp-2">
                                Ultimo comentario: {latestHistory.comentario}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full xl:w-auto">
                          <select
                            disabled={!canEdit}
                            value={t.estado}
                            onChange={(e) => void actualizarTicket(t.id, { estado: e.target.value as TicketEstado })}
                            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                          >
                            {TICKET_STATES.map((state) => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                          <select
                            disabled={!canEdit}
                            value={t.asignadoA || ''}
                            onChange={(e) => void actualizarTicket(t.id, { asignadoA: e.target.value })}
                            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500 disabled:opacity-50"
                          >
                            <option value="">Sin asignar</option>
                            {users
                              .filter((u) => (u.rol === 'tecnico' || u.rol === 'admin') && u.activo !== false)
                              .map((u) => (
                                <option key={u.id} value={u.nombre}>{u.nombre}</option>
                              ))}
                          </select>
                          <button
                            onClick={() => {
                              setView('inventory');
                              setSearchTerm(t.activoTag);
                            }}
                            className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                          >
                            Ver Activo
                          </button>
                          <button
                            disabled={!canEdit || t.estado === 'Resuelto' || t.estado === 'Cerrado'}
                            onClick={() => void resolverTicket(t.id)}
                            className="bg-[#8CC63F] text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50"
                          >
                            Resolver
                          </button>
                          {(canEdit || sessionUser?.rol === 'solicitante') && (
                            <button
                              type="button"
                              disabled={!canDeleteTicket(t)}
                              onClick={() => void eliminarTicket(t.id)}
                              className="px-4 py-3 rounded-2xl border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Adjuntos ({attachments.length})
                            </p>
                            <label className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${canCreateTickets ? 'bg-white border-slate-200 text-slate-600 cursor-pointer hover:bg-slate-50' : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'}`}>
                              {ticketAttachmentLoadingId === t.id ? 'Subiendo...' : 'Adjuntar archivo'}
                              <input
                                type="file"
                                disabled={!canCreateTickets || ticketAttachmentLoadingId === t.id}
                                className="hidden"
                                onChange={(event) => {
                                  void cargarAdjuntoTicket(t.id, event.target.files);
                                  event.currentTarget.value = '';
                                }}
                              />
                            </label>
                          </div>
                          <div className="space-y-2">
                            {attachments.map((attachment) => (
                              <div key={`attachment-${t.id}-${attachment.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-700 truncate">{attachment.fileName}</p>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    {formatBytes(attachment.size)} | {formatDateTime(attachment.uploadedAt)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void descargarAdjuntoTicket(t.id, attachment)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50"
                                  >
                                    Descargar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => void eliminarAdjuntoTicket(t.id, attachment)}
                                    className="px-2 py-1 rounded-lg border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            ))}
                            {attachments.length === 0 && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Sin adjuntos registrados.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={ticketCommentDrafts[t.id] || ''}
                              disabled={!canCreateTickets}
                              onChange={(event) =>
                                setTicketCommentDrafts((prev) => ({
                                  ...prev,
                                  [t.id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void agregarComentarioTicket(t.id);
                                }
                              }}
                              placeholder="Agregar comentario..."
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-100 bg-white text-xs font-bold text-slate-600 outline-none disabled:opacity-50"
                            />
                            <button
                              type="button"
                              disabled={!canCreateTickets}
                              onClick={() => void agregarComentarioTicket(t.id)}
                              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Guardar
                            </button>
                          </div>
                          <div className="space-y-2">
                            {historyWithComment.map((entry, index) => (
                              <div key={`comment-${t.id}-${entry.fecha}-${index}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                <p className="text-xs font-bold text-slate-700">{entry.comentario}</p>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">
                                  {entry.usuario} | {formatDateTime(entry.fecha)} | {entry.accion}
                                </p>
                              </div>
                            ))}
                            {historyWithComment.length === 0 && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Sin comentarios registrados.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredTickets.length === 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
                    No hay tickets para los filtros seleccionados.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* MODAL UNIVERSAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className={`bg-white w-full ${showModal === 'activo' ? 'max-w-5xl' : 'max-w-lg'} rounded-[3rem] shadow-2xl overflow-hidden`}>
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 font-black uppercase text-sm">
              {showModal === 'activo' ? 'Alta Equipo' : showModal === 'insumo' ? 'Ingreso Material' : 'Ticket'}
              <button onClick={closeModal} className="text-slate-300 hover:text-red-500"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-4 max-h-[72vh] overflow-y-auto">
               {showModal === 'activo' && (
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
                      <div className="grid grid-cols-1 gap-4">
                        {sessionUser?.rol === 'admin' ? (
                          <input
                            placeholder="PASSWORD REMOTA"
                            value={formData.passwordRemota || ''}
                            className="p-4 bg-white border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                            onChange={(e) => updateFormData({ passwordRemota: e.target.value })}
                          />
                        ) : (
                          <input
                            disabled
                            value="SOLO ADMIN: PASSWORD REMOTA"
                            className="p-4 bg-slate-100 border border-slate-100 rounded-2xl text-sm font-black uppercase text-slate-400 outline-none"
                          />
                        )}
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
               {showModal === 'insumo' && (
                 <>
                  <input required placeholder="NOMBRE" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none" onChange={e => updateFormData({ nombre: e.target.value })} />
                  <div className="grid grid-cols-2 gap-4">
                    <input required type="number" placeholder="STOCK" className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none" onChange={e => updateFormData({ stock: e.target.value })} />
                    <input required type="number" placeholder="MÍNIMO" className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none" onChange={e => updateFormData({ min: e.target.value })} />
                  </div>
                  <select required className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none" onChange={e => updateFormData({ categoria: e.target.value })}>
                    <option value="">Categoría...</option>
                    {CATEGORIAS_INSUMO.map((categoria) => (
                      <option key={categoria} value={categoria}>{categoria}</option>
                    ))}
                  </select>
                 </>
               )}
               {showModal === 'ticket' && (
                 <>
                   <input required placeholder="TAG EQUIPO" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none" value={formData.activoTag || ''} onChange={e => updateFormData({ activoTag: e.target.value })} />
                   <select
                     required
                     className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                     value={formData.sucursal || ''}
                     onChange={e => updateFormData({ sucursal: e.target.value })}
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
                     value={formData.areaAfectada || ''}
                     onChange={e => updateFormData({ areaAfectada: e.target.value, fallaComun: '' })}
                     className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                   >
                     <option value="">Área afectada...</option>
                     {TICKET_AREA_OPTIONS.map((area) => (
                       <option key={`afe-${area}`} value={area}>{area}</option>
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
               <button disabled={showModal === 'ticket' ? !canCreateTickets : !canEdit} type="submit" className="w-full py-5 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl hover:opacity-90 mt-4 flex justify-center gap-2 disabled:opacity-50">
                 <Save size={18}/> Guardar
               </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW IMPORTACION */}
      {importDraft && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vista Previa Dry-Run</p>
                <h3 className="text-lg font-black uppercase text-slate-800">{importDraft.fileName}</h3>
              </div>
              <button onClick={() => setImportDraft(null)} className="text-slate-300 hover:text-red-500">
                <X size={22} />
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-black text-slate-400">Filas</p>
                  <p className="text-xl font-black text-slate-800">{importDraft.preview.totalRows}</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-black text-green-500">Nuevos</p>
                  <p className="text-xl font-black text-green-700">{importDraft.preview.created}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-black text-blue-500">Actualizados</p>
                  <p className="text-xl font-black text-blue-700">{importDraft.preview.updated}</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-black text-amber-500">Omitidos</p>
                  <p className="text-xl font-black text-amber-700">{importDraft.preview.skipped}</p>
                </div>
                <div className="bg-red-50 rounded-2xl p-4">
                  <p className="text-[10px] uppercase font-black text-red-500">Invalidos</p>
                  <p className="text-xl font-black text-red-700">{importDraft.preview.invalid + importDraft.localInvalidDetails.length}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 flex justify-between items-center">
                  <p className="text-xs font-black uppercase text-slate-500">Incidencias ({importIssueRows.length})</p>
                  <button
                    onClick={exportImportIssuesCsv}
                    className="text-xs font-black uppercase text-[#F58220] hover:text-orange-600"
                  >
                    Exportar Errores CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3">Fila</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Tag</th>
                        <th className="px-4 py-3">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {importIssueRows.slice(0, 120).map((issue, index) => (
                        <tr key={`${issue.status}-${issue.rowNumber}-${index}`}>
                          <td className="px-4 py-3 text-xs font-black text-slate-700">{issue.rowNumber}</td>
                          <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">{issue.status}</td>
                          <td className="px-4 py-3 text-xs font-black text-slate-700 uppercase">{issue.tag || '-'}</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-500">{issue.reason || '-'}</td>
                        </tr>
                      ))}
                      {importIssueRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-xs font-black uppercase text-slate-400">
                            Sin incidencias detectadas en el dry-run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-white flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => setImportDraft(null)}
                className="px-6 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                disabled={isApplyingImport || importDraft.preview.created + importDraft.preview.updated === 0}
                onClick={() => void applyImportDraft()}
                className="px-6 py-3 rounded-2xl bg-[#F58220] text-white text-xs font-black uppercase disabled:opacity-50"
              >
                {isApplyingImport ? 'Aplicando...' : 'Confirmar Importación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESCANER QR */}
      {showQrScanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolución Segura QR</p>
                <h3 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2">
                  <ScanLine size={18} /> Escanear Activo
                </h3>
              </div>
              <button
                onClick={() => setShowQrScanner(false)}
                className="text-slate-300 hover:text-red-500"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Camara</p>
                <div className="aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-200">
                  <video
                    ref={qrScannerVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isQrScannerActive
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {isQrScannerActive ? 'Camara activa' : 'Camara inactiva'}
                  </span>
                  {!isQrCameraSupported && (
                    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                      Sin soporte nativo de scanner
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-500">{qrScannerStatus}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolución Manual</p>
                <textarea
                  value={qrManualInput}
                  onChange={(e) => setQrManualInput(e.target.value)}
                  placeholder="Pega aquí el token mtiqr1... o el JSON legacy del QR"
                  className="w-full h-56 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono text-slate-700 outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isResolvingQr || !qrManualInput.trim()}
                    onClick={() => void resolveQrFromManualInput()}
                    className="px-5 py-3 rounded-2xl bg-[#F58220] text-white text-xs font-black uppercase disabled:opacity-50"
                  >
                    {isResolvingQr ? 'Resolviendo...' : 'Resolver QR'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrManualInput('')}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Compatible con QR firmado (mtiqr1) y QR local legacy (JSON).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE ACTIVO */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[86vh] flex flex-col">
            <div className="bg-slate-800 text-white p-8 md:p-10 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black uppercase leading-none">{selectedAsset.tag}</h2>
                <p className="opacity-70 font-bold mt-2 uppercase text-sm">
                  {selectedAsset.tipo} | {selectedAsset.marca}
                  {selectedAsset.modelo ? ` | ${selectedAsset.modelo}` : ''}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant={selectedAsset.estado}>{selectedAsset.estado}</Badge>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider border-white/20 bg-white/10">
                    Compra: {selectedAsset.fechaCompra || 'N/D'}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full">
                <X />
              </button>
            </div>

            <div className="p-8 md:p-10 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-slate-800">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificacion</p>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Serial</p>
                    <p className="font-black">{selectedAsset.serial || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">ID Interno</p>
                    <p className="font-black">{selectedAsset.idInterno || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Equipo</p>
                    <p className="font-black">{selectedAsset.equipo || selectedAsset.tipo || 'N/D'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicacion y Responsable</p>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Ubicacion</p>
                    <p className="font-black">{selectedAsset.ubicacion || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Departamento</p>
                    <p className="font-black">{selectedAsset.departamento || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Responsable</p>
                    <p className="font-black">{selectedAsset.responsable || 'N/D'}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Red y Acceso</p>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">IP</p>
                    <p className="font-black">{selectedAsset.ipAddress || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">MAC</p>
                    <p className="font-black">{selectedAsset.macAddress || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Anydesk</p>
                    <p className="font-black">{selectedAsset.anydesk || 'N/D'}</p>
                  </div>
                  {sessionUser?.rol === 'admin' && (
                    <div className="text-sm">
                      <p className="font-black text-amber-600 uppercase">Password Remota</p>
                      <p className="font-black text-amber-700">{selectedAsset.passwordRemota || 'N/D'}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hardware</p>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">CPU</p>
                    <p className="font-black">{selectedAsset.cpu || 'N/D'}</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">RAM</p>
                    <p className="font-black">
                      {selectedAsset.ram || 'N/D'}
                      {selectedAsset.ramTipo ? ` ${selectedAsset.ramTipo}` : ''}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Disco</p>
                    <p className="font-black">
                      {selectedAsset.disco || 'N/D'}
                      {selectedAsset.tipoDisco ? ` ${selectedAsset.tipoDisco}` : ''}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="font-black text-slate-500 uppercase">Anios de Vida</p>
                    <p className="font-black">{selectedAsset.aniosVida || 'N/D'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comentarios</p>
                <p className="text-sm font-semibold text-slate-600">{selectedAsset.comentarios || 'Sin comentarios.'}</p>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="w-fit rounded-2xl bg-white border border-slate-200 p-3 shadow-sm mx-auto lg:mx-0">
                    <QRCodeCanvas
                      id={buildAssetQrCanvasId(selectedAsset.id)}
                      value={effectiveSelectedAssetQrValue}
                      size={180}
                      includeMargin
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Codigo QR del Activo</p>
                      <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                        <QrCode size={16} /> {selectedAsset.tag}
                      </h4>
                      <span className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        selectedAssetQrLoading
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : selectedAssetQrMode === 'signed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {selectedAssetQrLoading
                          ? 'Firmando QR...'
                          : selectedAssetQrMode === 'signed'
                            ? 'QR Firmado (HMAC)'
                            : 'QR Local (sin firma)'}
                      </span>
                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {selectedAssetQrMode === 'signed'
                          ? 'El QR contiene un token firmado por backend. No expone detalles sensibles en claro.'
                          : 'Modo fallback local: QR con datos en claro. Usa backend online para firma segura.'}
                      </p>
                      {selectedAssetQrMode === 'signed' && selectedAssetQrIssuedAt && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          Firmado: {formatDateTime(selectedAssetQrIssuedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={selectedAssetQrLoading}
                        onClick={descargarQrActivoSeleccionado}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Download size={14} /> Descargar QR
                      </button>
                      <button
                        type="button"
                        disabled={selectedAssetQrLoading}
                        onClick={imprimirEtiquetaQrActivoSeleccionado}
                        className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-black uppercase text-blue-700 hover:bg-blue-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Printer size={14} /> Imprimir Etiqueta
                      </button>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">
                      Formato sugerido para Zebra GK420t: 60 x 40 mm.
                    </p>
                  </div>
                </div>
              </div>

              <button
                disabled={!canEdit}
                onClick={async (e) => {
                  const removed = await eliminarActivo(selectedAsset.id, e);
                  if (removed) setSelectedAsset(null);
                }}
                className="w-full py-4 border-2 border-red-100 text-red-500 font-black uppercase rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} /> Dar de baja definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

    </div>
  );
}





