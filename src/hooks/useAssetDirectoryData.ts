import { useMemo } from 'react';

import type {
  Activo,
  EstadoActivo,
  InventoryRiskFilter,
  InventorySortDirection,
  InventorySortField,
} from '../types/app';
import {
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  calculateAssetRiskSummary,
  parseAssetLifeYears,
} from '../utils/assets';
import { includesAllSearchTokens, normalizeForCompare } from '../utils/format';

interface AssetDirectoryDataOptions {
  activos: Activo[];
  searchTokens: string[];
  departmentFilter: string;
  equipmentFilter: string;
  statusFilter: 'TODOS' | EstadoActivo;
  riskFilter: InventoryRiskFilter;
  sortField: InventorySortField;
  sortDirection: InventorySortDirection;
}

function compareText(left?: string, right?: string): number {
  const normalizedLeft = normalizeForCompare(left || '');
  const normalizedRight = normalizeForCompare(right || '');
  if (!normalizedLeft && !normalizedRight) return 0;
  if (!normalizedLeft) return 1;
  if (!normalizedRight) return -1;
  return normalizedLeft.localeCompare(normalizedRight);
}

export function deriveAssetDirectoryData({
  activos,
  searchTokens,
  departmentFilter,
  equipmentFilter,
  statusFilter,
  riskFilter,
  sortField,
  sortDirection,
}: AssetDirectoryDataOptions) {
  const localRiskSummary = calculateAssetRiskSummary(activos);
  const duplicateIps = new Set(localRiskSummary.duplicateIpEntries.map((entry) => entry.value));
  const duplicateMacs = new Set(localRiskSummary.duplicateMacEntries.map((entry) => entry.value));

  const departamentoOptions = Array.from(
    new Set(activos.map((asset) => (asset.departamento || '').trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  const equipoOptions = Array.from(
    new Set(activos.map((asset) => (asset.tipo || asset.equipo || '').trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  const filteredActivos = activos.filter((asset) => {
    if (
      departmentFilter !== 'TODOS'
      && normalizeForCompare(asset.departamento || '') !== normalizeForCompare(departmentFilter)
    ) {
      return false;
    }
    if (
      equipmentFilter !== 'TODOS'
      && normalizeForCompare(asset.tipo || asset.equipo || '') !== normalizeForCompare(equipmentFilter)
    ) {
      return false;
    }
    if (statusFilter !== 'TODOS' && asset.estado !== statusFilter) return false;

    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    if (riskFilter === 'SIN_IP' && (!assetRequiresNetworkIdentity(asset) || ip)) return false;
    if (riskFilter === 'SIN_MAC' && (!assetRequiresNetworkIdentity(asset) || mac)) return false;
    if (
      riskFilter === 'SIN_RESP'
      && (!assetRequiresResponsible(asset) || (asset.responsable || '').trim())
    ) {
      return false;
    }
    if (riskFilter === 'DUP_RED' && !duplicateIps.has(ip) && !duplicateMacs.has(mac)) return false;
    if (riskFilter === 'VIDA_ALTA') {
      const years = parseAssetLifeYears(asset.aniosVida);
      if (years === null || years < 4) return false;
    }

    if (searchTokens.length === 0) return true;
    const searchable = normalizeForCompare([
      asset.tag,
      asset.tipo,
      asset.marca,
      asset.modelo,
      asset.serial,
      asset.idInterno,
      asset.responsable,
      asset.departamento,
      asset.ubicacion,
      asset.ipAddress,
      asset.macAddress,
      asset.cpu,
      asset.ram,
      asset.disco,
    ].join(' '));
    return includesAllSearchTokens(searchable, searchTokens);
  });

  const sortedFilteredActivos = [...filteredActivos].sort((left, right) => {
    let comparison = 0;
    if (sortField === 'aniosVida') {
      const leftYears = parseAssetLifeYears(left.aniosVida);
      const rightYears = parseAssetLifeYears(right.aniosVida);
      if (leftYears === null && rightYears === null) comparison = 0;
      else if (leftYears === null) comparison = 1;
      else if (rightYears === null) comparison = -1;
      else comparison = leftYears - rightYears;
    } else if (sortField === 'tag') {
      comparison = compareText(left.tag, right.tag);
    } else if (sortField === 'tipo') {
      comparison = compareText(left.tipo || left.equipo || '', right.tipo || right.equipo || '');
    } else if (sortField === 'estado') {
      comparison = compareText(left.estado, right.estado);
    } else if (sortField === 'responsable') {
      comparison = compareText(left.responsable || '', right.responsable || '');
    } else {
      comparison = compareText(left.ubicacion || '', right.ubicacion || '');
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return {
    localRiskSummary,
    departamentoOptions,
    equipoOptions,
    filteredActivos,
    sortedFilteredActivos,
  };
}

export function useAssetDirectoryData(options: AssetDirectoryDataOptions) {
  const {
    activos,
    searchTokens,
    departmentFilter,
    equipmentFilter,
    statusFilter,
    riskFilter,
    sortField,
    sortDirection,
  } = options;

  return useMemo(
    () => deriveAssetDirectoryData({
      activos,
      searchTokens,
      departmentFilter,
      equipmentFilter,
      statusFilter,
      riskFilter,
      sortField,
      sortDirection,
    }),
    [
      activos,
      departmentFilter,
      equipmentFilter,
      riskFilter,
      searchTokens,
      sortDirection,
      sortField,
      statusFilter,
    ],
  );
}
