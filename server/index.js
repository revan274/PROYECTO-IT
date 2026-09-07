import { existsSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createInsumosRouter } from './routes/insumos.js';
import { createActivosRouter } from './routes/activos.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createUsersRouter } from './routes/users.js';
import { startKeepAlive } from './utils/keepAlive.js';
import {
  buildAssetQrLookupResponse,
  buildSignedAssetQrToken,
  QR_TOKEN_SCHEME,
  verifySignedAssetQrToken,
} from './modules/qr-token.js';
import {
  createUserPasswordHash,
  getDataDirPath,
  getSharedPostgresPool,
  getStorageBackend,
  nextId,
  readDb,
  sanitizeUser,
  summarizeAuditIntegrity,
  updateDb,
  verifyUserPassword,
} from './store.js';
import {
  // Constants
  SLA_HOURS,
  TICKET_STATES,
  CLOSED_STATES,
  DISALLOW_DEMO_PASSWORDS,
  // String helpers
  asNonEmptyString,
  toInt,
  normalizeTextKey,
  // Ticket helpers
  normalizePrioridad,
  normalizeEstadoTicket,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
  normalizeTicketBranch,
  ticketAuditAction,
  serializeTicket,
  buildTicketAttachmentResponse,
  filterTicketsForUser,
  ticketBelongsToUser,
  canAccessTicketByAuthUser,
  findTicketAssignee,
  // User helpers
  normalizeUserRole,
  normalizeUserCargo,
  canEditByRole,
  countActiveAdmins,
  isValidEmail,
  // Travel helpers
  normalizeTravelAdjustmentMonth,
  normalizeTravelScopeKey,
  normalizeTravelScopeLabel,
  normalizeTravelDestinationCode,
  serializeTravelAdjustment,
  // Supply helpers
  isSupplyActive,
  isLowStock,
  // SLA helpers
  calcDueDate,
  isSlaBreached,
  // Auth helpers
  isDemoPasswordUser,
  // Audit helpers
  getRequestActor,
  pushAuditWithContext,
  normalizeAuditModuleFilter,
  normalizeAuditResultFilter,
  normalizeAuditEntityIdFilter,
  parseAuditDateBoundary,
  auditTimestampMs,
  auditMatchesSearch,
  summarizeAuditAlerts,
  // Catalog helpers
  normalizeCatalogState,
  getCatalogsFromDb,
  getBranchCodesFromCatalog,
  roleIsEnabledByCatalog,
  // File helpers
  sanitizeUploadFileName,
  // Pagination helpers
  parsePagination,
  paginateList,
  getBootstrapAuditRows,
  // Authorization guards
  ensurePermission,
  getRequestDb,
} from './utils/helpers.js';
import { createAuthRuntime } from './middleware/authRuntime.js';
import { resolveAttachmentStorage, resolveAttachmentPath } from './modules/attachment-storage.js';
import { touchStorageMarker, STORAGE_MARKER_FILE } from './modules/storage-marker.js';
import { createAttachmentStore } from './modules/attachment-store.js';
import { auditIntegrity } from './modules/integrity.js';

const PORT = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMPORT_MAX_ROWS = 5000;
const RISK_DUPLICATE_SAMPLE_LIMIT = 10;
const TICKET_ATTACHMENT_MAX_BYTES = Math.max(64 * 1024, Math.trunc(Number(process.env.TICKET_ATTACHMENT_MAX_BYTES || 5 * 1024 * 1024)));
const TICKET_ATTACHMENT_MAX_COUNT = Math.max(1, Math.trunc(Number(process.env.TICKET_ATTACHMENT_MAX_COUNT || 10)));

const CORS_ORIGINS = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
// CORS fail-closed: en producción se exige una allowlist explícita; nunca reflejar cualquier origen.
const CORS_ALLOW_ALL = CORS_ORIGINS.length === 0 && !IS_PRODUCTION;
if (IS_PRODUCTION && CORS_ORIGINS.length === 0) {
  // Advertencia, NO crash: sin CORS_ORIGINS se niega cross-origin (CORS_ALLOW_ALL=false), pero el server arranca.
  console.warn('[SEGURIDAD] CORS_ORIGINS vacío en producción: se rechazarán orígenes cruzados. Define CORS_ORIGINS con tu dominio público.');
}
const TRUST_PROXY = process.env.TRUST_PROXY;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(10, Math.trunc(Number(process.env.AUTH_RATE_LIMIT_MAX || 30))),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación. Intenta más tarde.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(5, Math.trunc(Number(process.env.UPLOAD_RATE_LIMIT_MAX || 12))),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas cargas de adjuntos. Intenta más tarde.' },
});

