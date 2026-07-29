import { useCallback, useMemo } from 'react';
import {
  DEFAULT_CATALOGS,
  USER_ROLE_LABEL,
  USER_ROLE_PERMISSIONS,
} from '../constants/app';
import type { Activo, CatalogState, UserRole } from '../types/app';
import {
  buildAssetDisplayOptions,
  formatTicketBranch,
  formatUserCargo,
  resolveAssetBranchCode,
} from '../utils/assets';
import { isUserRole } from '../utils/roles';
import { buildTicketAssetContextSummary } from '../utils/tickets';

interface UseAppCatalogsOptions {
  activos: Activo[];
  catalogos: CatalogState;
  selectedTicketBranch?: string;
  selectedTicketAssetTag?: string;
}

export function useAppCatalogs({
  activos,
  catalogos,
  selectedTicketBranch,
  selectedTicketAssetTag,
}: UseAppCatalogsOptions) {
  const activeTicketBranches = useMemo(
    () => catalogos.sucursales.filter((branch) => branch.activo !== false),
    [catalogos.sucursales],
  );
  const activeTicketBranchCodes = useMemo(
    () => new Set(activeTicketBranches.map((branch) => branch.code)),
    [activeTicketBranches],
  );
  const ticketBranchLabelByCode = useMemo(() => {
    const labels: Record<string, string> = {};
    activeTicketBranches.forEach((branch) => {
      labels[branch.code] = `${branch.code} - ${branch.name}`;
    });
    return labels;
  }, [activeTicketBranches]);
  const ticketAssetOptions = useMemo(() => {
    const selectedBranch = String(selectedTicketBranch || '').trim().toUpperCase();
    if (!selectedBranch) return [] as Array<{ tag: string; label: string }>;

    const seenTags = new Set<string>();
    const branchAssets = activos.filter((asset) => {
      if (resolveAssetBranchCode(asset, activeTicketBranchCodes) !== selectedBranch) return false;
      const tag = String(asset.tag || '').trim().toUpperCase();
      if (!tag || seenTags.has(tag)) return false;
      seenTags.add(tag);
      return true;
    });

    return buildAssetDisplayOptions(branchAssets).map((option) => ({
      tag: option.tag,
      label: `${option.displayName} · FOLIO ${option.tag}`,
    }));
  }, [activos, activeTicketBranchCodes, selectedTicketBranch]);
  const selectedTicketAsset = useMemo(() => {
    const selectedBranch = String(selectedTicketBranch || '').trim().toUpperCase();
    const selectedTag = String(selectedTicketAssetTag || '').trim().toUpperCase();
    if (!selectedBranch || !selectedTag) return null;

    return activos.find((asset) => {
      const assetTag = String(asset.tag || '').trim().toUpperCase();
      return assetTag === selectedTag
        && resolveAssetBranchCode(asset, activeTicketBranchCodes) === selectedBranch;
    }) || null;
  }, [activos, activeTicketBranchCodes, selectedTicketAssetTag, selectedTicketBranch]);
  const selectedTicketAssetContext = useMemo(
    () => buildTicketAssetContextSummary(selectedTicketAsset, activeTicketBranchCodes),
    [activeTicketBranchCodes, selectedTicketAsset],
  );
  const userCargoOptions = useMemo(
    () => catalogos.cargos
      .map((label) => {
        const text = String(label || '').trim();
        if (!text) return null;
        return { value: text.toUpperCase(), label: text };
      })
      .filter((item): item is { value: string; label: string } => !!item),
    [catalogos.cargos],
  );
  const userCargoLabelByValue = useMemo(
    () => userCargoOptions.reduce(
      (acc, cargo) => ({ ...acc, [cargo.value]: cargo.label }),
      {} as Record<string, string>,
    ),
    [userCargoOptions],
  );
  const roleCatalogOptions = useMemo(() => {
    const active = catalogos.roles.filter((role) => {
      const value = String(role.value || '').trim().toLowerCase();
      return isUserRole(value) && role.activo !== false;
    });
    return active.length > 0 ? active : DEFAULT_CATALOGS.roles;
  }, [catalogos.roles]);
  const roleFilterOptions = useMemo(() => {
    const known = catalogos.roles.filter((role) => {
      const value = String(role.value || '').trim().toLowerCase();
      return isUserRole(value);
    });
    return known.length > 0 ? known : DEFAULT_CATALOGS.roles;
  }, [catalogos.roles]);
  const roleLabelByValue = useMemo(
    () => catalogos.roles.reduce((acc, role) => {
      const value = String(role.value || '').trim().toLowerCase();
      if (!isUserRole(value)) return acc;
      return {
        ...acc,
        [value]: String(role.label || USER_ROLE_LABEL[value]).trim() || USER_ROLE_LABEL[value],
      };
    }, {} as Record<UserRole, string>),
    [catalogos.roles],
  );
  const rolePermissionsByValue = useMemo(
    () => catalogos.roles.reduce((acc, role) => {
      const value = String(role.value || '').trim().toLowerCase();
      if (!isUserRole(value)) return acc;
      return {
        ...acc,
        [value]: String(role.permissions || USER_ROLE_PERMISSIONS[value]).trim()
          || USER_ROLE_PERMISSIONS[value],
      };
    }, {} as Record<UserRole, string>),
    [catalogos.roles],
  );
  const isValidTicketBranchValue = useCallback(
    (value?: string) => {
      const code = String(value || '').trim().toUpperCase();
      return activeTicketBranches.some((branch) => branch.code === code);
    },
    [activeTicketBranches],
  );
  const formatTicketBranchFromCatalog = useCallback(
    (value?: string) => formatTicketBranch(value, ticketBranchLabelByCode),
    [ticketBranchLabelByCode],
  );
  const formatCargoFromCatalog = useCallback(
    (value?: string) => formatUserCargo(value, userCargoLabelByValue),
    [userCargoLabelByValue],
  );

  return {
    activeTicketBranches,
    activeTicketBranchCodes,
    ticketAssetOptions,
    selectedTicketAsset,
    selectedTicketAssetContext,
    userCargoOptions,
    userCargoLabelByValue,
    roleCatalogOptions,
    roleFilterOptions,
    roleLabelByValue,
    rolePermissionsByValue,
    isValidTicketBranchValue,
    formatTicketBranchFromCatalog,
    formatCargoFromCatalog,
  };
}
