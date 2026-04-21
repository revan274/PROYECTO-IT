import { COMMON_TICKET_ISSUES, SLA_POLICY } from '../constants/app';
import type {
  Activo,
  PrioridadTicket,
  TicketAttentionType,
  TicketEstado,
  TicketItem,
} from '../types/app';
import { resolveAssetBranchCode } from './assets';
import { normalizeForCompare, parseDateToTimestamp } from './format';

type TicketAreaLabel = typeof COMMON_TICKET_ISSUES[number]['area'];

export interface TicketAssetContextSummary {
  branchCode: string;
  locationLabel: string;
  locationTokens: string[];
  typeCode: string;
  suggestedArea: TicketAreaLabel | null;
}

interface TicketIssueSuggestionTemplate {
  matchers: string[];
  preferredArea: TicketAreaLabel;
  areas: TicketAreaLabel[];
  extraIssues: string[];
}

const ISSUE_GROUP_BY_AREA = new Map<TicketAreaLabel, readonly string[]>(
  COMMON_TICKET_ISSUES.map((group) => [group.area, group.issues]),
);

const ASSET_TYPE_TEMPLATES: TicketIssueSuggestionTemplate[] = [
  {
    matchers: ['IMP', 'EPSON', 'PRN', 'TCK'],
    preferredArea: 'Recibos',
    areas: ['Recibos'],
    extraIssues: [
      'Impresora fuera de linea',
      'No corta ticket',
      'Error de comunicacion USB o red',
    ],
  },
  {
    matchers: ['POS', 'BSC', 'BAS', 'SCN', 'VDP', 'VPR', 'AUD'],
    preferredArea: 'Línea de cajas',
    areas: ['Línea de cajas', 'Tienda'],
    extraIssues: [
      'Caja sin comunicacion con perifericos',
      'No lee articulos o codigos',
      'No registra peso o venta correctamente',
    ],
  },
  {
    matchers: ['DSK', 'LPT', 'AIO', 'MON', 'EQUIPO'],
    preferredArea: 'Gerencia',
    areas: ['Gerencia', 'Tienda'],
    extraIssues: [
      'Equipo no enciende',
      'Pantalla sin imagen',
      'No inicia sesion o perfil',
      'Sin acceso a red o recursos compartidos',
    ],
  },
  {
    matchers: ['SVR', 'SVR0', 'SWT', 'TEL', 'NVR', 'DVR', 'ROU', 'RTR', 'AP', 'CAM'],
    preferredArea: 'Mantenimiento',
    areas: ['Mantenimiento', 'Tienda'],
    extraIssues: [
      'Servidor sin respuesta',
      'Switch o enlace de red caido',
      'Telefonia IP sin registro',
      'Camara o grabador sin video',
    ],
  },
];

const LOCATION_TEMPLATES: TicketIssueSuggestionTemplate[] = [
  {
    matchers: ['SITE', 'SIS', 'BSIS'],
    preferredArea: 'Mantenimiento',
    areas: ['Mantenimiento', 'Tienda'],
    extraIssues: [
      'Sin internet o enlace principal',
      'Servidor o servicio detenido',
      'Cableado o patch panel con falla',
    ],
  },
  {
    matchers: ['CARN', 'DELI', 'PASI', 'CMP', 'CAJA', 'TJ01', 'TJ02', 'TJ03', 'TC01', 'CEDIS'],
    preferredArea: 'Línea de cajas',
    areas: ['Línea de cajas', 'Tienda'],
    extraIssues: [
      'Caja o piso sin operar',
      'Periferico de piso sin comunicacion',
      'Lentitud en operacion de tienda',
    ],
  },
  {
    matchers: ['AYF', 'GER', 'DIR', 'RRHH', 'MERC', 'CAT', 'CORP', 'OPER', 'CD1'],
    preferredArea: 'Gerencia',
    areas: ['Gerencia', 'Tienda'],
    extraIssues: [
      'No abre sistema administrativo',
      'No acceso a carpetas o servidor remoto',
      'Permisos o credenciales incorrectas',
    ],
  },
];

function buildUniqueStrings(values: readonly string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = normalizeForCompare(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(text);
  });

  return output;
}

