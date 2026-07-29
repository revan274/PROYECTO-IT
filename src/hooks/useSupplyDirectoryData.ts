import { useMemo } from 'react';

import { CATEGORIAS_INSUMO } from '../constants/app';
import type { Insumo, SupplyStatusFilter } from '../types/app';
import { includesAllSearchTokens, normalizeForCompare } from '../utils/format';
import { getSupplyCriticalityRank, getSupplyHealthStatus } from '../utils/appHelpers';

interface SupplyDirectoryDataOptions {
  insumos: Insumo[];
  searchTokens: string[];
  categoryFilter: string;
  statusFilter: SupplyStatusFilter;
}

export function deriveSupplyDirectoryData({
  insumos,
  searchTokens,
  categoryFilter,
  statusFilter,
}: SupplyDirectoryDataOptions) {
  let agotados = 0;
  let bajoMinimo = 0;
  let ok = 0;
  let totalUnidades = 0;

  insumos.forEach((item) => {
    const status = getSupplyHealthStatus(item);
    totalUnidades += item.stock;
    if (status === 'AGOTADO') agotados += 1;
    else if (status === 'BAJO') bajoMinimo += 1;
    else ok += 1;
  });

  const supplySummary = {
    totalInsumos: insumos.length,
    agotados,
    bajoMinimo,
    ok,
    totalUnidades,
  };

  const supplyCategoryOptions = Array.from(
    new Set([
      ...CATEGORIAS_INSUMO,
      ...insumos.map((item) => (item.categoria || '').trim()).filter(Boolean),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const filteredSupplies = insumos.filter((item) => {
    if (categoryFilter !== 'TODAS' && item.categoria !== categoryFilter) return false;

    const status = getSupplyHealthStatus(item);
    if (statusFilter !== 'TODOS' && status !== statusFilter) return false;

    if (searchTokens.length === 0) return true;
    const searchable = normalizeForCompare(`${item.nombre} ${item.categoria} ${item.unidad}`);
    return includesAllSearchTokens(searchable, searchTokens);
  });

  filteredSupplies.sort((left, right) => {
    const leftStatus = getSupplyHealthStatus(left);
    const rightStatus = getSupplyHealthStatus(right);
    const rankDifference = getSupplyCriticalityRank(leftStatus) - getSupplyCriticalityRank(rightStatus);
    if (rankDifference !== 0) return rankDifference;

    const leftCoverage = left.min > 0
      ? left.stock / left.min
      : left.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
    const rightCoverage = right.min > 0
      ? right.stock / right.min
      : right.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
    if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;

    return left.nombre.localeCompare(right.nombre);
  });

  return {
    supplySummary,
    supplyCategoryOptions,
    filteredSupplies,
  };
}

export function useSupplyDirectoryData(options: SupplyDirectoryDataOptions) {
  const {
    insumos,
    searchTokens,
    categoryFilter,
    statusFilter,
  } = options;

  return useMemo(
    () => deriveSupplyDirectoryData({
      insumos,
      searchTokens,
      categoryFilter,
      statusFilter,
    }),
    [categoryFilter, insumos, searchTokens, statusFilter],
  );
}
