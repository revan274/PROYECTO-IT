import type { ComponentType } from 'react';

export type EstadoActivo = 'Operativo' | 'Falla';
export type PrioridadTicket = 'MEDIA' | 'ALTA' | 'CRITICA';
export type TicketEstado = 'Abierto' | 'En Proceso' | 'En Espera' | 'Resuelto' | 'Cerrado';
export type TicketAttentionType =
  | 'PRESENCIAL'
  | 'PRESENCIAL_FUERA_DE_HORARIO'
  | 'REMOTO'
  | 'REMOTO_FUERA_DE_HORARIO';
export type UserRole = 'admin' | 'tecnico' | 'consulta' | 'solicitante';
export type ToastType = 'success' | 'error' | 'warning';
export type ModalType = 'activo' | 'insumo' | 'ticket' | null;
export type ViewType = 'dashboard' | 'reports' | 'inventory' | 'supplies' | 'tickets' | 'history' | 'users';
export type SupplyStatusFilter = 'TODOS' | 'AGOTADO' | 'BAJO' | 'OK';
export type InventoryRiskFilter = 'TODOS' | 'SIN_IP' | 'SIN_MAC' | 'SIN_RESP' | 'DUP_RED' | 'VIDA_ALTA';
export type InventorySortField = 'tag' | 'tipo' | 'estado' | 'responsable' | 'ubicacion' | 'aniosVida';
export type InventorySortDirection = 'asc' | 'desc';
export type AuditModule = 'activos' | 'insumos' | 'tickets' | 'otros';
export type ThemeMode = 'light' | 'dark';
export type DashboardRange = 'TODAY' | '7D' | '30D' | '90D';
export type ReportStateFilter = TicketEstado | 'TODOS';
export type ReportPriorityFilter = PrioridadTicket | 'TODAS';
export type ReportAttentionFilter = TicketAttentionType | 'TODAS';
export type InsumoField = 'nombre' | 'unidad' | 'stock' | 'min' | 'categoria' | 'ubicacion' | 'proveedor';
export type InsumoTouchedState = Record<InsumoField, boolean>;
export type InsumoErrors = Partial<Record<InsumoField, string>>;

export interface ReportFilterSnapshot {
  dateFrom: string;
  dateTo: string;
  branch: string;
  area: string;
  state: ReportStateFilter;
  priority: ReportPriorityFilter;
  attention: ReportAttentionFilter;
  technician: string;
}

export interface ReportFilterPreset {
  id: string;
  name: string;
  createdAt: string;
  filters: ReportFilterSnapshot;
}

export interface TravelDestinationPreset {
  code: string;
  index: number;
  label: string;
  defaultKms: number;
}

export interface TravelMonthRange {
  year: number;
  monthIndex: number;
  startMs: number;
  endMs: number;
}

export interface TravelDestinationRule {
  code: string;
  index: number;
  label: string;
  kms: number;
}

export interface TravelReportRow {
  ticketId: number;
  createdAt: number;
  nombre: string;
  destinationCode: string;
  destinationLabel: string;
  routeIndex: number;
  kms: number;
  fecha: string;
  motivo: string;
}

export interface TravelTripAdjustment {
  id: number;
  month: string;
  technicianScopeKey: string;
  technicianScopeLabel: string;
  destinationCode: string;
  trips: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Activo {
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
  aniosVida?: string;
  comentarios?: string;
}

export interface ImportAssetDetail {
  rowNumber: number;
  status: 'created' | 'updated' | 'skipped' | 'invalid';
  reason?: string;
  tag?: string;
}

export interface ImportAssetsResponse {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  upsert: boolean;
  dryRun: boolean;
  details?: ImportAssetDetail[];
}

export interface ImportDraftState {
  fileName: string;
  payloadItems: Array<Record<string, unknown>>;
  preview: ImportAssetsResponse;
  localInvalidDetails: ImportAssetDetail[];
}

export interface DuplicateRiskItem {
  value: string;
  count: number;
}

export interface AssetRiskSummary {
  totalActivos: number;
  activosEvaluablesIp: number;
  activosConIp: number;
  activosSinIp: number;
  activosEvaluablesMac: number;
  activosConMac: number;
  activosSinMac: number;
  activosEvaluablesResponsable: number;
  activosSinResponsable: number;
  activosVidaAlta: number;
  activosEnFalla: number;
  duplicateIpCount: number;
  duplicateMacCount: number;
  duplicateIpEntries: DuplicateRiskItem[];
  duplicateMacEntries: DuplicateRiskItem[];
  generatedAt?: string;
}

export interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
  min: number;
  categoria: string;
  ubicacion?: string;
  proveedor?: string;
  activo?: boolean;
}

export interface TicketAttachment {
  id: number;
  fileName: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  localOnly?: boolean;
  localUrl?: string;
}

