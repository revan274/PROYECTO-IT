import type {
  Activo,
  DashboardRange,
  EstadoActivo,
  FormDataState,
  Insumo,
  ModalType,
  ReportAttentionFilter,
  ReportPriorityFilter,
  ReportStateFilter,
  SupplyStatusFilter,
  TicketItem,
  TravelDestinationRule,
  TravelMonthRange,
  TravelReportRow,
  UserItem,
  UserSession,
} from '../types/app';
import { DASHBOARD_RANGES } from '../constants/app';
import {
  normalizeForCompare,
  parseDateToTimestamp,
} from './format';
import { normalizeTicketAttentionType } from './tickets';
import {
  normalizeIpAddress,
  normalizeMacAddress,
  normalizeSpreadsheetKey,
  spreadsheetCellToText,
} from './assets';

export function ticketTimestamp(ticket: TicketItem): number {
  const source = ticket.fechaCreacion || ticket.fechaCierre || ticket.fecha;
  if (!source) return Number(ticket.id || 0);
  const parsed = parseDateToTimestamp(source);
  if (parsed === null) return Number(ticket.id || 0);
  return parsed;
}

export function ticketCreatedTimestamp(ticket: TicketItem): number {
  const source = ticket.fechaCreacion || ticket.fecha;
  if (!source) return ticketTimestamp(ticket);
  const parsed = parseDateToTimestamp(source);
  if (parsed === null) return ticketTimestamp(ticket);
  return parsed;
}

export function parseMonthInputRange(value?: string): TravelMonthRange | null {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return {
    year,
    monthIndex: month - 1,
    startMs: start.getTime(),
    endMs: end.getTime() - 1,
  };
}

export function formatMonthInputLabel(value?: string): string {
  const range = parseMonthInputRange(value);
  if (!range) return 'N/D';
  return new Date(range.year, range.monthIndex, 1)
    .toLocaleDateString('es-MX', { month: 'long' })
    .toUpperCase();
}

export function formatTravelDate(value?: string): string {
  const timestamp = parseDateToTimestamp(value);
  if (timestamp === null) return 'N/D';
  return new Date(timestamp).toLocaleDateString('es-MX');
}

export function compactBranchLabel(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^sucursal\s+/i, '').trim().toUpperCase();
}

