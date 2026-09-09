import { useState } from 'react';
import type { UserFormState, UserRole } from '../types/app';

export function useUserUiState() {
  const [newUserForm, setNewUserForm] = useState<UserFormState>({
    nombre: '',
    username: '',
    password: '',
    departamento: '',
    rol: 'solicitante',
    email: '',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userActionLoadingId, setUserActionLoadingId] = useState<number | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'TODOS' | UserRole>('TODOS');
  const [userStatusFilter, setUserStatusFilter] = useState<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');
  const [userDepartmentFilter, setUserDepartmentFilter] = useState('TODOS');

  return {
    newUserForm, setNewUserForm,
    isCreatingUser, setIsCreatingUser,
    editingUserId, setEditingUserId,
    userActionLoadingId, setUserActionLoadingId,
    userSearchTerm, setUserSearchTerm,
    userRoleFilter, setUserRoleFilter,
    userStatusFilter, setUserStatusFilter,
    userDepartmentFilter, setUserDepartmentFilter,
  };
}
