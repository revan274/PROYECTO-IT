import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createUserPasswordHash } from './store.js';

const ADMIN_PASSWORD = 'Admin.Integration.123';
const REQUESTER_PASSWORD = 'Solicitante.Integration.123';
const TECH_PASSWORD = 'Tecnico.Integration.123';

const ROLE_CATALOG = [
  { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
  { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: true },
  { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
  { value: 'solicitante', label: 'Solicitante', permissions: 'Crear y dar seguimiento a tickets', activo: true },
];

const BRANCH_CATALOG = [
  { code: 'TJ01', name: 'Sucursal Norte', activo: true },
];

const CARGO_CATALOG = ['Coordinador de Sistemas', 'Auxiliar de Sistemas'];

const ADMIN_USER = {
  id: 501,
  nombre: 'Admin Integracion',
  username: 'admin.integration',
  passwordHash: createUserPasswordHash(ADMIN_PASSWORD),
  rol: 'admin',
  departamento: 'IT',
  activo: true,
};

const TECH_USER = {
  id: 502,
  nombre: 'Técnico Integración',
  username: 'tecnico.integration',
  passwordHash: createUserPasswordHash(TECH_PASSWORD),
  rol: 'tecnico',
  departamento: 'IT',
  activo: true,
};

const REQUESTER_USER = {
  id: 601,
  nombre: 'Solicitante Integracion',
  username: 'solicitante.integration',
  passwordHash: createUserPasswordHash(REQUESTER_PASSWORD),
  rol: 'solicitante',
  departamento: 'VENTAS',
  activo: true,
};

function createTicket({
  id,
  activoTag,
  descripcion,
  prioridad,
  estado,
  atencionTipo,
  trasladoRequerido,
  fecha,
  fechaCreacion,
  fechaLimite,
  sucursal,
  solicitadoPor,
  solicitadoPorId,
  solicitadoPorUsername,
  departamento,
  asignadoA = '',
}) {
  return {
    id,
    activoTag,
    descripcion,
    prioridad,
    estado,
    atencionTipo,
    ...(trasladoRequerido !== undefined ? { trasladoRequerido } : {}),
    fecha,
    fechaCreacion,
    fechaLimite,
    sucursal,
    solicitadoPor,
    solicitadoPorId,
    solicitadoPorUsername,
    departamento,
    asignadoA,
    attachments: [],
    historial: [
      {
        fecha,
        usuario: solicitadoPor,
        accion: 'Ticket Creado',
        estado,
        comentario: 'Generado para prueba de integracion',
      },
    ],
  };
}

function buildFixtureDb() {
  return {
    meta: { nextId: 900 },
    catalogos: {
      sucursales: BRANCH_CATALOG,
      cargos: CARGO_CATALOG,
      roles: ROLE_CATALOG,
    },
    users: [ADMIN_USER, TECH_USER, REQUESTER_USER],
    activos: [
      {
        id: 1,
        tag: 'POS-001',
        tipo: 'POS',
        marca: 'IBM',
        ubicacion: 'Caja 1',
        estado: 'Operativo',
        serial: 'POS-001-SN',
        fechaCompra: '2025-01-10',
        passwordRemota: 'Secreto.Legacy.123',
      },
      {
        id: 2,
        tag: 'BAS-010',
        tipo: 'Báscula',
        marca: 'Datalogic',
        ubicacion: 'Frutas',
        estado: 'Falla',
        serial: 'BAS-010-SN',
        fechaCompra: '2024-08-14',
      },
    ],
    insumos: [
      {
        id: 11,
        nombre: 'Cable Ethernet Cat6',
        unidad: 'Piezas',
        stock: 25,
        min: 10,
        categoria: 'REDES',
        activo: true,
      },
    ],
    travelAdjustments: [],
    tickets: [
      createTicket({
        id: 701,
        activoTag: 'POS-001',
        descripcion: 'La terminal no sincroniza ventas.',
        prioridad: 'MEDIA',
        estado: 'Abierto',
        atencionTipo: 'REMOTO',
        fecha: '2026-03-29 09:00',
        fechaCreacion: '2026-03-29T09:00:00.000Z',
        fechaLimite: '2026-03-30T09:00:00.000Z',
        sucursal: 'TJ01',
        solicitadoPor: REQUESTER_USER.nombre,
        solicitadoPorId: REQUESTER_USER.id,
        solicitadoPorUsername: REQUESTER_USER.username,
        departamento: REQUESTER_USER.departamento,
      }),
      createTicket({
        id: 702,
        activoTag: 'BAS-010',
        descripcion: 'Báscula sin comunicación con caja.',
        prioridad: 'ALTA',
        estado: 'En Proceso',
        atencionTipo: 'PRESENCIAL',
        trasladoRequerido: true,
        fecha: '2026-03-30 12:00',
        fechaCreacion: '2026-03-30T12:00:00.000Z',
        fechaLimite: '2026-03-30T20:00:00.000Z',
        sucursal: 'TJ01',
        solicitadoPor: ADMIN_USER.nombre,
        solicitadoPorId: ADMIN_USER.id,
        solicitadoPorUsername: ADMIN_USER.username,
        departamento: ADMIN_USER.departamento,
        asignadoA: TECH_USER.nombre,
      }),
    ],
    auditoria: [],
  };
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo obtener un puerto libre para pruebas.')));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(baseUrl, child, getLogs) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`El servidor de integracion termino antes de responder.\n${getLogs()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Seguir reintentando hasta que el servidor quede listo.
    }

    await delay(150);
  }

  throw new Error(`El servidor de integracion no estuvo listo a tiempo.\n${getLogs()}`);
}

