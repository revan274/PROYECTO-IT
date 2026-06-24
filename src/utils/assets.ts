import {
  DEFAULT_CATALOGS,
  TICKET_BRANCH_LABEL_BY_CODE,
  USER_CARGO_LABEL_BY_VALUE,
  USER_ROLE_LABEL,
  USER_ROLE_PERMISSIONS,
} from '../constants/app';
import type {
  Activo,
  AssetRiskSummary,
  CatalogBranch,
  CatalogRole,
  CatalogState,
  UserRole,
} from '../types/app';
import { normalizeForCompare } from './format';
import { USER_ROLE_ORDER, isUserRole } from './roles';

const NETWORK_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);
const RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);

// Traducción de siglas de tipo de activo a un nombre que un solicitante reconozca.
const ASSET_TYPE_FRIENDLY_NAMES: Record<string, string> = {
  DSK: 'COMPUTADORA',
  PC: 'COMPUTADORA',
  CPU: 'COMPUTADORA',
  AIO: 'COMPUTADORA',
  LPT: 'LAPTOP',
  NB: 'LAPTOP',
  IMP: 'IMPRESORA',
  PRN: 'IMPRESORA',
  TCK: 'IMPRESORA DE TICKETS',
  MON: 'MONITOR',
  BSC: 'BASCULA',
  AUD: 'AUDIO',
  VPR: 'PROYECTOR',
  VDP: 'PANTALLA',
  SRV: 'SERVIDOR',
  RTR: 'RUTEADOR',
  SW: 'SWITCH',
  UPS: 'UPS / NO BREAK',
  TEL: 'TELEFONO',
  TAB: 'TABLET',
};

/** Devuelve un nombre de tipo legible (IMP -> IMPRESORA). Si no hay traducción, usa el código tal cual. */
export function humanizeAssetType(asset?: Pick<Activo, 'tipo' | 'equipo'> | null): string {
  const raw = String(asset?.tipo || asset?.equipo || '').trim().toUpperCase();
  const code = raw.replace(/[^A-Z0-9]/g, '');
  return ASSET_TYPE_FRIENDLY_NAMES[code] || raw || 'EQUIPO';
}

// Códigos de puesto (van en el folio/responsable, ej. "CJ1") que se expanden a un nombre reconocible.
const ASSET_STATION_PREFIXES: Record<string, string> = {
  CJ: 'CAJA',
  CAJA: 'CAJA',
};

/** Expande un código de puesto: "CJ1" -> "CAJA 1", "CJ" -> "CAJA". Devuelve null si no lo reconoce. */
export function expandStationCode(code?: string | null): string | null {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return null;
  const match = raw.match(/^([A-Z]+)\s*0*(\d+)$/);
  if (match && ASSET_STATION_PREFIXES[match[1]]) {
    return `${ASSET_STATION_PREFIXES[match[1]]} ${Number(match[2])}`;
  }
  return ASSET_STATION_PREFIXES[raw] || null;
}

/** Busca un código de puesto reconocible dentro del folio (ej. "TJ01-TJ01-IMP-CJ1-40" -> "CAJA 1"). */
export function extractStationFromTag(tag?: string | null): string | null {
  const segments = String(tag || '').toUpperCase().split(/[-_\s]+/).filter(Boolean);
  for (const segment of segments) {
    const expanded = expandStationCode(segment);
    if (expanded) return expanded;
  }
  return null;
}

export interface AssetDisplayOption {
  tag: string;
  displayName: string;
  ubicacion: string;
  /** true si el nombre lo cargó un humano (nombreVisible); false si es autogenerado. */
  custom: boolean;
}

/**
 * Construye nombres amigables para una lista de activos (típicamente de una sucursal).
 * Prioridad del nombre:
 *  1. `nombreVisible` cargado por un humano.
 *  2. Puesto reconocido en el folio + tipo (ej. "CAJA 1 - IMPRESORA").
 *  3. Tipo traducido y numerado si se repite (COMPUTADORA 1, COMPUTADORA 2, IMPRESORA...).
 * Apunta a nombres únicos dentro de la lista para que el selector no sea ambiguo.
 */