const NETWORK_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);
const RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);

const DATA_DIR_PATH = getDataDirPath ? getDataDirPath() : path.join(__dirname, 'data');
const ATTACHMENT_STORAGE = resolveAttachmentStorage({
  attachmentsDir: process.env.ATTACHMENTS_DIR,
  dataDir: DATA_DIR_PATH,
  storageBackend: getStorageBackend(),
});
const UPLOAD_DIR = ATTACHMENT_STORAGE.dir;
// Con Neon los binarios adjuntos van a su propia tabla, no al disco efimero del contenedor.
const attachmentStore = createAttachmentStore({
  getPool: getSharedPostgresPool,
  uploadDir: UPLOAD_DIR,
  backend: getStorageBackend(),
});
const CLIENT_DIST_DIR = path.resolve(process.cwd(), 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const HAS_CLIENT_DIST = existsSync(CLIENT_INDEX_FILE);

const ASSET_FIELDS = [
  'tag', 'tipo', 'marca', 'modelo', 'ubicacion', 'nombreVisible', 'estado', 'serial',
  'fechaCompra', 'idInterno', 'equipo', 'cpu', 'ram', 'ramTipo', 'disco',
  'tipoDisco', 'macAddress', 'ipAddress', 'responsable', 'departamento',
  'edo', 'anydesk', 'aniosVida', 'comentarios',
];

// --- App middleware setup ---

function configureTrustProxy(app) {
  if (typeof TRUST_PROXY !== 'string' || !TRUST_PROXY.trim()) return;
  const rawTrustProxy = TRUST_PROXY.trim();
  const normalizedTrustProxy = rawTrustProxy.toLowerCase();
  if (normalizedTrustProxy === 'true') app.set('trust proxy', true);
  else if (normalizedTrustProxy === 'false') app.set('trust proxy', false);
  else if (/^\d+$/.test(normalizedTrustProxy)) app.set('trust proxy', Number(normalizedTrustProxy));
  else app.set('trust proxy', rawTrustProxy);
}

function configureCommonMiddleware(app) {
  // Express no comprime por defecto. El estado completo viaja en /api/bootstrap como JSON
  // muy repetitivo: medido con 5.000 tickets, 7.7 MB se reducen a 0.25 MB (31x). El umbral
  // evita gastar CPU en respuestas pequeñas, donde comprimir cuesta más de lo que ahorra.
  app.use(compression({ threshold: 1024 }));
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", ...CORS_ORIGINS],
        'object-src': ["'none'"],
        'frame-ancestors': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: IS_PRODUCTION ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ALLOW_ALL) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Origen no permitido por CORS.'));
    },
    credentials: true,
    exposedHeaders: ['ETag', 'X-Request-Id'],
  }));
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: Math.max(60, Math.trunc(Number(process.env.RATE_LIMIT_MAX || 240))),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
  }));
  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => {
    const incoming = asNonEmptyString(req.headers['x-request-id']);
    const requestId = incoming || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });
}

// --- File / upload helpers ---

function toAbsoluteAttachmentPath(storagePath) {
  return resolveAttachmentPath(storagePath, UPLOAD_DIR);
}

// --- Asset helpers ---

function parseAssetLifeYears(value) {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const years = Number(match[0]);
  if (!Number.isFinite(years)) return null;
  return years;
}

function assetRiskTypeKey(asset) {
  return asNonEmptyString(asset?.tipo || asset?.equipo).toUpperCase();
}

function assetRequiresNetworkIdentity(asset) {
  return !NETWORK_RISK_EXEMPT_ASSET_TYPES.has(assetRiskTypeKey(asset));
}

function assetRequiresResponsible(asset) {
  return !RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES.has(assetRiskTypeKey(asset));
}

