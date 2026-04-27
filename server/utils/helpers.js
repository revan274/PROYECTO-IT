import { randomUUID } from 'node:crypto';
import { pushAudit } from '../store.js';

// --- Domain constants ---

export const SLA_HOURS = {
  MEDIA: 24,
  ALTA: 8,
  CRITICA: 2,
};

export const USER_ROLES = new Set(['admin', 'tecnico', 'consulta', 'solicitante']);

export const DEFAULT_CARGO_CATALOG = [
  'Coordinador de Sistemas',
  'Gerente',
  'Director',
  'Desarrollador',
  'Auxiliar de Sistemas',
  'CeDis',
];

export const DEFAULT_ROLE_CATALOG = [
  { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
  { value: 'tecnico', label: 'Tecnico', permissions: 'Operacion IT + tickets', activo: true },
  { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
  { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
];

export const DEFAULT_BRANCH_CATALOG = [
  { code: 'TJ01', name: 'Sucursal Estrella', activo: true },
  { code: 'TC01', name: 'Sucursal Camargo', activo: true },
  { code: 'TJ02', name: 'Sucursal CBtis', activo: true },
  { code: 'TJ03', name: 'Sucursal Sor Juana', activo: true },
  { code: 'CEDIS', name: 'CeDis', activo: true },
];

export const DEFAULT_BRANCH_CODES = new Set(DEFAULT_BRANCH_CATALOG.map((branch) => branch.code));

export const TICKET_STATES = ['Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado'];
export const CLOSED_STATES = new Set(['Resuelto', 'Cerrado']);

export const AUDIT_MODULES = new Set(['activos', 'insumos', 'tickets', 'otros']);
export const AUDIT_RESULTS = new Set(['ok', 'error']);

export const DEMO_PASSWORD_HASHES = new Set([
  'scrypt-v1$4923721e0ded78534bbd638be30ae5f1$1993ab737237283782f648c1dfa3abc737309abc2bbe5a2e3600a4e1a2ed33660abb03efd5bfdd7a4b44d065e9fe400a6444df09f2661ecda0b2119ddc2d39f9',
  'scrypt-v1$32054ec3b72a1863e1839397517c410c$cd46075c7507e0a5b6e7d81239a433706acd86290609d17896a40d6addb6204688f8e9445b75664b23c1faca7e8be8a1385d49f121b3d415e3ee124fdf260456',
  'scrypt-v1$a992b6ad1d54ff5171d08b30f1eb3d1a$2e59f85b782d7dc3d2774617c2d37333c7cba81c83999f39db1a5a93a4a5b87498199d2143cbae6cd35cec8a35989d4b0c8d749f42ef566d3dae916c2b571967',
]);

// --- Runtime constants (env-derived) ---

export const PAGINATION_DEFAULT_PAGE_SIZE = Math.max(10, Math.trunc(Number(process.env.PAGINATION_DEFAULT_SIZE || 25)));
export const PAGINATION_MAX_PAGE_SIZE = Math.max(PAGINATION_DEFAULT_PAGE_SIZE, Math.trunc(Number(process.env.PAGINATION_MAX_SIZE || 100)));
export const BOOTSTRAP_AUDIT_LIMIT = Math.max(0, Math.trunc(Number(process.env.BOOTSTRAP_AUDIT_LIMIT || 25)));
export const AUTH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = Math.max(3, Math.trunc(Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5)));
export const LOGIN_LOCK_MS = Math.max(60_000, Math.trunc(Number(process.env.AUTH_LOGIN_LOCK_MS || 15 * 60 * 1000)));
export const LOGIN_TRACK_WINDOW_MS = Math.max(LOGIN_LOCK_MS, Math.trunc(Number(process.env.AUTH_LOGIN_TRACK_WINDOW_MS || 30 * 60 * 1000)));
export const LOGIN_ATTEMPT_GC_MS = Math.max(60_000, Math.trunc(Number(process.env.AUTH_LOGIN_GC_MS || 5 * 60 * 1000)));
export const DISALLOW_DEMO_PASSWORDS = String(
  process.env.AUTH_DISALLOW_DEMO_PASSWORDS || (process.env.NODE_ENV === 'production' ? 'true' : 'false'),
).toLowerCase() !== 'false';

// --- Error class ---

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// --- String / number utilities ---

export function asNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function normalizeTextKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// --- Ticket normalize ---

export function normalizePrioridad(value) {
  const raw = String(value || 'MEDIA').toUpperCase();
  if (raw.includes('CRIT')) return 'CRITICA';
  if (raw.includes('ALTA')) return 'ALTA';
  return 'MEDIA';
}

export function normalizeEstadoTicket(value) {
  const raw = String(value || '').trim();
  const match = TICKET_STATES.find((state) => state.toLowerCase() === raw.toLowerCase());
  return match || null;
}

export function normalizeTicketAttentionType(value) {
  const type = asNonEmptyString(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (type === 'PRESENCIAL') return 'PRESENCIAL';
  if (type === 'PRESENCIAL_FUERA_DE_HORARIO' || type === 'PRESENCIAL_FUERA_HORARIO') {
    return 'PRESENCIAL_FUERA_DE_HORARIO';
  }
  if (type === 'REMOTO') return 'REMOTO';
  if (type === 'REMOTO_FUERA_DE_HORARIO' || type === 'REMOTO_FUERA_HORARIO') {
    return 'REMOTO_FUERA_DE_HORARIO';
  }
  return '';
}

export function normalizeTicketTravelRequired(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  const normalized = asNonEmptyString(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (!normalized) return undefined;
  if (['1', 'true', 'si', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

export function ticketAuditAction(estado) {
  if (estado === 'Resuelto') return 'Ticket Resuelto';
  if (estado === 'Cerrado') return 'Ticket Cerrado';
  if (estado === 'En Proceso') return 'Ticket En Proceso';
  if (estado === 'En Espera') return 'Ticket En Espera';
  return 'Ticket Actualizado';
}

// --- User normalize ---

export function normalizeUserRole(value) {
  const role = asNonEmptyString(value).toLowerCase();
  if (!USER_ROLES.has(role)) return null;
  return role;
}

export function normalizeUserCargo(value, cargoCatalog = DEFAULT_CARGO_CATALOG) {
  const key = normalizeTextKey(value);
  if (!key) return '';
  for (const cargo of cargoCatalog) {
    const normalized = asNonEmptyString(cargo);
    if (!normalized) continue;
    if (normalizeTextKey(normalized) === key) return normalized;
  }
  return '';
}

export function normalizeTicketBranch(value, allowedBranchCodes = DEFAULT_BRANCH_CODES) {
  const code = asNonEmptyString(value).toUpperCase();
  if (!allowedBranchCodes.has(code)) return '';
  return code;
}

// --- Travel normalize ---

export function normalizeTravelAdjustmentMonth(value) {
  const raw = asNonEmptyString(value);
  if (!/^\d{4}-\d{2}$/.test(raw)) return '';
  return raw;
}

export function normalizeTravelScopeKey(value) {
  return asNonEmptyString(value).slice(0, 120);
}

export function normalizeTravelScopeLabel(value) {
  return asNonEmptyString(value).slice(0, 120);
}

export function normalizeTravelDestinationCode(value) {
  return asNonEmptyString(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

// --- Supply helpers ---

export function isSupplyActive(item) {
  return item?.activo !== false;
}

export function isLowStock(item) {
  if (!isSupplyActive(item)) return false;
  return Number(item.stock) <= Number(item.min);
}

// --- SLA helpers ---

export function calcDueDate(prioridad) {
  const hours = SLA_HOURS[prioridad] || SLA_HOURS.MEDIA;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function isSlaBreached(ticket) {
  if (CLOSED_STATES.has(ticket.estado)) return false;
  if (!ticket.fechaLimite) return false;
  return Date.now() > new Date(ticket.fechaLimite).getTime();
}

export function slaRemainingMinutes(ticket) {
  if (CLOSED_STATES.has(ticket.estado)) return null;
  if (!ticket.fechaLimite) return null;
  return Math.ceil((new Date(ticket.fechaLimite).getTime() - Date.now()) / 60000);
}

// --- Ticket serialization ---

export function buildTicketAttachmentResponse(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  return {
    id: Number(attachment.id),
    fileName: asNonEmptyString(attachment.fileName),
    mimeType: asNonEmptyString(attachment.mimeType) || 'application/octet-stream',
    size: Math.max(0, Math.trunc(Number(attachment.size) || 0)),
    uploadedAt: asNonEmptyString(attachment.uploadedAt) || new Date().toISOString(),
    uploadedBy: asNonEmptyString(attachment.uploadedBy) || 'Sistema',
  };
}

export function serializeTicket(ticket) {
  const attachments = Array.isArray(ticket?.attachments)
    ? ticket.attachments.map(buildTicketAttachmentResponse).filter(Boolean)
    : [];
  return {
    ...ticket,
    attachments,
    slaVencido: isSlaBreached(ticket),
    slaRestanteMin: slaRemainingMinutes(ticket),
  };
}

export function serializeTravelAdjustment(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: Number(item.id),
    month: normalizeTravelAdjustmentMonth(item.month),
    technicianScopeKey: normalizeTravelScopeKey(item.technicianScopeKey),
    technicianScopeLabel: normalizeTravelScopeLabel(item.technicianScopeLabel),
    destinationCode: normalizeTravelDestinationCode(item.destinationCode),
    trips: Math.max(0, Math.trunc(Number(item.trips) || 0)),
    updatedAt: asNonEmptyString(item.updatedAt) || new Date().toISOString(),
    updatedBy: asNonEmptyString(item.updatedBy) || 'Sistema',
  };
}

// --- Role / access helpers ---

export function canEditByRole(role) {
  return role === 'admin' || role === 'tecnico';
}

export function canCreateTicketsByRole(role) {
  return role === 'admin' || role === 'tecnico' || role === 'solicitante';
}

export function ticketBelongsToUser(ticket, user) {
  if (!ticket || !user) return false;
  const userId = Number(user.id);
  const ticketUserId = Number(ticket.solicitadoPorId);
  if (Number.isFinite(userId) && Number.isFinite(ticketUserId) && userId === ticketUserId) {
    return true;
  }

  const usernameKey = normalizeTextKey(user.username);
  const ticketUsernameKey = normalizeTextKey(ticket.solicitadoPorUsername);
  if (usernameKey && ticketUsernameKey && usernameKey === ticketUsernameKey) {
    return true;
  }

  const nameKey = normalizeTextKey(user.nombre);
  const ticketNameKey = normalizeTextKey(ticket.solicitadoPor);
  if (nameKey && ticketNameKey && nameKey === ticketNameKey) {
    return true;
  }

  return false;
}

export function filterTicketsForUser(tickets, user) {
  const role = user?.rol || '';
  if (role !== 'solicitante') return tickets;
  return tickets.filter((ticket) => ticketBelongsToUser(ticket, user));
}

export function canAccessTicketByAuthUser(req, ticket) {
  const role = req.authUser?.rol || '';
  if (role !== 'solicitante') return true;
  return ticketBelongsToUser(ticket, req.authUser);
}

export function findTicketAssignee(users, value) {
  const key = normalizeTextKey(value);
  if (!key) return null;
  return users.find((user) => {
    if (!user || user.activo === false) return false;
    if (!canEditByRole(user.rol)) return false;
    return normalizeTextKey(user.nombre) === key || normalizeTextKey(user.username) === key;
  }) || null;
}

export function countActiveAdmins(users, excludeUserId = null) {
  return users.filter((user) => {
    if (excludeUserId !== null && Number(user.id) === Number(excludeUserId)) return false;
    return user.activo !== false && user.rol === 'admin';
  }).length;
}

// --- Auth helpers ---

export function parseBearerToken(headerValue) {
  const raw = asNonEmptyString(headerValue);
  if (!raw) return '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? asNonEmptyString(match[1]) : '';
}

export function createAuthToken() {
  return `mti_${randomUUID()}`;
}

export function getRequestIp(req) {
  const ip = asNonEmptyString(req.ip || req.socket?.remoteAddress || '');
  return ip || 'unknown';
}

export function getLoginAttemptKey(req, username) {
  const safeUser = asNonEmptyString(username).toLowerCase() || '*';
  return `${getRequestIp(req)}::${safeUser}`;
}

export function isDemoPasswordUser(user) {
  const hash = asNonEmptyString(user?.passwordHash);
  if (!hash) return false;
  return DEMO_PASSWORD_HASHES.has(hash);
}

// --- Audit helpers ---

export function getRequestActor(req) {
  return {
    userId: Number.isFinite(Number(req.authUser?.id)) ? Math.trunc(Number(req.authUser.id)) : null,
    username: asNonEmptyString(req.authUser?.username).toLowerCase(),
    rol: req.authUser?.rol || '',
    usuario: req.authUser?.nombre || 'Sistema',
    departamento: asNonEmptyString(req.authUser?.departamento).toUpperCase(),
  };
}

export function buildAuditPayload(req, payload = {}) {
  const actor = getRequestActor(req);
  return {
    ...payload,
    usuario: asNonEmptyString(payload.usuario) || actor.usuario || 'Sistema',
    userId: payload.userId !== undefined ? payload.userId : actor.userId,
    username: asNonEmptyString(payload.username || actor.username).toLowerCase(),
    rol: asNonEmptyString(payload.rol || actor.rol).toLowerCase(),
    departamento: asNonEmptyString(payload.departamento || actor.departamento).toUpperCase(),
    requestId: asNonEmptyString(payload.requestId || req?.requestId).slice(0, 120),
    ip: asNonEmptyString(payload.ip || getRequestIp(req)).slice(0, 120),
    userAgent: asNonEmptyString(payload.userAgent || req?.headers['user-agent']).slice(0, 280),
    resultado: asNonEmptyString(payload.resultado || payload.result).toLowerCase() || 'ok',
    timestamp: asNonEmptyString(payload.timestamp) || new Date().toISOString(),
  };
}

export function pushAuditWithContext(db, req, payload) {
  if (!req) return pushAudit(db, payload);
  const withContext = buildAuditPayload(req, payload);
  return pushAudit(db, withContext);
}

export function normalizeAuditModuleFilter(value) {
  const module = asNonEmptyString(value).toLowerCase();
  if (!AUDIT_MODULES.has(module)) return '';
  return module;
}

export function normalizeAuditResultFilter(value) {
  const result = asNonEmptyString(value).toLowerCase();
  if (!AUDIT_RESULTS.has(result)) return '';
  return result;
}

export function normalizeAuditEntityIdFilter(value) {
  const raw = value === null || typeof value === 'undefined' ? '' : String(value).trim();
  if (!raw) return '';
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  return raw.slice(0, 80);
}

export function parseAuditDateBoundary(value, endOfDay = false) {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const stamp = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    if (!Number.isNaN(stamp.getTime())) return stamp.getTime();
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return null;
}

export function auditTimestampMs(entry) {
  const direct = new Date(asNonEmptyString(entry?.timestamp)).getTime();
  if (Number.isFinite(direct)) return direct;

  const fallbackRaw = asNonEmptyString(entry?.fecha)
    .replace(/\sa\.\s*m\./gi, ' AM')
    .replace(/\sp\.\s*m\./gi, ' PM')
    .replace(/\./g, '');
  if (!fallbackRaw) return null;
  const fallback = new Date(fallbackRaw).getTime();
  if (!Number.isFinite(fallback)) return null;
  return fallback;
}

export function auditMatchesSearch(entry, searchKey) {
  if (!searchKey) return true;
  const fields = [
    entry?.accion,
    entry?.item,
    entry?.usuario,
    entry?.username,
    entry?.rol,
    entry?.departamento,
    entry?.entidad,
    entry?.motivo,
    entry?.modulo,
    entry?.requestId,
    entry?.ip,
    String(entry?.id || ''),
    String(entry?.entidadId ?? ''),
  ];
  return fields.some((value) => normalizeTextKey(value || '').includes(searchKey));
}

export function summarizeAuditAlerts(rows) {
  const nowTs = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const recentRows = rows.filter((entry) => {
    const ts = auditTimestampMs(entry);
    return ts !== null && ts >= nowTs - windowMs;
  });

  const errorCount24h = recentRows.filter((entry) => normalizeAuditResultFilter(entry?.resultado) === 'error').length;
  const loginFailures24h = recentRows.filter((entry) => {
    const action = normalizeTextKey(entry?.accion || '');
    return action.includes('login fallido') || action.includes('login bloqueado') || action.includes('login rechazado');
  }).length;
  const missingActorCount = rows.filter((entry) => {
    const username = asNonEmptyString(entry?.username);
    const usuario = asNonEmptyString(entry?.usuario);
    return !username && !usuario;
  }).length;
  const missingRequestIdCount = rows.filter((entry) => !asNonEmptyString(entry?.requestId)).length;

  const bucketMap = new Map();
  const bucketWindowMs = 10 * 60 * 1000;
  recentRows.forEach((entry) => {
    const ts = auditTimestampMs(entry);
    if (ts === null) return;
    const actor = asNonEmptyString(entry?.username || entry?.usuario).toLowerCase() || 'anon';
    const ip = asNonEmptyString(entry?.ip) || 'unknown';
    const bucket = Math.floor(ts / bucketWindowMs);
    const key = `${actor}|${ip}|${bucket}`;
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  });

  let burstBuckets = 0;
  let burstMaxEvents = 0;
  let burstTopActor = '';
  let burstTopIp = '';
  for (const [key, count] of bucketMap.entries()) {
    if (count < 12) continue;
    burstBuckets += 1;
    if (count > burstMaxEvents) {
      burstMaxEvents = count;
      const [actor, ip] = key.split('|');
      burstTopActor = actor || '';
      burstTopIp = ip || '';
    }
  }

  return {
    windowHours: 24,
    totalRows: rows.length,
    recentRows: recentRows.length,
    errorCount24h,
    loginFailures24h,
    missingActorCount,
    missingRequestIdCount,
    burst: {
      detected: burstMaxEvents >= 12,
      maxEvents10m: burstMaxEvents,
      actor: burstTopActor,
      ip: burstTopIp,
      buckets: burstBuckets,
      threshold: 12,
    },
  };
}

// --- Catalog helpers ---

export function normalizeCatalogBranchItem(value) {
  if (!value || typeof value !== 'object') return null;
  const code = asNonEmptyString(value.code || value.clave)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const name = asNonEmptyString(value.name || value.nombre).slice(0, 80);
  if (!code || !name) return null;
  return {
    code,
    name,
    activo: value.activo !== false,
  };
}

export function normalizeCatalogRoleItem(value) {
  if (!value || typeof value !== 'object') return null;
  const roleValue = normalizeUserRole(value.value || value.rol);
  if (!roleValue) return null;
  const base = DEFAULT_ROLE_CATALOG.find((item) => item.value === roleValue);
  return {
    value: roleValue,
    label: asNonEmptyString(value.label || base?.label || roleValue).slice(0, 60),
    permissions: asNonEmptyString(value.permissions || base?.permissions || '').slice(0, 160),
    activo: value.activo !== false,
  };
}

export function normalizeCatalogState(input) {
  const source = input && typeof input === 'object' ? input : {};

  const branchSource = Array.isArray(source.sucursales) && source.sucursales.length > 0
    ? source.sucursales
    : DEFAULT_BRANCH_CATALOG;
  const branchMap = new Map();
  branchSource.forEach((branch) => {
    const normalized = normalizeCatalogBranchItem(branch);
    if (!normalized) return;
    branchMap.set(normalized.code, normalized);
  });
  const sucursales = branchMap.size > 0
    ? Array.from(branchMap.values())
    : DEFAULT_BRANCH_CATALOG.map((branch) => ({ ...branch }));

  const cargoSource = Array.isArray(source.cargos) && source.cargos.length > 0
    ? source.cargos
    : DEFAULT_CARGO_CATALOG;
  const cargoMap = new Map();
  cargoSource.forEach((cargo) => {
    const normalized = asNonEmptyString(cargo).slice(0, 80);
    if (!normalized) return;
    const key = normalizeTextKey(normalized);
    if (!cargoMap.has(key)) cargoMap.set(key, normalized);
  });
  const cargos = cargoMap.size > 0 ? Array.from(cargoMap.values()) : [...DEFAULT_CARGO_CATALOG];

  const roleSource = Array.isArray(source.roles) && source.roles.length > 0
    ? source.roles
    : DEFAULT_ROLE_CATALOG;
  const roleMap = new Map();
  roleSource.forEach((role) => {
    const normalized = normalizeCatalogRoleItem(role);
    if (!normalized) return;
    roleMap.set(normalized.value, normalized);
  });
  DEFAULT_ROLE_CATALOG.forEach((role) => {
    if (!roleMap.has(role.value)) roleMap.set(role.value, { ...role });
  });
  const roles = DEFAULT_ROLE_CATALOG
    .map((role) => roleMap.get(role.value))
    .filter(Boolean);

  return { sucursales, cargos, roles };
}

export function getCatalogsFromDb(db) {
  return normalizeCatalogState(db?.catalogos);
}

export function getBranchCodesFromCatalog(db) {
  const catalogs = getCatalogsFromDb(db);
  return new Set(
    catalogs.sucursales
      .filter((branch) => branch.activo !== false)
      .map((branch) => branch.code),
  );
}

export function roleIsEnabledByCatalog(db, roleValue) {
  const catalogs = getCatalogsFromDb(db);
  const role = catalogs.roles.find((item) => item.value === roleValue);
  return role ? role.activo !== false : true;
}

// --- File helpers ---

export function sanitizeUploadFileName(fileName) {
  const base = asNonEmptyString(fileName) || 'archivo';
  const normalized = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 150) || 'archivo';
}

// --- Pagination helpers ---

export function parsePagination(query) {
  const pageRaw = toInt(query.page);
  const sizeRaw = toInt(query.pageSize);
  const page = pageRaw && pageRaw > 0 ? pageRaw : 1;
  const pageSizeCandidate = sizeRaw && sizeRaw > 0 ? sizeRaw : PAGINATION_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(pageSizeCandidate, 1), PAGINATION_MAX_PAGE_SIZE);
  return { page, pageSize };
}

export function paginateList(rows, page, pageSize) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * pageSize;
  const items = rows.slice(offset, offset + pageSize);
  return {
    items,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}

export function getBootstrapAuditRows(rows) {
  if (!Array.isArray(rows) || BOOTSTRAP_AUDIT_LIMIT <= 0) return [];
  return rows.slice(0, BOOTSTRAP_AUDIT_LIMIT);
}

// --- Authorization guards (send HTTP error and return false if not allowed) ---

export function ensureCanEdit(req, res) {
  if (!canEditByRole(req.authUser?.rol)) {
    res.status(403).json({ error: 'No autorizado para ejecutar esta operación.' });
    return false;
  }
  return true;
}

export function ensureCanCreateTickets(req, res) {
  if (!canCreateTicketsByRole(req.authUser?.rol)) {
    res.status(403).json({ error: 'No autorizado para crear tickets.' });
    return false;
  }
  return true;
}

export function ensureAdmin(req, res) {
  if (req.authUser?.rol !== 'admin') {
    res.status(403).json({ error: 'Solo administradores pueden ejecutar esta operacion.' });
    return false;
  }
  return true;
}
