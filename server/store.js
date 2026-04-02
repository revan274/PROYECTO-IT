import { existsSync, promises as fs } from 'node:fs';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const RENDER_DISK_DIR = '/var/data';
const DEFAULT_SEED_FILE = path.join(DEFAULT_DATA_DIR, 'db.seed.json');
const DEFAULT_RUNTIME_DIR = path.join(existsSync(RENDER_DISK_DIR) ? RENDER_DISK_DIR : DEFAULT_DATA_DIR, 'runtime');
const DB_FILE = process.env.DB_FILE
  ? path.resolve(process.cwd(), process.env.DB_FILE)
  : path.join(DEFAULT_RUNTIME_DIR, 'db.json');
const DATA_DIR = path.dirname(DB_FILE);
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_BACKUP_KEEP = Math.max(1, Math.trunc(Number(process.env.DB_BACKUP_KEEP || 50)));
const DB_BACKUP_ENABLE = String(process.env.DB_BACKUP_ENABLE || 'true').toLowerCase() !== 'false';
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const ALLOW_PRODUCTION_SEED = String(process.env.ALLOW_PRODUCTION_SEED || 'false').trim().toLowerCase() === 'true';
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const USE_POSTGRES = DATABASE_URL.length > 0;
const PG_STATE_TABLE = 'mesa_it_state';
const PG_POOL_MAX = Math.max(1, Math.trunc(Number(process.env.PG_POOL_MAX || 4)));
const PG_SSL_REQUIRED = /sslmode=require/i.test(DATABASE_URL);