async function startTestServer(dbFile, attachmentsDir) {
  const port = await reservePort();
  let logs = '';
  const child = spawn(process.execPath, ['server/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_FILE: dbFile,
      // Deliberadamente FUERA del árbol de DB_FILE: es la configuración de producción
      // recomendada (volumen persistente) y la que rompía la resolución de rutas.
      ATTACHMENTS_DIR: attachmentsDir,
      DB_BACKUP_ENABLE: 'false',
      AUTH_RATE_LIMIT_MAX: '10000',
      AUTH_DISALLOW_DEMO_PASSWORDS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  const appendLogs = (chunk) => {
    logs += chunk.toString();
  };

  child.stdout?.on('data', appendLogs);
  child.stderr?.on('data', appendLogs);

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child, () => logs);

  return {
    baseUrl,
    child,
    getLogs() {
      return logs;
    },
  };
}

async function stopTestServer(child) {
  if (!child || child.exitCode !== null) return;

  if (child.connected) child.send({ type: 'shutdown' });
  else child.kill();
  const exitedCleanly = await Promise.race([
    once(child, 'exit').then(() => true),
    delay(3_000).then(() => false),
  ]);

  if (exitedCleanly || child.exitCode !== null) return;

  child.kill('SIGKILL');
  await once(child, 'exit');
}

let tempDir = '';
let dbFilePath = '';
let attachmentsDirPath = '';
let serverRuntime = null;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'mesa-it-integration-'));
  dbFilePath = path.join(tempDir, 'db.json');
  attachmentsDirPath = path.join(tempDir, 'volumen-adjuntos');
  await writeFile(dbFilePath, JSON.stringify(buildFixtureDb(), null, 2), 'utf8');
  serverRuntime = await startTestServer(dbFilePath, attachmentsDirPath);
});

after(async () => {
  await stopTestServer(serverRuntime?.child);
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

async function requestJson(urlPath, {
  method = 'GET',
  token,
  body,
  headers: extraHeaders = {},
} = {}) {
  assert.ok(serverRuntime?.baseUrl, 'El servidor de integracion no fue inicializado.');

  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${serverRuntime.baseUrl}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  return { response, data };
}

async function login(username, password) {
  const { response, data } = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });

  assert.equal(
    response.status,
    200,
    `El login de pruebas fallo con ${response.status}: ${JSON.stringify(data)}\n${serverRuntime?.getLogs?.() || ''}`,
  );

  return data;
}

async function readPersistedDb() {
  return JSON.parse(await readFile(dbFilePath, 'utf8'));
}

test('POST /api/auth/login emite token y sanea el usuario', async () => {
  const data = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  assert.equal(typeof data.token, 'string');
  assert.ok(data.token.length > 20);
  assert.equal(data.user.username, ADMIN_USER.username);
  assert.equal(data.user.rol, ADMIN_USER.rol);
  assert.equal(data.user.departamento, ADMIN_USER.departamento);
  assert.equal(Object.hasOwn(data.user, 'password'), false);
  assert.equal(Object.hasOwn(data.user, 'passwordHash'), false);
  assert.equal(typeof data.loggedAt, 'string');
});

test('GET /api/health expone backend de almacenamiento activo', async () => {
  const { response, data } = await requestJson('/api/health');

  assert.equal(response.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(typeof data.timestamp, 'string');
  assert.equal(data.storageBackend, 'file');
});

test('GET /api/bootstrap limita el payload para solicitantes', async () => {
  const session = await login(REQUESTER_USER.username, REQUESTER_PASSWORD);
  const { response, data } = await requestJson('/api/bootstrap', {
    token: session.token,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(data.activos, [
    { id: 1, tag: 'POS-001', tipo: 'POS', ubicacion: 'Caja 1', departamento: '' },
    { id: 2, tag: 'BAS-010', tipo: 'BÁSCULA', ubicacion: 'Frutas', departamento: '' },
  ]);
  assert.deepEqual(data.insumos, []);
  assert.deepEqual(data.users, []);
  assert.deepEqual(data.auditoria, []);
  assert.equal(Array.isArray(data.tickets), true);
  assert.equal(data.tickets.length, 1);
  assert.equal(data.tickets[0].id, 701);
  assert.equal(data.tickets[0].solicitadoPorUsername, REQUESTER_USER.username);
  assert.equal(data.riskSummary, undefined);
  assert.equal(Array.isArray(data.ticketStates), true);
  assert.equal(typeof data.meta.generatedAt, 'string');
});

test('GET /api/bootstrap responde 304 cuando la revisión no cambió', async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const first = await requestJson('/api/bootstrap', {
    token: session.token,
  });

  assert.equal(first.response.status, 200, JSON.stringify(first.data));
  const etag = first.response.headers.get('etag');
  assert.equal(typeof etag, 'string');
  assert.ok(etag?.startsWith('W/"mesa-it-bootstrap-v2-'));
  assert.equal(Number.isFinite(Number(first.data?.meta?.revision)), true);
  assert.match(first.response.headers.get('vary') || '', /Authorization/i);

  const unchanged = await requestJson('/api/bootstrap', {
    token: session.token,
    headers: { 'If-None-Match': etag },
  });

  assert.equal(unchanged.response.status, 304);
  assert.equal(unchanged.data, null);
  assert.equal(unchanged.response.headers.get('etag'), etag);
});

test('GET /api/tickets pagina y ordena tickets para administradores', async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const { response, data } = await requestJson('/api/tickets?page=1&pageSize=1', {
    token: session.token,
  });

  assert.equal(response.status, 200);
  assert.equal(data.pagination.page, 1);
  assert.equal(data.pagination.pageSize, 1);
  assert.equal(data.pagination.total, 2);
  assert.equal(data.pagination.totalPages, 2);
  assert.equal(Array.isArray(data.items), true);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].id, 702);
  assert.equal(data.items[0].activoTag, 'BAS-010');
  assert.equal(Array.isArray(data.items[0].attachments), true);
  assert.equal(typeof data.items[0].slaVencido, 'boolean');
  assert.equal(typeof data.items[0].slaRestanteMin, 'number');
});

