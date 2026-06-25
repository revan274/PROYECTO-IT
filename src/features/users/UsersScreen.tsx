import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import {
  PageHeader, Toolbar, SearchInput, Button, FilterChip, DataTable, Badge, type Column,
} from '../../ui';
import type { UserItem } from '../../types/app';

type StatusFilter = 'TODOS' | 'ACTIVOS' | 'INACTIVOS';

interface UsersScreenProps {
  users: UserItem[];
  roleLabel: Record<string, string>;
  roleFilters: { value: string; label: string }[];
  formatCargo: (cargo?: string) => string;
  currentUserId?: number;
  loadingId: number | null;
  onNew: () => void;
  onEdit: (user: UserItem) => void;
  onToggleActive: (user: UserItem) => void;
  onDelete: (user: UserItem) => void;
  initialSearch?: string;
}

const isActive = (u: UserItem) => u.activo !== false;

export function UsersScreen({
  users, roleLabel, roleFilters, formatCargo, currentUserId, loadingId,
  onNew, onEdit, onToggleActive, onDelete, initialSearch = '',
}: UsersScreenProps) {
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState<string>('TODOS');
  const [status, setStatus] = useState<StatusFilter>('TODOS');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== 'TODOS' && u.rol !== role) return false;
      if (status === 'ACTIVOS' && !isActive(u)) return false;
      if (status === 'INACTIVOS' && isActive(u)) return false;
      if (q && !`${u.nombre} ${u.username} ${u.departamento ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, role, status]);

  const columns: Column<UserItem>[] = [
    { key: 'nombre', header: 'Nombre', cell: (u) => <span className="font-medium text-fg">{u.nombre}</span> },
    { key: 'username', header: 'Usuario', cell: (u) => <span className="text-fg-muted">{u.username}</span> },
    { key: 'rol', header: 'Rol', cell: (u) => <Badge tone="neutral">{roleLabel[u.rol] || u.rol}</Badge> },
    { key: 'cargo', header: 'Cargo', cell: (u) => <span className="text-fg-muted">{formatCargo(u.departamento)}</span> },
    { key: 'estado', header: 'Estado', cell: (u) => <Badge tone={isActive(u) ? 'success' : 'neutral'} dot>{isActive(u) ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: 'acciones', header: '', align: 'right', width: '160px', cell: (u) => {
        const busy = loadingId === u.id;
        const self = currentUserId != null && currentUserId === u.id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" aria-label={`Editar ${u.username}`} disabled={busy} onClick={() => onEdit(u)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label={`${isActive(u) ? 'Desactivar' : 'Activar'} ${u.username}`} disabled={busy} onClick={() => onToggleActive(u)}>
              {isActive(u) ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" aria-label={`Eliminar ${u.username}`} disabled={busy || self} onClick={() => onDelete(u)}>
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuarios registrados"
        subtitle={`${rows.length} de ${users.length}`}
        actions={<Button iconLeft={<Plus className="h-4 w-4" />} onClick={onNew}>Nuevo usuario</Button>}
      />

      <Toolbar className="justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Nombre, usuario o cargo…" />
        </div>
        <Toolbar>
          {(['TODOS', 'ACTIVOS', 'INACTIVOS'] as StatusFilter[]).map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
              {{ TODOS: 'Todos', ACTIVOS: 'Activos', INACTIVOS: 'Inactivos' }[s]}
            </FilterChip>
          ))}
        </Toolbar>
      </Toolbar>

      <Toolbar>
        <FilterChip active={role === 'TODOS'} onClick={() => setRole('TODOS')}>Todos los roles</FilterChip>
        {roleFilters.filter((r) => r.value !== 'TODOS').map((r) => (
          <FilterChip key={r.value} active={role === r.value} onClick={() => setRole(r.value)}>{r.label}</FilterChip>
        ))}
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        empty={{ title: 'Sin usuarios', description: 'Ajusta los filtros o crea un usuario nuevo.' }}
      />
    </div>
  );
}
