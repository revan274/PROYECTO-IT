import { existsSync, promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { createInsumosRouter } from './routes/insumos.js';
import { createActivosRouter } from './routes/activos.js';
import { createTicketsRouter } from './routes/tickets.js';
import { createUsersRouter } from './routes/users.js';
import {
  buildAssetQrLookupResponse,
  buildSignedAssetQrToken,
  QR_TOKEN_SCHEME,
  verifySignedAssetQrToken,
} from './modules/qr-token.js';
import {
  createUserPasswordHash,
  getDataDirPath,
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
  canCreateTicketsByRole,
  countActiveAdmins,
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
  slaRemainingMinutes,
  // Auth helpers
  parseBearerToken,
  createAuthToken,
  getRequestIp,
  getLoginAttemptKey,
  isDemoPasswordUser,
  // Audit helpers
  getRequestActor,
  buildAuditPayload,
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
  ensureCanEdit,
  ensureCanCreateTickets,
  ensureAdmin,
} from './utils/helpers.js';
import { createAuthRuntime } from './middleware/authRuntime.js';

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
const CORS_ALLOW_ALL = CORS_ORIGINS.length === 0;
const TRUST_PROXY = process.env.TRUST_PROXY;

const NETWORK_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);
const RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);

const DATA_DIR_PATH = getDataDirPath ? getDataDirPath() : path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR_PATH, 'uploads');
const CLIENT_DIST_DIR = path.resolve(process.cwd(), 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const HAS_CLIENT_DIST = existsSync(CLIENT_INDEX_FILE);

const ASSET_FIELDS = [
  'tag', 'tipo', 'marca', 'modelo', 'ubicacion', 'estado', 'serial',
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
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ALLOW_ALL) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Origen no permitido por CORS.'));
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
}

// --- File / upload helpers ---

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
  const { passwordRemota, pass, ...safe } = asset;
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

// --- Route registration ---

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
    destroySession(req.authToken);
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
      auditoria: requesterOnly ? [] : getBootstrapAuditRows(db.auditoria),
      users: requesterOnly ? [] : users,
      catalogos: getCatalogsFromDb(db),
      riskSummary: requesterOnly ? undefined : riskSummary,
      ticketStates: TICKET_STATES,
      slaPolicyHours: SLA_HOURS,
      travelAdjustments: requesterOnly ? [] : (Array.isArray(db.travelAdjustments) ? db.travelAdjustments.map(serializeTravelAdjustment).filter(Boolean) : []),
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/travel-adjustments', requireAuth, async (req, res, next) => {
  try {
    if (!ensureCanEdit(req, res)) return;

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
  ensureCanCreateTickets,
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
  ensureCanEdit,
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
  ensureUploadDir,
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
  ensureCanEdit,
  getRequestActor,
  normalizeAssetPayload,
  finalizeAsset,
  buildAssetIndexes,
  findAssetConflicts,
  pushAuditWithContext,
  IMPORT_MAX_ROWS,
  importAssets,
  ensureAdmin,
  buildSignedAssetQrToken,
};

const insumosRouteDeps = {
  requireAuth,
  ensureCanEdit,
  asNonEmptyString,
  toInt,
  getRequestActor,
  isSupplyActive,
  normalizeTextKey,
  pushAuditWithContext,
};

const usersRouteDeps = {
  requireAuth,
  ensureAdmin,
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
};

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
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer();
}
