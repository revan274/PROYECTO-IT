import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  { value: 'tecnico', label: 'Tecnico', permissions: 'Operacion IT + tickets', activo: true },
  { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
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
  nombre: 'Tecnico Integracion',
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
        tipo: 'Bascula',
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
        descripcion: 'Bascula sin comunicacion con caja.',
        prioridad: 'ALTA',
        estado: 'En Proceso',
        atencionTipo: 'PRESENCIAL',
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

async function startTestServer(dbFile) {
  const port = await reservePort();
  let logs = '';
  const child = spawn(process.execPath, ['server/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DB_FILE: dbFile,
      DB_BACKUP_ENABLE: 'false',
      AUTH_DISALLOW_DEMO_PASSWORDS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
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

  child.kill();
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
let serverRuntime = null;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'mesa-it-integration-'));
  dbFilePath = path.join(tempDir, 'db.json');
  await writeFile(dbFilePath, JSON.stringify(buildFixtureDb(), null, 2), 'utf8');
  serverRuntime = await startTestServer(dbFilePath);
});

after(async () => {
  await stopTestServer(serverRuntime?.child);
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

async function requestJson(urlPath, { method = 'GET', token, body } = {}) {
  assert.ok(serverRuntime?.baseUrl, 'El servidor de integracion no fue inicializado.');

  const headers = {
    Accept: 'application/json',
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
  assert.deepEqual(data.activos, []);
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
      comentarios: 'Actualizacion de prueba',
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