function getLocationSegments(ubicacion?: string): string[] {
  const raw = String(ubicacion || '').trim().toUpperCase();
  if (!raw || raw === 'SIN UBICACION') return [];
  return raw
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getLocationTokens(ubicacion?: string): string[] {
  const segments = getLocationSegments(ubicacion);
  return buildUniqueStrings(
    segments.flatMap((segment) => segment.split(/[\s/-]+/).map((token) => token.trim().toUpperCase())),
  );
}

function findIssueTemplate(
  templates: readonly TicketIssueSuggestionTemplate[],
  values: readonly string[],
): TicketIssueSuggestionTemplate | null {
  const normalized = values
    .map((value) => normalizeForCompare(value))
    .filter(Boolean);
  if (normalized.length === 0) return null;

  return templates.find((template) =>
    template.matchers.some((matcher) => {
      const key = normalizeForCompare(matcher);
      return normalized.some((value) => value === key || value.includes(key) || key.includes(value));
    }),
  ) || null;
}

function inferTicketSuggestedArea(
  locationTemplate: TicketIssueSuggestionTemplate | null,
  typeTemplate: TicketIssueSuggestionTemplate | null,
  locationLabel: string,
  branchCode: string,
): TicketAreaLabel | null {
  const normalizedLocation = normalizeForCompare(locationLabel);
  const normalizedBranch = normalizeForCompare(branchCode);
  const hasSpecificLocation = !!normalizedLocation && normalizedLocation !== normalizedBranch && normalizedLocation !== 'sinubicacion';
  if (hasSpecificLocation && locationTemplate?.preferredArea) return locationTemplate.preferredArea;
  if (typeTemplate?.preferredArea) return typeTemplate.preferredArea;
  if (locationTemplate?.preferredArea) return locationTemplate.preferredArea;
  return null;
}

function appendIssueGroup(target: string[], area: TicketAreaLabel | undefined) {
  if (!area) return;
  const issues = ISSUE_GROUP_BY_AREA.get(area);
  if (!issues) return;
  target.push(...issues);
}

function normalizeAssetType(asset?: Pick<Activo, 'tipo' | 'equipo'> | null): string {
  return String(asset?.tipo || asset?.equipo || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function buildTicketAssetContextSummary(
  asset: Pick<Activo, 'tipo' | 'equipo' | 'ubicacion' | 'departamento'> | null | undefined,
  validBranchCodes: ReadonlySet<string>,
): TicketAssetContextSummary | null {
  if (!asset) return null;

  const branchCode = resolveAssetBranchCode(asset, validBranchCodes);
  const locationSegments = getLocationSegments(asset.ubicacion);
  const locationLabel = locationSegments.find((segment) => normalizeForCompare(segment) !== normalizeForCompare(branchCode))
    || locationSegments[0]
    || 'SIN UBICACION';
  const locationTokens = getLocationTokens(asset.ubicacion);
  const typeCode = normalizeAssetType(asset);
  const typeTemplate = findIssueTemplate(ASSET_TYPE_TEMPLATES, [typeCode]);
  const locationTemplate = findIssueTemplate(LOCATION_TEMPLATES, [locationLabel, ...locationTokens, branchCode]);

  return {
    branchCode,
    locationLabel,
    locationTokens,
    typeCode,
    suggestedArea: inferTicketSuggestedArea(locationTemplate, typeTemplate, locationLabel, branchCode),
  };
}

export function buildSuggestedTicketIssues(
  selectedArea: string,
  asset: Pick<Activo, 'tipo' | 'equipo' | 'ubicacion' | 'departamento'> | null | undefined,
  validBranchCodes: ReadonlySet<string>,
): string[] {
  const output: string[] = [];
  const area = String(selectedArea || '').trim() as TicketAreaLabel;
  const context = buildTicketAssetContextSummary(asset, validBranchCodes);
  const typeTemplate = context?.typeCode
    ? findIssueTemplate(ASSET_TYPE_TEMPLATES, [context.typeCode])
    : null;
  const locationTemplate = context
    ? findIssueTemplate(LOCATION_TEMPLATES, [context.locationLabel, ...context.locationTokens, context.branchCode])
    : null;

  if (area) appendIssueGroup(output, area);
  if (context?.suggestedArea && context.suggestedArea !== area) appendIssueGroup(output, context.suggestedArea);

  typeTemplate?.areas.forEach((groupArea) => appendIssueGroup(output, groupArea));
  locationTemplate?.areas.forEach((groupArea) => appendIssueGroup(output, groupArea));

  if (typeTemplate) output.push(...typeTemplate.extraIssues);
  if (locationTemplate) output.push(...locationTemplate.extraIssues);

  return buildUniqueStrings(output);
}

export function calculateSlaDeadline(prioridad: PrioridadTicket): string {
  const hours = SLA_POLICY[prioridad] || SLA_POLICY.MEDIA;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function isTicketClosed(ticket: Pick<TicketItem, 'estado'>): boolean {
  return ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado';
}

export function ticketAuditActionLabel(estado: TicketEstado): string {
  if (estado === 'Resuelto') return 'Ticket Resuelto';
  if (estado === 'Cerrado') return 'Ticket Cerrado';
  if (estado === 'En Proceso') return 'Ticket En Proceso';
  if (estado === 'En Espera') return 'Ticket En Espera';
  return 'Ticket Actualizado';
}

export function buildTicketHistoryEntry(
  accion: string,
  estado: TicketEstado,
  usuario: string,
  comentario = '',
): { fecha: string; usuario: string; accion: string; estado: TicketEstado; comentario?: string } {
  return {
    fecha: new Date().toISOString(),
    usuario,
    accion,
    estado,
    comentario,
  };
}

function getTicketSlaDueTimestamp(ticket: Pick<TicketItem, 'fechaLimite'>): number | null {
  return parseDateToTimestamp(ticket.fechaLimite || '');
}

export function getTicketSlaRemainingMinutes(ticket: TicketItem, nowMs = Date.now()): number | null {
  if (isTicketClosed(ticket)) return null;
  const dueTimestamp = getTicketSlaDueTimestamp(ticket);
  if (dueTimestamp !== null) {
    return Math.ceil((dueTimestamp - nowMs) / 60000);
  }
  return typeof ticket.slaRestanteMin === 'number' ? ticket.slaRestanteMin : null;
}

export function isTicketSlaExpired(ticket: TicketItem, nowMs = Date.now()): boolean {
  if (isTicketClosed(ticket)) return false;
  const dueTimestamp = getTicketSlaDueTimestamp(ticket);
  if (dueTimestamp !== null) return nowMs > dueTimestamp;
  const remaining = typeof ticket.slaRestanteMin === 'number' ? ticket.slaRestanteMin : null;
  return !!ticket.slaVencido || (typeof remaining === 'number' && remaining <= 0);
}

export function getSlaStatus(ticket: TicketItem, nowMs = Date.now()): { label: string; className: string } {
  if (isTicketClosed(ticket)) {
    return { label: 'SLA CERRADO', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  const remaining = getTicketSlaRemainingMinutes(ticket, nowMs);
  if (isTicketSlaExpired(ticket, nowMs) || (typeof remaining === 'number' && remaining <= 0)) {
    return { label: 'SLA VENCIDO', className: 'bg-red-50 text-red-600 border-red-200' };
  }
  if (typeof remaining === 'number' && remaining <= 60) {
    return { label: `SLA ${remaining} MIN`, className: 'bg-amber-50 text-amber-600 border-amber-200' };
  }
  if (typeof remaining === 'number') {
    const hours = Math.ceil(remaining / 60);
    return { label: `SLA ${hours} H`, className: 'bg-green-50 text-green-600 border-green-200' };
  }

  return { label: 'SLA N/D', className: 'bg-slate-100 text-slate-500 border-slate-200' };
}

export function normalizeTicketAttentionType(value: unknown): TicketAttentionType | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'PRESENCIAL' || normalized === 'REMOTO') return normalized as TicketAttentionType;
  return null;
}

export function formatTicketAttentionType(value: unknown): string {
  const normalized = normalizeTicketAttentionType(value);
  if (!normalized) return 'Sin definir';
  return normalized === 'PRESENCIAL' ? 'Presencial' : 'Remoto';
}

export function buildTicketDescription(areaAfectada: string, descripcion: string): string {
  const area = String(areaAfectada || '').trim();
  const details = String(descripcion || '').trim();
  if (!area) return details;
  const areaLabel = `Área afectada: ${area}`;
  return details.startsWith(areaLabel) ? details : `${areaLabel} | ${details}`;
}
