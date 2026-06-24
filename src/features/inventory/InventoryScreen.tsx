import { useMemo, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  PageHeader, Toolbar, SearchInput, Button, FilterChip,
  DataTable, Badge, type Column, type BadgeTone,
} from '../../ui';

export type SupplyStatus = 'AGOTADO' | 'BAJO' | 'OK';

export interface SupplyRow {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  stock: number;
  min: number;
  status: SupplyStatus;
}

interface InventoryScreenProps {
  supplies: SupplyRow[];
  categories: string[];
  canEdit: boolean;
  onNew: () => void;
  onAdjust: (id: number, delta: number) => void;
  onOpen: (id: number) => void;
  initialSearch?: string;
}

const STATUS_TONE: Record<SupplyStatus, BadgeTone> = { AGOTADO: 'danger', BAJO: 'warning', OK: 'success' };
const STATUS_LABEL: Record<SupplyStatus, string> = { AGOTADO: 'Agotado', BAJO: 'Stock bajo', OK: 'OK' };

export function InventoryScreen({ supplies, categories, canEdit, onNew, onAdjust, onOpen, initialSearch = '' }: InventoryScreenProps) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<string>('TODAS');
  const [onlyLow, setOnlyLow] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supplies.filter((s) => {
      if (category !== 'TODAS' && s.categoria !== category) return false;
      if (onlyLow && s.status === 'OK') return false;
      if (q && !`${s.nombre} ${s.categoria}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [supplies, search, category, onlyLow]);

  const columns: Column<SupplyRow>[] = [
    { key: 'nombre', header: 'Insumo', cell: (s) => <span className="font-medium text-fg">{s.nombre}</span> },
    { key: 'categoria', header: 'Categoría', cell: (s) => <Badge tone="neutral">{s.categoria}</Badge> },
    { key: 'stock', header: 'Stock', align: 'right', cell: (s) => <span className="tabular-nums">{s.stock} <span className="text-fg-subtle">{s.unidad}</span></span> },
    { key: 'min', header: 'Mínimo', align: 'right', cell: (s) => <span className="tabular-nums text-fg-subtle">{s.min}</span> },
    { key: 'estado', header: 'Estado', cell: (s) => <Badge tone={STATUS_TONE[s.status]} dot>{STATUS_LABEL[s.status]}</Badge> },
    {
      key: 'acciones', header: '', align: 'right', width: '120px', cell: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" aria-label={`Restar stock a ${s.nombre}`} disabled={!canEdit || s.stock <= 0} onClick={() => onAdjust(s.id, -1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Sumar stock a ${s.nombre}`} disabled={!canEdit} onClick={() => onAdjust(s.id, +1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario de insumos"
        subtitle={`${rows.length} de ${supplies.length}`}
        actions={<Button iconLeft={<Plus className="h-4 w-4" />} onClick={onNew} disabled={!canEdit}>Nuevo insumo</Button>}
      />

      <Toolbar className="justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo…" />
        </div>
        <Toolbar>
          <FilterChip active={onlyLow} onClick={() => setOnlyLow((v) => !v)}>Stock bajo</FilterChip>
        </Toolbar>
      </Toolbar>

      <Toolbar>
        <FilterChip active={category === 'TODAS'} onClick={() => setCategory('TODAS')}>Todas</FilterChip>
        {categories.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</FilterChip>
        ))}
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => onOpen(s.id)}
        empty={{ title: 'Sin insumos', description: 'Ajusta los filtros o registra un insumo nuevo.' }}
      />
    </div>
  );
}
