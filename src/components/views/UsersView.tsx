import React from 'react';
import type { UserItem, UserRole, UserSession } from '../../types/app';
import { USER_ROLE_LABEL, USER_ROLE_PERMISSIONS } from '../../constants/app';

interface UsersViewProps {
  canManageUsers: boolean;
  users: UserItem[];
  activeUsersCount: number;
  requesterUsersCount: number;
  handleCreateUser: (e: React.FormEvent) => void;
  editingUserId: number | null;
  newUserForm: {
    nombre: string;
    username: string;
    password: string;
    departamento: string;
    rol: UserRole;
  };
  setNewUserForm: React.Dispatch<React.SetStateAction<{
    nombre: string;
    username: string;
    password: string;
    departamento: string;
    rol: UserRole;
  }>>;
  userCargoOptions: Array<{ value: string; label: string }>;
  roleCatalogOptions: Array<{ value: string; label: string }>;
  isCreatingUser: boolean;
  resetNewUserForm: () => void;
  sortedUsers: UserItem[];
  formatCargoFromCatalog: (cargo?: string) => string;
  roleLabelByValue: Record<string, string>;
  rolePermissionsByValue: Record<string, string>;
  sessionUser: UserSession | null;
  userActionLoadingId: number | null;
  handleEditUser: (user: UserItem) => void;
  handleToggleUserActive: (user: UserItem) => Promise<void>;
  handleDeleteUser: (user: UserItem) => Promise<void>;
}

export const UsersView: React.FC<UsersViewProps> = ({
  canManageUsers,
  users,
  activeUsersCount,
  requesterUsersCount,
  handleCreateUser,
  editingUserId,
  newUserForm,
  setNewUserForm,
  userCargoOptions,
  roleCatalogOptions,
  isCreatingUser,
  resetNewUserForm,
  sortedUsers,
  formatCargoFromCatalog,
  roleLabelByValue,
  rolePermissionsByValue,
  sessionUser,
  userActionLoadingId,
  handleEditUser,
  handleToggleUserActive,
  handleDeleteUser,
}) => {
  return (
    <div className="space-y-6">
      {!canManageUsers ? (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
          Solo administradores pueden gestionar usuarios.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Control de Accesos</p>
                <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Alta de Usuarios por Cargo</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Usuarios que pueden generar tickets
              </span>
            </div>
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Total Usuarios</p>
                <p className="text-3xl font-black text-blue-700">{users.length}</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Activos</p>
                <p className="text-3xl font-black text-green-700">{activeUsersCount}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Solicitantes</p>
                <p className="text-3xl font-black text-orange-700">{requesterUsersCount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <form onSubmit={handleCreateUser} className="xl:col-span-2 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{editingUserId !== null ? 'Editar Usuario' : 'Nuevo Usuario'}</p>
                <h4 className="font-black text-slate-800 uppercase tracking-tight">{editingUserId !== null ? 'Actualizacion de Cuenta' : 'Registro de Cuenta'}</h4>
              </div>
              <input
                required
                placeholder="NOMBRE COMPLETO"
                value={newUserForm.nombre}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, nombre: e.target.value }))}
              />
              <input
                required
                placeholder="USUARIO"
                value={newUserForm.username}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black lowercase outline-none"
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, username: e.target.value }))}
              />
              <input
                required={editingUserId === null}
                type="password"
                placeholder={editingUserId !== null ? 'PASSWORD (OPCIONAL)' : 'PASSWORD (MIN 6)'}
                value={newUserForm.password}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none"
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <select
                required
                value={newUserForm.departamento}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, departamento: e.target.value }))}
              >
                <option value="">Selecciona cargo...</option>
                {userCargoOptions.map((cargo) => (
                  <option key={cargo.value} value={cargo.value}>{cargo.label}</option>
                ))}
              </select>
              <select
                value={newUserForm.rol}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black uppercase outline-none"
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, rol: e.target.value as UserRole }))}
              >
                {roleCatalogOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full py-4 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl disabled:opacity-50"
              >
                {isCreatingUser ? (editingUserId !== null ? 'Guardando...' : 'Creando...') : (editingUserId !== null ? 'Guardar Cambios' : 'Crear Usuario')}
              </button>
              {editingUserId !== null && (
                <button
                  type="button"
                  onClick={resetNewUserForm}
                  className="w-full py-3 border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-50"
                >
                  Cancelar Edicion
                </button>
              )}
            </form>

            <div className="xl:col-span-3 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                <h4 className="font-black text-slate-800 uppercase tracking-tight">Usuarios Registrados</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[720px]">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">Nombre</th>
                      <th className="px-8 py-4">Usuario</th>
                      <th className="px-8 py-4">Cargo</th>
                      <th className="px-8 py-4">Rol</th>
                      <th className="px-8 py-4">Permisos</th>
                      <th className="px-8 py-4">Estado</th>
                      <th className="px-8 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedUsers.map((user) => (
                      <tr key={`user-${user.id}`}>
                        <td className="px-8 py-4 text-xs font-black text-slate-800 uppercase">{user.nombre}</td>
                        <td className="px-8 py-4 text-xs font-black text-slate-500">{user.username}</td>
                        <td className="px-8 py-4 text-xs font-black text-slate-500">{formatCargoFromCatalog(user.departamento)}</td>
                        <td className="px-8 py-4 text-xs font-black text-slate-500 uppercase">{roleLabelByValue[user.rol] || USER_ROLE_LABEL[user.rol]}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{rolePermissionsByValue[user.rol] || USER_ROLE_PERMISSIONS[user.rol]}</td>
                        <td className="px-8 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.activo !== false ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {user.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={userActionLoadingId === user.id}
                              onClick={() => handleEditUser(user)}
                              className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={userActionLoadingId === user.id || (sessionUser?.id === user.id)}
                              onClick={() => void handleToggleUserActive(user)}
                              className="px-3 py-1 rounded-lg border border-amber-200 text-[10px] font-black uppercase text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40"
                            >
                              {user.activo !== false ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              type="button"
                              disabled={userActionLoadingId === user.id || (sessionUser?.id === user.id)}
                              onClick={() => void handleDeleteUser(user)}
                              className="px-3 py-1 rounded-lg border border-red-200 text-[10px] font-black uppercase text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sortedUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-8 py-8 text-center text-xs font-black uppercase tracking-wider text-slate-400">
                          Sin usuarios registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default UsersView;
