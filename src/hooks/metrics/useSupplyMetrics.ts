import { useMemo } from 'react';
import type { Insumo, SupplyStatusFilter } from '../../types/app';
import { CATEGORIAS_INSUMO } from '../../constants/app';
import { includesAllSearchTokens, normalizeForCompare } from '../../utils/format';
import { getSupplyCriticalityRank, getSupplyHealthStatus } from '../../utils/appHelpers';

interface UseSupplyMetricsParams {
  insumos: Insumo[];
  supplyCategoryFilter: string;
  supplyStatusFilter: SupplyStatusFilter;
  supplySearchTokens: string[];
}

/**
 * Deriva resúmenes, opciones de categoría y la lista filtrada/ordenada de insumos.
 * Extraído de App.tsx sin cambios de comportamiento.
 */
export function useSupplyMetrics({
  insumos,
  supplyCategoryFilter,
  supplyStatusFilter,
  supplySearchTokens,
}: UseSupplyMetricsParams) {
  const supplySummary = useMemo(() => {
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

    return {
      totalInsumos: insumos.length,
      agotados,
      bajoMinimo,
      ok,
      totalUnidades,
    };
  }, [insumos]);

  const supplyCategoryOptions = useMemo(
    () =>
      Array.from(new Set([...CATEGORIAS_INSUMO, ...insumos.map((item) => (item.categoria || '').trim()).filter(Boolean)]))
        .sort((a, b) => a.localeCompare(b)),
    [insumos],
  );

  const filteredSupplies = useMemo(() => {
    const rows = insumos.filter((item) => {
      if (supplyCategoryFilter !== 'TODAS' && item.categoria !== supplyCategoryFilter) return false;

      const status = getSupplyHealthStatus(item);
      if (supplyStatusFilter !== 'TODOS' && status !== supplyStatusFilter) return false;

      if (supplySearchTokens.length === 0) return true;
      const searchable = normalizeForCompare(`${item.nombre} ${item.categoria} ${item.unidad}`);
      return includesAllSearchTokens(searchable, supplySearchTokens);
    });

    rows.sort((left, right) => {
      const leftStatus = getSupplyHealthStatus(left);
      const rightStatus = getSupplyHealthStatus(right);
      const rankDiff = getSupplyCriticalityRank(leftStatus) - getSupplyCriticalityRank(rightStatus);
      if (rankDiff !== 0) return rankDiff;

      const leftCoverage = left.min > 0 ? left.stock / left.min : left.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
      const rightCoverage = right.min > 0 ? right.stock / right.min : right.stock > 0 ? Number.MAX_SAFE_INTEGER : 0;
      if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;

      return left.nombre.localeCompare(right.nombre);
    });

    return rows;
  }, [insumos, supplyCategoryFilter, supplySearchTokens, supplyStatusFilter]);

  return { supplySummary, supplyCategoryOptions, filteredSupplies };
}