function summarizeAssetRisks(activos) {
  const ipCounts = new Map();
  const macCounts = new Map();
  let activosEvaluablesIp = 0;
  let activosSinIp = 0;
  let activosEvaluablesMac = 0;
  let activosSinMac = 0;
  let activosEvaluablesResponsable = 0;
  let activosSinResponsable = 0;
  let activosVidaAlta = 0;
  let activosEnFalla = 0;

  for (const asset of activos) {
    const ip = asNonEmptyString(asset.ipAddress);
    const mac = asNonEmptyString(asset.macAddress).toLowerCase();
    const responsable = asNonEmptyString(asset.responsable);
    const years = parseAssetLifeYears(asset.aniosVida);
    const requiresNetworkIdentity = assetRequiresNetworkIdentity(asset);
    const requiresResponsible = assetRequiresResponsible(asset);

    if (requiresNetworkIdentity) {
      activosEvaluablesIp += 1;
      activosEvaluablesMac += 1;
      if (!ip) activosSinIp += 1;
      if (!mac) activosSinMac += 1;
    }
    if (requiresResponsible) {
      activosEvaluablesResponsable += 1;
      if (!responsable) activosSinResponsable += 1;
    }
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
    activosEvaluablesIp,
    activosConIp: activosEvaluablesIp - activosSinIp,
    activosSinIp,
    activosEvaluablesMac,
    activosConMac: activosEvaluablesMac - activosSinMac,
    activosSinMac,
    activosEvaluablesResponsable,
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
  void role;
  const safe = { ...asset };
  delete safe.passwordRemota;
  delete safe.pass;
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
    errors.push('MAC inválida');
  }
  if (rawIp && ipAddress === null) {
    errors.push('IP inválida');
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
    nombreVisible: asNonEmptyString(payload?.nombreVisible).toUpperCase(),
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
  copy.nombreVisible = asNonEmptyString(copy.nombreVisible).toUpperCase();
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
  delete copy.passwordRemota;
  delete copy.pass;
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
  const sourceName = asNonEmptyString(options.fileName) || 'Importación Excel';
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
      accion: 'Importación Activos',
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

// --- Route registration ---

function buildBootstrapEtag(req) {
  const version = Math.max(0, Math.trunc(Number(req.appDbVersion) || 0));
  const userId = Math.max(0, Math.trunc(Number(req.authUser?.id) || 0));
  const role = asNonEmptyString(req.authUser?.rol).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `W/"mesa-it-bootstrap-v2-${version}-${userId}-${role || 'unknown'}"`;
}

function requestAcceptsEtag(req, etag) {
  return String(req.headers['if-none-match'] || '')
    .split(',')
    .map((value) => value.trim())
    .includes(etag);
}

function registerRoutes(app, authRuntime) {
  const {
    clearLoginFailures,
    destroySession,
    getLoginThrottle,
    registerLoginFailure,
    registerSession,
    requireAuth,
    revokeSessionsByUserId,
    writeSecurityAudit,
  } = authRuntime;

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageBackend: getStorageBackend(),
  });
});

