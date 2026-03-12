import { existsSync, promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import {
  buildAssetQrLookupResponse,
  buildSignedAssetQrToken,
  QR_TOKEN_SCHEME,
  verifySignedAssetQrToken,
} from './modules/qr-token.js';
import {
  createUserPasswordHash,
  getDataDirPath,
  now,
  nextId,
  pushAudit,
  readDb,
  sanitizeUser,
  summarizeAuditIntegrity,
  updateDb,
  verifyUserPassword,
} from './store.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLA_HOURS = {
  MEDIA: 24,
  ALTA: 8,
  CRITICA: 2,
};
const IMPORT_MAX_ROWS = 5000;
const RISK_DUPLICATE_SAMPLE_LIMIT = 10;
const AUTH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const USER_ROLES = new Set(['admin', 'tecnico', 'consulta', 'solicitante']);
const DEFAULT_CARGO_CATALOG = [
  'Coordinador de Sistemas',
  'Gerente',
  'Director',
  'Desarrollador',
  'Auxiliar de Sistemas',
  'CeDis',
];
const DEFAULT_ROLE_CATALOG = [
  { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
  { value: 'tecnico', label: 'Tecnico', permissions: 'Operacion IT + tickets', activo: true },
  { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
  { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
];
const DEFAULT_BRANCH_CATALOG = [
  { code: 'TJ01', name: 'Sucursal Estrella', activo: true },
  { code: 'TC01', name: 'Sucursal Camargo', activo: true },
  { code: 'TJ02', name: 'Sucursal CBtis', activo: true },
  { code: 'TJ03', name: 'Sucursal Sor Juana', activo: true },
  { code: 'CEDIS', name: 'CeDis', activo: true },
];
const DEFAULT_BRANCH_CODES = new Set(DEFAULT_BRANCH_CATALOG.map((branch) => branch.code));

const TICKET_STATES = ['Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado'];
const CLOSED_STATES = new Set(['Resuelto', 'Cerrado']);
const AUDIT_MODULES = new Set(['activos', 'insumos', 'tickets', 'otros']);
const AUDIT_RESULTS = new Set(['ok', 'error']);
const CORS_ORIGINS = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const CORS_ALLOW_ALL = CORS_ORIGINS.length === 0;
const LOGIN_MAX_ATTEMPTS = Math.max(3, Math.trunc(Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 5)));
const LOGIN_LOCK_MS = Math.max(60_000, Math.trunc(Number(process.env.AUTH_LOGIN_LOCK_MS || 15 * 60 * 1000)));
const LOGIN_TRACK_WINDOW_MS = Math.max(LOGIN_LOCK_MS, Math.trunc(Number(process.env.AUTH_LOGIN_TRACK_WINDOW_MS || 30 * 60 * 1000)));
const LOGIN_ATTEMPT_GC_MS = Math.max(60_000, Math.trunc(Number(process.env.AUTH_LOGIN_GC_MS || 5 * 60 * 1000)));
const TICKET_ATTACHMENT_MAX_BYTES = Math.max(64 * 1024, Math.trunc(Number(process.env.TICKET_ATTACHMENT_MAX_BYTES || 5 * 1024 * 1024)));
const TICKET_ATTACHMENT_MAX_COUNT = Math.max(1, Math.trunc(Number(process.env.TICKET_ATTACHMENT_MAX_COUNT || 10)));
const PAGINATION_DEFAULT_PAGE_SIZE = Math.max(10, Math.trunc(Number(process.env.PAGINATION_DEFAULT_SIZE || 25)));
const PAGINATION_MAX_PAGE_SIZE = Math.max(PAGINATION_DEFAULT_PAGE_SIZE, Math.trunc(Number(process.env.PAGINATION_MAX_SIZE || 100)));
const DATA_DIR_PATH = getDataDirPath ? getDataDirPath() : path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR_PATH, 'uploads');
const CLIENT_DIST_DIR = path.resolve(process.cwd(), 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const HAS_CLIENT_DIST = existsSync(CLIENT_INDEX_FILE);
const TRUST_PROXY = process.env.TRUST_PROXY;
const DISALLOW_DEMO_PASSWORDS = String(
  process.env.AUTH_DISALLOW_DEMO_PASSWORDS || (process.env.NODE_ENV === 'production' ? 'true' : 'false'),
).toLowerCase() !== 'false';
const DEMO_PASSWORD_HASHES = new Set([
  'scrypt-v1$4923721e0ded78534bbd638be30ae5f1$1993ab737237283782f648c1dfa3abc737309abc2bbe5a2e3600a4e1a2ed33660abb03efd5bfdd7a4b44d065e9fe400a6444df09f2661ecda0b2119ddc2d39f9',
  'scrypt-v1$32054ec3b72a1863e1839397517c410c$cd46075c7507e0a5b6e7d81239a433706acd86290609d17896a40d6addb6204688f8e9445b75664b23c1faca7e8be8a1385d49f121b3d415e3ee124fdf260456',
  'scrypt-v1$a992b6ad1d54ff5171d08b30f1eb3d1a$2e59f85b782d7dc3d2774617c2d37333c7cba81c83999f39db1a5a93a4a5b87498199d2143cbae6cd35cec8a35989d4b0c8d749f42ef566d3dae916c2b571967',
]);
const authSessions = new Map();
const loginAttempts = new Map();
let lastLoginAttemptGcAt = 0;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

if (typeof TRUST_PROXY === 'string' && TRUST_PROXY.trim()) {
  const rawTrustProxy = TRUST_PROXY.trim();
  const normalizedTrustProxy = rawTrustProxy.toLowerCase();
  if (normalizedTrustProxy === 'true') app.set('trust proxy', true);
  else if (normalizedTrustProxy === 'false') app.set('trust proxy', false);
  else if (/^\d+$/.test(normalizedTrustProxy)) app.set('trust proxy', Number(normalizedTrustProxy));
  else app.set('trust proxy', rawTrustProxy);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (CORS_ALLOW_ALL) return callback(null, true);
    if (CORS_ORIGINS.includes(origin)) return callback(null, true);
    callback(new HttpError(403, 'Origen no permitido por CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  const incoming = asNonEmptyString(req.headers['x-request-id']);
  const requestId = incoming || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

function normalizePrioridad(value) {
  const raw = String(value || 'MEDIA').toUpperCase();
  if (raw.includes('CRIT')) return 'CRITICA';
  if (raw.includes('ALTA')) return 'ALTA';
  return 'MEDIA';
}

function normalizeEstadoTicket(value) {
  const raw = String(value || '').trim();
  const match = TICKET_STATES.find((state) => state.toLowerCase() === raw.toLowerCase());
  return match || null;
}

function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function asNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTextKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeUserRole(value) {
  const role = asNonEmptyString(value).toLowerCase();
  if (!USER_ROLES.has(role)) return null;
  return role;
}

function normalizeUserCargo(value, cargoCatalog = DEFAULT_CARGO_CATALOG) {
  const key = normalizeTextKey(value);
  if (!key) return '';
  for (const cargo of cargoCatalog) {
    const normalized = asNonEmptyString(cargo);
    if (!normalized) continue;
    if (normalizeTextKey(normalized) === key) return normalized;
  }
  return '';
}

function normalizeTicketBranch(value, allowedBranchCodes = DEFAULT_BRANCH_CODES) {
  const code = asNonEmptyString(value).toUpperCase();
  if (!allowedBranchCodes.has(code)) return '';
  return code;
}

function normalizeTicketAttentionType(value) {
  const type = asNonEmptyString(value).toUpperCase();
  if (type === 'PRESENCIAL' || type === 'REMOTO') return type;
  return '';
}

function isSupplyActive(item) {
  return item?.activo !== false;
}

function isLowStock(item) {
  if (!isSupplyActive(item)) return false;
  return Number(item.stock) <= Number(item.min);
}

function calcDueDate(prioridad) {
  const hours = SLA_HOURS[prioridad] || SLA_HOURS.MEDIA;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isSlaBreached(ticket) {
  if (CLOSED_STATES.has(ticket.estado)) return false;
  if (!ticket.fechaLimite) return false;
  return Date.now() > new Date(ticket.fechaLimite).getTime();
}

function slaRemainingMinutes(ticket) {
  if (CLOSED_STATES.has(ticket.estado)) return null;
  if (!ticket.fechaLimite) return null;
  return Math.ceil((new Date(ticket.fechaLimite).getTime() - Date.now()) / 60000);
}

function serializeTicket(ticket) {
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

function ticketAuditAction(estado) {
  if (estado === 'Resuelto') return 'Ticket Resuelto';
  if (estado === 'Cerrado') return 'Ticket Cerrado';
  if (estado === 'En Proceso') return 'Ticket En Proceso';
  if (estado === 'En Espera') return 'Ticket En Espera';
  return 'Ticket Actualizado';
}

function canEditByRole(role) {
  return role === 'admin' || role === 'tecnico';
}

function canCreateTicketsByRole(role) {
  return role === 'admin' || role === 'tecnico' || role === 'solicitante';
}

function ticketBelongsToUser(ticket, user) {
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

function filterTicketsForUser(tickets, user) {
  const role = user?.rol || '';
  if (role !== 'solicitante') return tickets;
  return tickets.filter((ticket) => ticketBelongsToUser(ticket, user));
}

function canAccessTicketByAuthUser(req, ticket) {
  const role = req.authUser?.rol || '';
  if (role !== 'solicitante') return true;
  return ticketBelongsToUser(ticket, req.authUser);
}

function findTicketAssignee(users, value) {
  const key = normalizeTextKey(value);
  if (!key) return null;
  return users.find((user) => {
    if (!user || user.activo === false) return false;
    if (!canEditByRole(user.rol)) return false;
    return normalizeTextKey(user.nombre) === key || normalizeTextKey(user.username) === key;
  }) || null;
}

function parseBearerToken(headerValue) {
  const raw = asNonEmptyString(headerValue);
  if (!raw) return '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? asNonEmptyString(match[1]) : '';
}

function createAuthToken() {
  return `mti_${randomUUID()}`;
}

function registerSession(user) {
  const token = createAuthToken();
  authSessions.set(token, {
    userId: Number(user.id),
    username: String(user.username).toLowerCase(),
    issuedAt: Date.now(),
  });
  return token;
}

function getValidSession(token) {
  const session = authSessions.get(token);
  if (!session) return null;
  if (Date.now() - Number(session.issuedAt || 0) > AUTH_TOKEN_TTL_MS) {
    authSessions.delete(token);
    return null;
  }
  return session;
}

function getRequestActor(req) {
  return {
    userId: Number.isFinite(Number(req.authUser?.id)) ? Math.trunc(Number(req.authUser.id)) : null,
    username: asNonEmptyString(req.authUser?.username).toLowerCase(),
    rol: req.authUser?.rol || '',
    usuario: req.authUser?.nombre || 'Sistema',
    departamento: asNonEmptyString(req.authUser?.departamento).toUpperCase(),
  };
}

function buildAuditPayload(req, payload = {}) {
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

function pushAuditWithContext(db, req, payload) {
  if (!req) return pushAudit(db, payload);
  const withContext = buildAuditPayload(req, payload);
  return pushAudit(db, withContext);
}

async function writeSecurityAudit(req, payload) {
  try {
    await updateDb((db) =>
      pushAuditWithContext(db, req, {
        modulo: 'otros',
        entidad: 'sesion',
        ...payload,
      }));
  } catch {
    // No interrumpir el flujo de autenticacion por fallas de auditoria.
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Sesion requerida.' });
    }

    const session = getValidSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Sesion invalida o expirada.' });
    }

    const db = await readDb();
    const user = db.users.find(
      (u) =>
        Number(u.id) === Number(session.userId) &&
        String(u.username).toLowerCase() === String(session.username).toLowerCase() &&
        u.activo !== false,
    );

    if (!user) {
      authSessions.delete(token);
      return res.status(401).json({ error: 'Usuario no autorizado.' });
    }

    req.authToken = token;
    req.authUser = sanitizeUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

function ensureCanEdit(req, res) {
  if (!canEditByRole(req.authUser?.rol)) {
    res.status(403).json({ error: 'No autorizado para ejecutar esta operación.' });
    return false;
  }
  return true;
}

function ensureCanCreateTickets(req, res) {
  if (!canCreateTicketsByRole(req.authUser?.rol)) {
    res.status(403).json({ error: 'No autorizado para crear tickets.' });
    return false;
  }
  return true;
}

function ensureAdmin(req, res) {
  if (req.authUser?.rol !== 'admin') {
    res.status(403).json({ error: 'Solo administradores pueden ejecutar esta operacion.' });
    return false;
  }
  return true;
}

function countActiveAdmins(users, excludeUserId = null) {
  return users.filter((user) => {
    if (excludeUserId !== null && Number(user.id) === Number(excludeUserId)) return false;
    return user.activo !== false && user.rol === 'admin';
  }).length;
}

function revokeSessionsByUserId(userId) {
  for (const [token, session] of authSessions.entries()) {
    if (Number(session?.userId) === Number(userId)) {
      authSessions.delete(token);
    }
  }
}

function normalizeCatalogBranchItem(value) {
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

function normalizeCatalogRoleItem(value) {
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

function normalizeCatalogState(input) {
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

function getCatalogsFromDb(db) {
  return normalizeCatalogState(db?.catalogos);
}

function getBranchCodesFromCatalog(db) {
  const catalogs = getCatalogsFromDb(db);
  return new Set(
    catalogs.sucursales
      .filter((branch) => branch.activo !== false)
      .map((branch) => branch.code),
  );
}

function roleIsEnabledByCatalog(db, roleValue) {
  const catalogs = getCatalogsFromDb(db);
  const role = catalogs.roles.find((item) => item.value === roleValue);
  return role ? role.activo !== false : true;
}

function buildTicketAttachmentResponse(attachment) {
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

function sanitizeUploadFileName(fileName) {
  const base = asNonEmptyString(fileName) || 'archivo';
  const normalized = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 150) || 'archivo';
}

function parsePagination(query) {
  const pageRaw = toInt(query.page);
  const sizeRaw = toInt(query.pageSize);
  const page = pageRaw && pageRaw > 0 ? pageRaw : 1;
  const pageSizeCandidate = sizeRaw && sizeRaw > 0 ? sizeRaw : PAGINATION_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(pageSizeCandidate, 1), PAGINATION_MAX_PAGE_SIZE);
  return { page, pageSize };
}

function paginateList(rows, page, pageSize) {
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

function normalizeAuditModuleFilter(value) {
  const module = asNonEmptyString(value).toLowerCase();
  if (!AUDIT_MODULES.has(module)) return '';
  return module;
}

function normalizeAuditResultFilter(value) {
  const result = asNonEmptyString(value).toLowerCase();
  if (!AUDIT_RESULTS.has(result)) return '';
  return result;
}

function parseAuditDateBoundary(value, endOfDay = false) {
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

function auditTimestampMs(entry) {
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

function auditMatchesSearch(entry, searchKey) {
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

function summarizeAuditAlerts(rows) {
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

function getRequestIp(req) {
  const ip = asNonEmptyString(req.ip || req.socket?.remoteAddress || '');
  return ip || 'unknown';
}

function getLoginAttemptKey(req, username) {
  const safeUser = asNonEmptyString(username).toLowerCase() || '*';
  return `${getRequestIp(req)}::${safeUser}`;
}

function isDemoPasswordUser(user) {
  const hash = asNonEmptyString(user?.passwordHash);
  if (!hash) return false;
  return DEMO_PASSWORD_HASHES.has(hash);
}

function gcLoginAttempts() {
  const nowTs = Date.now();
  if (nowTs - lastLoginAttemptGcAt < LOGIN_ATTEMPT_GC_MS) return;
  for (const [key, item] of loginAttempts.entries()) {
    const expired = !item
      || (item.lockedUntil && item.lockedUntil <= nowTs && nowTs - item.lastFailedAt > LOGIN_TRACK_WINDOW_MS)
      || (!item.lockedUntil && nowTs - item.windowStartedAt > LOGIN_TRACK_WINDOW_MS);
    if (expired) loginAttempts.delete(key);
  }
  lastLoginAttemptGcAt = nowTs;
}

function getLoginThrottle(req, username) {
  gcLoginAttempts();
  const key = getLoginAttemptKey(req, username);
  const item = loginAttempts.get(key);
  if (!item) return null;
  if (item.lockedUntil && item.lockedUntil > Date.now()) {
    return {
      key,
      lockedUntil: item.lockedUntil,
      retryAfterSec: Math.max(1, Math.ceil((item.lockedUntil - Date.now()) / 1000)),
    };
  }
  return null;
}

function registerLoginFailure(req, username) {
  gcLoginAttempts();
  const key = getLoginAttemptKey(req, username);
  const nowTs = Date.now();
  const current = loginAttempts.get(key);
  const windowExpired = !current || nowTs - Number(current.windowStartedAt || 0) > LOGIN_TRACK_WINDOW_MS;

  const next = windowExpired
    ? { count: 1, windowStartedAt: nowTs, lastFailedAt: nowTs, lockedUntil: 0 }
    : {
        ...current,
        count: Number(current.count || 0) + 1,
        lastFailedAt: nowTs,
      };

  if (next.count >= LOGIN_MAX_ATTEMPTS) {
    next.lockedUntil = nowTs + LOGIN_LOCK_MS;
    next.count = 0;
    next.windowStartedAt = nowTs;
  }

  loginAttempts.set(key, next);
  return {
    locked: next.lockedUntil > nowTs,
    retryAfterSec: next.lockedUntil > nowTs ? Math.max(1, Math.ceil((next.lockedUntil - nowTs) / 1000)) : 0,
  };
}

function clearLoginFailures(req, username) {
  const key = getLoginAttemptKey(req, username);
  loginAttempts.delete(key);
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function toAbsoluteAttachmentPath(storagePath) {
  const normalized = asNonEmptyString(storagePath).replace(/\\/g, '/');
  if (!normalized) return '';
  const absolute = path.resolve(DATA_DIR_PATH, normalized);
  const root = path.resolve(UPLOAD_DIR);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return absolute;
}

function parseAssetLifeYears(value) {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const years = Number(match[0]);
  if (!Number.isFinite(years)) return null;
  return years;
}

function summarizeAssetRisks(activos) {
  const ipCounts = new Map();
  const macCounts = new Map();
  let activosSinIp = 0;
  let activosSinMac = 0;
  let activosSinResponsable = 0;
  let activosVidaAlta = 0;
  let activosEnFalla = 0;

  for (const asset of activos) {
    const ip = asNonEmptyString(asset.ipAddress);
    const mac = asNonEmptyString(asset.macAddress).toLowerCase();
    const responsable = asNonEmptyString(asset.responsable);
    const years = parseAssetLifeYears(asset.aniosVida);

    if (!ip) activosSinIp += 1;
    if (!mac) activosSinMac += 1;
    if (!responsable) activosSinResponsable += 1;
    if (years !== null && years >= 4) activosVidaAlta += 1;
    if (asset.estado === 'Falla') activosEnFalla += 1;

    if (ip) ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    if (mac) macCounts.set(mac, (macCounts.get(mac) || 0) + 1);
  }

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
    duplicateIpEntries: duplicateIpEntries.slice(0, RISK_DUPLICATE_SAMPLE_LIMIT),
    duplicateMacEntries: duplicateMacEntries.slice(0, RISK_DUPLICATE_SAMPLE_LIMIT),
  };
}

function stripSensitiveAssetFields(asset, role) {
  if (role === 'admin') return asset;
  const { passwordRemota, ...safe } = asset;
  return safe;
}

function buildBootstrapUsers(users, role) {
  const safeUsers = users.map((user) => sanitizeUser(user)).filter(Boolean);
  if (role === 'admin') return safeUsers;
  return safeUsers
    .filter((user) => user.activo !== false && canEditByRole(user.rol))
    .map((user) => ({
      id: user.id,
      nombre: user.nombre,
      username: user.username,
      rol: user.rol,
      activo: user.activo,
    }));
}

const ASSET_FIELDS = [
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

function normalizeAssetTag(value) {
  return asNonEmptyString(value)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 80);
}

function normalizeAssetStatus(value) {
  const raw = asNonEmptyString(value).toLowerCase();
  if (!raw) return 'Operativo';
  if (raw === 'falla' || raw === 'e') return 'Falla';
  if (raw.includes('falla') || raw.includes('inoper') || raw.includes('off') || raw.includes('down') || raw.includes('dan')) {
    return 'Falla';
  }
  return 'Operativo';
}

function normalizeMacAddress(value) {
  const compact = asNonEmptyString(value).toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!compact) return '';
  if (compact.length !== 12) return null;
  return compact.match(/.{1,2}/g).join(':');
}

function normalizeIpAddress(value) {
  const raw = asNonEmptyString(value);
  if (!raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 4) return null;

  const normalized = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    normalized.push(String(n));
  }
  return normalized.join('.');
}

function normalizeDateInput(value, fallbackToToday = true) {
  const raw = asNonEmptyString(value);
  if (!raw) return fallbackToToday ? new Date().toISOString().slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackToToday ? new Date().toISOString().slice(0, 10) : '';
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeAssetPayload(payload, { mode = 'create' } = {}) {
  const errors = [];
  const fromImport = mode === 'import';
  const hasRawEstado = asNonEmptyString(payload?.estado || payload?.edo).length > 0;
  const hasRawFechaCompra = asNonEmptyString(payload?.fechaCompra).length > 0;
  const rawMac = asNonEmptyString(payload?.macAddress || payload?.mac);
  const rawIp = asNonEmptyString(payload?.ipAddress || payload?.ip);

  const tag = normalizeAssetTag(payload?.tag || payload?.idInterno || payload?.serial);
  const tipo = asNonEmptyString(payload?.tipo || payload?.equipo).toUpperCase();
  const marca = asNonEmptyString(payload?.marca);
  const modelo = asNonEmptyString(payload?.modelo);
  const ubicacion = asNonEmptyString(payload?.ubicacion);
  const serial = asNonEmptyString(payload?.serial || payload?.idInterno).toUpperCase();
  const idInterno = asNonEmptyString(payload?.idInterno).toUpperCase();
  const equipo = asNonEmptyString(payload?.equipo || tipo).toUpperCase();
  const macAddress = normalizeMacAddress(rawMac);
  const ipAddress = normalizeIpAddress(rawIp);

  if (rawMac && macAddress === null) {
    errors.push('MAC invalida');
  }
  if (rawIp && ipAddress === null) {
    errors.push('IP invalida');
  }

  if (fromImport) {
    if (!tag && !serial && !idInterno && !macAddress) {
      errors.push('Sin identificador (tag/serial/idInterno/mac)');
    }
  } else {
    if (!tag || !tipo || !marca || !ubicacion || !serial) {
      errors.push('Campos requeridos incompletos para activo');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const normalized = {
    tag: tag || normalizeAssetTag(`${equipo || 'ACT'}-${payload?.rowNumber || Date.now()}`),
    tipo,
    marca,
    modelo,
    ubicacion,
    estado: hasRawEstado ? normalizeAssetStatus(payload?.estado || payload?.edo) : fromImport ? '' : 'Operativo',
    serial: serial || idInterno || (tag ? `${tag}-SN` : ''),
    fechaCompra: hasRawFechaCompra ? normalizeDateInput(payload?.fechaCompra, false) : fromImport ? '' : normalizeDateInput('', true),
    idInterno,
    equipo,
    cpu: asNonEmptyString(payload?.cpu).toUpperCase(),
    ram: asNonEmptyString(payload?.ram).toUpperCase(),
    ramTipo: asNonEmptyString(payload?.ramTipo).toUpperCase(),
    disco: asNonEmptyString(payload?.disco).toUpperCase(),
    tipoDisco: asNonEmptyString(payload?.tipoDisco).toUpperCase(),
    macAddress: macAddress || '',
    ipAddress: ipAddress || '',
    responsable: asNonEmptyString(payload?.responsable),
    departamento: asNonEmptyString(payload?.departamento).toUpperCase(),
    edo: asNonEmptyString(payload?.edo).toUpperCase(),
    anydesk: asNonEmptyString(payload?.anydesk),
    passwordRemota: asNonEmptyString(payload?.passwordRemota || payload?.pass),
    aniosVida: asNonEmptyString(payload?.aniosVida),
    comentarios: asNonEmptyString(payload?.comentarios),
  };

  return { ok: true, item: normalized };
}

function finalizeAsset(asset) {
  const copy = { ...asset };
  copy.tag = normalizeAssetTag(copy.tag) || normalizeAssetTag(`${copy.equipo || 'ACT'}-${Date.now()}`);
  copy.tipo = asNonEmptyString(copy.tipo || copy.equipo || 'EQUIPO').toUpperCase() || 'EQUIPO';
  copy.marca = asNonEmptyString(copy.marca) || 'SIN MARCA';
  copy.modelo = asNonEmptyString(copy.modelo);
  copy.ubicacion = asNonEmptyString(copy.ubicacion) || 'SIN UBICACION';
  copy.estado = normalizeAssetStatus(copy.estado || copy.edo);
  copy.serial = asNonEmptyString(copy.serial || copy.idInterno || `${copy.tag}-SN`).toUpperCase();
  copy.fechaCompra = normalizeDateInput(copy.fechaCompra, true);
  copy.idInterno = asNonEmptyString(copy.idInterno).toUpperCase();
  copy.equipo = asNonEmptyString(copy.equipo || copy.tipo).toUpperCase();
  copy.cpu = asNonEmptyString(copy.cpu).toUpperCase();
  copy.ram = asNonEmptyString(copy.ram).toUpperCase();
  copy.ramTipo = asNonEmptyString(copy.ramTipo).toUpperCase();
  copy.disco = asNonEmptyString(copy.disco).toUpperCase();
  copy.tipoDisco = asNonEmptyString(copy.tipoDisco).toUpperCase();
  copy.macAddress = normalizeMacAddress(copy.macAddress) || '';
  copy.ipAddress = normalizeIpAddress(copy.ipAddress) || '';
  copy.responsable = asNonEmptyString(copy.responsable);
  copy.departamento = asNonEmptyString(copy.departamento).toUpperCase();
  copy.edo = asNonEmptyString(copy.edo).toUpperCase();
  copy.anydesk = asNonEmptyString(copy.anydesk);
  copy.passwordRemota = asNonEmptyString(copy.passwordRemota);
  copy.aniosVida = asNonEmptyString(copy.aniosVida);
  copy.comentarios = asNonEmptyString(copy.comentarios);
  return copy;
}

function indexAsset(map, key, value) {
  const normalized = normalizeTextKey(key);
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, value);
}

function buildAssetIndexes(activos) {
  const indexes = {
    tag: new Map(),
    serial: new Map(),
    idInterno: new Map(),
    macAddress: new Map(),
    ipAddress: new Map(),
  };

  for (const item of activos) {
    indexAsset(indexes.tag, item.tag, item);
    indexAsset(indexes.serial, item.serial, item);
    indexAsset(indexes.idInterno, item.idInterno, item);
    indexAsset(indexes.macAddress, item.macAddress, item);
    indexAsset(indexes.ipAddress, item.ipAddress, item);
  }

  return indexes;
}

function getIndexedAsset(map, value) {
  const normalized = normalizeTextKey(value);
  if (!normalized) return null;
  return map.get(normalized) || null;
}

function findExistingAsset(indexes, asset) {
  return (
    getIndexedAsset(indexes.idInterno, asset.idInterno) ||
    getIndexedAsset(indexes.serial, asset.serial) ||
    getIndexedAsset(indexes.macAddress, asset.macAddress) ||
    getIndexedAsset(indexes.tag, asset.tag) ||
    null
  );
}

function findAssetConflicts(indexes, asset, currentId = null) {
  const conflicts = [];
  const checks = [
    ['tag', indexes.tag],
    ['serial', indexes.serial],
    ['idInterno', indexes.idInterno],
    ['macAddress', indexes.macAddress],
    ['ipAddress', indexes.ipAddress],
  ];

  for (const [field, map] of checks) {
    const value = asset[field];
    if (!value) continue;
    const existing = getIndexedAsset(map, value);
    if (!existing) continue;
    if (currentId !== null && Number(existing.id) === Number(currentId)) continue;
    conflicts.push(field);
  }
  return conflicts;
}

function mergeAsset(existing, incoming) {
  const merged = { ...existing };
  for (const field of ASSET_FIELDS) {
    const value = incoming[field];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    merged[field] = value;
  }
  return finalizeAsset(merged);
}

function hasAssetChanges(current, next) {
  return ASSET_FIELDS.some((field) => String(current[field] || '') !== String(next[field] || ''));
}

function importAssets(db, options) {
  const items = Array.isArray(options.items) ? options.items : [];
  const upsert = options.upsert !== false;
  const usuario = asNonEmptyString(options.usuario) || 'Admin IT';
  const persist = options.persist !== false;
  const sourceName = asNonEmptyString(options.fileName) || 'Importacion Excel';
  const auditReq = options.auditReq || null;

  const detailLimit = 40;
  const details = [];
  const report = {
    totalRows: items.length,
    created: 0,
    updated: 0,
    skipped: 0,
    invalid: 0,
    upsert,
    details,
  };

  let indexes = buildAssetIndexes(db.activos);

  items.forEach((rawItem, i) => {
    const parsed = normalizeAssetPayload(rawItem, { mode: 'import' });
    const rowNumber = toInt(rawItem?.rowNumber) || i + 2;
    if (!parsed.ok) {
      report.invalid += 1;
      if (details.length < detailLimit) {
        details.push({ rowNumber, status: 'invalid', reason: parsed.errors.join(', ') });
      }
      return;
    }

    const normalized = finalizeAsset(parsed.item);
    const existing = findExistingAsset(indexes, normalized);
    const conflicts = findAssetConflicts(indexes, normalized, existing ? existing.id : null);
    if (conflicts.length > 0) {
      report.invalid += 1;
      if (details.length < detailLimit) {
        details.push({ rowNumber, status: 'invalid', reason: `Conflicto en ${conflicts.join('/')}`, tag: normalized.tag });
      }
      return;
    }

    if (existing) {
      if (!upsert) {
        report.skipped += 1;
        if (details.length < detailLimit) {
          details.push({ rowNumber, status: 'skipped', reason: 'Ya existe', tag: normalized.tag });
        }
        return;
      }

      const merged = mergeAsset(existing, parsed.item);
      if (!hasAssetChanges(existing, merged)) {
        report.skipped += 1;
        if (details.length < detailLimit) {
          details.push({ rowNumber, status: 'skipped', reason: 'Sin cambios', tag: existing.tag });
        }
        return;
      }

      Object.assign(existing, merged);
      report.updated += 1;
      if (details.length < detailLimit) {
        details.push({ rowNumber, status: 'updated', tag: existing.tag });
      }
      indexes = buildAssetIndexes(db.activos);
      return;
    }

    const nuevo = { id: nextId(db), ...normalized };
    db.activos.push(nuevo);
    report.created += 1;
    if (details.length < detailLimit) {
      details.push({ rowNumber, status: 'created', tag: nuevo.tag });
    }
    indexes = buildAssetIndexes(db.activos);
  });

  if (persist && (report.created > 0 || report.updated > 0)) {
    pushAuditWithContext(db, auditReq, {
      accion: 'Importacion Activos',
      item: sourceName,
      cantidad: report.created + report.updated,
      usuario,
      modulo: 'activos',
      entidad: 'activo',
      meta: { created: report.created, updated: report.updated, skipped: report.skipped, invalid: report.invalid },
    });
  }

  return report;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/users', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const db = await readDb();
    res.json(db.users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalogos', requireAuth, async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json({
      ...getCatalogsFromDb(db),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/catalogos', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const { usuario } = getRequestActor(req);

    const hasBranchUpdate = req.body?.sucursales !== undefined;
    const hasCargoUpdate = req.body?.cargos !== undefined;
    const hasRoleUpdate = req.body?.roles !== undefined;
    if (!hasBranchUpdate && !hasCargoUpdate && !hasRoleUpdate) {
      return res.status(400).json({ error: 'No hay cambios de catalogos para aplicar.' });
    }

    if (hasBranchUpdate && !Array.isArray(req.body?.sucursales)) {
      return res.status(400).json({ error: 'El catalogo de sucursales debe ser una lista.' });
    }
    if (hasCargoUpdate && !Array.isArray(req.body?.cargos)) {
      return res.status(400).json({ error: 'El catalogo de cargos debe ser una lista.' });
    }
    if (hasRoleUpdate && !Array.isArray(req.body?.roles)) {
      return res.status(400).json({ error: 'El catalogo de roles debe ser una lista.' });
    }

    const updated = await updateDb((db) => {
      const current = getCatalogsFromDb(db);
      const nextDraft = {
        sucursales: hasBranchUpdate ? req.body.sucursales : current.sucursales,
        cargos: hasCargoUpdate ? req.body.cargos : current.cargos,
        roles: hasRoleUpdate ? req.body.roles : current.roles,
      };
      const normalized = normalizeCatalogState(nextDraft);

      if (hasBranchUpdate && normalized.sucursales.length === 0) return { ok: false, code: 'INVALID_BRANCHES' };
      if (hasCargoUpdate && normalized.cargos.length === 0) return { ok: false, code: 'INVALID_CARGOS' };
      if (hasRoleUpdate && normalized.roles.length === 0) return { ok: false, code: 'INVALID_ROLES' };

      db.catalogos = normalized;
      pushAuditWithContext(db, req, {
        accion: 'Catalogos Actualizados',
        item: `Sucursales: ${normalized.sucursales.length} | Cargos: ${normalized.cargos.length} | Roles: ${normalized.roles.length}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'catalogo',
      });
      return { ok: true, catalogos: normalized };
    });

    if (!updated?.ok && updated?.code === 'INVALID_BRANCHES') {
      return res.status(400).json({ error: 'Catalogo de sucursales invalido.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_CARGOS') {
      return res.status(400).json({ error: 'Catalogo de cargos invalido.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_ROLES') {
      return res.status(400).json({ error: 'Catalogo de roles invalido.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudieron guardar los catalogos.' });
    }

    res.json({
      ...updated.catalogos,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/users', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const nombre = asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ');
    const username = asNonEmptyString(req.body?.username).toLowerCase();
    const password = asNonEmptyString(req.body?.password);
    const cargoInput = req.body?.cargo ?? req.body?.departamento;
    const rol = normalizeUserRole(req.body?.rol) || 'solicitante';
    const { usuario } = getRequestActor(req);

    if (!nombre || !username || !password || !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Nombre, usuario, password y cargo son requeridos.' });
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres.' });
    }

    const created = await updateDb((db) => {
      const catalogs = getCatalogsFromDb(db);
      const cargo = normalizeUserCargo(cargoInput, catalogs.cargos);
      if (!cargo) return { ok: false, code: 'INVALID_CARGO' };
      if (!roleIsEnabledByCatalog(db, rol)) return { ok: false, code: 'ROLE_DISABLED' };

      const duplicated = db.users.some((u) => String(u.username).toLowerCase() === username);
      if (duplicated) return { ok: false, code: 'DUPLICATE' };

      const user = {
        id: nextId(db),
        nombre,
        username,
        passwordHash: createUserPasswordHash(password),
        rol,
        departamento: cargo,
        activo: true,
      };
      db.users.push(user);
      pushAuditWithContext(db, req, {
        accion: 'Alta Usuario',
        item: `${user.username} | ${cargo}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: user.id,
        after: sanitizeUser(user),
      });
      return { ok: true, user };
    });

    if (!created?.ok && created?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }
    if (!created?.ok && created?.code === 'INVALID_CARGO') {
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (!created?.ok && created?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catalogo.' });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }

    res.status(201).json(sanitizeUser(created.user));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/users/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const hasNombre = req.body?.nombre !== undefined;
    const hasUsername = req.body?.username !== undefined;
    const hasPassword = req.body?.password !== undefined;
    const hasCargo = req.body?.cargo !== undefined || req.body?.departamento !== undefined;
    const hasRol = req.body?.rol !== undefined;
    const hasActivo = req.body?.activo !== undefined;

    if (!hasNombre && !hasUsername && !hasPassword && !hasCargo && !hasRol && !hasActivo) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }

    const nombre = hasNombre ? asNonEmptyString(req.body?.nombre).replace(/\s+/g, ' ') : undefined;
    const username = hasUsername ? asNonEmptyString(req.body?.username).toLowerCase() : undefined;
    const password = hasPassword ? asNonEmptyString(req.body?.password) : undefined;
    const cargoInput = req.body?.cargo !== undefined ? req.body?.cargo : req.body?.departamento;
    const rol = hasRol ? normalizeUserRole(req.body?.rol) : undefined;
    const activo = hasActivo ? req.body?.activo : undefined;
    const { usuario } = getRequestActor(req);

    if (hasNombre && !nombre) {
      return res.status(400).json({ error: 'Nombre invalido.' });
    }
    if (hasUsername) {
      if (!username) return res.status(400).json({ error: 'Usuario invalido.' });
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'El usuario debe tener 3 a 32 caracteres (a-z, 0-9, ., _, -).' });
      }
    }
    if (hasPassword && password && password.length < 6) {
      return res.status(400).json({ error: 'El password debe tener al menos 6 caracteres.' });
    }
    if (hasCargo && !asNonEmptyString(cargoInput)) {
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (hasRol && !rol) {
      return res.status(400).json({ error: 'Rol invalido.' });
    }
    if (hasActivo && typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El estado activo debe ser booleano.' });
    }

    const updated = await updateDb((db) => {
      const user = db.users.find((item) => Number(item.id) === Number(id));
      if (!user) return { ok: false, code: 'NOT_FOUND' };
      const catalogs = getCatalogsFromDb(db);
      const nextCargo = hasCargo ? normalizeUserCargo(cargoInput, catalogs.cargos) : user.departamento;
      if (hasCargo && !nextCargo) return { ok: false, code: 'INVALID_CARGO' };

      const isSelf = Number(req.authUser?.id) === Number(user.id);
      const nextRol = rol || user.rol;
      if (!roleIsEnabledByCatalog(db, nextRol)) return { ok: false, code: 'ROLE_DISABLED' };
      const nextActivo = hasActivo ? activo : user.activo !== false;

      if (isSelf && (nextActivo === false || nextRol !== 'admin')) {
        return { ok: false, code: 'SELF_ADMIN_GUARD' };
      }

      const willDropAdmin = user.rol === 'admin' && user.activo !== false && (nextRol !== 'admin' || nextActivo === false);
      if (willDropAdmin && countActiveAdmins(db.users, user.id) === 0) {
        return { ok: false, code: 'LAST_ADMIN' };
      }

      if (username) {
        const duplicated = db.users.some(
          (item) => Number(item.id) !== Number(user.id) && String(item.username).toLowerCase() === username,
        );
        if (duplicated) return { ok: false, code: 'DUPLICATE' };
      }

      if (nombre) user.nombre = nombre;
      if (username) user.username = username;
      if (hasCargo) user.departamento = nextCargo;
      if (rol) user.rol = rol;
      if (hasActivo) user.activo = activo;
      if (password) {
        user.passwordHash = createUserPasswordHash(password);
        revokeSessionsByUserId(user.id);
      }

      if (hasActivo && activo === false) {
        revokeSessionsByUserId(user.id);
      }

      pushAuditWithContext(db, req, {
        accion: hasActivo ? (activo ? 'Activacion Usuario' : 'Desactivacion Usuario') : 'Edicion Usuario',
        item: `${user.username} | ${user.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: user.id,
        after: sanitizeUser(user),
      });
      return { ok: true, user };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'El usuario ya existe.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_CARGO') {
      return res.status(400).json({ error: 'Cargo invalido.' });
    }
    if (!updated?.ok && updated?.code === 'ROLE_DISABLED') {
      return res.status(400).json({ error: 'Rol deshabilitado en catalogo.' });
    }
    if (!updated?.ok && updated?.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
    }
    if (!updated?.ok && updated?.code === 'SELF_ADMIN_GUARD') {
      return res.status(409).json({ error: 'No puedes desactivarte ni quitarte el rol administrador.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el usuario.' });
    }

    res.json(sanitizeUser(updated.user));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    const { usuario } = getRequestActor(req);

    const removed = await updateDb((db) => {
      const index = db.users.findIndex((item) => Number(item.id) === Number(id));
      if (index < 0) return { ok: false, code: 'NOT_FOUND' };

      const target = db.users[index];
      if (Number(req.authUser?.id) === Number(target.id)) {
        return { ok: false, code: 'SELF_DELETE' };
      }

      if (target.rol === 'admin' && target.activo !== false && countActiveAdmins(db.users, target.id) === 0) {
        return { ok: false, code: 'LAST_ADMIN' };
      }

      db.users.splice(index, 1);
      revokeSessionsByUserId(target.id);
      pushAuditWithContext(db, req, {
        accion: 'Baja Usuario',
        item: `${target.username} | ${target.departamento || 'SIN CARGO'}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'usuario',
        entidadId: target.id,
        before: sanitizeUser(target),
      });
      return { ok: true };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador activo.' });
    }
    if (!removed?.ok && removed?.code === 'SELF_DELETE') {
      return res.status(409).json({ error: 'No puedes eliminar tu propio usuario.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = asNonEmptyString(req.body?.username).toLowerCase();
    const password = asNonEmptyString(req.body?.password);

    if (!username || !password) {
      await writeSecurityAudit(req, {
        accion: 'Login Fallido',
        item: username || 'N/A',
        cantidad: 1,
        resultado: 'error',
        motivo: 'Credenciales incompletas',
        username,
      });
      return res.status(400).json({ error: 'Usuario y password son requeridos.' });
    }
    const throttle = getLoginThrottle(req, username);
    if (throttle) {
      await writeSecurityAudit(req, {
        accion: 'Login Bloqueado',
        item: username,
        cantidad: 1,
        resultado: 'error',
        motivo: 'Throttle de intentos',
        username,
        meta: { retryAfterSec: throttle.retryAfterSec },
      });
      return res.status(429).json({
        error: 'Demasiados intentos de inicio de sesion. Intenta mas tarde.',
        retryAfterSec: throttle.retryAfterSec,
      });
    }

    const db = await readDb();
    const user = db.users.find(
      (u) =>
        u.activo !== false
        && String(u.username).toLowerCase() === username
        && verifyUserPassword(u, password),
    );

    if (!user) {
      const failed = registerLoginFailure(req, username);
      if (failed.locked) {
        await writeSecurityAudit(req, {
          accion: 'Login Bloqueado',
          item: username,
          cantidad: 1,
          resultado: 'error',
          motivo: 'Cuenta bloqueada por intentos fallidos',
          username,
          meta: { retryAfterSec: failed.retryAfterSec },
        });
        return res.status(429).json({
          error: 'Cuenta temporalmente bloqueada por intentos fallidos.',
          retryAfterSec: failed.retryAfterSec,
        });
      }
      await writeSecurityAudit(req, {
        accion: 'Login Fallido',
        item: username,
        cantidad: 1,
        resultado: 'error',
        motivo: 'Credenciales invalidas',
        username,
      });
      return res.status(401).json({ error: 'Credenciales invalidas.' });
    }
    if (!roleIsEnabledByCatalog(db, user.rol)) {
      await writeSecurityAudit(req, {
        accion: 'Login Rechazado',
        item: username,
        cantidad: 1,
        resultado: 'error',
        motivo: 'Rol deshabilitado',
        userId: user.id,
        username: user.username,
        rol: user.rol,
        departamento: user.departamento,
      });
      return res.status(403).json({ error: 'Tu rol esta deshabilitado en catalogo.' });
    }
    if (DISALLOW_DEMO_PASSWORDS && isDemoPasswordUser(user)) {
      await writeSecurityAudit(req, {
        accion: 'Login Rechazado',
        item: username,
        cantidad: 1,
        resultado: 'error',
        motivo: 'Password demo deshabilitado',
        userId: user.id,
        username: user.username,
        rol: user.rol,
        departamento: user.departamento,
      });
      return res.status(403).json({
        error: 'Credencial de demo deshabilitada. Solicita cambio de password al administrador.',
      });
    }

    clearLoginFailures(req, username);
    const token = registerSession(user);
    await writeSecurityAudit(req, {
      accion: 'Login Exitoso',
      item: user.username,
      cantidad: 1,
      resultado: 'ok',
      userId: user.id,
      username: user.username,
      rol: user.rol,
      departamento: user.departamento,
      meta: { tokenIssued: true },
    });
    res.json({
      user: sanitizeUser(user),
      token,
      loggedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const actor = getRequestActor(req);
    if (req.authToken) authSessions.delete(req.authToken);
    await writeSecurityAudit(req, {
      accion: 'Logout',
      item: actor.username || actor.usuario || 'N/A',
      cantidad: 1,
      resultado: 'ok',
      userId: actor.userId,
      username: actor.username,
      rol: actor.rol,
      departamento: actor.departamento,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/bootstrap', requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const rol = req.authUser?.rol || '';
    const requesterOnly = rol === 'solicitante';
    const users = buildBootstrapUsers(db.users, rol);
    const riskSummary = summarizeAssetRisks(db.activos);
    const visibleTickets = filterTicketsForUser(db.tickets, req.authUser);

    res.json({
      activos: requesterOnly ? [] : db.activos.map((asset) => stripSensitiveAssetFields(asset, rol)),
      insumos: requesterOnly ? [] : db.insumos.filter(isSupplyActive),
      tickets: visibleTickets.map(serializeTicket),
      auditoria: requesterOnly ? [] : db.auditoria,
      users: requesterOnly ? [] : users,
      catalogos: getCatalogsFromDb(db),
      riskSummary: requesterOnly ? undefined : riskSummary,
      ticketStates: TICKET_STATES,
      slaPolicyHours: SLA_HOURS,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/activos/riesgos', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar riesgos de activos.' });
    }
    const db = await readDb();
    res.json({
      ...summarizeAssetRisks(db.activos),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/summary', requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const requesterOnly = req.authUser?.rol === 'solicitante';
    const ticketsSource = requesterOnly ? filterTicketsForUser(db.tickets, req.authUser) : db.tickets;
    const activosOperativos = db.activos.filter((a) => a.estado === 'Operativo').length;
    const stockBajo = db.insumos.filter((i) => isLowStock(i)).length;
    const ticketsAbiertosRows = ticketsSource.filter((t) => !CLOSED_STATES.has(t.estado));
    const ticketsAbiertos = ticketsAbiertosRows.length;
    const ticketsSlaVencido = ticketsAbiertosRows.filter((t) => isSlaBreached(t)).length;
    const salud = requesterOnly
      ? 100
      : db.activos.length > 0 ? Math.round((activosOperativos / db.activos.length) * 100) : 100;
    const catalogos = getCatalogsFromDb(db);

    const countBy = (rows, valueResolver) => {
      const map = new Map();
      rows.forEach((row) => {
        const key = asNonEmptyString(valueResolver(row)) || 'SIN DATO';
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value }));
    };
    const branchLabelByCode = new Map(
      catalogos.sucursales.map((branch) => [branch.code, `${branch.code} - ${branch.name}`]),
    );
    const ticketsPorSucursal = countBy(
      ticketsAbiertosRows,
      (ticket) => branchLabelByCode.get(asNonEmptyString(ticket.sucursal).toUpperCase()) || 'SIN SUCURSAL',
    );
    const ticketsPorTecnico = countBy(
      ticketsAbiertosRows.filter((ticket) => asNonEmptyString(ticket.asignadoA)),
      (ticket) => ticket.asignadoA,
    );
    const ticketsPorCargo = countBy(
      ticketsAbiertosRows.filter((ticket) => asNonEmptyString(ticket.departamento)),
      (ticket) => ticket.departamento,
    );

    res.json({
      totalActivos: requesterOnly ? 0 : db.activos.length,
      activosOperativos: requesterOnly ? 0 : activosOperativos,
      stockBajo: requesterOnly ? 0 : stockBajo,
      ticketsAbiertos,
      ticketsSlaVencido,
      salud,
      kpi: {
        ticketsPorSucursal,
        ticketsPorTecnico,
        ticketsPorCargo,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/activos', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar inventario.' });
    }
    const db = await readDb();
    const role = req.authUser?.rol || '';
    const search = normalizeTextKey(req.query.search || '');
    const estado = asNonEmptyString(req.query.estado);
    const departamento = normalizeTextKey(req.query.departamento || '');
    const tipo = normalizeTextKey(req.query.tipo || '');
    const risk = asNonEmptyString(req.query.risk).toUpperCase();
    const withPagination = req.query.page !== undefined || req.query.pageSize !== undefined;

    let list = db.activos
      .map((asset) => stripSensitiveAssetFields(asset, role))
      .slice();

    if (estado) {
      list = list.filter((asset) => asNonEmptyString(asset.estado).toLowerCase() === estado.toLowerCase());
    }
    if (departamento) {
      list = list.filter((asset) => normalizeTextKey(asset.departamento || '') === departamento);
    }
    if (tipo) {
      list = list.filter((asset) => normalizeTextKey(asset.tipo || asset.equipo || '') === tipo);
    }
    if (search) {
      list = list.filter((asset) => {
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
        return fields.some((value) => normalizeTextKey(value || '').includes(search));
      });
    }

    if (risk) {
      const ipCount = new Map();
      const macCount = new Map();
      list.forEach((asset) => {
        const ip = asNonEmptyString(asset.ipAddress);
        const mac = asNonEmptyString(asset.macAddress).toLowerCase();
        if (ip) ipCount.set(ip, (ipCount.get(ip) || 0) + 1);
        if (mac) macCount.set(mac, (macCount.get(mac) || 0) + 1);
      });

      if (risk === 'SIN_IP') list = list.filter((asset) => !asNonEmptyString(asset.ipAddress));
      if (risk === 'SIN_MAC') list = list.filter((asset) => !asNonEmptyString(asset.macAddress));
      if (risk === 'SIN_RESP') list = list.filter((asset) => !asNonEmptyString(asset.responsable));
      if (risk === 'VIDA_ALTA') list = list.filter((asset) => {
        const years = parseAssetLifeYears(asset.aniosVida);
        return years !== null && years >= 4;
      });
      if (risk === 'DUP_RED') {
        list = list.filter((asset) => {
          const ip = asNonEmptyString(asset.ipAddress);
          const mac = asNonEmptyString(asset.macAddress).toLowerCase();
          return (ip && (ipCount.get(ip) || 0) > 1) || (mac && (macCount.get(mac) || 0) > 1);
        });
      }
    }

    list.sort((left, right) => normalizeTextKey(left.tag).localeCompare(normalizeTextKey(right.tag)));

    if (!withPagination) {
      return res.json(list);
    }

    const { page, pageSize } = parsePagination(req.query);
    const paged = paginateList(list, page, pageSize);
    return res.json(paged);
  } catch (error) {
    next(error);
  }
});

app.get('/api/activos/:id/qr-token', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para generar QR de activos.' });
    }
    const id = toInt(req.params.id);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const db = await readDb();
    const asset = db.activos.find((item) => Number(item.id) === Number(id));
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado.' });

    const signed = buildSignedAssetQrToken(asset);
    return res.json({
      token: signed.token,
      scheme: signed.scheme,
      assetId: signed.payload.aid,
      issuedAt: new Date(signed.payload.iat * 1000).toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/qr/resolve/:token', requireAuth, async (req, res, next) => {
  try {
    const verified = verifySignedAssetQrToken(req.params.token);
    if (!verified.ok) {
      return res.status(400).json({ error: 'QR invalido o manipulado.' });
    }

    const db = await readDb();
    const asset = db.activos.find((item) => Number(item.id) === Number(verified.payload.aid));
    if (!asset) return res.status(404).json({ error: 'Activo no encontrado para este QR.' });

    return res.json({
      ok: true,
      verified: true,
      scheme: QR_TOKEN_SCHEME,
      token: {
        version: verified.payload.v,
        type: verified.payload.t,
        assetId: verified.payload.aid,
        issuedAt: new Date(verified.payload.iat * 1000).toISOString(),
      },
      asset: buildAssetQrLookupResponse(asset),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/activos', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const { usuario } = getRequestActor(req);

    const parsed = normalizeAssetPayload(req.body, { mode: 'create' });
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.errors.join('. ') || 'Campos requeridos incompletos para activo.' });
    }
    const normalized = finalizeAsset(parsed.item);

    const created = await updateDb((db) => {
      const indexes = buildAssetIndexes(db.activos);
      const conflicts = findAssetConflicts(indexes, normalized, null);
      if (conflicts.length > 0) {
        return { ok: false, code: 'CONFLICT', fields: conflicts };
      }

      const nuevo = { id: nextId(db), ...normalized };
      db.activos.push(nuevo);
      pushAuditWithContext(db, req, {
        accion: 'Alta Activo',
        item: nuevo.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: nuevo.id,
        after: nuevo,
      });
      return { ok: true, item: nuevo };
    });

    if (!created?.ok && created?.code === 'CONFLICT') {
      return res.status(409).json({ error: `Activo duplicado por: ${created.fields.join(', ')}` });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo registrar el activo.' });
    }
    res.status(201).json(created.item);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/activos/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const parsed = normalizeAssetPayload(req.body, { mode: 'create' });
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.errors.join('. ') || 'Campos requeridos incompletos para activo.' });
    }
    const normalized = finalizeAsset(parsed.item);

    const updated = await updateDb((db) => {
      const idx = db.activos.findIndex((item) => Number(item.id) === Number(id));
      if (idx < 0) return { ok: false, code: 'NOT_FOUND' };

      const indexes = buildAssetIndexes(db.activos);
      const conflicts = findAssetConflicts(indexes, normalized, id);
      if (conflicts.length > 0) {
        return { ok: false, code: 'CONFLICT', fields: conflicts };
      }

      const nextItem = { ...db.activos[idx], ...normalized, id };
      db.activos[idx] = nextItem;
      pushAuditWithContext(db, req, {
        accion: 'Edicion Activo',
        item: nextItem.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: nextItem.id,
        after: nextItem,
      });
      return { ok: true, item: nextItem };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Activo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'CONFLICT') {
      return res.status(409).json({ error: `Activo duplicado por: ${updated.fields.join(', ')}` });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el activo.' });
    }

    return res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

app.post('/api/activos/import', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const { usuario } = getRequestActor(req);
    const fileName = asNonEmptyString(req.body?.fileName) || 'Importacion Excel';
    const dryRun = req.body?.dryRun === true;
    const upsert = req.body?.upsert !== false;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (items.length === 0) {
      return res.status(400).json({ error: 'No hay filas para importar.' });
    }
    if (items.length > IMPORT_MAX_ROWS) {
      return res.status(413).json({ error: `La importacion excede el maximo permitido (${IMPORT_MAX_ROWS} filas).` });
    }
    if (items.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      return res.status(400).json({ error: 'Formato de filas invalido para importacion.' });
    }

    if (dryRun) {
      const db = await readDb();
      const previewDb = JSON.parse(JSON.stringify(db));
      const report = importAssets(previewDb, {
        items,
        upsert,
        usuario,
        fileName,
        persist: false,
        auditReq: req,
      });
      return res.json({ ...report, dryRun: true });
    }

    const result = await updateDb((db) =>
      importAssets(db, {
        items,
        upsert,
        usuario,
        fileName,
        persist: true,
        auditReq: req,
      }),
    );

    return res.json({ ...result, dryRun: false });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/activos', requireAuth, async (req, res, next) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const { usuario } = getRequestActor(req);

    const result = await updateDb((db) => {
      const removedCount = Array.isArray(db.activos) ? db.activos.length : 0;
      if (removedCount > 0) {
        db.activos = [];
        pushAuditWithContext(db, req, {
          accion: 'Borrado Masivo Activos',
          item: 'Inventario completo',
          cantidad: removedCount,
          usuario,
          modulo: 'activos',
          entidad: 'activo',
          meta: { removedCount },
        });
      }
      return { removedCount };
    });

    res.json({ ok: true, removedCount: Number(result?.removedCount || 0) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/activos/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const removed = await updateDb((db) => {
      const idx = db.activos.findIndex((a) => a.id === id);
      if (idx < 0) return null;
      const [activo] = db.activos.splice(idx, 1);
      pushAuditWithContext(db, req, {
        accion: 'Baja Activo',
        item: activo.tag,
        cantidad: 1,
        usuario,
        modulo: 'activos',
        entidad: 'activo',
        entidadId: activo.id,
        before: activo,
      });
      return activo;
    });

    if (!removed) return res.status(404).json({ error: 'Activo no encontrado.' });
    res.json({ ok: true, removed });
  } catch (error) {
    next(error);
  }
});

app.post('/api/insumos', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const nombre = asNonEmptyString(req.body?.nombre);
    const unidad = asNonEmptyString(req.body?.unidad) || 'Piezas';
    const categoria = (asNonEmptyString(req.body?.categoria) || 'HARDWARE').toUpperCase();
    const stock = toInt(req.body?.stock);
    const min = toInt(req.body?.min);
    const { usuario } = getRequestActor(req);

    if (!nombre || stock === null || min === null) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para insumo.' });
    }
    if (stock < 0 || min < 0) {
      return res.status(400).json({ error: 'Stock y minimo deben ser mayores o iguales a 0.' });
    }
    if (min > stock) {
      return res.status(400).json({ error: 'El minimo no puede ser mayor al stock inicial.' });
    }

    const result = await updateDb((db) => {
      const exists = db.insumos.find(
        (item) =>
          isSupplyActive(item) &&
          normalizeTextKey(item.nombre) === normalizeTextKey(nombre) &&
          normalizeTextKey(item.categoria) === normalizeTextKey(categoria),
      );
      if (exists) {
        return { ok: false, code: 'DUPLICATE' };
      }

      const nuevo = {
        id: nextId(db),
        nombre,
        unidad,
        stock,
        min,
        categoria,
        activo: true,
      };
      db.insumos.push(nuevo);
      pushAuditWithContext(db, req, {
        accion: 'Registro Nuevo',
        item: nombre,
        cantidad: stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: nuevo.id,
        after: nuevo,
      });
      return { ok: true, item: nuevo };
    });

    if (!result?.ok && result?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'Ya existe un insumo activo con ese nombre y categoria.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo registrar el insumo.' });
    }
    res.status(201).json(result.item);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/insumos/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const nombre = asNonEmptyString(req.body?.nombre);
    const unidad = asNonEmptyString(req.body?.unidad) || 'Piezas';
    const categoria = (asNonEmptyString(req.body?.categoria) || 'HARDWARE').toUpperCase();
    const stock = toInt(req.body?.stock);
    const min = toInt(req.body?.min);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    if (!nombre || stock === null || min === null) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para insumo.' });
    }
    if (stock < 0 || min < 0) {
      return res.status(400).json({ error: 'Stock y minimo deben ser mayores o iguales a 0.' });
    }
    if (min > stock) {
      return res.status(400).json({ error: 'El minimo no puede ser mayor al stock.' });
    }

    const updated = await updateDb((db) => {
      const idx = db.insumos.findIndex((item) => Number(item.id) === Number(id));
      if (idx < 0) return { ok: false, code: 'NOT_FOUND' };

      const current = db.insumos[idx];
      if (!isSupplyActive(current)) return { ok: false, code: 'INACTIVE' };

      const exists = db.insumos.find(
        (item) =>
          Number(item.id) !== Number(id) &&
          isSupplyActive(item) &&
          normalizeTextKey(item.nombre) === normalizeTextKey(nombre) &&
          normalizeTextKey(item.categoria) === normalizeTextKey(categoria),
      );
      if (exists) return { ok: false, code: 'DUPLICATE' };

      const before = { ...current };
      const nextItem = {
        ...current,
        nombre,
        unidad,
        stock,
        min,
        categoria,
      };
      db.insumos[idx] = nextItem;
      pushAuditWithContext(db, req, {
        accion: 'Edicion Insumo',
        item: nextItem.nombre,
        cantidad: nextItem.stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: nextItem.id,
        before,
        after: nextItem,
      });
      return { ok: true, item: nextItem };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo esta dado de baja y no se puede editar.' });
    }
    if (!updated?.ok && updated?.code === 'DUPLICATE') {
      return res.status(409).json({ error: 'Ya existe un insumo activo con ese nombre y categoria.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el insumo.' });
    }
    return res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/insumos/:id/stock', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const delta = toInt(req.body?.delta);
    const stockInput = toInt(req.body?.stock);
    if (delta === null && stockInput === null) {
      return res.status(400).json({ error: 'Debes enviar delta o stock.' });
    }
    if (stockInput !== null && stockInput < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo.' });
    }

    const updated = await updateDb((db) => {
      const item = db.insumos.find((i) => i.id === id);
      if (!item) return { ok: false, code: 'NOT_FOUND' };
      if (!isSupplyActive(item)) return { ok: false, code: 'INACTIVE' };

      const current = item.stock;
      const nextStock = stockInput !== null ? Math.max(0, stockInput) : Math.max(0, current + delta);
      const diff = nextStock - current;
      if (diff === 0) return { ok: true, item };

      item.stock = nextStock;
      const accion = stockInput !== null
        ? diff > 0 ? 'Ajuste Entrada' : 'Ajuste Salida'
        : diff > 0 ? 'Entrada' : 'Salida';
      pushAuditWithContext(db, req, {
        accion,
        item: item.nombre,
        cantidad: Math.abs(diff),
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: item.id,
        after: item,
        meta: { previousStock: current, nextStock },
      });
      return { ok: true, item };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo esta dado de baja y no se puede editar.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el stock.' });
    }
    res.json(updated.item);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/insumos/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const removed = await updateDb((db) => {
      const item = db.insumos.find((i) => i.id === id);
      if (!item) return { ok: false, code: 'NOT_FOUND' };
      if (!isSupplyActive(item)) return { ok: false, code: 'INACTIVE' };
      item.activo = false;
      pushAuditWithContext(db, req, {
        accion: 'Baja Logica',
        item: item.nombre,
        cantidad: item.stock,
        usuario,
        modulo: 'insumos',
        entidad: 'insumo',
        entidadId: item.id,
        after: item,
      });
      return { ok: true, item };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Insumo no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'INACTIVE') {
      return res.status(409).json({ error: 'El insumo ya estaba dado de baja.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo dar de baja el insumo.' });
    }
    res.json({ ok: true, deactivated: removed.item });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const activoTag = asNonEmptyString(req.body?.activoTag);
    const descripcion = asNonEmptyString(req.body?.descripcion);
    const sucursalInput = req.body?.sucursal;
    const prioridad = normalizePrioridad(req.body?.prioridad);
    const atencionTipo = normalizeTicketAttentionType(req.body?.atencionTipo);
    const asignadoA = canEditByRole(req.authUser?.rol) ? asNonEmptyString(req.body?.asignadoA) : '';
    const { usuario, departamento } = getRequestActor(req);

    if (!activoTag || !descripcion || !asNonEmptyString(sucursalInput) || !atencionTipo) {
      return res.status(400).json({ error: 'Campos requeridos incompletos para ticket.' });
    }

    const created = await updateDb((db) => {
      const branchCodes = getBranchCodesFromCatalog(db);
      const sucursal = normalizeTicketBranch(sucursalInput, branchCodes);
      if (!sucursal) return { ok: false, code: 'INVALID_BRANCH' };
      let assignedUser = null;
      if (asignadoA) {
        assignedUser = findTicketAssignee(db.users, asignadoA);
        if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
      }

      const createdAtIso = new Date().toISOString();
      const ticket = {
        id: nextId(db),
        activoTag,
        descripcion,
        sucursal,
        prioridad,
        atencionTipo,
        estado: 'Abierto',
        fecha: now(),
        fechaCreacion: createdAtIso,
        fechaLimite: calcDueDate(prioridad),
        asignadoA: assignedUser ? assignedUser.nombre : '',
        solicitadoPor: usuario,
        solicitadoPorId: Number(req.authUser?.id) || null,
        solicitadoPorUsername: asNonEmptyString(req.authUser?.username).toLowerCase(),
        departamento,
        attachments: [],
        historial: [
          {
            fecha: now(),
            usuario,
            accion: 'Ticket Creado',
            estado: 'Abierto',
            comentario: 'Registro inicial',
          },
        ],
      };
      db.tickets.push(ticket);

      if (prioridad === 'CRITICA') {
        const activo = db.activos.find((a) => a.tag.toUpperCase() === activoTag.toUpperCase());
        if (activo) activo.estado = 'Falla';
      }

      pushAuditWithContext(db, req, {
        accion: 'Nuevo Ticket',
        item: `${activoTag} | ${sucursal} | ${atencionTipo}`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        after: ticket,
      });
      return { ok: true, ticket };
    });

    if (!created?.ok && created?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a invalido. Debe ser un tecnico/admin activo.' });
    }
    if (!created?.ok && created?.code === 'INVALID_BRANCH') {
      return res.status(400).json({ error: 'Sucursal invalida para el ticket.' });
    }
    if (!created?.ok) {
      return res.status(500).json({ error: 'No se pudo crear el ticket.' });
    }

    res.status(201).json(serializeTicket(created.ticket));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const estado = req.body?.estado ? normalizeEstadoTicket(req.body?.estado) : null;
    const asignadoA = req.body?.asignadoA !== undefined ? asNonEmptyString(req.body?.asignadoA) : undefined;
    const hasAtencionTipoUpdate = req.body?.atencionTipo !== undefined;
    const atencionTipo = hasAtencionTipoUpdate ? normalizeTicketAttentionType(req.body?.atencionTipo) : '';
    const comentario = asNonEmptyString(req.body?.comentario);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!estado && asignadoA === undefined && !comentario && !hasAtencionTipoUpdate) {
      return res.status(400).json({ error: 'No hay cambios para aplicar.' });
    }
    if (req.body?.estado && !estado) {
      return res.status(400).json({ error: 'Estado de ticket no valido.' });
    }
    if (hasAtencionTipoUpdate && !atencionTipo) {
      return res.status(400).json({ error: 'Tipo de atencion no valido.' });
    }

    const updated = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };

      let nextAssignee;
      if (asignadoA !== undefined) {
        if (!asignadoA) {
          nextAssignee = '';
        } else {
          const assignedUser = findTicketAssignee(db.users, asignadoA);
          if (!assignedUser) return { ok: false, code: 'ASSIGNEE_INVALID' };
          nextAssignee = assignedUser.nombre;
        }
      }

      const previousState = ticket.estado;
      const previousAttentionType = normalizeTicketAttentionType(ticket.atencionTipo);
      if (estado) ticket.estado = estado;
      if (nextAssignee !== undefined) ticket.asignadoA = nextAssignee;
      if (hasAtencionTipoUpdate) ticket.atencionTipo = atencionTipo;
      const attentionChanged = hasAtencionTipoUpdate && atencionTipo !== previousAttentionType;

      if (CLOSED_STATES.has(ticket.estado) && !ticket.fechaCierre) {
        ticket.fechaCierre = new Date().toISOString();
      }

      if (ticket.estado === 'Abierto' || ticket.estado === 'En Proceso') {
        const activo = db.activos.find((a) => a.tag.toUpperCase() === ticket.activoTag.toUpperCase());
        if (activo) activo.estado = 'Falla';
      }

      if (ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado') {
        const activo = db.activos.find((a) => a.tag.toUpperCase() === ticket.activoTag.toUpperCase());
        if (activo) activo.estado = 'Operativo';
      }

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: estado ? ticketAuditAction(ticket.estado) : attentionChanged ? 'Tipo Atencion Ticket' : 'Ticket Actualizado',
        estado: ticket.estado,
        comentario: comentario || '',
      });

      if (estado && estado !== previousState) {
        pushAuditWithContext(db, req, {
          accion: ticketAuditAction(estado),
          item: ticket.activoTag,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (asignadoA !== undefined) {
        pushAuditWithContext(db, req, {
          accion: 'Asignacion Ticket',
          item: ticket.activoTag,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }
      if (attentionChanged) {
        pushAuditWithContext(db, req, {
          accion: 'Tipo Atencion Ticket',
          item: `${ticket.activoTag} | ${atencionTipo}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          after: ticket,
        });
      }

      return { ok: true, ticket };
    });

    if (!updated?.ok && updated?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!updated?.ok && updated?.code === 'ASSIGNEE_INVALID') {
      return res.status(400).json({ error: 'Asignado a invalido. Debe ser un tecnico/admin activo.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudo actualizar el ticket.' });
    }
    res.json(serializeTicket(updated.ticket));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tickets/:id/resolve', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    const comentario = asNonEmptyString(req.body?.comentario) || 'Ticket resuelto';
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const resolved = await updateDb((db) => {
      const ticket = db.tickets.find((t) => t.id === id);
      if (!ticket) return null;

      ticket.estado = 'Resuelto';
      ticket.fechaCierre = ticket.fechaCierre || new Date().toISOString();
      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Ticket Resuelto',
        estado: 'Resuelto',
        comentario,
      });

      const activo = db.activos.find((a) => a.tag.toUpperCase() === ticket.activoTag.toUpperCase());
      if (activo) activo.estado = 'Operativo';
      pushAuditWithContext(db, req, {
        accion: 'Ticket Resuelto',
        item: ticket.activoTag,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        after: ticket,
      });
      return ticket;
    });

    if (!resolved) return res.status(404).json({ error: 'Ticket no encontrado.' });
    res.json(serializeTicket(resolved));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });

    const removed = await updateDb((db) => {
      const index = db.tickets.findIndex((item) => Number(item.id) === Number(id));
      if (index < 0) return { ok: false, code: 'NOT_FOUND' };

      const ticket = db.tickets[index];
      const role = req.authUser?.rol || '';
      const isEditor = canEditByRole(role);
      const isTicketOwnerRequester = role === 'solicitante' && ticketBelongsToUser(ticket, req.authUser);
      if (!isEditor && !isTicketOwnerRequester) return { ok: false, code: 'FORBIDDEN' };
      if (isTicketOwnerRequester && ticket.estado !== 'Abierto') return { ok: false, code: 'LOCKED' };

      const [deleted] = db.tickets.splice(index, 1);
      const attachmentPaths = Array.isArray(deleted.attachments)
        ? deleted.attachments
          .map((item) => asNonEmptyString(item?.storagePath))
          .filter(Boolean)
        : [];

      const hadOpenTicketState = deleted.estado === 'Abierto' || deleted.estado === 'En Proceso';
      if (hadOpenTicketState) {
        const hasRelatedOpenTickets = db.tickets.some((item) => (
          normalizeTextKey(item?.activoTag) === normalizeTextKey(deleted.activoTag)
          && (item.estado === 'Abierto' || item.estado === 'En Proceso')
        ));
        if (!hasRelatedOpenTickets) {
          const activo = db.activos.find((item) => normalizeTextKey(item?.tag) === normalizeTextKey(deleted.activoTag));
          if (activo) activo.estado = 'Operativo';
        }
      }

      pushAuditWithContext(db, req, {
        accion: 'Ticket Eliminado',
        item: `${deleted.activoTag} | #${deleted.id}`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: deleted.id,
        before: deleted,
      });
      return { ok: true, ticket: deleted, attachmentPaths };
    });

    if (!removed?.ok && removed?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!removed?.ok && removed?.code === 'FORBIDDEN') {
      return res.status(403).json({ error: 'No autorizado para eliminar este ticket.' });
    }
    if (!removed?.ok && removed?.code === 'LOCKED') {
      return res.status(409).json({ error: 'Solo puedes eliminar tickets abiertos creados por ti.' });
    }
    if (!removed?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el ticket.' });
    }

    for (const path of removed.attachmentPaths) {
      const absPath = toAbsoluteAttachmentPath(path);
      if (absPath) {
        await fs.unlink(absPath).catch(() => undefined);
      }
    }

    res.json({ ok: true, removedId: removed.ticket.id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets/:id/comments', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const id = toInt(req.params.id);
    const comentario = asNonEmptyString(req.body?.comentario);
    const { usuario } = getRequestActor(req);
    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!comentario) return res.status(400).json({ error: 'Comentario requerido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      if (!canAccessTicketByAuthUser(req, ticket)) return { ok: false, code: 'FORBIDDEN' };

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Comentario',
        estado: ticket.estado,
        comentario,
      });

      pushAuditWithContext(db, req, {
        accion: 'Comentario Ticket',
        item: ticket.activoTag,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        meta: { comentario },
      });
      return { ok: true, ticket };
    });

    if (!result?.ok && result?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!result?.ok && result?.code === 'FORBIDDEN') {
      return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo guardar el comentario.' });
    }
    res.status(201).json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tickets/:id/attachments', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanCreateTickets(req, res)) return;
    const id = toInt(req.params.id);
    const fileName = sanitizeUploadFileName(req.body?.fileName);
    const mimeType = asNonEmptyString(req.body?.mimeType || req.body?.contentType) || 'application/octet-stream';
    const contentBase64 = asNonEmptyString(req.body?.contentBase64);
    const { usuario } = getRequestActor(req);

    if (id === null) return res.status(400).json({ error: 'ID invalido.' });
    if (!fileName || !contentBase64) {
      return res.status(400).json({ error: 'fileName y contentBase64 son requeridos.' });
    }

    let contentBuffer;
    try {
      contentBuffer = Buffer.from(contentBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Adjunto en base64 invalido.' });
    }
    if (!contentBuffer || contentBuffer.length === 0) {
      return res.status(400).json({ error: 'Adjunto vacio.' });
    }
    if (contentBuffer.length > TICKET_ATTACHMENT_MAX_BYTES) {
      return res.status(413).json({ error: `Adjunto excede limite de ${Math.round(TICKET_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB.` });
    }

    await ensureUploadDir();
    const storedName = `tk_${id}_${Date.now()}_${randomUUID()}_${fileName}`;
    const storagePath = path.join('uploads', storedName).replace(/\\/g, '/');
    const absPath = toAbsoluteAttachmentPath(storagePath);
    if (!absPath) {
      return res.status(500).json({ error: 'No se pudo preparar almacenamiento del adjunto.' });
    }

    let fileSaved = false;
    let persisted = false;
    try {
      await fs.writeFile(absPath, contentBuffer);
      fileSaved = true;

      const result = await updateDb((db) => {
        const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
        if (!ticket) return { ok: false, code: 'NOT_FOUND' };
        if (!canAccessTicketByAuthUser(req, ticket)) return { ok: false, code: 'FORBIDDEN' };

        ticket.attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
        if (ticket.attachments.length >= TICKET_ATTACHMENT_MAX_COUNT) {
          return { ok: false, code: 'MAX_ATTACHMENTS' };
        }

        const attachmentId = nextId(db);
        const attachment = {
          id: attachmentId,
          fileName,
          storagePath,
          mimeType,
          size: contentBuffer.length,
          uploadedAt: new Date().toISOString(),
          uploadedBy: usuario,
        };

        ticket.attachments.unshift(attachment);
        ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
        ticket.historial.unshift({
          fecha: now(),
          usuario,
          accion: 'Adjunto agregado',
          estado: ticket.estado,
          comentario: fileName,
        });

        pushAuditWithContext(db, req, {
          accion: 'Adjunto Ticket',
          item: `${ticket.activoTag} | ${fileName}`,
          cantidad: 1,
          usuario,
          modulo: 'tickets',
          entidad: 'ticket',
          entidadId: ticket.id,
          meta: { attachmentName: fileName, size: contentBuffer.length },
        });

        return { ok: true, ticket, attachment };
      });

      if (!result?.ok && result?.code === 'NOT_FOUND') {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }
      if (!result?.ok && result?.code === 'FORBIDDEN') {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
      }
      if (!result?.ok && result?.code === 'MAX_ATTACHMENTS') {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(409).json({ error: `Limite de ${TICKET_ATTACHMENT_MAX_COUNT} adjuntos por ticket alcanzado.` });
      }
      if (!result?.ok) {
        if (fileSaved) await fs.unlink(absPath).catch(() => undefined);
        return res.status(500).json({ error: 'No se pudo guardar el adjunto.' });
      }

      persisted = true;
      return res.status(201).json({
        attachment: buildTicketAttachmentResponse(result.attachment),
        ticket: serializeTicket(result.ticket),
      });
    } catch (error) {
      if (fileSaved && !persisted) {
        await fs.unlink(absPath).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets/:id/attachments/:attachmentId/download', requireAuth, async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID invalido.' });

    const db = await readDb();
    const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!canAccessTicketByAuthUser(req, ticket)) {
      return res.status(403).json({ error: 'No autorizado para acceder a este ticket.' });
    }
    const attachment = Array.isArray(ticket.attachments)
      ? ticket.attachments.find((item) => Number(item.id) === Number(attachmentId))
      : null;
    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado.' });

    const absPath = toAbsoluteAttachmentPath(attachment.storagePath);
    if (!absPath) return res.status(404).json({ error: 'Ruta de adjunto invalida.' });
    let content;
    try {
      content = await fs.readFile(absPath);
    } catch {
      return res.status(404).json({ error: 'Archivo adjunto no disponible.' });
    }

    const fileName = sanitizeUploadFileName(attachment.fileName || `adjunto_${attachmentId}`);
    res.setHeader('Content-Type', asNonEmptyString(attachment.mimeType) || 'application/octet-stream');
    res.setHeader('Content-Length', String(content.length));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tickets/:id/attachments/:attachmentId', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;
    const id = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId);
    const { usuario } = getRequestActor(req);
    if (id === null || attachmentId === null) return res.status(400).json({ error: 'ID invalido.' });

    const result = await updateDb((db) => {
      const ticket = db.tickets.find((item) => Number(item.id) === Number(id));
      if (!ticket) return { ok: false, code: 'NOT_FOUND' };
      ticket.attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
      const index = ticket.attachments.findIndex((item) => Number(item.id) === Number(attachmentId));
      if (index < 0) return { ok: false, code: 'ATTACHMENT_NOT_FOUND' };

      const [attachment] = ticket.attachments.splice(index, 1);

      ticket.historial = Array.isArray(ticket.historial) ? ticket.historial : [];
      ticket.historial.unshift({
        fecha: now(),
        usuario,
        accion: 'Adjunto eliminado',
        estado: ticket.estado,
        comentario: attachment.fileName,
      });

      pushAuditWithContext(db, req, {
        accion: 'Adjunto Ticket',
        item: `${ticket.activoTag} | ${attachment.fileName} | eliminado`,
        cantidad: 1,
        usuario,
        modulo: 'tickets',
        entidad: 'ticket',
        entidadId: ticket.id,
        meta: { attachmentName: attachment.fileName, removed: true },
      });
      return { ok: true, ticket, removedStoragePath: attachment.storagePath };
    });

    if (!result?.ok && result?.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    if (!result?.ok && result?.code === 'ATTACHMENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Adjunto no encontrado.' });
    }
    if (!result?.ok) {
      return res.status(500).json({ error: 'No se pudo eliminar el adjunto.' });
    }
    const absPath = toAbsoluteAttachmentPath(result.removedStoragePath);
    if (absPath) {
      await fs.unlink(absPath).catch(() => undefined);
    }
    res.json(serializeTicket(result.ticket));
  } catch (error) {
    next(error);
  }
});

app.get('/api/tickets', requireAuth, async (req, res, next) => {
  try {
    const db = await readDb();
    const estado = req.query.estado ? normalizeEstadoTicket(req.query.estado) : null;
    const prioridad = req.query.prioridad ? normalizePrioridad(req.query.prioridad) : null;
    const atencionTipo = req.query.atencion !== undefined ? normalizeTicketAttentionType(req.query.atencion) : '';
    const onlyOpen = req.query.open === '1';
    const onlySla = req.query.sla === 'vencido';
    const lifecycle = asNonEmptyString(req.query.lifecycle).toUpperCase();
    const sucursal = asNonEmptyString(req.query.sucursal).toUpperCase();
    const assignee = asNonEmptyString(req.query.assignee);
    const search = normalizeTextKey(req.query.search || '');
    const withPagination = req.query.page !== undefined || req.query.pageSize !== undefined;
    if (req.query.atencion !== undefined && !atencionTipo) {
      return res.status(400).json({ error: 'Filtro de atencion invalido.' });
    }

    let list = filterTicketsForUser(db.tickets.slice(), req.authUser);
    if (estado) list = list.filter((t) => t.estado === estado);
    if (prioridad) list = list.filter((t) => t.prioridad === prioridad);
    if (atencionTipo) list = list.filter((t) => normalizeTicketAttentionType(t.atencionTipo) === atencionTipo);
    if (onlyOpen) list = list.filter((t) => !CLOSED_STATES.has(t.estado));
    if (onlySla) list = list.filter((t) => isSlaBreached(t));
    if (lifecycle === 'ABIERTOS') list = list.filter((t) => !CLOSED_STATES.has(t.estado));
    if (lifecycle === 'CERRADOS') list = list.filter((t) => CLOSED_STATES.has(t.estado));
    if (sucursal) list = list.filter((t) => asNonEmptyString(t.sucursal).toUpperCase() === sucursal);
    if (assignee === '__NONE__') list = list.filter((t) => !asNonEmptyString(t.asignadoA));
    if (assignee && assignee !== '__NONE__') {
      const key = normalizeTextKey(assignee);
      list = list.filter((t) => normalizeTextKey(t.asignadoA || '') === key);
    }
    if (search) {
      list = list.filter((ticket) => {
        const fields = [
          ticket.activoTag,
          ticket.descripcion,
          ticket.asignadoA,
          ticket.sucursal,
          ticket.solicitadoPor,
          ticket.departamento,
          ticket.atencionTipo,
          String(ticket.id),
        ];
        return fields.some((value) => normalizeTextKey(value || '').includes(search));
      });
    }

    list.sort((a, b) => {
      const leftTs = new Date(a.fechaCreacion || a.fecha || 0).getTime() || 0;
      const rightTs = new Date(b.fechaCreacion || b.fecha || 0).getTime() || 0;
      return rightTs - leftTs;
    });

    if (!withPagination) {
      return res.json(list.map(serializeTicket));
    }

    const { page, pageSize } = parsePagination(req.query);
    const paged = paginateList(list, page, pageSize);

    res.json({
      ...paged,
      items: paged.items.map(serializeTicket),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auditoria', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar auditoria.' });
    }

    const db = await readDb();
    const moduleFilter = normalizeAuditModuleFilter(req.query.module);
    const resultFilter = normalizeAuditResultFilter(req.query.result);
    const userFilter = normalizeTextKey(req.query.user || '');
    const entityFilter = normalizeTextKey(req.query.entity || '');
    const actionFilter = normalizeTextKey(req.query.action || '');
    const search = normalizeTextKey(req.query.q || req.query.search || '');
    const fromTs = parseAuditDateBoundary(req.query.from || req.query.dateFrom, false);
    const toTs = parseAuditDateBoundary(req.query.to || req.query.dateTo, true);
    const { page, pageSize } = parsePagination(req.query);

    let rows = Array.isArray(db.auditoria) ? db.auditoria.slice() : [];
    if (moduleFilter) rows = rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === moduleFilter);
    if (resultFilter) rows = rows.filter((entry) => normalizeAuditResultFilter(entry?.resultado) === resultFilter);
    if (userFilter) {
      rows = rows.filter((entry) => {
        const userFields = [
          entry?.usuario,
          entry?.username,
          entry?.rol,
          entry?.departamento,
        ];
        return userFields.some((value) => normalizeTextKey(value || '').includes(userFilter));
      });
    }
    if (entityFilter) rows = rows.filter((entry) => normalizeTextKey(entry?.entidad || '').includes(entityFilter));
    if (actionFilter) rows = rows.filter((entry) => normalizeTextKey(entry?.accion || '').includes(actionFilter));
    if (search) rows = rows.filter((entry) => auditMatchesSearch(entry, search));
    if (fromTs !== null) rows = rows.filter((entry) => {
      const ts = auditTimestampMs(entry);
      return ts !== null && ts >= fromTs;
    });
    if (toTs !== null) rows = rows.filter((entry) => {
      const ts = auditTimestampMs(entry);
      return ts !== null && ts <= toTs;
    });

    rows.sort((left, right) => {
      const leftTs = auditTimestampMs(left) || 0;
      const rightTs = auditTimestampMs(right) || 0;
      return rightTs - leftTs;
    });

    const paged = paginateList(rows, page, pageSize);
    const integrity = summarizeAuditIntegrity(db.auditoria);
    const alerts = summarizeAuditAlerts(rows);

    res.json({
      items: paged.items,
      pagination: paged.pagination,
      filters: {
        module: moduleFilter || '',
        result: resultFilter || '',
        user: asNonEmptyString(req.query.user),
        entity: asNonEmptyString(req.query.entity),
        action: asNonEmptyString(req.query.action),
        q: asNonEmptyString(req.query.q || req.query.search),
        from: asNonEmptyString(req.query.from || req.query.dateFrom),
        to: asNonEmptyString(req.query.to || req.query.dateTo),
      },
      summary: {
        total: rows.length,
        byModule: {
          tickets: rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === 'tickets').length,
          insumos: rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === 'insumos').length,
          activos: rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === 'activos').length,
          otros: rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === 'otros').length,
        },
        byResult: {
          ok: rows.filter((entry) => normalizeAuditResultFilter(entry?.resultado) === 'ok').length,
          error: rows.filter((entry) => normalizeAuditResultFilter(entry?.resultado) === 'error').length,
        },
      },
      integrity,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

if (HAS_CLIENT_DIST) {
  app.use(express.static(CLIENT_DIST_DIR, { index: false }));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(CLIENT_INDEX_FILE);
  });
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((_req, res) => {
  if (HAS_CLIENT_DIST) {
    return res.sendFile(CLIENT_INDEX_FILE);
  }
  return res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((error, _req, res, _next) => {
  const isJsonParseError = error?.type === 'entity.parse.failed'
    || (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body'));
  if (isJsonParseError) {
    return res.status(400).json({ error: 'JSON invalido en la solicitud.' });
  }

  const status = Math.trunc(Number(error?.statusCode || error?.status || 500));
  const message = asNonEmptyString(error?.message);
  if (status >= 400 && status < 600) {
    return res.status(status).json({ error: message || 'Solicitud invalida.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Mesa IT API corriendo en http://localhost:${PORT}`);
});