test('GET /api/bootstrap sanea credenciales remotas legacy en API y runtime DB', async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const { response, data } = await requestJson('/api/bootstrap', {
    token: session.token,
  });

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(data.activos), true);
  assert.equal(data.activos.length >= 1, true);
  assert.equal(Object.hasOwn(data.activos[0], 'passwordRemota'), false);
  assert.equal(Object.hasOwn(data.activos[0], 'pass'), false);

  const persisted = JSON.parse(await readFile(dbFilePath, 'utf8'));
  assert.equal(Array.isArray(persisted.activos), true);
  assert.equal(Object.hasOwn(persisted.activos[0], 'passwordRemota'), false);
  assert.equal(Object.hasOwn(persisted.activos[0], 'pass'), false);
});

test('PUT /api/travel-adjustments persiste viajes reales y bootstrap los devuelve', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const saved = await requestJson('/api/travel-adjustments', {
    method: 'PUT',
    token: session.token,
    body: {
      month: '2026-03',
      technicianScopeKey: `user:${TECH_USER.id}`,
      technicianScopeLabel: TECH_USER.nombre,
      destinationCode: 'TJ01',
      trips: 3,
    },
  });

  assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.adjustment.month, '2026-03');
  assert.equal(saved.data.adjustment.technicianScopeKey, `user:${TECH_USER.id}`);
  assert.equal(saved.data.adjustment.destinationCode, 'TJ01');
  assert.equal(saved.data.adjustment.trips, 3);

  const bootstrap = await requestJson('/api/bootstrap', {
    token: session.token,
  });

  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.data));
  assert.equal(Array.isArray(bootstrap.data.travelAdjustments), true);
  assert.equal(bootstrap.data.travelAdjustments.length, 1);
  assert.equal(bootstrap.data.travelAdjustments[0].trips, 3);

  const persisted = await readPersistedDb();
  assert.equal(Array.isArray(persisted.travelAdjustments), true);
  assert.equal(persisted.travelAdjustments.length, 1);
  assert.equal(persisted.travelAdjustments[0].trips, 3);
  assert.equal(persisted.travelAdjustments[0].technicianScopeKey, `user:${TECH_USER.id}`);
  assert.equal(persisted.auditoria.some((entry) => entry.accion === 'Viajes Reales Actualizados'), true);
});

test('POST/PATCH /api/users crea y actualiza usuarios sanitizados', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const username = 'usuario.integration';

  const created = await requestJson('/api/users', {
    method: 'POST',
    token: session.token,
    body: {
      nombre: 'Usuario Integracion',
      username,
      password: 'Usuario.Integration.123',
      cargo: 'Coordinador de Sistemas',
      rol: 'tecnico',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.username, username);
  assert.equal(created.data.rol, 'tecnico');
  assert.equal(created.data.departamento, 'COORDINADOR DE SISTEMAS');
  assert.equal(Object.hasOwn(created.data, 'passwordHash'), false);

  const updated = await requestJson(`/api/users/${created.data.id}`, {
    method: 'PATCH',
    token: session.token,
    body: {
      nombre: 'Usuario Integracion Editado',
      cargo: 'Auxiliar de Sistemas',
      rol: 'solicitante',
      activo: false,
    },
  });

  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.nombre, 'Usuario Integracion Editado');
  assert.equal(updated.data.rol, 'solicitante');
  assert.equal(updated.data.activo, false);
  assert.equal(updated.data.departamento, 'AUXILIAR DE SISTEMAS');
  assert.equal(Object.hasOwn(updated.data, 'passwordHash'), false);

  const listed = await requestJson('/api/users', {
    token: session.token,
  });

  assert.equal(listed.response.status, 200);
  const listedUser = listed.data.find((item) => item.username === username);
  assert.ok(listedUser);
  assert.equal(listedUser.departamento, 'AUXILIAR DE SISTEMAS');
  assert.equal(listedUser.rol, 'solicitante');
  assert.equal(Object.hasOwn(listedUser, 'passwordHash'), false);

  const persisted = await readPersistedDb();
  const storedUser = persisted.users.find((item) => item.username === username);
  assert.ok(storedUser);
  assert.equal(storedUser.nombre, 'Usuario Integracion Editado');
  assert.equal(storedUser.departamento, 'Auxiliar de Sistemas');
  assert.equal(storedUser.rol, 'solicitante');
  assert.equal(storedUser.activo, false);
  assert.equal(typeof storedUser.passwordHash, 'string');
  assert.ok(storedUser.passwordHash.length > 20);
});

test('POST/PATCH /api/activos crea y actualiza activos persistidos', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const assetPayload = {
    tag: 'LAP-INT-900',
    tipo: 'Laptop',
    marca: 'Dell',
    modelo: 'Latitude 5440',
    ubicacion: 'Oficina TI',
    serial: 'LAP-INT-900-SN',
    fechaCompra: '2026-01-15',
    estado: 'Operativo',
    idInterno: 'INT-900',
    equipo: 'Laptop',
    cpu: 'Intel Core i7',
    ram: '16 GB',
    ramTipo: 'DDR5',
    disco: '512 GB',
    tipoDisco: 'SSD',
    macAddress: 'AA:BB:CC:DD:EE:91',
    ipAddress: '10.10.10.91',
    responsable: 'Mesa IT',
    departamento: 'IT',
    anydesk: '123456789',
    aniosVida: '1',
    comentarios: 'Alta de prueba',
  };

  const created = await requestJson('/api/activos', {
    method: 'POST',
    token: session.token,
    body: assetPayload,
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.tag, 'LAP-INT-900');
  assert.equal(created.data.marca, 'Dell');
  assert.equal(Object.hasOwn(created.data, 'passwordRemota'), false);
  assert.equal(Object.hasOwn(created.data, 'pass'), false);

  const updated = await requestJson(`/api/activos/${created.data.id}`, {
    method: 'PATCH',
    token: session.token,
    body: {
      ...assetPayload,
      marca: 'Lenovo',
      modelo: 'ThinkPad T14',
      estado: 'Falla',
      ipAddress: '10.10.10.92',
      macAddress: 'AA:BB:CC:DD:EE:92',
      responsable: 'Soporte Campo',
      comentarios: 'Actualización de prueba',
    },
  });

  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.marca, 'Lenovo');
  assert.equal(updated.data.modelo, 'ThinkPad T14');
  assert.equal(updated.data.estado, 'Falla');
  assert.equal(updated.data.ipAddress, '10.10.10.92');
  assert.equal(updated.data.macAddress, 'aa:bb:cc:dd:ee:92');

  const listed = await requestJson('/api/activos?search=LAP-INT-900', {
    token: session.token,
  });

  assert.equal(listed.response.status, 200);
  assert.equal(Array.isArray(listed.data), true);
  const listedAsset = listed.data.find((item) => item.tag === 'LAP-INT-900');
  assert.ok(listedAsset);
  assert.equal(listedAsset.marca, 'Lenovo');

  const persisted = await readPersistedDb();
  const storedAsset = persisted.activos.find((item) => item.tag === 'LAP-INT-900');
  assert.ok(storedAsset);
  assert.equal(storedAsset.marca, 'Lenovo');
  assert.equal(storedAsset.modelo, 'ThinkPad T14');
  assert.equal(storedAsset.estado, 'Falla');
  assert.equal(storedAsset.ipAddress, '10.10.10.92');
  assert.equal(storedAsset.macAddress, 'aa:bb:cc:dd:ee:92');
});

