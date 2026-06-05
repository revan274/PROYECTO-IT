import { useMemo } from 'react';
import type { UserItem, UserRole } from '../../types/app';
import { USER_ROLE_LABEL, USER_ROLE_PERMISSIONS } from '../../constants/app';
import { includesAllSearchTokens, normalizeForCompare } from '../../utils/format';
import { roleCanGenerateTickets } from '../../utils/roles';

interface UseUserMetricsParams {
  users: UserItem[];
  userRoleFilter: 'TODOS' | UserRole;
  userStatusFilter: 'TODOS' | 'ACTIVOS' | 'INACTIVOS';
  userDepartmentFilter: string;
  userSearchTokens: string[];
  userCargoLabelByValue: Record<string, string>;
  roleLabelByValue: Record<UserRole, string>;
  rolePermissionsByValue: Record<UserRole, string>;
}

/**
 * Deriva la lista de usuarios filtrada/ordenada y los conteos de usuarios.
 * Extraído de App.tsx sin cambios de comportamiento.
 */
export function useUserMetrics({
  users,
  userRoleFilter,
  userStatusFilter,
  userDepartmentFilter,
  userSearchTokens,
  userCargoLabelByValue,
  roleLabelByValue,
  rolePermissionsByValue,
}: UseUserMetricsParams) {
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (userRoleFilter !== 'TODOS' && user.rol !== userRoleFilter) {
          return false;
        }
        if (userStatusFilter === 'ACTIVOS' && user.activo === false) {
          return false;
        }
        if (userStatusFilter === 'INACTIVOS' && user.activo !== false) {
          return false;
        }
        if (
          userDepartmentFilter !== 'TODOS'
          && normalizeForCompare(user.departamento || '') !== normalizeForCompare(userDepartmentFilter)
        ) {
          return false;
        }

        if (userSearchTokens.length === 0) return true;
        const searchable = normalizeForCompare([
          user.nombre,
          user.username,
          user.departamento,
          userCargoLabelByValue[String(user.departamento || '').trim().toUpperCase()] || '',
          roleLabelByValue[user.rol] || USER_ROLE_LABEL[user.rol],
          rolePermissionsByValue[user.rol] || USER_ROLE_PERMISSIONS[user.rol],
          user.activo !== false ? 'activo' : 'inactivo',
        ].join(' '));
        return includesAllSearchTokens(searchable, userSearchTokens);
      }),
    [
      roleLabelByValue,
      rolePermissionsByValue,
      userCargoLabelByValue,
      userDepartmentFilter,
      userRoleFilter,
      userSearchTokens,
      userStatusFilter,
      users,
    ],
  );
  const sortedUsers = useMemo(
    () =>
      [...filteredUsers].sort((left, right) => {
        const deptCompare = normalizeForCompare(left.departamento || '').localeCompare(normalizeForCompare(right.departamento || ''));
        if (deptCompare !== 0) return deptCompare;
        return normalizeForCompare(left.nombre).localeCompare(normalizeForCompare(right.nombre));
      }),
    [filteredUsers],
  );
  const activeUsersCount = useMemo(
    () => users.filter((user) => user.activo !== false).length,
    [users],
  );
  const ticketEligibleUsersCount = useMemo(
    () => users.filter((user) => user.activo !== false && roleCanGenerateTickets(user.rol)).length,
    [users],
  );

  return { sortedUsers, activeUsersCount, ticketEligibleUsersCount };
}
