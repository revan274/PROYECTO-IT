import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PERMISSIONS,
  ADMIN_ONLY_PERMISSIONS,
  EDITOR_PERMISSIONS,
  TICKET_AUTHOR_PERMISSIONS,
  roleHasPermission,
} from '../shared/permissions.js';
import {
  USER_ROLE_ORDER,
  canEditByRole,
  canCreateTicketsByRole,
} from './domain/roles.js';

// La matriz de permisos se introduce SIN cambiar el comportamiento: cada permiso debe
// otorgarse exactamente a los mismos roles que hoy autorizan los helpers booleanos.
// Si esta equivalencia se rompe, el refactor abrió (o cerró) un acceso.

test('los permisos de administrador se otorgan solo al rol admin', () => {
  for (const role of USER_ROLE_ORDER) {
    for (const permission of ADMIN_ONLY_PERMISSIONS) {
      assert.equal(
        roleHasPermission(role, permission),
        role === 'admin',
        `${role} / ${permission}`,
      );
    }
  }
});

test('los permisos de edición equivalen exactamente a canEditByRole', () => {
  for (const role of USER_ROLE_ORDER) {
    for (const permission of EDITOR_PERMISSIONS) {
      assert.equal(
        roleHasPermission(role, permission),
        canEditByRole(role),
        `${role} / ${permission}`,
      );
    }
  }
});

test('los permisos de autoría de tickets equivalen exactamente a canCreateTicketsByRole', () => {
  for (const role of USER_ROLE_ORDER) {
    for (const permission of TICKET_AUTHOR_PERMISSIONS) {
      assert.equal(
        roleHasPermission(role, permission),
        canCreateTicketsByRole(role),
        `${role} / ${permission}`,
      );
    }
  }
});

test('el rol consulta no obtiene ningún permiso de escritura', () => {
  for (const permission of PERMISSIONS) {
    assert.equal(roleHasPermission('consulta', permission), false, permission);
  }
});

test('los tres grupos cubren el catálogo completo y no se solapan', () => {
  const union = [...ADMIN_ONLY_PERMISSIONS, ...EDITOR_PERMISSIONS, ...TICKET_AUTHOR_PERMISSIONS];
  assert.equal(new Set(union).size, union.length, 'ningún permiso puede estar en dos grupos');
  assert.deepEqual([...union].sort(), [...PERMISSIONS].sort());
});

test('falla cerrado ante permisos o roles desconocidos', () => {
  assert.equal(roleHasPermission('admin', 'permiso.inventado'), false);
  assert.equal(roleHasPermission('rol.inventado', 'tickets.create'), false);
  assert.equal(roleHasPermission('', 'tickets.create'), false);
  assert.equal(roleHasPermission(undefined, 'tickets.create'), false);
});