test('POST/PATCH stock/DELETE /api/insumos persiste cambios de inventario', { concurrency: false }, async () => {
  const session = await login(TECH_USER.username, TECH_PASSWORD);
  const nombre = 'Mouse Optico Integracion';

  const created = await requestJson('/api/insumos', {
    method: 'POST',
    token: session.token,
    body: {
      nombre,
      unidad: 'Piezas',
      stock: 12,
      min: 4,
      categoria: 'PERIFERICOS',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.nombre, nombre);
  assert.equal(created.data.stock, 12);
  assert.equal(created.data.activo, true);

  const adjusted = await requestJson(`/api/insumos/${created.data.id}/stock`, {
    method: 'PATCH',
    token: session.token,
    body: {
      delta: -3,
    },
  });

  assert.equal(adjusted.response.status, 200, JSON.stringify(adjusted.data));
  assert.equal(adjusted.data.stock, 9);

  const removed = await requestJson(`/api/insumos/${created.data.id}`, {
    method: 'DELETE',
    token: session.token,
  });

  assert.equal(removed.response.status, 200, JSON.stringify(removed.data));
  assert.equal(removed.data.ok, true);
  assert.equal(removed.data.deactivated.activo, false);

  const persisted = await readPersistedDb();
  const storedSupply = persisted.insumos.find((item) => item.nombre === nombre);
  assert.ok(storedSupply);
  assert.equal(storedSupply.stock, 9);
  assert.equal(storedSupply.activo, false);
  assert.equal(storedSupply.categoria, 'PERIFERICOS');
});

test('POST/PATCH /api/insumos permite un mínimo superior al stock', { concurrency: false }, async () => {
  const session = await login(TECH_USER.username, TECH_PASSWORD);
  const nombre = 'Papel Termico Bajo Minimo';

  const created = await requestJson('/api/insumos', {
    method: 'POST',
    token: session.token,
    body: {
      nombre,
      unidad: 'Rollos',
      stock: 3,
      min: 12,
      categoria: 'CONSUMIBLES',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.stock, 3);
  assert.equal(created.data.min, 12);

  const updated = await requestJson(`/api/insumos/${created.data.id}`, {
    method: 'PATCH',
    token: session.token,
    body: {
      nombre,
      unidad: 'Rollos',
      stock: 2,
      min: 15,
      categoria: 'CONSUMIBLES',
      ubicacion: 'Almacén IT',
      proveedor: 'Proveedor Integración',
    },
  });

  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.stock, 2);
  assert.equal(updated.data.min, 15);

  const persisted = await readPersistedDb();
  const storedSupply = persisted.insumos.find((item) => Number(item.id) === Number(created.data.id));
  assert.ok(storedSupply);
  assert.equal(storedSupply.stock, 2);
  assert.equal(storedSupply.min, 15);
});

test('resolver un ticket mantiene el activo en falla si existe otro ticket abierto relacionado', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'BAS-010',
      descripcion: 'Seguimiento adicional para la bascula',
      sucursal: 'TJ01',
      prioridad: 'ALTA',
      atencionTipo: 'REMOTO',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.activoTag, 'BAS-010');
  assert.equal(created.data.estado, 'Abierto');

  const resolved = await requestJson('/api/tickets/702/resolve', {
    method: 'PATCH',
    token: session.token,
    body: {
      comentario: 'Atendido en sitio',
    },
  });

  assert.equal(resolved.response.status, 200, JSON.stringify(resolved.data));
  assert.equal(resolved.data.estado, 'Resuelto');

  const inventory = await requestJson('/api/activos?search=BAS-010', {
    token: session.token,
  });

  assert.equal(inventory.response.status, 200, JSON.stringify(inventory.data));
  const asset = inventory.data.find((item) => item.tag === 'BAS-010');
  assert.ok(asset);
  assert.equal(asset.estado, 'Falla');

  const persisted = await readPersistedDb();
  const storedAsset = persisted.activos.find((item) => item.tag === 'BAS-010');
  assert.ok(storedAsset);
  assert.equal(storedAsset.estado, 'Falla');
});

test('POST/PATCH /api/tickets persiste traslado y nuevos tipos de atención', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Atención fuera de horario en sucursal',
      sucursal: 'TJ01',
      prioridad: 'ALTA',
      atencionTipo: 'PRESENCIAL_FUERA_DE_HORARIO',
      trasladoRequerido: true,
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.atencionTipo, 'PRESENCIAL_FUERA_DE_HORARIO');
  assert.equal(created.data.trasladoRequerido, true);

  const updated = await requestJson(`/api/tickets/${created.data.id}`, {
    method: 'PATCH',
    token: session.token,
    body: {
      atencionTipo: 'REMOTO_FUERA_DE_HORARIO',
      trasladoRequerido: false,
    },
  });

  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.atencionTipo, 'REMOTO_FUERA_DE_HORARIO');
  assert.equal(updated.data.trasladoRequerido, false);

  const persisted = await readPersistedDb();
  const storedTicket = persisted.tickets.find((item) => item.id === created.data.id);
  assert.ok(storedTicket);
  assert.equal(storedTicket.atencionTipo, 'REMOTO_FUERA_DE_HORARIO');
  assert.equal(storedTicket.trasladoRequerido, false);
});

