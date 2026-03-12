import {
  BarChart3,
  History,
  LayoutDashboard,
  Monitor,
  Package,
  Ticket,
  Users,
} from 'lucide-react';
import type {
  Activo,
  CatalogState,
  DashboardRange,
  NavItem,
  PrioridadTicket,
  RegistroAuditoria,
  TicketAttentionType,
  TicketEstado,
  TicketItem,
  TravelDestinationPreset,
  UserRole,
  Insumo,
} from '../types/app';
export const INVENTARIO_ACTIVOS_INICIAL: Activo[] = [
  { id: 1, tag: 'POS-001', tipo: 'POS', marca: 'IBM SurePOS', ubicacion: 'Caja Rápida 1', estado: 'Operativo', serial: 'SN-99201', fechaCompra: '2022-01-15' },
  { id: 2, tag: 'POS-002', tipo: 'POS', marca: 'IBM SurePOS', ubicacion: 'Caja Rápida 2', estado: 'Operativo', serial: 'SN-99202', fechaCompra: '2022-01-15' },
  { id: 3, tag: 'BAS-010', tipo: 'Báscula', marca: 'Datalogic', ubicacion: 'Frutas y Verduras', estado: 'Falla', serial: 'SN-10293', fechaCompra: '2023-05-10' },
  { id: 4, tag: 'SRV-001', tipo: 'Servidor', marca: 'Dell PowerEdge', ubicacion: 'Site', estado: 'Operativo', serial: 'SN-SRV-01', fechaCompra: '2021-11-20' },
];

export const INSUMOS_INICIALES: Insumo[] = [
  { id: 1, nombre: 'Cable Ethernet Cat6', unidad: 'Metros', stock: 150, min: 50, categoria: 'REDES', activo: true },
  { id: 2, nombre: 'Papel Térmico 80mm', unidad: 'Rollos', stock: 12, min: 20, categoria: 'CONSUMIBLES', activo: true },
  { id: 3, nombre: 'Conectores RJ45', unidad: 'Piezas', stock: 100, min: 30, categoria: 'REDES', activo: true },
  { id: 4, nombre: 'Teclado USB', unidad: 'Piezas', stock: 5, min: 5, categoria: 'HARDWARE', activo: true },
];

export const TICKETS_INICIALES: TicketItem[] = [
  {
    id: 101,
    activoTag: 'BAS-010',
    descripcion: 'Falla en el pesaje',
    prioridad: 'CRITICA',
    estado: 'Abierto',
    atencionTipo: 'PRESENCIAL',
    fecha: '2023-10-24 09:00',
    asignadoA: 'Técnico 1',
    fechaCreacion: '2023-10-24T09:00:00.000Z',
    fechaLimite: '2023-10-24T11:00:00.000Z',
  }
];
export const AUDITORIA_INICIAL: RegistroAuditoria[] = [
  { id: 1, accion: 'Entrada', item: 'Papel Térmico', cantidad: 50, fecha: '2024-05-20 10:30', usuario: 'Admin IT', modulo: 'insumos' }
];

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'reports', icon: BarChart3, label: 'Reporteria' },
  { id: 'inventory', icon: Monitor, label: 'Inventario' },
  { id: 'supplies', icon: Package, label: 'Insumos' },
  { id: 'tickets', icon: Ticket, label: 'Tickets' },
  { id: 'history', icon: History, label: 'Auditoría' },
  { id: 'users', icon: Users, label: 'Usuarios' },
];

