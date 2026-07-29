import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { UserItem } from '../types/app';
import { deriveUserDirectoryData, useUserDirectoryData } from './useUserDirectoryData';

const USERS: UserItem[] = [
  {
    id: 1,
    nombre: 'Zoe Solicitante',
    username: 'zoe',
    rol: 'solicitante',
    departamento: 'VENTAS',
    activo: true,
  },
  {
    id: 2,
    nombre: 'Ana Técnica',
    username: 'ana.tech',
    rol: 'tecnico',
    departamento: 'IT',
    activo: true,
  },
  {
    id: 3,
    nombre: 'Bruno Consulta',
    username: 'bruno',
    rol: 'consulta',
    departamento: 'IT',
    activo: true,
  },
  {
    id: 4,
    nombre: 'Admin Inactivo',
    username: 'admin.old',
    rol: 'admin',
    departamento: 'FINANZAS',
    activo: false,
  },
];

const BASE_OPTIONS = {
  users: USERS,
  searchTokens: [],
  roleFilter: 'TODOS' as const,
  statusFilter: 'TODOS' as const,
  departmentFilter: 'TODOS',
  roleLabelByValue: {},
  rolePermissionsByValue: {},
  userCargoLabelByValue: {
    IT: 'Mesa de soporte',
  },
};

describe('deriveUserDirectoryData', () => {
  test('ordena por departamento y nombre y calcula contadores operativos', () => {
    const result = deriveUserDirectoryData(BASE_OPTIONS);

    expect(result.sortedUsers.map((user) => user.id)).toEqual([4, 2, 3, 1]);
    expect(result.activeUsersCount).toBe(3);
    expect(result.ticketEligibleUsersCount).toBe(2);
  });

  test('combina filtros y busca también en etiquetas de catálogo', () => {
    const result = deriveUserDirectoryData({
      ...BASE_OPTIONS,
      searchTokens: ['mesa', 'especialista'],
      roleFilter: 'tecnico',
      statusFilter: 'ACTIVOS',
      departmentFilter: 'it',
      roleLabelByValue: {
        tecnico: 'Especialista técnico',
      },
    });

    expect(result.sortedUsers.map((user) => user.username)).toEqual(['ana.tech']);
  });

  test('distingue correctamente usuarios inactivos', () => {
    const result = deriveUserDirectoryData({
      ...BASE_OPTIONS,
      roleFilter: 'admin',
      statusFilter: 'INACTIVOS',
    });

    expect(result.sortedUsers.map((user) => user.username)).toEqual(['admin.old']);
  });

  test('recalcula el resultado cuando cambia un filtro del hook', () => {
    const { result, rerender } = renderHook(
      ({ statusFilter }) => useUserDirectoryData({
        ...BASE_OPTIONS,
        statusFilter,
      }),
      {
        initialProps: {
          statusFilter: 'TODOS' as 'TODOS' | 'INACTIVOS',
        },
      },
    );

    expect(result.current.sortedUsers).toHaveLength(4);

    rerender({ statusFilter: 'INACTIVOS' });

    expect(result.current.sortedUsers.map((user) => user.username)).toEqual(['admin.old']);
  });
});