const PASSWORD_HASH_VERSION = 'scrypt-v1';
const PASSWORD_KEYLEN = 64;
const AUDIT_MODULES = new Set(['activos', 'insumos', 'tickets', 'otros']);
const AUDIT_RESULTS = new Set(['ok', 'error']);
const AUDIT_GENESIS_HASH = 'genesis';
const USER_ROLES = new Set(['admin', 'tecnico', 'consulta', 'solicitante']);
const DEFAULT_TICKET_BRANCHES = [
  { code: 'TJ01', name: 'Sucursal Estrella', activo: true },
  { code: 'TC01', name: 'Sucursal Camargo', activo: true },
  { code: 'TJ02', name: 'Sucursal CBtis', activo: true },
  { code: 'TJ03', name: 'Sucursal Sor Juana', activo: true },
  { code: 'CEDIS', name: 'CeDis', activo: true },
];
const DEFAULT_USER_CARGOS = [
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
const TICKET_BRANCH_CODES = new Set(DEFAULT_TICKET_BRANCHES.map((branch) => branch.code));
let pgPool = null;
let pgInitPromise = null;

function hashPassword(plainPassword) {
  const password = String(plainPassword || '');
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, PASSWORD_KEYLEN);
  return `${PASSWORD_HASH_VERSION}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyHashedPassword(plainPassword, encodedHash) {
  try {
    const value = String(encodedHash || '');
    const [version, saltHex, hashHex] = value.split('$');
    if (version !== PASSWORD_HASH_VERSION || !saltHex || !hashHex) return false;
    if (!/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = scryptSync(String(plainPassword || ''), salt, expected.length || PASSWORD_KEYLEN);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const DEFAULT_USERS = [
  {
    id: 501,
    nombre: 'Admin IT',
    username: 'admin',
    passwordHash: 'scrypt-v1$4923721e0ded78534bbd638be30ae5f1$1993ab737237283782f648c1dfa3abc737309abc2bbe5a2e3600a4e1a2ed33660abb03efd5bfdd7a4b44d065e9fe400a6444df09f2661ecda0b2119ddc2d39f9',
    rol: 'admin',
    departamento: 'IT',
    activo: true,
  },
  {
    id: 502,
    nombre: 'Tecnico 1',
    username: 'tecnico1',
    passwordHash: 'scrypt-v1$32054ec3b72a1863e1839397517c410c$cd46075c7507e0a5b6e7d81239a433706acd86290609d17896a40d6addb6204688f8e9445b75664b23c1faca7e8be8a1385d49f121b3d415e3ee124fdf260456',
    rol: 'tecnico',
    departamento: 'IT',
    activo: true,
  },
  {
    id: 503,
    nombre: 'Supervisor',
    username: 'consulta',
    passwordHash: 'scrypt-v1$a992b6ad1d54ff5171d08b30f1eb3d1a$2e59f85b782d7dc3d2774617c2d37333c7cba81c83999f39db1a5a93a4a5b87498199d2143cbae6cd35cec8a35989d4b0c8d749f42ef566d3dae916c2b571967',
    rol: 'consulta',
    departamento: 'OPERACIONES',
    activo: true,
  },
];

const DEFAULT_DB = {
  meta: { nextId: 1000 },
  catalogos: {
    sucursales: DEFAULT_TICKET_BRANCHES,
    cargos: DEFAULT_USER_CARGOS,
    roles: DEFAULT_ROLE_CATALOG,
  },
  users: DEFAULT_USERS,
  activos: [
    {
      id: 1,
      tag: 'POS-001',
      tipo: 'POS',
      marca: 'IBM SurePOS',
      ubicacion: 'Caja Rapida 1',
      estado: 'Operativo',
      serial: 'SN-99201',
      fechaCompra: '2022-01-15',
    },
    {
      id: 2,
      tag: 'POS-002',
      tipo: 'POS',
      marca: 'IBM SurePOS',
      ubicacion: 'Caja Rapida 2',
      estado: 'Operativo',
      serial: 'SN-99202',
      fechaCompra: '2022-01-15',
    },
    {
      id: 3,
      tag: 'BAS-010',
      tipo: 'Bascula',
      marca: 'Datalogic',
      ubicacion: 'Frutas y Verduras',
      estado: 'Falla',
      serial: 'SN-10293',
      fechaCompra: '2023-05-10',
    },
    {
      id: 4,
      tag: 'SRV-001',
      tipo: 'Servidor',
      marca: 'Dell PowerEdge',
      ubicacion: 'Site',
      estado: 'Operativo',
      serial: 'SN-SRV-01',
      fechaCompra: '2021-11-20',
    },
  ],
  insumos: [
    { id: 11, nombre: 'Cable Ethernet Cat6', unidad: 'Metros', stock: 150, min: 50, categoria: 'REDES', activo: true },
    { id: 12, nombre: 'Papel Termico 80mm', unidad: 'Rollos', stock: 12, min: 20, categoria: 'CONSUMIBLES', activo: true },
    { id: 13, nombre: 'Conectores RJ45', unidad: 'Piezas', stock: 100, min: 30, categoria: 'REDES', activo: true },
    { id: 14, nombre: 'Teclado USB', unidad: 'Piezas', stock: 5, min: 5, categoria: 'HARDWARE', activo: true },
  ],
  tickets: [
    {
      id: 101,
      activoTag: 'BAS-010',
      descripcion: 'Falla en el pesaje',
      prioridad: 'CRITICA',
      estado: 'Abierto',
      atencionTipo: 'PRESENCIAL',
      fecha: '2023-10-24 09:00',
      fechaCreacion: '2023-10-24T09:00:00.000Z',
      fechaLimite: '2023-10-24T11:00:00.000Z',
      asignadoA: 'Tecnico 1',
      historial: [
        {
          fecha: '2023-10-24 09:00',
          usuario: 'Admin IT',
          accion: 'Ticket Creado',
          estado: 'Abierto',
          comentario: 'Registro inicial',
        },
      ],
    },
  ],
  auditoria: [
    {
      id: 201,
      accion: 'Entrada',
      item: 'Papel Termico',
      cantidad: 50,
      fecha: '2024-05-20 10:30',
      usuario: 'Admin IT',
    },
  ],
};

let queue = Promise.resolve();

function maxExistingId(db) {
  const sources = [
    ...(Array.isArray(db.users) ? db.users : []),
    ...(Array.isArray(db.activos) ? db.activos : []),
    ...(Array.isArray(db.insumos) ? db.insumos : []),
    ...(Array.isArray(db.tickets) ? db.tickets : []),
    ...(Array.isArray(db.auditoria) ? db.auditoria : []),
  ];

  return sources.reduce((acc, item) => {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) return acc;
    return Math.max(acc, Math.trunc(id));
  }, 0);
}

function normalizeTicketAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const id = Math.max(0, Math.trunc(Number(attachment.id) || 0));
  const fileName = text(attachment.fileName || attachment.nombre).slice(0, 180);
  const storagePath = text(attachment.storagePath || attachment.path).replace(/\\/g, '/');
  const mimeType = text(attachment.mimeType || attachment.mime).toLowerCase() || 'application/octet-stream';
  const size = Math.max(0, Math.trunc(Number(attachment.size) || 0));
  const uploadedAt = text(attachment.uploadedAt || attachment.fecha) || new Date().toISOString();
  const uploadedBy = text(attachment.uploadedBy || attachment.usuario) || 'Sistema';
  if (!id || !fileName || !storagePath) return null;
  return {
    id,
    fileName,
    storagePath,
    mimeType,
    size,
    uploadedAt,
    uploadedBy,
  };
}

function normalizeTicketAttentionType(value) {
  const type = text(value).toUpperCase();
  if (type === 'PRESENCIAL' || type === 'REMOTO') return type;
  return '';
}

function normalizeTicket(ticket, validBranchCodes = TICKET_BRANCH_CODES) {
  const copy = { ...ticket };
  if (!copy.fechaCreacion) {
    copy.fechaCreacion = new Date().toISOString();
  }
  if (!copy.fechaLimite) {
    copy.fechaLimite = new Date(Date.now() + (copy.prioridad === 'CRITICA' ? 2 : copy.prioridad === 'ALTA' ? 8 : 24) * 60 * 60 * 1000).toISOString();
  }
  if (!Array.isArray(copy.historial)) {
    copy.historial = [
      {
        fecha: copy.fecha || now(),
        usuario: 'Sistema',
        accion: 'Migrado',
        estado: copy.estado || 'Abierto',
        comentario: 'Ticket normalizado',
      },
    ];
  }
  if (!copy.estado) copy.estado = 'Abierto';
  if (!copy.prioridad) copy.prioridad = 'MEDIA';
  if (!copy.asignadoA) copy.asignadoA = '';
  copy.atencionTipo = normalizeTicketAttentionType(copy.atencionTipo);
  copy.attachments = Array.isArray(copy.attachments)
    ? copy.attachments.map(normalizeTicketAttachment).filter(Boolean)
    : [];
  copy.sucursal = text(copy.sucursal).toUpperCase();
  if (!validBranchCodes.has(copy.sucursal)) copy.sucursal = '';
  copy.departamento = text(copy.departamento).toUpperCase();
  if (!text(copy.solicitadoPor)) {
    const firstHistory = Array.isArray(copy.historial) && copy.historial.length > 0
      ? copy.historial[copy.historial.length - 1]
      : null;
    copy.solicitadoPor = text(firstHistory?.usuario);
  } else {
    copy.solicitadoPor = text(copy.solicitadoPor);
  }
  return copy;
}

function normalizeCatalogBranch(value) {
  if (!value || typeof value !== 'object') return null;
  const code = text(value.code || value.clave).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const name = text(value.name || value.nombre).slice(0, 80);
  if (!code || !name) return null;
  return {
    code,
    name,
    activo: value.activo !== false,
  };
}

function normalizeCatalogRole(value) {
  if (!value || typeof value !== 'object') return null;
  const roleValue = normalizeUserRole(value.value || value.rol);
  if (!roleValue) return null;
  const base = DEFAULT_ROLE_CATALOG.find((item) => item.value === roleValue);
  return {
    value: roleValue,
    label: text(value.label || base?.label || roleValue),
    permissions: text(value.permissions || base?.permissions || ''),
    activo: value.activo !== false,
  };
}

function normalizeCatalogs(catalogos) {
  const source = catalogos && typeof catalogos === 'object' ? catalogos : {};

  const branchSource = Array.isArray(source.sucursales) && source.sucursales.length > 0
    ? source.sucursales
    : DEFAULT_TICKET_BRANCHES;
  const branchMap = new Map();
  branchSource.forEach((branch) => {
    const normalized = normalizeCatalogBranch(branch);
    if (!normalized) return;
    branchMap.set(normalized.code, normalized);
  });
  const sucursales = branchMap.size > 0
    ? Array.from(branchMap.values())
    : DEFAULT_TICKET_BRANCHES.map((branch) => ({ ...branch }));

  const cargoSource = Array.isArray(source.cargos) && source.cargos.length > 0 ? source.cargos : DEFAULT_USER_CARGOS;
  const cargoMap = new Map();
  cargoSource.forEach((cargo) => {
    const normalized = text(cargo);
    if (!normalized) return;
    const key = normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!cargoMap.has(key)) cargoMap.set(key, normalized);
  });
  const cargos = cargoMap.size > 0 ? Array.from(cargoMap.values()) : [...DEFAULT_USER_CARGOS];

  const roleSource = Array.isArray(source.roles) && source.roles.length > 0 ? source.roles : DEFAULT_ROLE_CATALOG;
  const roleMap = new Map();
  roleSource.forEach((role) => {
    const normalized = normalizeCatalogRole(role);
    if (!normalized) return;
    roleMap.set(normalized.value, normalized);
  });
  DEFAULT_ROLE_CATALOG.forEach((role) => {
    if (!roleMap.has(role.value)) roleMap.set(role.value, { ...role });
  });
  const roles = DEFAULT_ROLE_CATALOG.map((role) => roleMap.get(role.value)).filter(Boolean);

  return { sucursales, cargos, roles };
}

function normalizeSupply(item) {
  const copy = { ...item };
  copy.nombre = String(copy.nombre || '').trim();
  copy.unidad = String(copy.unidad || 'Piezas').trim() || 'Piezas';
  copy.categoria = String(copy.categoria || 'HARDWARE').trim().toUpperCase() || 'HARDWARE';
  copy.stock = Math.max(0, Math.trunc(Number(copy.stock) || 0));
  copy.min = Math.max(0, Math.trunc(Number(copy.min) || 0));
  copy.activo = copy.activo !== false;
  return copy;
}

function text(value) {
  return String(value || '').trim();
}

function normalizeUserRole(value) {
  const role = text(value).toLowerCase();
  if (!USER_ROLES.has(role)) return 'consulta';
  return role;
}

function normalizeAuditModule(value) {
  const module = text(value).toLowerCase();
  if (!AUDIT_MODULES.has(module)) return '';
  return module;
}

function normalizeAuditResult(value) {
  const result = text(value).toLowerCase();
  if (!AUDIT_RESULTS.has(result)) return 'ok';
  return result;
}

function parseDateMs(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  const fallback = new Date(
    raw
      .replace(/\sa\.\s*m\./gi, ' AM')
      .replace(/\sp\.\s*m\./gi, ' PM')
      .replace(/\./g, ''),
  );
  if (!Number.isNaN(fallback.getTime())) return fallback.getTime();
  return null;
}

function isSensitiveAuditKey(key) {
  const normalized = text(key).toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('password')
    || normalized.includes('pass')
    || normalized.includes('secret')
    || normalized.includes('token')
    || normalized.includes('hash')
    || normalized.includes('auth')
  );
}

function sanitizeAuditSnapshot(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (depth > 3) return '[TRUNCATED]';
  if (typeof value === 'string') return value.slice(0, 400);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeAuditSnapshot(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value).slice(0, 400);

  const output = {};
  const keys = Object.keys(value).slice(0, 60);
  keys.forEach((key) => {
    if (isSensitiveAuditKey(key)) {
      output[key] = '[REDACTED]';
      return;
    }
    output[key] = sanitizeAuditSnapshot(value[key], depth + 1);
  });
  return output;
}

function normalizeAuditEntityId(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.trunc(numeric);
  return text(value).slice(0, 80) || null;
}

function normalizeAuditHash(value) {
  const hash = text(value).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return '';
  return hash;
}

function normalizeAuditPrevHash(value) {
  const normalized = text(value).toLowerCase();
  if (normalized === AUDIT_GENESIS_HASH) return AUDIT_GENESIS_HASH;
  return normalizeAuditHash(normalized);
}

function stableAuditStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableAuditStringify(item)).join(',')}]`;
  if (typeof value !== 'object') return JSON.stringify(String(value));

  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableAuditStringify(value[key])}`);
  return `{${pairs.join(',')}}`;
}

function buildAuditHashSource(entry) {
  return {
    id: Number(entry.id) || 0,
    accion: text(entry.accion),
    item: text(entry.item),
    cantidad: Math.max(0, Math.trunc(Number(entry.cantidad) || 0)),
    fecha: text(entry.fecha),
    usuario: text(entry.usuario),
    modulo: normalizeAuditModule(entry.modulo) || inferAuditModule(entry.accion, entry.item),
    timestamp: text(entry.timestamp),
    requestId: text(entry.requestId),
    ip: text(entry.ip),
    userAgent: text(entry.userAgent),
    userId: Number.isFinite(Number(entry.userId)) ? Math.trunc(Number(entry.userId)) : null,
    username: text(entry.username).toLowerCase(),
    rol: text(entry.rol).toLowerCase(),
    departamento: text(entry.departamento).toUpperCase(),
    resultado: normalizeAuditResult(entry.resultado),
    entidad: text(entry.entidad).toLowerCase(),
    entidadId: normalizeAuditEntityId(entry.entidadId),
    motivo: text(entry.motivo),
    before: sanitizeAuditSnapshot(entry.before),
    after: sanitizeAuditSnapshot(entry.after),
    meta: sanitizeAuditSnapshot(entry.meta),
  };
}

export function computeAuditEntryHash(entry, prevHash = 'genesis') {
  const previous = normalizeAuditPrevHash(prevHash) || AUDIT_GENESIS_HASH;
  const source = buildAuditHashSource(entry);
  const digest = createHash('sha256');
  digest.update(`${previous}|${stableAuditStringify(source)}`);
  return digest.digest('hex');
}

function inferAuditModule(accion, item = '') {
  const action = text(accion).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const subject = text(item).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

function normalizeAuditEntry(entry) {
  const copy = { ...entry };
  copy.accion = text(copy.accion);
  copy.item = text(copy.item);
  copy.cantidad = Math.max(0, Math.trunc(Number(copy.cantidad) || 0));
  copy.fecha = text(copy.fecha) || now();
  copy.usuario = text(copy.usuario) || 'Sistema';
  copy.modulo = normalizeAuditModule(copy.modulo) || inferAuditModule(copy.accion, copy.item);
  copy.timestamp = (() => {
    const source = text(copy.timestamp);
    if (source) {
      const parsed = parseDateMs(source);
      if (parsed !== null) return new Date(parsed).toISOString();
    }
    const parsedFecha = parseDateMs(copy.fecha);
    if (parsedFecha !== null) return new Date(parsedFecha).toISOString();
    return new Date().toISOString();
  })();
  copy.requestId = text(copy.requestId).slice(0, 120);
  copy.ip = text(copy.ip).slice(0, 120);
  copy.userAgent = text(copy.userAgent).slice(0, 280);
  copy.userId = Number.isFinite(Number(copy.userId)) ? Math.trunc(Number(copy.userId)) : null;
  copy.username = text(copy.username).toLowerCase();
  copy.rol = text(copy.rol).toLowerCase();
  copy.departamento = text(copy.departamento).toUpperCase();
  copy.resultado = normalizeAuditResult(copy.resultado);
  copy.entidad = text(copy.entidad).toLowerCase();
  copy.entidadId = normalizeAuditEntityId(copy.entidadId);
  copy.motivo = text(copy.motivo).slice(0, 240);
  copy.before = sanitizeAuditSnapshot(copy.before);
  copy.after = sanitizeAuditSnapshot(copy.after);
  copy.meta = sanitizeAuditSnapshot(copy.meta);
  copy.prevHash = normalizeAuditPrevHash(copy.prevHash);
  copy.hash = normalizeAuditHash(copy.hash);
  return copy;
}

function rebuildAuditChain(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const normalized = entries.map((entry) => normalizeAuditEntry(entry));
  const oldestFirst = [...normalized].reverse();
  let prevHash = AUDIT_GENESIS_HASH;
  oldestFirst.forEach((entry) => {
    entry.prevHash = prevHash;
    entry.hash = computeAuditEntryHash(entry, prevHash);
    prevHash = entry.hash;
  });
  return oldestFirst.reverse();
}

function normalizeAuditEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const normalized = entries.map((entry) => normalizeAuditEntry(entry));
  const requiresChainRebuild = normalized.some(
    (entry) => !normalizeAuditPrevHash(entry.prevHash) || !normalizeAuditHash(entry.hash),
  );
  if (requiresChainRebuild) {
    return rebuildAuditChain(normalized);
  }
  const oldestFirst = [...normalized].reverse();
  let prevHash = AUDIT_GENESIS_HASH;
  oldestFirst.forEach((entry) => {
    const storedPrevHash = normalizeAuditPrevHash(entry.prevHash);
    const storedHash = normalizeAuditHash(entry.hash);
    entry.prevHash = storedPrevHash || prevHash;
    entry.hash = storedHash || computeAuditEntryHash(entry, entry.prevHash);
    prevHash = entry.hash;
  });
  return oldestFirst.reverse();
}

function entryNeedsAuditMigration(entry) {
  const normalized = normalizeAuditEntry(entry);
  if (!normalized.accion) return true;
  if (!normalized.item) return true;
  if (!normalized.fecha) return true;
  if (!normalized.timestamp) return true;
  if (!normalizeAuditModule(normalized.modulo)) return true;
  if (!normalizeAuditPrevHash(normalized.prevHash)) return true;
  if (!normalizeAuditHash(normalized.hash)) return true;
  return false;
}

export function summarizeAuditIntegrity(entries) {
  const normalized = normalizeAuditEntries(entries);
  if (normalized.length === 0) {
    return {
      ok: true,
      total: 0,
      valid: 0,
      invalid: 0,
      firstBrokenId: null,
      checkedAt: new Date().toISOString(),
      lastExpectedHash: AUDIT_GENESIS_HASH,
      samples: [],
    };
  }

  const oldestFirst = [...normalized].reverse();
  let expectedPrevHash = AUDIT_GENESIS_HASH;
  let valid = 0;
  let invalid = 0;
  let firstBrokenId = null;
  const samples = [];

  oldestFirst.forEach((entry) => {
    const expectedHash = computeAuditEntryHash(entry, expectedPrevHash);
    const actualPrevHash = normalizeAuditPrevHash(entry.prevHash);
    const actualHash = normalizeAuditHash(entry.hash);
    const prevMatches = actualPrevHash === expectedPrevHash;
    const hashMatches = actualHash === expectedHash;

    if (prevMatches && hashMatches) {
      valid += 1;
    } else {
      invalid += 1;
      if (firstBrokenId === null) firstBrokenId = Number(entry.id) || null;
      if (samples.length < 5) {
        samples.push({
          id: Number(entry.id) || 0,
          prevHashExpected: expectedPrevHash,
          prevHashActual: actualPrevHash || '(empty)',
          hashExpected: expectedHash,
          hashActual: actualHash || '(empty)',
        });
      }
    }

    expectedPrevHash = expectedHash;
  });

  return {
    ok: invalid === 0,
    total: oldestFirst.length,
    valid,
    invalid,
    firstBrokenId,
    checkedAt: new Date().toISOString(),
    lastExpectedHash: expectedPrevHash,
    samples,
  };
}

function normalizeAssetStatus(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return 'Operativo';
  if (raw === 'falla' || raw === 'e') return 'Falla';
  if (raw.includes('falla') || raw.includes('inoper') || raw.includes('off') || raw.includes('down') || raw.includes('dan')) {
    return 'Falla';
  }
  return 'Operativo';
}

function normalizeMacAddress(value) {
  const compact = text(value).toLowerCase().replace(/[^0-9a-f]/g, '');
  if (compact.length !== 12) return '';
  return compact.match(/.{1,2}/g).join(':');
}

function normalizeIpAddress(value) {
  const raw = text(value);
  if (!raw) return '';
  const parts = raw.split('.');
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

function normalizeDate(value) {
  const raw = text(value);
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function normalizeAsset(item) {
  const copy = { ...item };
  copy.tag = text(copy.tag).toUpperCase() || `ACT-${Math.max(0, Math.trunc(Number(copy.id) || 0))}`;
  copy.tipo = text(copy.tipo || copy.equipo || 'EQUIPO').toUpperCase();
  copy.marca = text(copy.marca || 'SIN MARCA');
  copy.modelo = text(copy.modelo);
  copy.ubicacion = text(copy.ubicacion || 'SIN UBICACION');
  copy.estado = normalizeAssetStatus(copy.estado || copy.edo);
  copy.serial = text(copy.serial || copy.idInterno || `${copy.tag}-SN`).toUpperCase();
  copy.fechaCompra = normalizeDate(copy.fechaCompra);

  copy.idInterno = text(copy.idInterno).toUpperCase();
  copy.equipo = text(copy.equipo || copy.tipo).toUpperCase();
  copy.cpu = text(copy.cpu).toUpperCase();
  copy.ram = text(copy.ram).toUpperCase();
  copy.ramTipo = text(copy.ramTipo).toUpperCase();
  copy.disco = text(copy.disco).toUpperCase();
  copy.tipoDisco = text(copy.tipoDisco).toUpperCase();
  copy.macAddress = normalizeMacAddress(copy.macAddress || copy.mac);
  copy.ipAddress = normalizeIpAddress(copy.ipAddress || copy.ip);
  copy.responsable = text(copy.responsable);
  copy.departamento = text(copy.departamento).toUpperCase();
  copy.edo = text(copy.edo).toUpperCase();
  copy.anydesk = text(copy.anydesk);
  delete copy.passwordRemota;
  delete copy.pass;
  copy.aniosVida = text(copy.aniosVida);
  copy.comentarios = text(copy.comentarios);
  return copy;
}

function normalizeDbShape(db) {
  const normalized = { ...db };
  normalized.catalogos = normalizeCatalogs(db.catalogos);
  const validBranchCodes = new Set(
    normalized.catalogos.sucursales.map((branch) => text(branch?.code).toUpperCase()).filter(Boolean),
  );
  normalized.users = Array.isArray(db.users) && db.users.length > 0
    ? db.users.map((user) => {
      const copy = { ...user };
      const rawPassword = String(copy.password || '').trim();
      const hashedPassword = String(copy.passwordHash || '').trim();
      if (!hashedPassword) {
        const migrationSecret = rawPassword || randomBytes(16).toString('hex');
        copy.passwordHash = hashPassword(migrationSecret);
      }
      delete copy.password;
      copy.username = String(copy.username || '').trim().toLowerCase();
      copy.nombre = String(copy.nombre || '').trim();
      copy.departamento = String(copy.departamento || '').trim().toUpperCase();
      copy.rol = normalizeUserRole(copy.rol);
      copy.activo = copy.activo !== false;
      return copy;
    })
    : DEFAULT_USERS;
  normalized.activos = Array.isArray(db.activos) ? db.activos.map(normalizeAsset) : [];
  normalized.insumos = Array.isArray(db.insumos) ? db.insumos.map(normalizeSupply) : [];
  normalized.tickets = Array.isArray(db.tickets)
    ? db.tickets.map((ticket) => normalizeTicket(ticket, validBranchCodes))
    : [];
  normalized.auditoria = Array.isArray(db.auditoria) ? normalizeAuditEntries(db.auditoria) : [];

  if (!normalized.meta || typeof normalized.meta !== 'object') {
    normalized.meta = { nextId: maxExistingId(normalized) + 1 };
  }
  if (!Number.isFinite(Number(normalized.meta.nextId))) {
    normalized.meta.nextId = maxExistingId(normalized) + 1;
  }
  normalized.meta.nextId = Math.max(Math.trunc(Number(normalized.meta.nextId)), maxExistingId(normalized) + 1);

  return normalized;
}

function getPgPool() {
  if (!USE_POSTGRES) return null;
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      max: PG_POOL_MAX,
      ssl: PG_SSL_REQUIRED ? { rejectUnauthorized: false } : undefined,
      application_name: 'mesa-it',
    });
  }
  return pgPool;
}

async function loadBootstrapDb() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return normalizeDbShape(JSON.parse(raw));
  } catch {
    return loadSeedDb();
  }
}

async function ensurePgState() {
  if (!USE_POSTGRES) return;
  if (!pgInitPromise) {
    const pool = getPgPool();
    pgInitPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${PG_STATE_TABLE} (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const existing = await pool.query(`SELECT id FROM ${PG_STATE_TABLE} WHERE id = 1`);
      if (existing.rowCount && existing.rowCount > 0) return;

      if (IS_PRODUCTION && !ALLOW_PRODUCTION_SEED) {
        throw new Error(
          'DATABASE_URL esta configurado pero la base de datos no tiene estado inicial. Habilita ALLOW_PRODUCTION_SEED=true temporalmente para sembrarla.',
        );
      }

      const seedDb = await loadBootstrapDb();
      await pool.query(
        `INSERT INTO ${PG_STATE_TABLE} (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(seedDb)],
      );
    })().catch((error) => {
      pgInitPromise = null;
      throw error;
    });
  }
  await pgInitPromise;
}