// Responde, desde la propia aplicacion, si los adjuntos sobreviven a un redespliegue.
// La configuracion de volumenes vive en el panel del hosting y no en el repositorio, asi
// que sin este endpoint la unica forma de saberlo es entrar al dashboard. Admin only: expone
// rutas del sistema de archivos.
app.get('/api/diagnostics/storage', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'diagnostics.read')) return;

    const marker = await touchStorageMarker(UPLOAD_DIR);
    // Una sola consulta en lugar de una por adjunto.
    const enBase = new Set(await attachmentStore.listStoredPaths());
    const db = await getRequestDb(req);
    const integridad = auditIntegrity(db, {
      attachmentExists: (storagePath) => {
        if (enBase.has(storagePath)) return true;
        // Adjunto anterior a la migración: puede seguir en disco.
        const absolute = resolveAttachmentPath(storagePath, UPLOAD_DIR);
        return Boolean(absolute) && existsSync(absolute);
      },
      listStoredFiles: () => (existsSync(UPLOAD_DIR)
        ? readdirSync(UPLOAD_DIR).filter((name) => name !== STORAGE_MARKER_FILE)
        : []),
    });

    res.json({
      storageBackend: getStorageBackend(),
      attachments: {
        // Con Neon los binarios viven en la base; el directorio solo conserva los heredados.
        backend: attachmentStore.backend,
        storedInDatabase: await attachmentStore.countStored(),
        dir: ATTACHMENT_STORAGE.dir,
        source: ATTACHMENT_STORAGE.source,
        durabilityRisk: attachmentStore.backend === 'postgres' ? false : ATTACHMENT_STORAGE.durabilityRisk,
        warning: attachmentStore.backend === 'postgres' ? null : (ATTACHMENT_STORAGE.warning || null),
        marker,
      },
      integrity: integridad.counts,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalogos', requireAuth, async (req, res, next) => {
  try {
    const db = await getRequestDb(req);
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
    if (!ensurePermission(req, res, 'catalogos.manage')) return;
    const { usuario } = getRequestActor(req);

    const hasBranchUpdate = req.body?.sucursales !== undefined;
    const hasCargoUpdate = req.body?.cargos !== undefined;
    const hasRoleUpdate = req.body?.roles !== undefined;
    if (!hasBranchUpdate && !hasCargoUpdate && !hasRoleUpdate) {
      return res.status(400).json({ error: 'No hay cambios de catálogos para aplicar.' });
    }

    if (hasBranchUpdate && !Array.isArray(req.body?.sucursales)) {
      return res.status(400).json({ error: 'El catálogo de sucursales debe ser una lista.' });
    }
    if (hasCargoUpdate && !Array.isArray(req.body?.cargos)) {
      return res.status(400).json({ error: 'El catálogo de cargos debe ser una lista.' });
    }
    if (hasRoleUpdate && !Array.isArray(req.body?.roles)) {
      return res.status(400).json({ error: 'El catálogo de roles debe ser una lista.' });
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
      if (hasRoleUpdate && normalized.roles.find((role) => role.value === 'admin')?.activo === false) {
        return { ok: false, code: 'ADMIN_ROLE_DISABLED' };
      }

      db.catalogos = normalized;
      pushAuditWithContext(db, req, {
        accion: 'Catálogos Actualizados',
        item: `Sucursales: ${normalized.sucursales.length} | Cargos: ${normalized.cargos.length} | Roles: ${normalized.roles.length}`,
        cantidad: 1,
        usuario,
        modulo: 'otros',
        entidad: 'catálogo',
      });
      return { ok: true, catalogos: normalized };
    });

    if (!updated?.ok && updated?.code === 'INVALID_BRANCHES') {
      return res.status(400).json({ error: 'Catálogo de sucursales inválido.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_CARGOS') {
      return res.status(400).json({ error: 'Catálogo de cargos inválido.' });
    }
    if (!updated?.ok && updated?.code === 'INVALID_ROLES') {
      return res.status(400).json({ error: 'Catálogo de roles inválido.' });
    }
    if (!updated?.ok && updated?.code === 'ADMIN_ROLE_DISABLED') {
      return res.status(409).json({ error: 'El rol administrador debe permanecer activo.' });
    }
    if (!updated?.ok) {
      return res.status(500).json({ error: 'No se pudieron guardar los catálogos.' });
    }

    res.json({
      ...updated.catalogos,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
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
    const throttle = await getLoginThrottle(req, username);
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
        error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.',
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
      const failed = await registerLoginFailure(req, username);
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
        motivo: 'Credenciales inválidas',
        username,
      });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
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
      return res.status(403).json({ error: 'Tu rol está deshabilitado en catálogo.' });
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

    await clearLoginFailures(req, username);
    const token = await registerSession(user);
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
    await destroySession(req.authToken);
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
    const etag = buildBootstrapEtag(req);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache, max-age=0');
    res.vary('Authorization');
    if (requestAcceptsEtag(req, etag)) {
      return res.status(304).end();
    }

    const db = await getRequestDb(req);
    const rol = req.authUser?.rol || '';
    const requesterOnly = rol === 'solicitante';
    const users = buildBootstrapUsers(db.users, rol);
    const riskSummary = summarizeAssetRisks(db.activos);
    const visibleTickets = filterTicketsForUser(db.tickets, req.authUser);

    res.json({
      activos: requesterOnly
        ? db.activos.filter((a) => a.activo !== false).map((a) => ({ id: a.id, tag: a.tag, tipo: a.tipo, ubicacion: a.ubicacion, departamento: a.departamento, nombreVisible: a.nombreVisible }))
        : db.activos.map((asset) => stripSensitiveAssetFields(asset, rol)),
      insumos: requesterOnly ? [] : db.insumos.filter(isSupplyActive),
      tickets: visibleTickets.map(serializeTicket),
      auditoria: requesterOnly ? [] : getBootstrapAuditRows(db.auditoria),
      users: requesterOnly ? [] : users,
      catalogos: getCatalogsFromDb(db),
      riskSummary: requesterOnly ? undefined : riskSummary,
      ticketStates: TICKET_STATES,
      slaPolicyHours: SLA_HOURS,
      travelAdjustments: requesterOnly ? [] : (Array.isArray(db.travelAdjustments) ? db.travelAdjustments.map(serializeTravelAdjustment).filter(Boolean) : []),
      meta: {
        generatedAt: new Date().toISOString(),
        revision: Math.max(0, Math.trunc(Number(req.appDbVersion) || Number(db.meta?.revision) || 0)),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/travel-adjustments', requireAuth, async (req, res, next) => {
  try {
    if (!ensurePermission(req, res, 'travel.manage')) return;

    const month = normalizeTravelAdjustmentMonth(req.body?.month);
    const technicianScopeKey = normalizeTravelScopeKey(req.body?.technicianScopeKey);
    const technicianScopeLabel = normalizeTravelScopeLabel(req.body?.technicianScopeLabel || technicianScopeKey);
    const destinationCode = normalizeTravelDestinationCode(req.body?.destinationCode);
    const rawTrips = req.body?.trips;
    const deleteOverride = rawTrips === null || rawTrips === '' || typeof rawTrips === 'undefined';
    const trips = deleteOverride ? null : toInt(rawTrips);

    if (!month || !technicianScopeKey || !destinationCode) {
      return res.status(400).json({ error: 'month, technicianScopeKey y destinationCode son obligatorios.' });
    }
    if (!deleteOverride && (trips === null || trips < 0)) {
      return res.status(400).json({ error: 'trips debe ser un entero mayor o igual a cero.' });
    }

    const actor = getRequestActor(req);
    const adjustment = await updateDb((db) => {
      if (!Array.isArray(db.travelAdjustments)) db.travelAdjustments = [];

      const existingIndex = db.travelAdjustments.findIndex((item) => (
        normalizeTravelAdjustmentMonth(item?.month) === month
        && normalizeTravelScopeKey(item?.technicianScopeKey) === technicianScopeKey
        && normalizeTravelDestinationCode(item?.destinationCode) === destinationCode
      ));
      const before = existingIndex >= 0 ? serializeTravelAdjustment(db.travelAdjustments[existingIndex]) : null;

      if (deleteOverride) {
        if (existingIndex < 0) return null;
        const [removed] = db.travelAdjustments.splice(existingIndex, 1);
        pushAuditWithContext(db, req, {
          modulo: 'otros',
          accion: 'Viajes Reales Restablecidos',
          item: `${month} ${destinationCode}`,
          cantidad: before?.trips || 0,
          entidad: 'travel-adjustments',
          entidadId: removed?.id || null,
          motivo: technicianScopeLabel,
          before,
          after: null,
          meta: { month, destinationCode, technicianScopeKey, technicianScopeLabel },
        });
        return null;
      }

      const nextAdjustment = {
        id: existingIndex >= 0 ? db.travelAdjustments[existingIndex].id : nextId(db),
        month,
        technicianScopeKey,
        technicianScopeLabel: technicianScopeLabel || technicianScopeKey,
        destinationCode,
        trips,
        updatedAt: new Date().toISOString(),
        updatedBy: actor.username || actor.usuario || 'Sistema',
      };

      if (existingIndex >= 0) db.travelAdjustments[existingIndex] = nextAdjustment;
      else db.travelAdjustments.push(nextAdjustment);

      pushAuditWithContext(db, req, {
        modulo: 'otros',
        accion: 'Viajes Reales Actualizados',
        item: `${month} ${destinationCode}`,
        cantidad: trips,
        entidad: 'travel-adjustments',
        entidadId: nextAdjustment.id,
        motivo: technicianScopeLabel,
        before,
        after: serializeTravelAdjustment(nextAdjustment),
        meta: { month, destinationCode, technicianScopeKey, technicianScopeLabel, trips },
      });

      return nextAdjustment;
    });

    res.json({
      adjustment: adjustment ? serializeTravelAdjustment(adjustment) : null,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/summary', requireAuth, async (req, res, next) => {
  try {
    const db = await getRequestDb(req);
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
      kpi: { ticketsPorSucursal, ticketsPorTecnico, ticketsPorCargo },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/qr/resolve/:token', requireAuth, async (req, res, next) => {
  try {
    const verified = verifySignedAssetQrToken(req.params.token);
    if (!verified.ok) {
      return res.status(400).json({ error: 'QR inválido o manipulado.' });
    }

    const db = await getRequestDb(req);
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

app.get('/api/auditoria', requireAuth, async (req, res, next) => {
  try {
    if (req.authUser?.rol === 'solicitante') {
      return res.status(403).json({ error: 'No autorizado para consultar auditoría.' });
    }

    const db = await getRequestDb(req);
    const moduleFilter = normalizeAuditModuleFilter(req.query.module);
    const resultFilter = normalizeAuditResultFilter(req.query.result);
    const userFilter = normalizeTextKey(req.query.user || '');
    const entityFilter = normalizeTextKey(req.query.entity || '');
    const entityIdFilter = normalizeAuditEntityIdFilter(req.query.entityId);
    const actionFilter = normalizeTextKey(req.query.action || '');
    const search = normalizeTextKey(req.query.q || req.query.search || '');
    const fromTs = parseAuditDateBoundary(req.query.from || req.query.dateFrom, false);
    const toTs = parseAuditDateBoundary(req.query.to || req.query.dateTo, true);
    const returnAll = req.query.all === '1';
    const includeDiagnostics = req.query.includeDiagnostics !== '0';
    const { page, pageSize } = parsePagination(req.query);

    let rows = Array.isArray(db.auditoria) ? db.auditoria.slice() : [];
    if (moduleFilter) rows = rows.filter((entry) => normalizeAuditModuleFilter(entry?.modulo) === moduleFilter);
    if (resultFilter) rows = rows.filter((entry) => normalizeAuditResultFilter(entry?.resultado) === resultFilter);
    if (userFilter) {
      rows = rows.filter((entry) => {
        const userFields = [entry?.usuario, entry?.username, entry?.rol, entry?.departamento];
        return userFields.some((value) => normalizeTextKey(value || '').includes(userFilter));
      });
    }
    if (entityFilter) rows = rows.filter((entry) => normalizeTextKey(entry?.entidad || '').includes(entityFilter));
    if (entityIdFilter) {
      rows = rows.filter((entry) => normalizeAuditEntityIdFilter(entry?.entidadId) === entityIdFilter);
    }
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

    const paged = returnAll
      ? {
          items: rows,
          pagination: {
            page: 1,
            pageSize: Math.max(rows.length, 1),
            total: rows.length,
            totalPages: 1,
          },
        }
      : paginateList(rows, page, pageSize);
    const integrity = includeDiagnostics ? summarizeAuditIntegrity(db.auditoria) : undefined;
    const alerts = includeDiagnostics ? summarizeAuditAlerts(rows) : undefined;
    const summary = includeDiagnostics
      ? {
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
        }
      : undefined;

    res.json({
      items: paged.items,
      pagination: paged.pagination,
      filters: {
        module: moduleFilter || '',
        result: resultFilter || '',
        user: asNonEmptyString(req.query.user),
        entity: asNonEmptyString(req.query.entity),
        entityId: asNonEmptyString(req.query.entityId),
        action: asNonEmptyString(req.query.action),
        q: asNonEmptyString(req.query.q || req.query.search),
        from: asNonEmptyString(req.query.from || req.query.dateFrom),
        to: asNonEmptyString(req.query.to || req.query.dateTo),
      },
      summary,
      integrity,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

const ticketRouteDeps = {
  requireAuth,
  ensurePermission,
  asNonEmptyString,
  normalizePrioridad,
  normalizeTicketAttentionType,
  normalizeTicketTravelRequired,
  canEditByRole,
  getRequestActor,
  getBranchCodesFromCatalog,
  normalizeTicketBranch,
  findTicketAssignee,
  calcDueDate,
  pushAuditWithContext,
  serializeTicket,
  toInt,
  normalizeEstadoTicket,
  CLOSED_STATES,
  ticketAuditAction,
  ticketBelongsToUser,
  normalizeTextKey,
  toAbsoluteAttachmentPath,
  canAccessTicketByAuthUser,
  sanitizeUploadFileName,
  TICKET_ATTACHMENT_MAX_BYTES,
  attachmentStore,
  TICKET_ATTACHMENT_MAX_COUNT,
  buildTicketAttachmentResponse,
  filterTicketsForUser,
  isSlaBreached,
  parsePagination,
  paginateList,
};

const activosRouteDeps = {
  requireAuth,
  summarizeAssetRisks,
  normalizeTextKey,
  asNonEmptyString,
  stripSensitiveAssetFields,
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  parseAssetLifeYears,
  parsePagination,
  paginateList,
  toInt,
  ensurePermission,
  getRequestActor,
  normalizeAssetPayload,
  finalizeAsset,
  buildAssetIndexes,
  findAssetConflicts,
  pushAuditWithContext,
  IMPORT_MAX_ROWS,
  importAssets,
  buildSignedAssetQrToken,
};

const insumosRouteDeps = {
  requireAuth,
  ensurePermission,
  asNonEmptyString,
  toInt,
  getRequestActor,
  isSupplyActive,
  normalizeTextKey,
  pushAuditWithContext,
};

const usersRouteDeps = {
  requireAuth,
  ensurePermission,
  createUserPasswordHash,
  roleIsEnabledByCatalog,
  getRequestActor,
  pushAuditWithContext,
  asNonEmptyString,
  normalizeUserRole,
  getCatalogsFromDb,
  normalizeUserCargo,
  toInt,
  nextId,
  countActiveAdmins,
  revokeSessionsByUserId,
  isValidEmail,
};

app.use('/api/tickets/:id/attachments', uploadLimiter);
app.use('/api/tickets', createTicketsRouter(ticketRouteDeps));
app.use('/api/activos', createActivosRouter(activosRouteDeps));
app.use('/api/insumos', createInsumosRouter(insumosRouteDeps));
app.use('/api/users', createUsersRouter(usersRouteDeps));

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
    return res.status(400).json({ error: 'JSON inválido en la solicitud.' });
  }

  const status = Math.trunc(Number(error?.statusCode || error?.status || 500));
  const message = asNonEmptyString(error?.message);
  if (status >= 400 && status < 600) {
    return res.status(status).json({ error: message || 'Solicitud inválida.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

}

// --- App factory & entry point ---

export function createApp() {
  const app = express();
  const authRuntime = createAuthRuntime();
  configureTrustProxy(app);
  configureCommonMiddleware(app);
  registerRoutes(app, authRuntime);
  return app;
}

const app = createApp();

export { app };

export function startServer(port = PORT, appInstance = app) {
  return appInstance.listen(port, () => {
    console.log(`Mesa IT API corriendo en http://localhost:${port}`);
    if (attachmentStore.backend === 'postgres') {
      // Los binarios ya no dependen del disco del contenedor: viven en la misma base que
      // el estado, con sus respaldos. El directorio solo conserva los adjuntos heredados.
      console.log('Adjuntos de tickets en PostgreSQL (tabla mesa_it_attachments).');
      void attachmentStore.ensureSchema().catch((error) => {
        console.error('No se pudo preparar la tabla de adjuntos:', error?.message || error);
      });
    } else {
      console.log(`Adjuntos de tickets en "${ATTACHMENT_STORAGE.dir}" (origen: ${ATTACHMENT_STORAGE.source}).`);
      if (ATTACHMENT_STORAGE.durabilityRisk) {
        console.warn(`ADVERTENCIA: ${ATTACHMENT_STORAGE.warning}`);
      }
    }
    // Deja constancia en cada arranque. Si tras un redespliegue la fecha de creacion se
    // conserva, el almacenamiento es persistente; si se reinicia a hoy, es efimero y los
    // adjuntos se estan perdiendo. Best-effort: nunca debe impedir que la API arranque.
    void touchStorageMarker(UPLOAD_DIR).then((marker) => {
      if (marker.error) {
        console.warn(`No se pudo escribir el marcador de almacenamiento: ${marker.error}`);
        return;
      }
      const veredicto = marker.survivedRestart
        ? 'sobrevivio a reinicios anteriores'
        : 'primer arranque registrado';
      console.log(`Almacenamiento de adjuntos en uso desde ${marker.firstSeenAt} (arranque #${marker.bootCount}, ${veredicto}).`);
    });
    // Keep-alive solo si se define PUBLIC_URL (p. ej. plataformas con sleep).
    // En Railway no hace falta; sin PUBLIC_URL no se hace ping a ningún lado.
    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl) startKeepAlive(`${publicUrl}/api/health`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
