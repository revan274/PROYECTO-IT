import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  PageHeader, Toolbar, SearchInput, Button, Tabs, FilterChip,
  DataTable, Badge, toneForDomain, type Column, type TabItem,
} from '../../ui';

export interface TicketScreenRow {
  id: number;
  activoTag: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  asignadoA: string;
  sucursal: string;
  slaLabel: string;
  slaBreached: boolean;
  fecha: string;
}

type Lifecycle = 'ABIERTOS' | 'CERRADOS' | 'TODOS';

interface TicketsScreenProps {
  tickets: TicketScreenRow[];
  onOpen: (id: number) => void;
  onNew: () => void;
  /** Semilla de búsqueda (drill-down desde dashboard / búsqueda global). */
  initialSearch?: string;
  /** Permite ocultar el botón "Nuevo ticket" según permisos del rol. */
  canCreate?: boolean;
}

const isClosed = (estado: string) => estado === 'Resuelto' || estado === 'Cerrado';

export function TicketsScreen({ tickets, onOpen, onNew, initialSearch = '', canCreate = true }: TicketsScreenProps) {
  const [search, setSearch] = useState(initialSearch);
  const [tab, setTab] = useState<Lifecycle>('ABIERTOS');
  const [onlySla, setOnlySla] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const tabs: TabItem<Lifecycle>[] = [
    { value: 'ABIERTOS', label: 'Abiertos', count: tickets.filter((t) => !isClosed(t.estado)).length },
    { value: 'CERRADOS', label: 'Cerrados', count: tickets.filter((t) => isClosed(t.estado)).length },
    { value: 'TODOS', label: 'Todos', count: tickets.length },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (tab === 'ABIERTOS' && isClosed(t.estado)) return false;
      if (tab === 'CERRADOS' && !isClosed(t.estado)) return false;
      if (onlySla && !t.slaBreached) return false;
      if (onlyUnassigned && t.asignadoA) return false;
      if (q && !`${t.id} ${t.activoTag} ${t.descripcion} ${t.asignadoA} ${t.sucursal}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, tab, search, onlySla, onlyUnassigned]);

  const columns: Column<TicketScreenRow>[] = [
    { key: 'id', header: '#', width: '64px', cell: (t) => <span className="text-fg-subtle tabular-nums">#{t.id}</span> },
    {
      key: 'descripcion', header: 'Asunto', cell: (t) => (
        <div className="min-w-0">
          <p className="font-medium text-fg truncate">{t.descripcion}</p>
          <p className="text-xs text-fg-subtle truncate">{t.activoTag} · {t.sucursal || 'Sin sucursal'}</p>
        </div>
      ),
    },
    { key: 'prioridad', header: 'Prioridad', cell: (t) => <Badge tone={toneForDomain(t.prioridad)} dot>{t.prioridad}</Badge> },
    { key: 'estado', header: 'Estado', cell: (t) => <Badge tone={toneForDomain(t.estado)}>{t.estado}</Badge> },
    { key: 'sla', header: 'SLA', cell: (t) => <Badge tone={t.slaBreached ? 'danger' : 'success'}>{t.slaLabel}</Badge> },
    { key: 'asignadoA', header: 'Asignado', cell: (t) => t.asignadoA || <span className="text-fg-subtle">Sin asignar</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tickets"
        subtitle={`${rows.length} de ${tickets.length}`}
        actions={<Button iconLeft={<Plus className="h-4 w-4" />} onClick={onNew} disabled={!canCreate}>Nuevo ticket</Button>}
      />

      <Tabs<Lifecycle> items={tabs} value={tab} onChange={setTab} />

      <Toolbar className="justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar tickets…" />
        </div>
        <Toolbar>
          <FilterChip active={onlySla} onClick={() => setOnlySla((v) => !v)}>SLA vencido</FilterChip>
          <FilterChip active={onlyUnassigned} onClick={() => setOnlyUnassigned((v) => !v)}>Sin asignar</FilterChip>
        </Toolbar>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        onRowClick={(t) => onOpen(t.id)}
        empty={{ title: 'Sin tickets', description: 'Ajusta los filtros o crea un ticket nuevo.' }}
      />
    </div>
  );
}
