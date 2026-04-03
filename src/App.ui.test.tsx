import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import App from './App';
import { useAppStore } from './store/useAppStore';
import { readStoredSession } from './utils/app';

const ADMIN_USER = {
  id: 501,
  nombre: 'Admin Integracion',
  username: 'admin.integration',
  rol: 'admin',
  departamento: 'IT',
};

const REQUESTER_USER = {
  id: 601,
  nombre: 'Solicitante Integracion',
  username: 'solicitante.integration',
  rol: 'solicitante',
  departamento: 'VENTAS',
};

const TICKET_STATES = ['Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado'];

const BASE_CATALOGS = {
  sucursales: [
    { code: 'TJ01', name: 'Sucursal Norte', activo: true },
  ],
  cargos: ['Coordinador de Sistemas', 'Auxiliar de Sistemas'],
  roles: [
    { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
    { value: 'tecnico', label: 'Tecnico', permissions: 'Operacion IT + tickets', activo: true },
    { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
  ],
};

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getRequestUrl(input: string | URL | Request): string {
  if (input instanceof Request) return input.url;
  return String(input);
}

function getRequestPath(input: string | URL | Request): string {
  return new URL(getRequestUrl(input), 'http://localhost').pathname;
}

function installFetchMock(routes: Array<{
  method: string;
  path: string;
  response: unknown | ((input: string | URL | Request, init?: RequestInit) => unknown);
  status?: number;
}>) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const method = String(init?.method || 'GET').toUpperCase();
    const path = getRequestPath(input);
    const match = routes.find((route) => route.method === method && route.path === path);

    if (!match) {
      throw new Error(`Solicitud inesperada en pruebas UI: ${method} ${path}`);
    }

    const body = typeof match.response === 'function'
      ? match.response(input, init)
      : match.response;

    return createJsonResponse(body, match.status);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function buildAdminBootstrap() {
  return {
    activos: [
      {
        id: 1,
        tag: 'POS-001',
        tipo: 'POS',
        marca: 'IBM',
        ubicacion: 'Caja 1',
        estado: 'Operativo',
        responsable: 'Caja Norte',
        departamento: 'TJ01',
      },
      {
        id: 2,
        tag: 'BAS-010',
        tipo: 'Bascula',
        marca: 'Datalogic',
        ubicacion: 'Frutas',
        estado: 'Falla',
        responsable: 'Frutas',
        departamento: 'TJ01',
      },
    ],
    insumos: [],
    tickets: [
      {
        id: 701,
        activoTag: 'POS-001',
        descripcion: 'Impresora fiscal desconectada',
        sucursal: 'TJ01',
        prioridad: 'MEDIA',
        estado: 'Abierto',
        atencionTipo: 'REMOTO',
        fecha: '2026-03-29 09:00',
        fechaCreacion: '2026-03-29T09:00:00.000Z',
        fechaLimite: '2026-03-30T09:00:00.000Z',
        solicitadoPor: REQUESTER_USER.nombre,
        solicitadoPorId: REQUESTER_USER.id,
        solicitadoPorUsername: REQUESTER_USER.username,
        departamento: REQUESTER_USER.departamento,
        historial: [
          {
            fecha: '2026-03-29 09:00',
            usuario: REQUESTER_USER.nombre,
            accion: 'Ticket Creado',
            estado: 'Abierto',
            comentario: 'Generado en pruebas UI',
          },
        ],
        attachments: [],
      },
      {
        id: 702,
        activoTag: 'BAS-010',
        descripcion: 'Bascula sin comunicacion con caja',
        sucursal: 'TJ01',
        prioridad: 'ALTA',
        estado: 'En Proceso',
        atencionTipo: 'PRESENCIAL',
        fecha: '2026-03-30 12:00',
        fechaCreacion: '2026-03-30T12:00:00.000Z',
        fechaLimite: '2026-03-30T20:00:00.000Z',
        asignadoA: 'Tecnico Integracion',
        solicitadoPor: ADMIN_USER.nombre,
        solicitadoPorId: ADMIN_USER.id,
        solicitadoPorUsername: ADMIN_USER.username,
        departamento: ADMIN_USER.departamento,
        historial: [
          {
            fecha: '2026-03-30 12:00',
            usuario: ADMIN_USER.nombre,
            accion: 'Ticket Creado',
            estado: 'En Proceso',
            comentario: 'Generado en pruebas UI',
          },
        ],
        attachments: [],
      },
    ],
    auditoria: [],
    users: [
      { ...ADMIN_USER, activo: true },
      {
        id: 502,
        nombre: 'Tecnico Integracion',
        username: 'tecnico.integration',
        rol: 'tecnico',
        departamento: 'IT',
        activo: true,
      },
      { ...REQUESTER_USER, activo: true },
    ],
    catalogos: BASE_CATALOGS,
    ticketStates: TICKET_STATES,
  };
}

function buildRequesterBootstrap() {
  return {
    activos: [],
    insumos: [],
    tickets: [
      {
        id: 801,
        activoTag: 'POS-001',
        descripcion: 'Terminal sin conexion al servidor',
        sucursal: 'TJ01',
        prioridad: 'MEDIA',
        estado: 'Abierto',
        atencionTipo: 'REMOTO',
        fecha: '2026-03-30 08:30',
        fechaCreacion: '2026-03-30T08:30:00.000Z',
        fechaLimite: '2026-03-31T08:30:00.000Z',
        solicitadoPor: REQUESTER_USER.nombre,
        solicitadoPorId: REQUESTER_USER.id,
        solicitadoPorUsername: REQUESTER_USER.username,
        departamento: REQUESTER_USER.departamento,
        historial: [
          {
            fecha: '2026-03-30 08:30',
            usuario: REQUESTER_USER.nombre,
            accion: 'Ticket Creado',
            estado: 'Abierto',
            comentario: 'Generado en pruebas UI',
          },
        ],
        attachments: [],
      },
    ],
    auditoria: [],
    users: [],
    catalogos: BASE_CATALOGS,
    ticketStates: TICKET_STATES,
  };
}

function resetUiState() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
  useAppStore.setState({
    sessionUser: null,
    theme: 'light',
    sidebarOpen: false,
    toast: null,
  });
}

function fillLoginForm(username: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('admin'), {
    target: { value: username },
  });
  fireEvent.change(screen.getByPlaceholderText('Ingresa tu password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: /Iniciar Sesi[oó]n/i }));
}

describe('App UI flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetUiState();
  });

  test('permite login admin, persiste token y muestra tickets cargados desde bootstrap', async () => {
    const fetchMock = installFetchMock([
      {
        method: 'POST',
        path: '/api/auth/login',
        response: {
          user: ADMIN_USER,
          token: 'token-admin-ui',
          loggedAt: '2026-03-30T18:00:00.000Z',
        },
      },
      {
        method: 'GET',
        path: '/api/bootstrap',
        response: buildAdminBootstrap(),
      },
    ]);

    render(<App />);

    expect(screen.getByRole('button', { name: /Iniciar Sesi[oó]n/i })).toBeTruthy();

    fillLoginForm(ADMIN_USER.username, 'Admin.Ui.123');

    await screen.findByText('Backend Online');

    expect(readStoredSession()?.token).toBe('token-admin-ui');
    expect(useAppStore.getState().sessionUser?.username).toBe(ADMIN_USER.username);

    const loginCall = fetchMock.mock.calls.find(([input]) => getRequestPath(input) === '/api/auth/login');
    expect(loginCall).toBeTruthy();
    expect(String(loginCall?.[1]?.body || '')).toContain(ADMIN_USER.username);

    const bootstrapCall = fetchMock.mock.calls.find(([input]) => getRequestPath(input) === '/api/bootstrap');
    expect(bootstrapCall).toBeTruthy();
    const bootstrapHeaders = new Headers(bootstrapCall?.[1]?.headers);
    expect(bootstrapHeaders.get('Authorization')).toBe('Bearer token-admin-ui');

    fireEvent.click(screen.getByRole('button', { name: /^Tickets$/i }));

    await screen.findByText('Tickets IT');

    expect(screen.getByRole('button', { name: /Nuevo Ticket/i })).toBeTruthy();
    expect(screen.getByText(/POS-001\s+\|\s+Impresora fiscal desconectada/i)).toBeTruthy();
    expect(screen.getByText(/BAS-010\s+\|\s+Bascula sin comunicacion con caja/i)).toBeTruthy();
  });

  test('un solicitante entra directo a tickets y no ve navegacion administrativa', async () => {
    installFetchMock([
      {
        method: 'POST',
        path: '/api/auth/login',
        response: {
          user: REQUESTER_USER,
          token: 'token-requester-ui',
          loggedAt: '2026-03-30T18:10:00.000Z',
        },
      },
      {
        method: 'GET',
        path: '/api/bootstrap',
        response: buildRequesterBootstrap(),
      },
    ]);

    render(<App />);

    fillLoginForm(REQUESTER_USER.username, 'Solicitante.Ui.123');

    await screen.findByText('Tickets IT');

    expect(screen.queryByRole('button', { name: /^Dashboard$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Usuarios$/i })).toBeNull();
    expect(screen.queryByText('Estado del Sistema')).toBeNull();
    expect(screen.getByText(/POS-001\s+\|\s+Terminal sin conexion al servidor/i)).toBeTruthy();
    expect(screen.queryByText(/BAS-010\s+\|/i)).toBeNull();
  });

  test('si bootstrap falla muestra backend offline y no rellena tickets locales', async () => {
    installFetchMock([
      {
        method: 'POST',
        path: '/api/auth/login',
        response: {
          user: ADMIN_USER,
          token: 'token-admin-offline-ui',
          loggedAt: '2026-03-30T18:20:00.000Z',
        },
      },
      {
        method: 'GET',
        path: '/api/bootstrap',
        response: {
          error: 'Backend de pruebas fuera de linea',
        },
        status: 503,
      },
    ]);

    render(<App />);

    fillLoginForm(ADMIN_USER.username, 'Admin.Ui.123');

    await screen.findByText('Backend Offline');
    await screen.findByText(/Backend de pruebas fuera de linea/i);

    fireEvent.click(screen.getByRole('button', { name: /^Tickets$/i }));

    await screen.findByText('Tickets IT');
    expect(screen.getByText(/No hay tickets para los filtros seleccionados/i)).toBeTruthy();
    expect(screen.queryByText(/POS-001\s+\|/i)).toBeNull();
  });

  test('rechaza QR locales y solo acepta tokens firmados', async () => {
    installFetchMock([
      {
        method: 'POST',
        path: '/api/auth/login',
        response: {
          user: ADMIN_USER,
          token: 'token-admin-qr-ui',
          loggedAt: '2026-04-03T10:00:00.000Z',
        },
      },
      {
        method: 'GET',
        path: '/api/bootstrap',
        response: buildAdminBootstrap(),
      },
    ]);

    render(<App />);

    fillLoginForm(ADMIN_USER.username, 'Admin.Ui.123');

    await screen.findByText('Backend Online');

    fireEvent.click(screen.getByRole('button', { name: /^Inventario$/i }));

    await screen.findByText('Activos IT');

    fireEvent.click(screen.getByRole('button', { name: /Escanear QR/i }));

    fireEvent.change(screen.getByPlaceholderText(/mtiqr1 del QR firmado/i), {
      target: { value: 'mtiqr0.1.POS-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Resolver QR/i }));

    await screen.findByText(/Solo se aceptan QR firmados/i);
  });
});