test('POST /api/tickets ignora modalidad enviada por solicitantes', { concurrency: false }, async () => {
  const session = await login(REQUESTER_USER.username, REQUESTER_PASSWORD);

  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Caja sin conexión reportada por solicitante',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'PRESENCIAL',
      trasladoRequerido: true,
      asignadoA: TECH_USER.nombre,
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.solicitadoPorId, REQUESTER_USER.id);
  assert.equal(created.data.asignadoA, '');
  assert.equal(created.data.atencionTipo, undefined);
  assert.equal(created.data.trasladoRequerido, undefined);

  const persisted = await readPersistedDb();
  const storedTicket = persisted.tickets.find((item) => item.id === created.data.id);
  assert.ok(storedTicket);
  assert.equal(storedTicket.asignadoA, '');
  assert.equal(storedTicket.atencionTipo, undefined);
  assert.equal(storedTicket.trasladoRequerido, undefined);
});

test('POST /api/tickets/historical registra un ticket pasado cerrado con fechas personalizadas', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const fechaCreacion = '2026-01-10T09:00:00.000Z';
  const fechaCierre = '2026-01-12T15:30:00.000Z';

  const created = await requestJson('/api/tickets/historical', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Falla histórica registrada de forma retroactiva',
      sucursal: 'TJ01',
      prioridad: 'ALTA',
      atencionTipo: 'REMOTO',
      estado: 'Cerrado',
      fechaCreacion,
      fechaCierre,
      asignadoA: TECH_USER.nombre,
      comentarioResolucion: 'Resuelto en su momento',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.estado, 'Cerrado');
  assert.equal(created.data.esHistorico, true);
  assert.equal(created.data.fechaCreacion, fechaCreacion);
  assert.equal(created.data.fechaCierre, fechaCierre);
  assert.equal(created.data.atencionTipo, 'REMOTO');
  assert.equal(created.data.asignadoA, TECH_USER.nombre);
  // SLA calculado desde la fecha histórica (ALTA = 8h), no desde ahora, y solo con horas
  // hábiles: el ticket nace el sábado 10/01 a las 03:00 (cerrado), así que arranca a las
  // 09:00, consume las 3 h del sábado corto, salta el domingo y termina el lunes 12/01 a
  // las 13:00 local. El cálculo anterior devolvía sábado 11:00 porque cobraba como SLA las
  // seis horas de madrugada en que nadie podía atenderlo.
  assert.equal(created.data.fechaLimite, '2026-01-12T19:00:00.000Z');
  assert.equal(Array.isArray(created.data.historial), true);
  assert.equal(created.data.historial.length, 2);
  assert.equal(created.data.historial[0].estado, 'Cerrado');
  assert.equal(created.data.historial[1].accion, 'Ticket Creado');

  const persisted = await readPersistedDb();
  const storedTicket = persisted.tickets.find((item) => item.id === created.data.id);
  assert.ok(storedTicket);
  assert.equal(storedTicket.esHistorico, true);
  assert.equal(storedTicket.fechaCreacion, fechaCreacion);
  assert.equal(storedTicket.fechaCierre, fechaCierre);
  // Un histórico cerrado no debe alterar el estado operativo actual del activo.
  const storedAsset = persisted.activos.find((item) => item.tag === 'POS-001');
  assert.ok(storedAsset);
  assert.equal(storedAsset.estado, 'Operativo');
  assert.equal(persisted.auditoria.some((entry) => entry.accion === 'Ticket Histórico'), true);
});

test('POST /api/tickets/historical rechaza no administradores y datos inválidos', { concurrency: false }, async () => {
  const techSession = await login(TECH_USER.username, TECH_PASSWORD);
  const forbidden = await requestJson('/api/tickets/historical', {
    method: 'POST',
    token: techSession.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Intento de histórico por técnico',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      estado: 'Cerrado',
      fechaCreacion: '2026-01-10T09:00:00.000Z',
      fechaCierre: '2026-01-11T09:00:00.000Z',
    },
  });
  assert.equal(forbidden.response.status, 403, JSON.stringify(forbidden.data));

  const adminSession = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const future = await requestJson('/api/tickets/historical', {
    method: 'POST',
    token: adminSession.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Histórico con fecha futura',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      estado: 'Cerrado',
      fechaCreacion: futureDate,
      fechaCierre: futureDate,
    },
  });
  assert.equal(future.response.status, 400, JSON.stringify(future.data));

  const missingClose = await requestJson('/api/tickets/historical', {
    method: 'POST',
    token: adminSession.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Histórico cerrado sin fecha de cierre',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      estado: 'Cerrado',
      fechaCreacion: '2026-01-10T09:00:00.000Z',
    },
  });
  assert.equal(missingClose.response.status, 400, JSON.stringify(missingClose.data));
});

test('reabrir y cerrar de nuevo un ticket limpia y recalcula fechaCierre', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const firstClose = await requestJson('/api/tickets/701', {
    method: 'PATCH',
    token: session.token,
    body: {
      estado: 'Resuelto',
    },
  });

  assert.equal(firstClose.response.status, 200, JSON.stringify(firstClose.data));
  assert.equal(firstClose.data.estado, 'Resuelto');
  assert.equal(typeof firstClose.data.fechaCierre, 'string');
  const firstClosedAt = firstClose.data.fechaCierre;

  await delay(20);

  const reopened = await requestJson('/api/tickets/701', {
    method: 'PATCH',
    token: session.token,
    body: {
      estado: 'Abierto',
    },
  });

  assert.equal(reopened.response.status, 200, JSON.stringify(reopened.data));
  assert.equal(reopened.data.estado, 'Abierto');
  assert.equal(reopened.data.fechaCierre, undefined);

  await delay(20);

  const secondClose = await requestJson('/api/tickets/701', {
    method: 'PATCH',
    token: session.token,
    body: {
      estado: 'Cerrado',
    },
  });

  assert.equal(secondClose.response.status, 200, JSON.stringify(secondClose.data));
  assert.equal(secondClose.data.estado, 'Cerrado');
  assert.equal(typeof secondClose.data.fechaCierre, 'string');
  assert.notEqual(secondClose.data.fechaCierre, firstClosedAt);
  assert.equal(new Date(secondClose.data.fechaCierre).getTime() > new Date(firstClosedAt).getTime(), true);
});

