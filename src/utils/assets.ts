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

const NETWORK_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);
const RESPONSIBLE_RISK_EXEMPT_ASSET_TYPES = new Set(['MON', 'IMP', 'BSC', 'AUD', 'VPR', 'VDP']);

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

export function isUserRole(value: string): value is UserRole {
  return value === 'admin' || value === 'tecnico' || value === 'consulta' || value === 'solicitante';
}

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
  const roles: CatalogRole[] = (['admin', 'tecnico', 'consulta', 'solicitante'] as UserRole[]).map((role) => (
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