export function parseNonNegativeNumber(value: unknown, fallback = 0): number {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function roundToTwoDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function formatTravelNumber(value: number): string {
  return String(roundToTwoDecimals(value));
}

export function parseTicketTravelCreatedAt(ticket: TicketItem): number | null {
  return parseDateToTimestamp(ticket.fechaCreacion || ticket.fecha);
}

export function resolveTravelTechnicianScope(
  selectedValue: string,
  users: readonly UserItem[],
): { key: string; label: string } {
  const raw = String(selectedValue || '').trim();
  if (!raw || raw === 'TODOS') {
    return { key: 'scope:all', label: 'TODOS' };
  }
  if (raw === 'SIN_ASIGNAR') {
    return { key: 'scope:unassigned', label: 'SIN ASIGNAR' };
  }

  const normalized = normalizeForCompare(raw);
  const matchedUser = users.find((user) => {
    const nameKey = normalizeForCompare(user.nombre || '');
    const usernameKey = normalizeForCompare(user.username || '');
    return normalized && (nameKey === normalized || usernameKey === normalized);
  });

  if (matchedUser?.id) {
    return {
      key: `user:${matchedUser.id}`,
      label: String(matchedUser.nombre || raw).trim() || raw,
    };
  }

  return {
    key: `name:${normalized || 'unknown'}`,
    label: raw,
  };
}

function buildTravelManualRow(
  destinationCode: string,
  destinationRuleByCode: ReadonlyMap<string, TravelDestinationRule>,
  reporterName: string,
  createdAt: number,
  ticketId: number,
  motivo: string,
): TravelReportRow {
  const destinationRule = destinationRuleByCode.get(destinationCode);
  return {
    ticketId,
    createdAt,
    nombre: reporterName,
    destinationCode,
    destinationLabel: destinationRule?.label || destinationCode,
    routeIndex: destinationRule?.index || 0,
    kms: destinationRule?.kms || 0,
    fecha: 'MANUAL',
    motivo,
  };
}

function aggregateTravelRows(rows: readonly TravelReportRow[], reporterName: string): TravelReportRow {
  const first = rows[0];
  const motives = Array.from(
    new Set(
      rows
        .map((row) => String(row.motivo || '').trim())
        .filter(Boolean),
    ),
  );
  const dates = Array.from(
    new Set(
      rows
        .map((row) => String(row.fecha || '').trim())
        .filter(Boolean),
    ),
  );

  return {
    ...first,
    nombre: reporterName || first.nombre,
    fecha: dates.length <= 1 ? (dates[0] || first.fecha) : 'VARIOS',
    motivo: motives.join(' / ') || first.motivo,
  };
}

export function buildTravelReportRowsFromActualTrips(
  ticketRows: readonly TravelReportRow[],
  actualTripsByCode: ReadonlyMap<string, number>,
  destinationRuleByCode: ReadonlyMap<string, TravelDestinationRule>,
  reporterName: string,
  monthRange: TravelMonthRange | null,
): TravelReportRow[] {
  const grouped = new Map<string, TravelReportRow[]>();

  ticketRows
    .slice()
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.ticketId - b.ticketId;
    })
    .forEach((row) => {
      const current = grouped.get(row.destinationCode);
      if (current) current.push(row);
      else grouped.set(row.destinationCode, [row]);
    });

  const destinationCodes = new Set<string>([
    ...grouped.keys(),
    ...actualTripsByCode.keys(),
  ]);
  const output: TravelReportRow[] = [];
  let manualSequence = 0;
  const manualBaseTime = monthRange?.endMs ?? Date.now();
  const manualBaseTicketId = 900000;

  Array.from(destinationCodes)
    .sort((a, b) => a.localeCompare(b))
    .forEach((destinationCode) => {
      const sourceRows = grouped.get(destinationCode) || [];
      const inferredTrips = sourceRows.length;
      const targetTrips = Math.max(
        0,
        Math.trunc(Number(actualTripsByCode.get(destinationCode) ?? inferredTrips) || 0),
      );
      if (targetTrips <= 0) return;

      if (sourceRows.length === 0) {
        for (let index = 0; index < targetTrips; index += 1) {
          manualSequence += 1;
          output.push(buildTravelManualRow(
            destinationCode,
            destinationRuleByCode,
            reporterName,
            manualBaseTime + manualSequence,
            manualBaseTicketId + manualSequence,
            'Viaje real registrado manualmente',
          ));
        }
        return;
      }

      if (targetTrips >= sourceRows.length) {
        output.push(...sourceRows.map((row) => ({ ...row, nombre: reporterName || row.nombre })));
        for (let index = sourceRows.length; index < targetTrips; index += 1) {
          manualSequence += 1;
          output.push(buildTravelManualRow(
            destinationCode,
            destinationRuleByCode,
            reporterName,
            manualBaseTime + manualSequence,
            manualBaseTicketId + manualSequence,
            'Viaje adicional registrado manualmente',
          ));
        }
        return;
      }

      const buckets = Array.from({ length: targetTrips }, () => [] as TravelReportRow[]);
      sourceRows.forEach((row, index) => {
        const bucketIndex = Math.min(
          targetTrips - 1,
          Math.floor((index * targetTrips) / sourceRows.length),
        );
        buckets[bucketIndex].push(row);
      });
      buckets
        .filter((bucket) => bucket.length > 0)
        .forEach((bucket) => {
          output.push(aggregateTravelRows(bucket, reporterName));
        });
    });

  return output.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.ticketId - b.ticketId;
  });
}

export function resolveTicketTravelDestinationCode(ticket: TicketItem, validBranchCodes: ReadonlySet<string>): string {
  const byBranch = String(ticket.sucursal || '').trim().toUpperCase();
  if (byBranch && validBranchCodes.has(byBranch)) return byBranch;

  const byDepartment = String(ticket.departamento || '').trim().toUpperCase();
  if (byDepartment && validBranchCodes.has(byDepartment)) return byDepartment;
  return '';
}

export function getTicketAreaLabel(ticket: TicketItem): string {
  const description = String(ticket.descripcion || '').trim();
  if (description) {
    const match = description.match(/^(?:[aá]rea afectada:)\s*([^|]+)\|/i);
    if (match?.[1]) {
      const area = match[1].trim();
      if (area) return area;
    }
  }
  const departamento = String(ticket.departamento || '').trim();
  if (departamento) return departamento;
  return 'Sin area';
}

