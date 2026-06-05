import { useCallback, useMemo } from 'react';
import type {
  Activo,
  EstadoActivo,
  InventoryRiskFilter,
  InventorySortDirection,
  InventorySortField,
} from '../../types/app';
import { includesAllSearchTokens, normalizeForCompare } from '../../utils/format';
import {
  assetRequiresNetworkIdentity,
  assetRequiresResponsible,
  calculateAssetRiskSummary,
  parseAssetLifeYears,
} from '../../utils/assets';

interface UseInventoryMetricsParams {
  activos: Activo[];
  inventoryDepartmentFilter: string;
  inventoryEquipmentFilter: string;
  inventoryStatusFilter: 'TODOS' | EstadoActivo;
  inventoryRiskFilter: InventoryRiskFilter;
  inventorySortField: InventorySortField;
  inventorySortDirection: InventorySortDirection;
  headerSearchTokens: string[];
}

/**
 * Deriva el resumen de riesgos, opciones de filtro y la lista de activos
 * filtrada/ordenada del inventario. Extraído de App.tsx sin cambios de comportamiento.
 */
export function useInventoryMetrics({
  activos,
  inventoryDepartmentFilter,
  inventoryEquipmentFilter,
  inventoryStatusFilter,
  inventoryRiskFilter,
  inventorySortField,
  inventorySortDirection,
  headerSearchTokens,
}: UseInventoryMetricsParams) {
  const networkIpCounts = useMemo(
    () =>
      activos.reduce<Record<string, number>>((acc, asset) => {
        const ip = (asset.ipAddress || '').trim();
        if (ip) acc[ip] = (acc[ip] || 0) + 1;
        return acc;
      }, {}),
    [activos],
  );
  const networkMacCounts = useMemo(
    () =>
      activos.reduce<Record<string, number>>((acc, asset) => {
        const mac = (asset.macAddress || '').trim().toLowerCase();
        if (mac) acc[mac] = (acc[mac] || 0) + 1;
        return acc;
      }, {}),
    [activos],
  );
  const hasNetworkDuplication = useCallback((asset: Activo): boolean => {
    const ip = (asset.ipAddress || '').trim();
    const mac = (asset.macAddress || '').trim().toLowerCase();
    return (ip ? (networkIpCounts[ip] || 0) > 1 : false) || (mac ? (networkMacCounts[mac] || 0) > 1 : false);
  }, [networkIpCounts, networkMacCounts]);
  const localRiskSummary = useMemo(() => calculateAssetRiskSummary(activos), [activos]);
  const duplicateIpEntries = localRiskSummary.duplicateIpEntries;
  const duplicateMacEntries = localRiskSummary.duplicateMacEntries;

  const departamentoOptions = useMemo(
    () =>
      Array.from(
        new Set(activos.map((asset) => (asset.departamento || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [activos],
  );
  const equipoOptions = useMemo(
    () =>
      Array.from(
        new Set(activos.map((asset) => (asset.tipo || asset.equipo || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [activos],
  );

  const filteredActivos = useMemo(
    () =>
      activos.filter((asset) => {
        if (inventoryDepartmentFilter !== 'TODOS' && normalizeForCompare(asset.departamento || '') !== normalizeForCompare(inventoryDepartmentFilter)) {
          return false;
        }
        if (inventoryEquipmentFilter !== 'TODOS' && normalizeForCompare(asset.tipo || asset.equipo || '') !== normalizeForCompare(inventoryEquipmentFilter)) {
          return false;
        }
        if (inventoryStatusFilter !== 'TODOS' && asset.estado !== inventoryStatusFilter) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_IP' && (!assetRequiresNetworkIdentity(asset) || (asset.ipAddress || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_MAC' && (!assetRequiresNetworkIdentity(asset) || (asset.macAddress || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'SIN_RESP' && (!assetRequiresResponsible(asset) || (asset.responsable || '').trim())) {
          return false;
        }
        if (inventoryRiskFilter === 'DUP_RED' && !hasNetworkDuplication(asset)) {
          return false;
        }
        if (inventoryRiskFilter === 'VIDA_ALTA') {
          const years = parseAssetLifeYears(asset.aniosVida);
          if (years === null || years < 4) return false;
        }

        if (headerSearchTokens.length === 0) return true;
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
        return includesAllSearchTokens(searchable, headerSearchTokens);
      }),
    [
      activos,
      hasNetworkDuplication,
      headerSearchTokens,
      inventoryDepartmentFilter,
      inventoryEquipmentFilter,
      inventoryRiskFilter,
      inventoryStatusFilter,
    ],
  );

  const sortedFilteredActivos = useMemo(() => {
    const compareText = (left?: string, right?: string) => {
      const a = normalizeForCompare(left || '');
      const b = normalizeForCompare(right || '');
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    };

    const rows = [...filteredActivos];
    rows.sort((left, right) => {
      let base = 0;
      if (inventorySortField === 'aniosVida') {
        const leftYears = parseAssetLifeYears(left.aniosVida);
        const rightYears = parseAssetLifeYears(right.aniosVida);
        if (leftYears === null && rightYears === null) base = 0;
        else if (leftYears === null) base = 1;
        else if (rightYears === null) base = -1;
        else base = leftYears - rightYears;
      } else if (inventorySortField === 'tag') {
        base = compareText(left.tag, right.tag);
      } else if (inventorySortField === 'tipo') {
        base = compareText(left.tipo || left.equipo || '', right.tipo || right.equipo || '');
      } else if (inventorySortField === 'estado') {
        base = compareText(left.estado, right.estado);
      } else if (inventorySortField === 'responsable') {
        base = compareText(left.responsable || '', right.responsable || '');
      } else {
        base = compareText(left.ubicacion || '', right.ubicacion || '');
      }
      return inventorySortDirection === 'asc' ? base : -base;
    });

    return rows;
  }, [filteredActivos, inventorySortDirection, inventorySortField]);

  return {
    localRiskSummary,
    duplicateIpEntries,
    duplicateMacEntries,
    departamentoOptions,
    equipoOptions,
    filteredActivos,
    sortedFilteredActivos,
  };
}