test('un rol deshabilitado pierde acceso aunque ya tuviera una sesión activa', { concurrency: false }, async () => {
  const adminSession = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const techSession = await login(TECH_USER.username, TECH_PASSWORD);

  const blockedAdminCatalog = await requestJson('/api/catalogos', {
    method: 'PATCH',
    token: adminSession.token,
    body: {
      roles: [
        { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: false },
        { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: true },
        { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
        { value: 'solicitante', label: 'Solicitante', permissions: 'Crear y dar seguimiento a tickets', activo: true },
      ],
    },
  });

  assert.equal(blockedAdminCatalog.response.status, 409, JSON.stringify(blockedAdminCatalog.data));
  assert.equal(blockedAdminCatalog.data.error, 'El rol administrador debe permanecer activo.');

  const updatedCatalog = await requestJson('/api/catalogos', {
    method: 'PATCH',
    token: adminSession.token,
    body: {
      roles: [
        { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
        { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: false },
        { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
        { value: 'solicitante', label: 'Solicitante', permissions: 'Crear y dar seguimiento a tickets', activo: true },
      ],
    },
  });

  assert.equal(updatedCatalog.response.status, 200, JSON.stringify(updatedCatalog.data));

  const forbidden = await requestJson('/api/insumos', {
    method: 'POST',
    token: techSession.token,
    body: {
      nombre: 'Cable bloqueado por rol',
      unidad: 'Piezas',
      stock: 1,
      min: 0,
      categoria: 'REDES',
    },
  });

  assert.equal(forbidden.response.status, 403, JSON.stringify(forbidden.data));
  assert.equal(forbidden.data.error, 'Tu rol está deshabilitado en catálogo.');
});

test('GET /api/auditoria soporta all=1 y entityId para consultas bajo demanda', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const created = await requestJson('/api/insumos', {
    method: 'POST',
    token: session.token,
    body: {
      nombre: 'Switch Auditoría Integración',
      unidad: 'Piezas',
      stock: 5,
      min: 1,
      categoria: 'REDES',
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));

  await requestJson(`/api/insumos/${created.data.id}/stock`, {
    method: 'PATCH',
    token: session.token,
    body: {
      delta: 2,
    },
  });

  const audit = await requestJson(`/api/auditoria?module=insumos&entity=insumo&entityId=${created.data.id}&all=1&includeDiagnostics=0`, {
    token: session.token,
  });

  assert.equal(audit.response.status, 200, JSON.stringify(audit.data));
  assert.equal(Array.isArray(audit.data.items), true);
  assert.equal(audit.data.items.length >= 2, true);
  assert.equal(audit.data.pagination.total, audit.data.items.length);
  assert.equal(audit.data.filters.entityId, String(created.data.id));
  assert.equal(audit.data.summary, undefined);
  assert.equal(audit.data.integrity, undefined);
  assert.equal(audit.data.alerts, undefined);
  assert.equal(audit.data.items.every((item) => Number(item.entidadId) === Number(created.data.id)), true);
});

test('GET /api/bootstrap limita la auditoría incluida para reducir payload inicial', { concurrency: false }, async () => {
  const persisted = await readPersistedDb();
  persisted.auditoria = Array.from({ length: 40 }, (_, index) => ({
    id: 3000 + index,
    accion: `Evento ${index + 1}`,
    item: `Item ${index + 1}`,
    cantidad: 1,
    fecha: `2026-04-${String((index % 9) + 1).padStart(2, '0')} 10:00`,
    usuario: 'Admin Integracion',
    modulo: 'otros',
  }));
  await writeFile(dbFilePath, JSON.stringify(persisted, null, 2), 'utf8');

  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const bootstrap = await requestJson('/api/bootstrap', {
    token: session.token,
  });

  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.data));
  assert.equal(Array.isArray(bootstrap.data.auditoria), true);
  assert.equal(bootstrap.data.auditoria.length, 25);
});

// --- Regresión de hallazgos ofensivos (H1, H2, H4) ---

test('H1: un solicitante no puede consumir insumos al crear ticket (403, stock intacto)', { concurrency: false }, async () => {
  const before = await readPersistedDb();
  const supplyBefore = before.insumos.find((item) => item.id === 11);
  assert.ok(supplyBefore, 'El insumo de prueba (11) debe existir en el fixture.');
  const stockBefore = supplyBefore.stock;

  const session = await login(REQUESTER_USER.username, REQUESTER_PASSWORD);
  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Intento de consumir insumos como solicitante',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      insumosUsados: [{ insumoId: 11, cantidad: 5 }],
    },
  });

  assert.equal(created.response.status, 403, JSON.stringify(created.data));
  assert.equal(created.data.error, 'No autorizado para registrar consumo de insumos.');

  const after = await readPersistedDb();
  const supplyAfter = after.insumos.find((item) => item.id === 11);
  assert.ok(supplyAfter);
  assert.equal(supplyAfter.stock, stockBefore, 'El stock no debe cambiar ante un intento bloqueado.');
});

