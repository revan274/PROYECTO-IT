import type React from 'react';
import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { apiRequest, getApiErrorMessage } from '../../utils/api';
import type { UserItem, UserRole } from '../../types/app';
import { isUserRole } from '../../utils/assets';
import { normalizeForCompare } from '../../utils/format';

interface UserFormState {
  username: string;
  nombre: string;
  rol: string;
  departamento: string;
  password?: string;
}

interface UseUserActionsProps {
  canManageUsers: boolean;
  editingUserId: number | null;
  newUserForm: UserFormState;
  setNewUserForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  setIsCreatingUser: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingUserId: React.Dispatch<React.SetStateAction<number | null>>;
  setUserActionLoadingId: React.Dispatch<React.SetStateAction<number | null>>;
  resetNewUserForm: () => void;
}

export function useUserActions({
  canManageUsers,
  editingUserId,
  newUserForm,
  setNewUserForm,
  setIsCreatingUser,
  setEditingUserId,
  setUserActionLoadingId,
  resetNewUserForm,
}: UseUserActionsProps) {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const users = useAppStore((state) => state.users);
  const backendConnected = useAppStore((state) => state.backendConnected);
  const refreshAppData = useAppStore((state) => state.refreshAppData);
  const showToast = useAppStore((state) => state.showToast);

  const ensureBackendConnected = useCallback(
    (action: string) => {
      if (backendConnected) return true;
      showToast(`${action} requiere conexion con el backend.`, 'warning');
      return false;
    },
    [backendConnected, showToast],
  );

  const refreshData = useCallback(async () => {
    if (!refreshAppData) return;
    await refreshAppData({ silent: true, force: true });
  }, [refreshAppData]);

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!canManageUsers) {
      showToast('Solo administradores pueden crear usuarios', 'warning');
      return false;
    }

    const isEditing = editingUserId !== null;
    const nombre = newUserForm.nombre.trim();
    const username = newUserForm.username.trim().toLowerCase();
    const password = newUserForm.password;
    const departamento = newUserForm.departamento.trim().toUpperCase();
    const rol = newUserForm.rol;

    if (!nombre || !username || !departamento) {
      showToast('Completa nombre, usuario y cargo', 'warning');
      return false;
    }
    if (!isEditing && !password) {
      showToast('Password requerido para nuevo usuario', 'warning');
      return false;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      showToast('Usuario inválido: usa a-z, 0-9, ., _, - (3 a 32)', 'warning');
      return false;
    }
    if (password && password.length < 6) {
      showToast('El password debe tener al menos 6 caracteres', 'warning');
      return false;
    }
    if (users.some((user) => normalizeForCompare(user.username) === normalizeForCompare(username) && (!isEditing || user.id !== editingUserId))) {
      showToast('El usuario ya existe', 'warning');
      return false;
    }
    if (!ensureBackendConnected(isEditing ? 'Editar usuario' : 'Crear usuario')) return false;

    setIsCreatingUser(true);
    try {
      if (isEditing && editingUserId !== null) {
        const payload: Record<string, unknown> = { nombre, username, departamento, rol };
        if (password) payload.password = password;
        await apiRequest(`/users/${editingUserId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            nombre,
            username,
            password,
            departamento,
            rol,
          }),
        });
      }

      await refreshData();
      showToast(isEditing ? `Usuario ${username} actualizado` : `Usuario ${username} creado`, 'success');
      resetNewUserForm();
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo guardar el usuario', 'error');
      return false;
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = (user: UserItem) => {
    if (!canManageUsers) return;
    const nextRole = isUserRole(user.rol) ? user.rol : ('solicitante' as UserRole);
    setNewUserForm({
      username: user.username,
      nombre: user.nombre,
      rol: nextRole,
      departamento: user.departamento || '',
      password: '',
    });
    setEditingUserId(user.id);
    setIsCreatingUser(true);
  };

  const handleToggleUserActive = async (user: UserItem): Promise<boolean> => {
    if (!canManageUsers) return false;
    if (!ensureBackendConnected('Cambiar estado de usuario')) return false;
    if (user.username === sessionUser?.username) {
      showToast('No puedes desactivar tu propio usuario', 'warning');
      return false;
    }

    setUserActionLoadingId(user.id);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !user.activo }),
      });
      await refreshData();
      showToast(user.activo ? 'Usuario desactivado' : 'Usuario activado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo actualizar el estado del usuario', 'error');
      return false;
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: UserItem): Promise<boolean> => {
    if (!canManageUsers) return false;
    if (user.username === sessionUser?.username) {
      showToast('No puedes eliminar tu propio usuario', 'warning');
      return false;
    }

    const confirmacion = window.confirm(`Eliminar usuario ${user.username}?`);
    if (!confirmacion) return false;
    if (!ensureBackendConnected('Eliminar usuarios')) return false;

    setUserActionLoadingId(user.id);
    try {
      await apiRequest(`/users/${user.id}`, { method: 'DELETE' });
      await refreshData();
      if (editingUserId === user.id) {
        resetNewUserForm();
      }
      showToast('Usuario eliminado', 'success');
      return true;
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'No se pudo eliminar el usuario', 'error');
      return false;
    } finally {
      setUserActionLoadingId(null);
    }
  };

  return {
    handleCreateUser,
    handleEditUser,
    handleToggleUserActive,
    handleDeleteUser,
  };
}
