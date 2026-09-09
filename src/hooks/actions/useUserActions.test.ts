import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import type { UserFormState, UserItem, UserSession } from '../../types/app';
import { useUserActions } from './useUserActions';

const USUARIO: UserItem = {
  id: 7,
  nombre: 'ADMIN IT',
  username: 'admin',
  rol: 'admin',
  departamento: 'IT',
  activo: true,
  email: 'admin@empresa.com',
};

const FORM_VACIO: UserFormState = {
  username: '',
  nombre: '',
  rol: 'solicitante',
  departamento: '',
  password: '',
  email: '',
};

const SESION: UserSession = {
  id: 1,
  nombre: 'Otro Admin',
  username: 'otro',
  rol: 'admin',
  departamento: 'IT',
};

function montar() {
  const setNewUserForm = vi.fn();
  const setIsCreatingUser = vi.fn();
  const setEditingUserId = vi.fn();

  const { result } = renderHook(() => useUserActions({
    sessionUser: SESION,
    users: [USUARIO],
    backendConnected: true,
    refreshAppData: null,
    showToast: vi.fn(),
    showConfirm: null,
    canManageUsers: true,
    editingUserId: null,
    newUserForm: FORM_VACIO,
    setNewUserForm,
    setIsCreatingUser,
    setEditingUserId,
    setUserActionLoadingId: vi.fn(),
    resetNewUserForm: vi.fn(),
  }));

  return { result, setNewUserForm, setIsCreatingUser, setEditingUserId };
}

describe('handleEditUser', () => {
  // El boton de guardar lee `isCreatingUser` para deshabilitarse y mostrar "Guardando...".
  // Abrir el formulario no es guardar: si al pulsar "Editar" se enciende esa bandera, el
  // boton nace deshabilitado y el usuario NUNCA puede guardar sus cambios.
  test('abrir la edicion no marca que haya un guardado en curso', () => {
    const { result, setIsCreatingUser } = montar();

    result.current.handleEditUser(USUARIO);

    expect(setIsCreatingUser).not.toHaveBeenCalledWith(true);
  });

  test('abrir la edicion carga la ficha en el formulario', () => {
    const { result, setNewUserForm, setEditingUserId } = montar();

    result.current.handleEditUser(USUARIO);

    expect(setEditingUserId).toHaveBeenCalledWith(USUARIO.id);
    expect(setNewUserForm).toHaveBeenCalledWith(expect.objectContaining({
      username: 'admin',
      nombre: 'ADMIN IT',
      rol: 'admin',
      email: 'admin@empresa.com',
      // La contrasena nunca se precarga: no viaja al cliente y dejarla vacia significa
      // "no la cambies".
      password: '',
    }));
  });
});