test('H2: solo un rol editor (no el solicitante) puede marcar el activo como Falla con CRÍTICA', { concurrency: false }, async () => {
  // Estado determinista: forzamos el activo a Operativo antes de la prueba.
  const seed = await readPersistedDb();
  const seedAsset = seed.activos.find((item) => item.tag === 'POS-001');
  assert.ok(seedAsset, 'El activo POS-001 debe existir.');
  seedAsset.estado = 'Operativo';
  await writeFile(dbFilePath, JSON.stringify(seed, null, 2), 'utf8');

  // Solicitante: CRÍTICA NO debe voltear el activo a Falla.
  const requesterSession = await login(REQUESTER_USER.username, REQUESTER_PASSWORD);
  const byRequester = await requestJson('/api/tickets', {
    method: 'POST',
    token: requesterSession.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Ticket crítico creado por solicitante',
      sucursal: 'TJ01',
      prioridad: 'CRITICA',
    },
  });
  assert.equal(byRequester.response.status, 201, JSON.stringify(byRequester.data));

  const afterRequester = await readPersistedDb();
  const assetAfterRequester = afterRequester.activos.find((item) => item.tag === 'POS-001');
  assert.equal(assetAfterRequester.estado, 'Operativo', 'Un solicitante no debe poder marcar el activo como Falla.');

  // Control positivo: un admin con CRÍTICA sí preserva la derivación a Falla.
  const adminSession = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const byAdmin = await requestJson('/api/tickets', {
    method: 'POST',
    token: adminSession.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Ticket crítico creado por admin',
      sucursal: 'TJ01',
      prioridad: 'CRITICA',
      atencionTipo: 'PRESENCIAL',
    },
  });
  assert.equal(byAdmin.response.status, 201, JSON.stringify(byAdmin.data));

  const afterAdmin = await readPersistedDb();
  const assetAfterAdmin = afterAdmin.activos.find((item) => item.tag === 'POS-001');
  assert.equal(assetAfterAdmin.estado, 'Falla', 'Un rol editor sí debe poder derivar el estado del activo a Falla.');
});

test('H4: un solicitante no accede a tickets legacy sin id/username aunque coincida el nombre', { concurrency: false }, async () => {
  const persisted = await readPersistedDb();
  // Ticket legacy: solo nombre visible homónimo, sin solicitadoPorId ni solicitadoPorUsername.
  persisted.tickets.push({
    id: 950,
    activoTag: 'POS-001',
    descripcion: 'Ticket legacy de otro usuario homónimo',
    prioridad: 'MEDIA',
    estado: 'Abierto',
    atencionTipo: 'REMOTO',
    fecha: '2026-02-01 09:00',
    fechaCreacion: '2026-02-01T09:00:00.000Z',
    fechaLimite: '2026-02-02T09:00:00.000Z',
    sucursal: 'TJ01',
    solicitadoPor: REQUESTER_USER.nombre,
    departamento: 'VENTAS',
    attachments: [],
    historial: [
      { fecha: '2026-02-01 09:00', usuario: REQUESTER_USER.nombre, accion: 'Ticket Creado', estado: 'Abierto', comentario: 'Legacy' },
    ],
  });
  await writeFile(dbFilePath, JSON.stringify(persisted, null, 2), 'utf8');

  const session = await login(REQUESTER_USER.username, REQUESTER_PASSWORD);
  const list = await requestJson('/api/tickets', { token: session.token });

  assert.equal(list.response.status, 200, JSON.stringify(list.data));
  assert.equal(Array.isArray(list.data), true);
  const ids = list.data.map((ticket) => ticket.id);
  // El ticket legacy homónimo NO debe ser visible (fail-closed).
  assert.equal(ids.includes(950), false, 'El ticket legacy homónimo no debe ser accesible.');
  // Control positivo: el ticket propio por id (701) sí debe verse.
  assert.equal(ids.includes(701), true, 'El solicitante debe seguir viendo sus tickets propios por id.');
});

test('P1: crear ticket rechaza activo inexistente sin persistir cambios', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const before = await readPersistedDb();

  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'ACTIVO-INEXISTENTE',
      descripcion: 'No debe persistirse',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
    },
  });

  assert.equal(created.response.status, 400, JSON.stringify(created.data));
  assert.equal(created.data.error, 'El activo indicado no existe.');

  const after = await readPersistedDb();
  assert.equal(after.tickets.length, before.tickets.length);
  assert.equal(after.meta.nextId, before.meta.nextId);
  assert.equal(after.auditoria.length, before.auditoria.length);
});

test('P1: crear ticket rechaza insumo inexistente o stock insuficiente de forma atómica', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const before = await readPersistedDb();
  const supplyBefore = before.insumos.find((item) => item.id === 11);
  assert.ok(supplyBefore);

  const missingSupply = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Insumo inexistente',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      insumosUsados: [{ insumoId: 999999, cantidad: 1 }],
    },
  });
  assert.equal(missingSupply.response.status, 400, JSON.stringify(missingSupply.data));

  const insufficientStock = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Stock insuficiente',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      insumosUsados: [{ insumoId: 11, cantidad: supplyBefore.stock + 1 }],
    },
  });
  assert.equal(insufficientStock.response.status, 409, JSON.stringify(insufficientStock.data));

  const after = await readPersistedDb();
  const supplyAfter = after.insumos.find((item) => item.id === 11);
  assert.ok(supplyAfter);
  assert.equal(supplyAfter.stock, supplyBefore.stock);
  assert.equal(after.tickets.length, before.tickets.length);
  assert.equal(after.meta.nextId, before.meta.nextId);
  assert.equal(after.auditoria.length, before.auditoria.length);
});