export interface TicketItem {
  id: number;
  activoTag: string;
  descripcion: string;
  sucursal?: string;
  prioridad: PrioridadTicket;
  estado: TicketEstado;
  atencionTipo?: TicketAttentionType;
  trasladoRequerido?: boolean;
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
  insumosUsados?: Array<{
    insumoId: number;
    cantidad: number;
    nombre: string;
  }>;
  attachments?: TicketAttachment[];
}

export interface RegistroAuditoria {
  id: number;
  accion: string;
  item: string;
  cantidad: number;
  fecha: string;
  usuario: string;
  modulo?: AuditModule;
  timestamp?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  userId?: number | null;
  username?: string;
  rol?: string;
  departamento?: string;
  resultado?: 'ok' | 'error';
  entidad?: string;
  entidadId?: number | string | null;
  motivo?: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  prevHash?: string;
  hash?: string;
}

export interface AuditFiltersState {
  module: '' | AuditModule;
  result: '' | 'ok' | 'error';
  user: string;
  entity: string;
  action: string;
  q: string;
  from: string;
  to: string;
}

export interface AuditPaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuditSummaryState {
  total: number;
  byModule: Record<AuditModule, number>;
  byResult: {
    ok: number;
    error: number;
  };
}

export interface AuditIntegrityState {
  ok: boolean;
  total: number;
  valid: number;
  invalid: number;
  firstBrokenId: number | null;
  checkedAt: string;
  lastExpectedHash: string;
  samples: Array<{
    id: number;
    prevHashExpected: string;
    prevHashActual: string;
    hashExpected: string;
    hashActual: string;
  }>;
}

export interface AuditAlertsState {
  windowHours: number;
  totalRows: number;
  recentRows: number;
  errorCount24h: number;
  loginFailures24h: number;
  missingActorCount: number;
  missingRequestIdCount: number;
  burst: {
    detected: boolean;
    maxEvents10m: number;
    actor: string;
    ip: string;
    buckets: number;
    threshold: number;
  };
}

export interface AuditHistoryResponse {
  items: RegistroAuditoria[];
  pagination: AuditPaginationState;
  filters?: Partial<AuditFiltersState>;
  summary?: AuditSummaryState;
  integrity?: AuditIntegrityState;
  alerts?: AuditAlertsState;
  generatedAt?: string;
}

export interface ToastState {
  message: string;
  type: ToastType;
}

export interface SupplyAuditMovement {
  logId: number;
  insumoId: number;
  accion: string;
  cantidad: number;
  usuario: string;
  fecha: string;
  timestampMs: number;
  resultado: 'ok' | 'error';
}

export interface FormDataState {
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
  aniosVida?: string;
  comentarios?: string;
  nombre?: string;
  unidad?: string;
  stock?: string | number;
  min?: string | number;
  categoria?: string;
  activoTag?: string;
  descripcion?: string;
  sucursal?: string;
  areaAfectada?: string;
  fallaComun?: string;
  prioridad?: PrioridadTicket;
  atencionTipo?: TicketAttentionType;
  trasladoRequerido?: boolean;
  asignadoA?: string;
  comentario?: string;
  ubicacionInsumo?: string;
  proveedor?: string;
}

export interface UserItem {
  id: number;
  nombre: string;
  username: string;
  rol: UserRole;
  departamento?: string;
  activo: boolean;
}

export interface UserSession {
  id: number;
  nombre: string;
  username: string;
  rol: UserRole;
  departamento?: string;
}

export interface CatalogBranch {
  code: string;
  name: string;
  activo?: boolean;
}

export interface CatalogRole {
  value: string;
  label: string;
  permissions: string;
  activo?: boolean;
}

export interface CatalogState {
  sucursales: CatalogBranch[];
  cargos: string[];
  roles: CatalogRole[];
}

export interface NavItem {
  id: ViewType;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

export interface StoredSession {
  user: UserSession;
  token: string;
  loggedAt: string;
}

export interface BootstrapResponse {
  activos: Activo[];
  insumos: Insumo[];
  tickets: TicketItem[];
  auditoria: RegistroAuditoria[];
  users?: UserItem[];
  catalogos?: CatalogState;
  riskSummary?: AssetRiskSummary;
  ticketStates?: TicketEstado[];
  slaPolicyHours?: Record<PrioridadTicket, number>;
  travelAdjustments?: TravelTripAdjustment[];
}

export interface LoginResponse {
  user: UserSession;
  token: string;
  loggedAt: string;
}

export interface TravelTripAdjustmentResponse {
  adjustment: TravelTripAdjustment | null;
}

export interface TicketAttachmentUploadResponse {
  attachment: TicketAttachment;
  ticket: TicketItem;
}

export interface AssetQrTokenResponse {
  token: string;
  scheme?: string;
  issuedAt?: string;
  assetId?: number;
}

export interface AssetQrResolveResponse {
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