export function buildAssetDisplayOptions(
  assets: Array<Pick<Activo, 'tag' | 'tipo' | 'equipo' | 'ubicacion' | 'nombreVisible'>>,
): AssetDisplayOption[] {
  const sorted = assets
    .filter((asset) => String(asset?.tag || '').trim() !== '')
    .slice()
    .sort((left, right) => String(left.tag || '').localeCompare(String(right.tag || '')));

  // Solo numeramos los autogenerados SIN puesto reconocido (los de puesto ya son únicos por "CAJA n").
  const typeCounts = new Map<string, number>();
  for (const asset of sorted) {
    if (String(asset?.nombreVisible || '').trim()) continue;
    if (extractStationFromTag(asset.tag)) continue;
    const type = humanizeAssetType(asset);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }

  const typeSeq = new Map<string, number>();
  return sorted.map((asset) => {
    const tag = String(asset.tag || '').trim().toUpperCase();
    const ubicacion = String(asset.ubicacion || '').trim().toUpperCase() || 'SIN UBICACION';
    const custom = String(asset?.nombreVisible || '').trim() !== '';

    if (custom) {
      return { tag, displayName: String(asset.nombreVisible).trim().toUpperCase(), ubicacion, custom: true };
    }

    const type = humanizeAssetType(asset);
    const station = extractStationFromTag(tag);
    if (station) {
      return { tag, displayName: `${station} - ${type}`, ubicacion, custom: false };
    }

    const total = typeCounts.get(type) || 0;
    const seq = (typeSeq.get(type) || 0) + 1;
    typeSeq.set(type, seq);
    const displayName = total > 1 ? `${type} ${seq}` : type;
    return { tag, displayName, ubicacion, custom: false };
  });
}

type NetworkSheetRow = unknown[];

export function formatTicketBranch(value?: string, labels: Record<string, string> = TICKET_BRANCH_LABEL_BY_CODE): string {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return 'Sin sucursal';
  return labels[code] || code;
}

export function resolveAssetBranchCode(
  asset: Pick<Activo, 'departamento' | 'ubicacion'>,
  validBranchCodes: ReadonlySet<string>,
): string {
  const departamento = String(asset.departamento || '').trim().toUpperCase();
  if (departamento && validBranchCodes.has(departamento)) return departamento;

  const ubicacion = String(asset.ubicacion || '').trim().toUpperCase();
  if (!ubicacion) return '';

  const segments = ubicacion.split('|').map((part) => part.trim()).filter(Boolean);
  for (const segment of segments) {
    if (validBranchCodes.has(segment)) return segment;
    const tokens = segment.split(/\s+/).map((token) => token.trim()).filter(Boolean);
    for (const token of tokens) {
      if (validBranchCodes.has(token)) return token;
    }
  }

  for (const code of validBranchCodes) {
    if (ubicacion.includes(code)) return code;
  }

  return '';
}

export function formatUserCargo(value?: string, labels: Record<string, string> = USER_CARGO_LABEL_BY_VALUE): string {
  const cargo = String(value || '').trim().toUpperCase();
  if (!cargo) return 'Sin cargo';
  return labels[cargo] || value || 'Sin cargo';
}

export function normalizeSpreadsheetKey(value: string): string {
  return normalizeForCompare(value).replace(/[^a-z0-9]/g, '');
}

export function spreadsheetCellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, '');
  }
  return String(value).trim();
}

export function normalizeMacAddress(value: string): string {
  const compact = value.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!compact || compact.length !== 12) return '';
  return compact.match(/.{1,2}/g)?.join(':') || '';
}

