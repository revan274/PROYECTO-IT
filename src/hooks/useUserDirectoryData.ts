import { useMemo } from 'react';

import { USER_ROLE_LABEL, USER_ROLE_PERMISSIONS } from '../constants/app';
import type { UserItem, UserRole } from '../types/app';
import { includesAllSearchTokens, normalizeForCompare } from '../utils/format';
import { roleCanGenerateTickets } from '../utils/roles';

export type UserStatusFilter = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

interface UserDirectoryDataOptions {
  users: UserItem[];
  searchTokens: string[];
  roleFilter: 'TODOS' | UserRole;
  statusFilter: UserStatusFilter;
  departmentFilter: string;
  roleLabelByValue: Record<string, string>;
  rolePermissionsByValue: Record<string, string>;
  userCargoLabelByValue: Record<string, string>;
}

export function deriveUserDirectoryData({
  users,
  searchTokens,
  roleFilter,
  statusFilter,
  departmentFilter,
  roleLabelByValue,
  rolePermissionsByValue,
  userCargoLabelByValue,
}: UserDirectoryDataOptions) {
  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'TODOS' && user.rol !== roleFilter) return false;
    if (statusFilter === 'ACTIVOS' && user.activo === false) return false;
    if (statusFilter === 'INACTIVOS' && user.activo !== false) return false;
    if (
      departmentFilter !== 'TODOS'
      && normalizeForCompare(user.departamento || '') !== normalizeForCompare(departmentFilter)
    ) {
      return false;
    }

    if (searchTokens.length === 0) return true;
    const searchable = normalizeForCompare([
      user.nombre,
      user.username,
      user.departamento,
      userCargoLabelByValue[String(user.departamento || '').trim().toUpperCase()] || '',
      roleLabelByValue[user.rol] || USER_ROLE_LABEL[user.rol],
      rolePermissionsByValue[user.rol] || USER_ROLE_PERMISSIONS[user.rol],
      user.activo !== false ? 'activo' : 'inactivo',
    ].join(' '));
    return includesAllSearchTokens(searchable, searchTokens);
  });

  const sortedUsers = [...filteredUsers].sort((left, right) => {
    const departmentComparison = normalizeForCompare(left.departamento || '')
      .localeCompare(normalizeForCompare(right.departamento || ''));
    if (departmentComparison !== 0) return departmentComparison;
    return normalizeForCompare(left.nombre).localeCompare(normalizeForCompare(right.nombre));
  });

  return {
    sortedUsers,
    activeUsersCount: users.filter((user) => user.activo !== false).length,
    ticketEligibleUsersCount: users.filter(
      (user) => user.activo !== false && roleCanGenerateTickets(user.rol),
    ).length,
  };
}

export function useUserDirectoryData(options: UserDirectoryDataOptions) {
  const {
    users,
    searchTokens,
    roleFilter,
    statusFilter,
    departmentFilter,
    roleLabelByValue,
    rolePermissionsByValue,
    userCargoLabelByValue,
  } = options;

  return useMemo(
    () => deriveUserDirectoryData({
      users,
      searchTokens,
      roleFilter,
      statusFilter,
      departmentFilter,
      roleLabelByValue,
      rolePermissionsByValue,
      userCargoLabelByValue,
    }),
    [
      departmentFilter,
      roleFilter,
      roleLabelByValue,
      rolePermissionsByValue,
      searchTokens,
      statusFilter,
      userCargoLabelByValue,
      users,
    ],
  );
}
