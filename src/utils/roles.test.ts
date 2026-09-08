import { describe, expect, test } from 'vitest';

import {
  USER_ROLE_ORDER,
  can,
  canCreateTicketsByRole,
  canEditByRole,
  canManageUsersByRole,
  isRequesterOnlyRole,
  isUserRole,
  roleCanGenerateTickets,
} from './roles';

// Estas funciones deciden qué ve y qué puede pulsar cada rol en la interfaz. El backend es la
// autoridad final, pero si aquí se desalinean, la UI ofrece acciones que la API va a rechazar
// —o esconde acciones legítimas—, y ninguna de las dos cosas se nota hasta que un usuario se
// topa con ellas. Por eso ahora derivan de la misma matriz que aplica el servidor.

describe('equivalencia con las reglas vigentes', () => {
  // Comportamiento histórico, escrito a mano: es la referencia que NO debe cambiar.
  const editorEsperado = (rol: string) => rol === 'admin' || rol === 'tecnico';
  const autorEsperado = (rol: string) => editorEsperado(rol) || rol === 'solicitante';

  test.each(USER_ROLE_ORDER)('canEditByRole no cambia para %s', (rol) => {
    expect(canEditByRole(rol)).toBe(editorEsperado(rol));
  });

  test.each(USER_ROLE_ORDER)('canCreateTicketsByRole no cambia para %s', (rol) => {
    expect(canCreateTicketsByRole(rol)).toBe(autorEsperado(rol));
  });

  test.each(USER_ROLE_ORDER)('canManageUsersByRole no cambia para %s', (rol) => {
    expect(canManageUsersByRole(rol)).toBe(rol === 'admin');
  });

  test.each(USER_ROLE_ORDER)('isRequesterOnlyRole no cambia para %s', (rol) => {
    expect(isRequesterOnlyRole(rol)).toBe(rol === 'solicitante');
  });

  test('roleCanGenerateTickets sigue siendo el mismo criterio que crear tickets', () => {
    for (const rol of USER_ROLE_ORDER) {
      expect(roleCanGenerateTickets(rol)).toBe(canCreateTicketsByRole(rol));
    }
  });
});

describe('can(): consulta directa a la matriz compartida', () => {
  test('el técnico opera inventario pero no administra', () => {
    expect(can('tecnico', 'activos.update')).toBe(true);
    expect(can('tecnico', 'insumos.stock')).toBe(true);
    expect(can('tecnico', 'users.manage')).toBe(false);
    expect(can('tecnico', 'catalogos.manage')).toBe(false);
  });

  test('el solicitante solo puede sobre tickets propios', () => {
    expect(can('solicitante', 'tickets.create')).toBe(true);
    expect(can('solicitante', 'tickets.comment')).toBe(true);
    expect(can('solicitante', 'activos.update')).toBe(false);
  });

  test('consulta no obtiene ningún permiso de escritura', () => {
    for (const permiso of ['activos.update', 'tickets.create', 'insumos.stock', 'users.manage'] as const) {
      expect(can('consulta', permiso)).toBe(false);
    }
  });

  test('falla cerrado ante roles o permisos desconocidos', () => {
    expect(can('inventado', 'tickets.create')).toBe(false);
    expect(can('admin', 'permiso.inventado')).toBe(false);
    expect(can(null, 'tickets.create')).toBe(false);
    expect(can(undefined, 'tickets.create')).toBe(false);
  });
});

describe('isUserRole', () => {
  test('reconoce los cuatro roles y rechaza el resto', () => {
    for (const rol of USER_ROLE_ORDER) expect(isUserRole(rol)).toBe(true);
    expect(isUserRole('supervisor')).toBe(false);
    expect(isUserRole('')).toBe(false);
  });
});