async function ensureDbFile() {
  if (USE_POSTGRES) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    if (IS_PRODUCTION && !ALLOW_PRODUCTION_SEED) {
      throw new Error(
        `DB_FILE no existe en produccion (${DB_FILE}). Provisiona el runtime DB o habilita ALLOW_PRODUCTION_SEED=true temporalmente.`,
      );
    }
    const seedDb = await loadSeedDb();
    await fs.writeFile(DB_FILE, JSON.stringify(seedDb, null, 2), 'utf8');
  }
}

async function loadSeedDb() {
  try {
    const raw = await fs.readFile(DEFAULT_SEED_FILE, 'utf8');
    return normalizeDbShape(JSON.parse(raw));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

async function pruneBackups() {
  if (USE_POSTGRES) return;
  if (!DB_BACKUP_ENABLE) return;
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter((file) => /^db_\d{8}T\d{6}Z\.json$/.test(file))
      .sort((a, b) => a.localeCompare(b));
    if (backups.length <= DB_BACKUP_KEEP) return;

    const toDelete = backups.slice(0, backups.length - DB_BACKUP_KEEP);
    await Promise.all(
      toDelete.map((file) => fs.unlink(path.join(BACKUP_DIR, file)).catch(() => undefined)),
    );
  } catch {
    // Mantener continuidad de escritura principal aunque falle la poda de backups.
  }
}

async function backupCurrentDbSnapshot() {
  if (USE_POSTGRES) return;
  if (!DB_BACKUP_ENABLE) return;
  try {
    const current = await fs.readFile(DB_FILE, 'utf8');
    if (!current.trim()) return;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const backupFile = path.join(BACKUP_DIR, `db_${stamp}.json`);
    await fs.writeFile(backupFile, current, 'utf8');
    await pruneBackups();
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    // No bloquear operación principal si falla backup.
  }
}

export async function readDb() {
  let parsed;
  if (USE_POSTGRES) {
    await ensurePgState();
    const pool = getPgPool();
    const result = await pool.query(`SELECT data FROM ${PG_STATE_TABLE} WHERE id = 1`);
    parsed = result.rows[0]?.data || {};
  } else {
    await ensureDbFile();
    const raw = await fs.readFile(DB_FILE, 'utf8');
    parsed = JSON.parse(raw);
  }
  const normalized = normalizeDbShape(parsed);
  const assetsRequireSecretMigration = Array.isArray(parsed?.activos)
    && parsed.activos.some((asset) => (
      asset
      && typeof asset === 'object'
      && (
        Object.prototype.hasOwnProperty.call(asset, 'passwordRemota')
        || Object.prototype.hasOwnProperty.call(asset, 'pass')
      )
    ));
  const usersRequireMigration = Array.isArray(parsed?.users)
    && parsed.users.some((user) => typeof user?.password === 'string' || !String(user?.passwordHash || '').trim());
  const auditRequiresMigration = Array.isArray(parsed?.auditoria)
    && parsed.auditoria.some((entry) => entryNeedsAuditMigration(entry));
  const catalogsRequireMigration = !parsed?.catalogos
    || !Array.isArray(parsed.catalogos?.sucursales)
    || !Array.isArray(parsed.catalogos?.cargos)
    || !Array.isArray(parsed.catalogos?.roles);
  if (assetsRequireSecretMigration || usersRequireMigration || auditRequiresMigration || catalogsRequireMigration) {
    await writeDb(normalized, { backup: !assetsRequireSecretMigration });
  }
  return normalized;
}

async function writeDb(db, options = {}) {
  if (USE_POSTGRES) {
    await ensurePgState();
    const pool = getPgPool();
    await pool.query(
      `INSERT INTO ${PG_STATE_TABLE} (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(db)],
    );
    return;
  }
  await ensureDbFile();
  if (options.backup !== false) {
    await backupCurrentDbSnapshot();
  }
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export async function updateDb(mutator) {
  const job = queue.then(async () => {
    const db = await readDb();
    const snapshotBefore = JSON.stringify(db);
    const result = await mutator(db);
    const snapshotAfter = JSON.stringify(db);
    if (snapshotAfter !== snapshotBefore) {
      await writeDb(db);
    }
    return result;
  });

  queue = job.catch(() => undefined);
  return job;
}

export function nextId(db) {
  db.meta.nextId += 1;
  return db.meta.nextId;
}

export function now() {
  return new Date().toLocaleString('es-MX', { hour12: false });
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    nombre: user.nombre,
    username: user.username,
    rol: user.rol,
    departamento: text(user.departamento).toUpperCase(),
    activo: user.activo !== false,
  };
}

export function createUserPasswordHash(plainPassword) {
  return hashPassword(plainPassword);
}

export function verifyUserPassword(user, plainPassword) {
  const hash = String(user?.passwordHash || '').trim();
  if (hash) return verifyHashedPassword(plainPassword, hash);
  const legacy = String(user?.password || '');
  return legacy.length > 0 && legacy === String(plainPassword || '');
}

export function pushAudit(db, payload) {
  const modulo = normalizeAuditModule(payload.modulo) || inferAuditModule(payload.accion, payload.item);
  const currentAudit = Array.isArray(db.auditoria) ? db.auditoria : [];
  const latestHash = normalizeAuditHash(currentAudit[0]?.hash) || null;
  const prevHash = latestHash || AUDIT_GENESIS_HASH;
  const draftEntry = {
    id: nextId(db),
    accion: payload.accion || 'Accion',
    item: payload.item || 'N/A',
    cantidad: payload.cantidad,
    fecha: now(),
    usuario: payload.usuario || payload.username || 'Sistema',
    modulo,
    timestamp: payload.timestamp || new Date().toISOString(),
    requestId: payload.requestId || '',
    ip: payload.ip || '',
    userAgent: payload.userAgent || '',
    userId: payload.userId ?? null,
    username: payload.username || '',
    rol: payload.rol || '',
    departamento: payload.departamento || '',
    resultado: payload.resultado || payload.result || 'ok',
    entidad: payload.entidad || payload.entity || '',
    entidadId: payload.entidadId ?? payload.entityId ?? null,
    motivo: payload.motivo || payload.reason || '',
    before: payload.before,
    after: payload.after,
    meta: payload.meta,
    prevHash,
  };
  const entry = normalizeAuditEntry(draftEntry);
  entry.prevHash = normalizeAuditPrevHash(entry.prevHash) || AUDIT_GENESIS_HASH;
  entry.hash = computeAuditEntryHash(entry, entry.prevHash);
  db.auditoria = currentAudit;
  db.auditoria.unshift(entry);
  return entry;
}

export function getDataDirPath() {
  return DATA_DIR;
}

export function getStorageBackend() {
  return USE_POSTGRES ? 'postgres' : 'file';
}