export function extractTicketIssueDescription(ticket: TicketItem): string {
  const description = String(ticket.descripcion || '').trim();
  if (!description) return 'Sin descripcion';

  const cleaned = description
    .replace(/^(?:[aá]rea afectada:)\s*[^|]+(?:\|\s*)?/i, '')
    .trim();
  return cleaned || description;
}

export function normalizeIncidentCause(value: string): string {
  const normalized = normalizeForCompare(value || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || 'sin descripcion';
}

export function matchesReportBranch(ticket: TicketItem, filter: string): boolean {
  if (filter === 'TODAS') return true;
  return String(ticket.sucursal || '').trim().toUpperCase() === filter;
}

export function matchesReportArea(ticket: TicketItem, filter: string): boolean {
  if (filter === 'TODAS') return true;
  return normalizeForCompare(getTicketAreaLabel(ticket)) === normalizeForCompare(filter);
}

export function matchesReportState(ticket: TicketItem, filter: ReportStateFilter): boolean {
  if (filter === 'TODOS') return true;
  return ticket.estado === filter;
}

export function matchesReportPriority(ticket: TicketItem, filter: ReportPriorityFilter): boolean {
  if (filter === 'TODAS') return true;
  return ticket.prioridad === filter;
}

export function matchesReportAttention(ticket: TicketItem, filter: ReportAttentionFilter): boolean {
  if (filter === 'TODAS') return true;
  return normalizeTicketAttentionType(ticket.atencionTipo) === filter;
}

export function matchesReportTechnician(ticket: TicketItem, filter: string): boolean {
  const assignee = String(ticket.asignadoA || '').trim();
  if (filter === 'TODOS') return true;
  if (filter === 'SIN_ASIGNAR') return !assignee;
  return normalizeForCompare(assignee) === normalizeForCompare(filter);
}

export function collectResolutionHours(rows: TicketItem[]): number[] {
  return rows
    .filter((ticket) => ticket.estado === 'Resuelto' || ticket.estado === 'Cerrado')
    .map((ticket) => {
      const start = ticketCreatedTimestamp(ticket);
      const end = parseDateToTimestamp(ticket.fechaCierre || '');
      if (end === null || end <= start) return null;
      return (end - start) / (60 * 60 * 1000);
    })
    .filter((value): value is number => value !== null);
}

export function startOfLocalDayTimestamp(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfLocalWeekTimestamp(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.getTime();
}

export function resolveDashboardRangeWindow(range: DashboardRange, nowMs = Date.now()): {
  label: string;
  startMs: number;
  endMs: number;
  previousStartMs: number;
  previousEndMs: number;
} {
  const dayMs = 24 * 60 * 60 * 1000;
  const selected = DASHBOARD_RANGES.find((item) => item.value === range) || DASHBOARD_RANGES[1];

  if (selected.value === 'TODAY') {
    const startMs = startOfLocalDayTimestamp(nowMs);
    const elapsed = Math.max(1, nowMs - startMs);
    const previousStartMs = startMs - dayMs;
    const previousEndMs = previousStartMs + elapsed;
    return {
      label: selected.label,
      startMs,
      endMs: nowMs,
      previousStartMs,
      previousEndMs,
    };
  }

  const spanMs = selected.days * dayMs;
  const startMs = nowMs - spanMs;
  const endMs = nowMs;
  const previousStartMs = startMs - spanMs;
  const previousEndMs = startMs;
  return {
    label: selected.label,
    startMs,
    endMs,
    previousStartMs,
    previousEndMs,
  };
}

export function formatDashboardTrend(current: number, previous: number, positiveIsGood = true): {
  label: string;
  toneClass: string;
} {
  const diff = current - previous;
  if (diff === 0) {
    return {
      label: `Sin cambio vs periodo anterior (${previous})`,
      toneClass: 'text-slate-400',
    };
  }

  const pct = previous > 0
    ? Math.round((Math.abs(diff) / previous) * 100)
    : 100;
  const sign = diff > 0 ? '+' : '-';
  const isPositiveResult = positiveIsGood ? diff > 0 : diff < 0;
  return {
    label: `${sign}${Math.abs(diff)} (${pct}%) vs periodo anterior (${previous})`,
    toneClass: isPositiveResult ? 'text-green-500' : 'text-red-500',
  };
}

export function formatMetricTrend(
  current: number | null,
  previous: number | null,
  options?: {
    positiveIsGood?: boolean;
    decimals?: number;
    unitSuffix?: string;
    usePoints?: boolean;
    unavailableLabel?: string;
  },
): {
  label: string;
  toneClass: string;
} {
  const positiveIsGood = options?.positiveIsGood ?? true;
  const decimals = options?.decimals ?? 0;
  const unitSuffix = options?.unitSuffix ?? '';
  const usePoints = options?.usePoints ?? false;
  const unavailableLabel = options?.unavailableLabel ?? 'Comparativo no disponible';

  if (current === null || previous === null) {
    return {
      label: unavailableLabel,
      toneClass: 'text-slate-400',
    };
  }

  const normalizedCurrent = Number(current.toFixed(decimals));
  const normalizedPrevious = Number(previous.toFixed(decimals));
  const diff = Number((normalizedCurrent - normalizedPrevious).toFixed(decimals));
  const formatValue = (value: number) => (decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));

  if (diff === 0) {
    return {
      label: `Sin cambio vs periodo anterior (${formatValue(normalizedPrevious)}${unitSuffix})`,
      toneClass: 'text-slate-400',
    };
  }

  const sign = diff > 0 ? '+' : '-';
  const absDiff = Math.abs(diff);
  const isPositiveResult = positiveIsGood ? diff > 0 : diff < 0;

  if (usePoints) {
    return {
      label: `${sign}${formatValue(absDiff)} pts vs periodo anterior (${formatValue(normalizedPrevious)}${unitSuffix})`,
      toneClass: isPositiveResult ? 'text-green-500' : 'text-red-500',
    };
  }

  const pct = Math.abs(normalizedPrevious) > 0
    ? Math.round((absDiff / Math.abs(normalizedPrevious)) * 100)
    : 100;
  return {
    label: `${sign}${formatValue(absDiff)}${unitSuffix} (${pct}%) vs periodo anterior (${formatValue(normalizedPrevious)}${unitSuffix})`,
    toneClass: isPositiveResult ? 'text-green-500' : 'text-red-500',
  };
}

export function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculatePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return roundHours(sorted[0]);

  const clamped = Math.min(100, Math.max(0, percentile));
  const index = (clamped / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  if (lowerIndex === upperIndex) return roundHours(lower);

  const ratio = index - lowerIndex;
  return roundHours(lower + ((upper - lower) * ratio));
}

export function calculateMedian(values: number[]): number | null {
  return calculatePercentile(values, 50);
}

export function ticketBelongsToSessionUser(ticket: TicketItem, user: UserSession | null): boolean {
  if (!user) return false;
  if (user.rol !== 'solicitante') return true;

  const userId = Number(user.id);
  const ticketUserId = Number(ticket.solicitadoPorId);
  if (Number.isFinite(userId) && Number.isFinite(ticketUserId) && userId === ticketUserId) {
    return true;
  }

  const userName = normalizeForCompare(user.nombre || '');
  const userUsername = normalizeForCompare(user.username || '');
  const ticketName = normalizeForCompare(ticket.solicitadoPor || '');
  const ticketUsername = normalizeForCompare(ticket.solicitadoPorUsername || '');
  if (userUsername && ticketUsername && userUsername === ticketUsername) return true;
  if (userName && ticketName && userName === ticketName) return true;
  return false;
}

export function buildInitialFormDataForModal(
  modal: Exclude<ModalType, null>,
  defaultBranchCode: string,
): FormDataState {
  if (modal === 'ticket') {
    return {
      prioridad: 'MEDIA',
      atencionTipo: undefined,
      trasladoRequerido: undefined,
      asignadoA: '',
      sucursal: defaultBranchCode,
      areaAfectada: '',
      fallaComun: '',
    };
  }
  if (modal === 'activo') {
    return {
      estado: 'Operativo',
      fechaCompra: new Date().toISOString().slice(0, 10),
    };
  }
  if (modal === 'insumo') {
    return { unidad: 'Piezas' };
  }
  return {};
}

export function getModalTitle(
  modal: ModalType,
  editingAssetId: number | null,
  editingInsumoId: number | null,
): string {
  if (modal === 'activo') return editingAssetId !== null ? 'Editar Equipo' : 'Alta Equipo';
  if (modal === 'insumo') return editingInsumoId !== null ? 'Editar Insumo' : 'Ingreso Material';
  if (modal === 'ticket') return 'Ticket';
  return '';
}

export function getModalSubmitLabel(
  modal: ModalType,
  isModalSaving: boolean,
  editingAssetId: number | null,
  editingInsumoId: number | null,
): string {
  if (isModalSaving) return 'Guardando...';
  if (modal === 'activo' && editingAssetId !== null) return 'Guardar Cambios';
  if (modal === 'insumo' && editingInsumoId !== null) return 'Guardar Cambios';
  return 'Guardar';
}

export function getSupplyHealthStatus(item: Insumo): Exclude<SupplyStatusFilter, 'TODOS'> {
  if (item.stock <= 0) return 'AGOTADO';
  if (item.stock <= item.min) return 'BAJO';
  return 'OK';
}

export function getSupplyCriticalityRank(status: Exclude<SupplyStatusFilter, 'TODOS'>): number {
  if (status === 'AGOTADO') return 0;
  if (status === 'BAJO') return 1;
  return 2;
}

type SpreadsheetRow = Record<string, unknown>;

export function parseInventoryRow(row: SpreadsheetRow, rowNumber: number): Omit<Activo, 'id'> | null {
  const values = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    values.set(normalizeSpreadsheetKey(key), spreadsheetCellToText(value));
  });

  const pick = (...aliases: string[]) => {
    for (const alias of aliases) {
      const value = values.get(normalizeSpreadsheetKey(alias));
      if (!value) continue;
      const clean = value.trim();
      if (!clean || clean.toUpperCase() === 'NA' || clean.toUpperCase() === 'N/A') continue;
      return clean;
    }
    return '';
  };

  const numero = pick('NUM', 'NUMERO');
  const idInterno = pick('ID INTERNO', 'ID_INTERNO', 'ID');
  const equipo = pick('EQUIPO', 'TIPO EQUIPO', 'TIPO');
  const marca = pick('MARCA');
  const modelo = pick('MODELO');
  const serialBase = pick('S/N', 'SN', 'SERIAL', 'NO SERIE');
  const cpu = pick('CPU');
  const ram = pick('RAM');
  const ramTipo = pick('TIPORAM', 'TIPO RAM', 'RAM TIPO', 'TIPO_RAM');
  const disco = pick('DD', 'DISCO', 'HDD', 'SSD');
  const tipoDisco = pick('TIPO_1', 'TIPODISCO', 'TIPO DISCO', 'TIPOALMACENAMIENTO');
  const macAddress = normalizeMacAddress(pick('MAC ADDRESS', 'MAC', 'MACADDRESS'));
  const ipAddress = normalizeIpAddress(pick('IP'));
  const departamento = pick('DEPTO', 'DEPARTAMENTO');
  const ubicacion = pick('UBIC.', 'UBICACION', 'UBIC');
  const responsable = pick('RESP', 'RESPONSABLE');
  const estadoRaw = pick('EDO', 'ESTADO');
  const anydesk = pick('ANYDESK');
  const aniosVida = pick('AÑOS DE VIDA', 'ANOS DE VIDA', 'AÑOS', 'ANOS');
  const comentarios = pick('COMENTARIOS');
  const tagSource = idInterno || pick('TAG') || [equipo, numero].filter(Boolean).join('-') || `INV-${rowNumber}`;
  const tipo = (equipo || 'EQUIPO').toUpperCase();
  const tag = tagSource
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 80);

  if (!tag) return null;

  const marcaFinal = marca || 'SIN MARCA';
  const ubicacionFinal = [departamento, ubicacion].filter(Boolean).join(' | ').trim() || 'SIN UBICACION';
  const serial = (serialBase || idInterno || `${tag}-SN`).toUpperCase();
  const estado: EstadoActivo = /falla|dan|malo|fuera|off|inoper|down|bad/i.test(normalizeForCompare(estadoRaw))
    ? 'Falla'
    : 'Operativo';

  return {
    tag,
    tipo,
    marca: marcaFinal,
    modelo,
    ubicacion: ubicacionFinal,
    estado,
    serial,
    fechaCompra: new Date().toISOString().slice(0, 10),
    idInterno: idInterno.toUpperCase(),
    equipo: tipo,
    cpu: cpu.toUpperCase(),
    ram: ram.toUpperCase(),
    ramTipo: ramTipo.toUpperCase(),
    disco: disco.toUpperCase(),
    tipoDisco: tipoDisco.toUpperCase(),
    macAddress,
    ipAddress,
    responsable,
    departamento: departamento.toUpperCase(),
    edo: estadoRaw.toUpperCase(),
    anydesk,
    aniosVida: aniosVida.toUpperCase(),
    comentarios,
  };
}