export function normalizeIpAddress(value: string): string {
  if (!value) return '';
  const parts = value.split('.');
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

export function parseNetworkSheetRows(rows: NetworkSheetRow[]): Array<{ macAddress: string; ipAddress: string; deviceLabel: string }> {
  return rows
    .map((row) => {
      const rawMac = spreadsheetCellToText(row[0]);
      const rawIp = spreadsheetCellToText(row[1]);
      const rawLabel = spreadsheetCellToText(row[2]);
      const macAddress = normalizeMacAddress(rawMac);
      const ipAddress = normalizeIpAddress(rawIp);
      const label = rawLabel.trim();
      const isHeader =
        normalizeForCompare(rawMac).includes('mac')
        || normalizeForCompare(rawIp).includes('ip')
        || normalizeForCompare(rawLabel).includes('nombre');

      return { macAddress, ipAddress, deviceLabel: label, isHeader };
    })
    .filter((row) => !row.isHeader)
    .filter((row) => !!row.macAddress || !!row.ipAddress || !!row.deviceLabel)
    .map((row) => ({
      macAddress: row.macAddress,
      ipAddress: row.ipAddress,
      deviceLabel: row.deviceLabel,
    }));
}

export function enrichAssetsWithNetworkSheet(
  parsedRows: Array<{ rowNumber: number; item: Omit<Activo, 'id'> }>,
  networkRows: Array<{ macAddress: string; ipAddress: string; deviceLabel: string }>,
): Array<{ rowNumber: number; item: Omit<Activo, 'id'> }> {
  if (networkRows.length === 0 || parsedRows.length === 0) return parsedRows;

  const byMac = new Map<string, { macAddress: string; ipAddress: string; deviceLabel: string }>();
  const byIp = new Map<string, { macAddress: string; ipAddress: string; deviceLabel: string }>();

  networkRows.forEach((row) => {
    if (row.macAddress) byMac.set(normalizeForCompare(row.macAddress), row);
    if (row.ipAddress) byIp.set(normalizeForCompare(row.ipAddress), row);
  });

  return parsedRows.map((entry) => {
    const macKey = normalizeForCompare(entry.item.macAddress || '');
    const ipKey = normalizeForCompare(entry.item.ipAddress || '');
    const match = (macKey ? byMac.get(macKey) : undefined) || (ipKey ? byIp.get(ipKey) : undefined);
    if (!match) return entry;

    return {
      rowNumber: entry.rowNumber,
      item: {
        ...entry.item,
        macAddress: entry.item.macAddress || match.macAddress,
        ipAddress: entry.item.ipAddress || match.ipAddress,
        responsable: entry.item.responsable || match.deviceLabel,
      },
    };
  });
}

export function parseAssetLifeYears(value?: string): number | null {
  const raw = normalizeForCompare(value || '');
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const years = Number(match[0]);
  if (!Number.isFinite(years)) return null;
  return years;
}

export function getAssetRiskTypeKey(asset: Pick<Activo, 'tipo' | 'equipo'>): string {
  return String(asset.tipo || asset.equipo || '')
    .trim()
    .toUpperCase();
}

export function assetRequiresNetworkIdentity(asset: Pick<Activo, 'tipo' | 'equipo'>): boolean {
  return !NETWORK_RISK_EXEMPT_ASSET_TYPES.has(getAssetRiskTypeKey(asset));
}

export function assetRequiresResponsible(asset: Pick<Activo, 'tipo' | 'equipo'>): boolean {
  return !RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES.has(getAssetRiskTypeKey(asset));
}

export { isUserRole };

export function normalizeCatalogState(value?: Partial<CatalogState>): CatalogState {
  const branchSource = Array.isArray(value?.sucursales) && value.sucursales.length > 0
    ? value.sucursales
    : DEFAULT_CATALOGS.sucursales;
  const branchMap = new Map<string, CatalogBranch>();
  branchSource.forEach((branch) => {
    const code = String(branch?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = String(branch?.name || '').trim();
    if (!code || !name) return;
    branchMap.set(code, {
      code,
      name,
      activo: branch?.activo !== false,
    });
  });
  const sucursales = branchMap.size > 0
    ? Array.from(branchMap.values())
    : DEFAULT_CATALOGS.sucursales.map((branch) => ({ ...branch }));

  const cargoSource = Array.isArray(value?.cargos) && value.cargos.length > 0
    ? value.cargos
    : DEFAULT_CATALOGS.cargos;
  const cargoMap = new Map<string, string>();
  cargoSource.forEach((cargo) => {
    const label = String(cargo || '').trim();
    if (!label) return;
    const key = normalizeForCompare(label);
    if (!cargoMap.has(key)) cargoMap.set(key, label);
  });
  const cargos = cargoMap.size > 0 ? Array.from(cargoMap.values()) : [...DEFAULT_CATALOGS.cargos];

  const roleSource = Array.isArray(value?.roles) && value.roles.length > 0
    ? value.roles
    : DEFAULT_CATALOGS.roles;
  const roleMap = new Map<UserRole, CatalogRole>();
  roleSource.forEach((role) => {
    const rawValue = String(role?.value || '').trim().toLowerCase();
    if (!isUserRole(rawValue)) return;
    roleMap.set(rawValue, {
      value: rawValue,
      label: String(role?.label || USER_ROLE_LABEL[rawValue]).trim() || USER_ROLE_LABEL[rawValue],
      permissions: String(role?.permissions || USER_ROLE_PERMISSIONS[rawValue]).trim() || USER_ROLE_PERMISSIONS[rawValue],
      activo: role?.activo !== false,
    });
  });
  const roles: CatalogRole[] = USER_ROLE_ORDER.map((role) => (
    roleMap.get(role) || {
      value: role,
      label: USER_ROLE_LABEL[role],
      permissions: USER_ROLE_PERMISSIONS[role],
      activo: true,
    }
  ));

  return { sucursales, cargos, roles };
}

export function calculateAssetRiskSummary(activos: Activo[]): AssetRiskSummary {
  const ipCounts = new Map<string, number>();
  const macCounts = new Map<string, number>();
  let activosEvaluablesIp = 0;
  let activosSinIp = 0;
  let activosEvaluablesMac = 0;
  let activosSinMac = 0;
  let activosEvaluablesResponsable = 0;
  let activosSinResponsable = 0;
  let activosVidaAlta = 0;
  let activosEnFalla = 0;

  activos.forEach((asset) => {
    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    const responsable = (asset.responsable || '').trim();
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
  });

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
    duplicateIpEntries,
    duplicateMacEntries,
  };
}