test('P1: PATCH de ticket con stock insuficiente no aplica cambios parciales', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'POS-001',
      descripcion: 'Validación atómica de actualización',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));

  const before = await readPersistedDb();
  const supplyBefore = before.insumos.find((item) => item.id === 11);
  const ticketBefore = before.tickets.find((item) => item.id === created.data.id);
  assert.ok(supplyBefore);
  assert.ok(ticketBefore);

  const updated = await requestJson(`/api/tickets/${created.data.id}`, {
    method: 'PATCH',
    token: session.token,
    body: {
      estado: 'En Proceso',
      insumosUsados: [{ insumoId: 11, cantidad: supplyBefore.stock + 1 }],
    },
  });
  assert.equal(updated.response.status, 409, JSON.stringify(updated.data));

  const after = await readPersistedDb();
  const supplyAfter = after.insumos.find((item) => item.id === 11);
  const ticketAfter = after.tickets.find((item) => item.id === created.data.id);
  assert.ok(supplyAfter);
  assert.ok(ticketAfter);
  assert.equal(supplyAfter.stock, supplyBefore.stock);
  assert.equal(ticketAfter.estado, ticketBefore.estado);
  assert.deepEqual(ticketAfter.insumosUsados || [], ticketBefore.insumosUsados || []);
  assert.equal(after.meta.nextId, before.meta.nextId);
  assert.equal(after.auditoria.length, before.auditoria.length);
});

test('P1: ajuste de insumo rechaza una salida mayor al stock disponible', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const before = await readPersistedDb();
  const supplyBefore = before.insumos.find((item) => item.id === 11);
  assert.ok(supplyBefore);

  const adjusted = await requestJson('/api/insumos/11/stock', {
    method: 'PATCH',
    token: session.token,
    body: { delta: -(supplyBefore.stock + 1) },
  });

  assert.equal(adjusted.response.status, 409, JSON.stringify(adjusted.data));
  const after = await readPersistedDb();
  const supplyAfter = after.insumos.find((item) => item.id === 11);
  assert.ok(supplyAfter);
  assert.equal(supplyAfter.stock, supplyBefore.stock);
  assert.equal(after.meta.nextId, before.meta.nextId);
  assert.equal(after.auditoria.length, before.auditoria.length);
});

test('P1: consumo válido normaliza IDs y cantidades antes de descontar stock', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const before = await readPersistedDb();
  const supplyBefore = before.insumos.find((item) => item.id === 11);
  assert.ok(supplyBefore);

  const created = await requestJson('/api/tickets', {
    method: 'POST',
    token: session.token,
    body: {
      activoTag: 'pos-001',
      descripcion: 'Consumo normalizado',
      sucursal: 'TJ01',
      prioridad: 'MEDIA',
      atencionTipo: 'REMOTO',
      insumosUsados: [{ insumoId: '11', cantidad: '2' }],
    },
  });

  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.activoTag, 'POS-001');
  assert.deepEqual(created.data.insumosUsados, [{
    insumoId: 11,
    cantidad: 2,
    nombre: supplyBefore.nombre,
  }]);

  const after = await readPersistedDb();
  const supplyAfter = after.insumos.find((item) => item.id === 11);
  assert.ok(supplyAfter);
  assert.equal(supplyAfter.stock, supplyBefore.stock - 2);
});

test('Fase 2: una sesión sigue válida después de reiniciar el servidor', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const previousRuntime = serverRuntime;

  await stopTestServer(previousRuntime.child);
  serverRuntime = await startTestServer(dbFilePath, attachmentsDirPath);

  const bootstrap = await requestJson('/api/bootstrap', {
    token: session.token,
  });
  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.data));
  assert.equal(Array.isArray(bootstrap.data?.tickets), true);
});

// El ciclo subir -> descargar no tenía cobertura, y por eso pasó inadvertida una regresión
// que bloqueaba TODOS los adjuntos cuando ATTACHMENTS_DIR apunta fuera del árbol de datos
// (la configuración recomendada en producción: un volumen persistente).
test('adjuntos: ciclo completo subir/descargar con ATTACHMENTS_DIR fuera del árbol de datos', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const contenido = Buffer.from('evidencia de la falla del POS', 'utf8');

  const subida = await requestJson('/api/tickets/701/attachments', {
    method: 'POST',
    token: session.token,
    body: {
      fileName: 'evidencia.txt',
      mimeType: 'text/plain',
      contentBase64: contenido.toString('base64'),
    },
  });

  assert.equal(subida.response.status, 201, JSON.stringify(subida.data));
  const attachmentId = subida.data.attachment.id;
  assert.ok(attachmentId, 'la subida debe devolver el id del adjunto');
  assert.equal(subida.data.ticket.attachments.length, 1);
  assert.equal(subida.data.attachment.size, contenido.length);

  // El archivo debe existir físicamente en el volumen configurado, no junto al db.json.
  const enVolumen = await readdir(attachmentsDirPath);
  assert.equal(enVolumen.length, 1, `se esperaba 1 archivo en ${attachmentsDirPath}`);
  assert.equal(enVolumen[0].endsWith('evidencia.txt'), true);

  const descarga = await fetch(
    `${serverRuntime.baseUrl}/api/tickets/701/attachments/${attachmentId}/download`,
    { headers: { Authorization: `Bearer ${session.token}` } },
  );
  assert.equal(descarga.status, 200);
  assert.equal(await descarga.text(), contenido.toString('utf8'));
});

test('adjuntos: un ticket ajeno no puede descargar el adjunto de otro', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);
  const inexistente = await fetch(
    `${serverRuntime.baseUrl}/api/tickets/702/attachments/999999/download`,
    { headers: { Authorization: `Bearer ${session.token}` } },
  );
  assert.equal(inexistente.status, 404);
});

// Express no comprime por defecto. El bootstrap envía el dominio completo y es JSON muy
// repetitivo: sin compresión cada usuario descarga megabytes en cada arranque de sesión.
test('las respuestas grandes viajan comprimidas', { concurrency: false }, async () => {
  const session = await login(ADMIN_USER.username, ADMIN_PASSWORD);

  const response = await fetch(`${serverRuntime.baseUrl}/api/bootstrap`, {
    headers: { Authorization: `Bearer ${session.token}`, 'Accept-Encoding': 'gzip' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  const payload = await response.json();
  assert.equal(Array.isArray(payload.tickets), true, 'el cuerpo debe seguir siendo JSON válido');
});

test('las respuestas pequeñas no pagan el costo de comprimir', { concurrency: false }, async () => {
  const response = await fetch(`${serverRuntime.baseUrl}/api/health`, {
    headers: { 'Accept-Encoding': 'gzip' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-encoding'), null);
});
