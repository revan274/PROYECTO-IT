import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  const child = spawn(process.execPath, ['server/index.js'], {
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
let serverRuntime = null;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'mesa-it-integration-'));
  const dbFile = path.join(tempDir, 'db.json');
  await writeFile(dbFile, JSON.stringify(buildFixtureDb(), null, 2), 'utf8');
  serverRuntime = await startTestServer(dbFile);
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