export const CATEGORIAS_INSUMO = ['REDES', 'CONSUMIBLES', 'HARDWARE'] as const;
export const SUPPLY_UNIT_OPTIONS = ['Piezas', 'Rollos', 'Metros', 'Cajas', 'Litros'] as const;
export const TICKET_STATES: TicketEstado[] = ['Abierto', 'En Proceso', 'En Espera', 'Resuelto', 'Cerrado'];
export const TICKET_ATTENTION_TYPES: TicketAttentionType[] = ['PRESENCIAL', 'REMOTO'];
export const DASHBOARD_RANGES: Array<{ value: DashboardRange; label: string; days: number }> = [
  { value: 'TODAY', label: 'Hoy', days: 1 },
  { value: '7D', label: '7 dias', days: 7 },
  { value: '30D', label: '30 dias', days: 30 },
  { value: '90D', label: '90 dias', days: 90 },
];
export const SLA_POLICY: Record<PrioridadTicket, number> = {
  MEDIA: 24,
  ALTA: 8,
  CRITICA: 2,
};
export const TICKET_BRANCHES = [
  { code: 'TJ01', name: 'Sucursal Estrella' },
  { code: 'TC01', name: 'Sucursal Camargo' },
  { code: 'TJ02', name: 'Sucursal CBtis' },
  { code: 'TJ03', name: 'Sucursal Sor Juana' },
  { code: 'CEDIS', name: 'CeDis' },
] as const;
export const TICKET_BRANCH_LABEL_BY_CODE: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  TICKET_BRANCHES.forEach((branch) => {
    labels[branch.code] = `${branch.code} - ${branch.name}`;
  });
  return labels;
})();
export const TRAVEL_DESTINATION_PRESETS: TravelDestinationPreset[] = [
  { code: 'TJ01', index: 1, label: 'ESTRELLA', defaultKms: 4 },
  { code: 'TJ02', index: 2, label: 'TJ02', defaultKms: 4 },
  { code: 'TJ03', index: 3, label: 'SOR JUANA', defaultKms: 3 },
  { code: 'TC01', index: 4, label: 'CAMARGO', defaultKms: 150 },
  { code: 'CEDIS', index: 5, label: 'CEDIS', defaultKms: 8 },
];
export const TRAVEL_DEFAULT_FUEL_EFFICIENCY = 10;
export const TRAVEL_DEFAULT_DEPARTMENT = 'SISTEMAS';
export const TRAVEL_DEFAULT_AUTHORIZER = 'MIREYA SANDOVAL';
export const TRAVEL_DEFAULT_FINANCE = 'RAQUEL PARRA';
export const TRAVEL_REPORT_MIN_ROWS = 36;
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  consulta: 'Consulta',
  solicitante: 'Solicitante',
};
export const USER_ROLE_PERMISSIONS: Record<UserRole, string> = {
  admin: 'Acceso total',
  tecnico: 'Operación IT + tickets',
  consulta: 'Solo consulta',
  solicitante: 'Crear tickets',
};
export const USER_CARGO_OPTIONS = [
  { value: 'COORDINADOR DE SISTEMAS', label: 'Coordinador de Sistemas' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'DESARROLLADOR', label: 'Desarrollador' },
  { value: 'AUXILIAR DE SISTEMAS', label: 'Auxiliar de Sistemas' },
  { value: 'CEDIS', label: 'CeDis' },
] as const;
export const USER_CARGO_LABEL_BY_VALUE: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  USER_CARGO_OPTIONS.forEach((cargo) => {
    labels[cargo.value] = cargo.label;
  });
  return labels;
})();
export const DEFAULT_CATALOGS: CatalogState = {
  sucursales: TICKET_BRANCHES.map((branch) => ({ ...branch, activo: true })),
  cargos: USER_CARGO_OPTIONS.map((item) => item.label),
  roles: [
    { value: 'admin', label: 'Administrador', permissions: 'Acceso total', activo: true },
    { value: 'tecnico', label: 'Técnico', permissions: 'Operación IT + tickets', activo: true },
    { value: 'consulta', label: 'Consulta', permissions: 'Solo consulta', activo: true },
    { value: 'solicitante', label: 'Solicitante', permissions: 'Crear tickets', activo: true },
  ],
};
export const TICKET_AREA_OPTIONS = ['Recibos', 'Gerencia', 'Línea de cajas', 'Tienda', 'Mantenimiento'] as const;
export const COMMON_TICKET_ISSUES = [
  {
    area: 'Línea de cajas',
    issues: [
      'No muestra peso',
      'Falla del monitor',
      'Lector de códigos no enciende',
      'No funciona la impresora de tickets',
      'POS lento o trabado',
      'Terminal bancaria sin conexión',
    ],
  },
  {
    area: 'Recibos',
    issues: [
      'No funciona la impresora',
      'No imprime ticket',
      'Impresión borrosa o incompleta',
      'Atasco de papel en impresora',
      'Sin papel térmico',
      'Error de conexión con impresora',
      'No acceso al servidor remoto',
      'Lentitud en módulo de recibos',
      'Falla de teclado',
      'Falla de ratón',
    ],
  },
  {
    area: 'Gerencia',
    issues: [
      'No se genera reporte diario',
      'Dashboard no actualiza',
      'Sin acceso a indicadores',
      'Sistema administrativo lento',
      'No abre reportes de ventas',
      'Error al exportar reportes (Excel/PDF)',
      'Datos de ventas no sincronizados',
      'No carga KPI por sucursal',
      'Error de permisos en módulo gerencial',
      'No acceso al servidor remoto de gerencia',
    ],
  },
  {
    area: 'Tienda',
    issues: [
      'No abre sistema en tienda',
      'Sin internet en tienda',
      'Sin Wi-Fi',
      'Sistema lento en tienda',
      'No se sincronizan ventas',
      'No funciona equipo de piso',
    ],
  },
  {
    area: 'Mantenimiento',
    issues: [
      'Mantenimiento preventivo',
      'Limpieza de equipo programada',
      'Actualización de software programada',
      'Revisión preventiva de red',
    ],
  },
] as const;

export function parsePositiveInt(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.trunc(numeric);
}

export const AUTHOR_BRAND = String(import.meta.env.VITE_AUTHOR_BRAND || 'Inge Juan Carlos R. P.').trim() || 'Inge Juan Carlos R. P.';
export const AUTHOR_SIGNATURE = `Desarrollado por ${AUTHOR_BRAND}`;
export const DEFAULT_API_BASE_URL = import.meta.env.DEV ? 'http://localhost:4000/api' : '/api';
export const API_BASE_URL = String(import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL).trim();
export const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
export const API_REQUEST_TIMEOUT_MS = parsePositiveInt(import.meta.env.VITE_API_TIMEOUT_MS, 15000);
export const CLIENT_ATTACHMENT_MAX_BYTES = Math.max(
  64 * 1024,
  parsePositiveInt(import.meta.env.VITE_TICKET_ATTACHMENT_MAX_BYTES, 5 * 1024 * 1024),
);
export const CLIENT_ATTACHMENT_MAX_COUNT = Math.max(
  1,
  parsePositiveInt(import.meta.env.VITE_TICKET_ATTACHMENT_MAX_COUNT, 10),
);
export const SESSION_STORAGE_KEY = 'mesa_it_session';
export const THEME_STORAGE_KEY = 'mesa_it_theme';
export const REPORT_FILTER_PRESETS_STORAGE_PREFIX = 'mesa_it_report_presets';

