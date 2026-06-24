import { RefreshCw, Download, RotateCcw, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  PageHeader, Toolbar, SearchInput, Button, FilterChip, Input,
  DataTable, Badge, type Column,
} from '../../ui';
import type {
  AuditFiltersState, AuditIntegrityState, AuditModule, AuditPaginationState, RegistroAuditoria,
} from '../../types/app';

interface AuditScreenProps {
  rows: RegistroAuditoria[];
  loading: boolean;
  filters: AuditFiltersState;
  onFilterChange: (patch: Partial<AuditFiltersState>) => void;
  onReset: () => void;
  onRefresh: () => void;
  onExport: () => void;
  integrity: AuditIntegrityState | null;
  moduleTotals: { tickets: number; insumos: number; activos: number; otros: number };
  resultTotals: { ok: number; error: number };
  pagination: AuditPaginationState;
  onPageChange: (page: number) => void;
}

const MODULES: { value: '' | AuditModule; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'activos', label: 'Activos' },
  { value: 'otros', label: 'Otros' },
];

const RESULTS: { value: '' | 'ok' | 'error'; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'ok', label: 'OK' },
  { value: 'error', label: 'Error' },
];

export function AuditScreen({
  rows, loading, filters, onFilterChange, onReset, onRefresh, onExport,
  integrity, moduleTotals, resultTotals, pagination, onPageChange,
}: AuditScreenProps) {
  const columns: Column<RegistroAuditoria>[] = [
    { key: 'fecha', header: 'Fecha', width: '180px', cell: (r) => <span className="text-fg-subtle tabular-nums">{r.fecha}</span> },
    { key: 'usuario', header: 'Usuario', cell: (r) => <span className="font-medium text-fg">{r.usuario || 'Sistema'}</span> },
    { key: 'accion', header: 'Acción', cell: (r) => <span className="text-fg-muted">{r.accion}</span> },
    { key: 'item', header: 'Detalle', cell: (r) => <span className="text-fg-muted truncate">{r.item}</span> },
    { key: 'modulo', header: 'Módulo', cell: (r) => <Badge tone="neutral">{r.modulo || 'otros'}</Badge> },
    { key: 'resultado', header: 'Resultado', cell: (r) => <Badge tone={(r.resultado || 'ok') === 'ok' ? 'success' : 'danger'} dot>{(r.resultado || 'ok').toUpperCase()}</Badge> },
  ];

  const moduleCount = (value: '' | AuditModule): number | undefined =>
    value === '' ? undefined : moduleTotals[value];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoría"
        subtitle={loading ? 'Consultando registros…' : `${rows.length} en esta página · ${pagination.total} en total`}
        actions={
          <>
            {integrity && (
              <Badge tone={integrity.ok ? 'success' : 'danger'}>
                {integrity.ok ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {integrity.ok ? 'Cadena íntegra' : `Integridad rota (#${integrity.firstBrokenId ?? '?'})`}
              </Badge>
            )}
            <Button variant="ghost" size="sm" iconLeft={<RotateCcw className="h-4 w-4" />} onClick={onReset}>Limpiar</Button>
            <Button variant="secondary" size="sm" iconLeft={<RefreshCw className="h-4 w-4" />} onClick={onRefresh}>Actualizar</Button>
            <Button variant="secondary" size="sm" iconLeft={<Download className="h-4 w-4" />} onClick={onExport}>Exportar</Button>
          </>
        }
      />

      <div className="w-full sm:w-96">
        <SearchInput value={filters.q} onChange={(v) => onFilterChange({ q: v })} placeholder="Buscar en auditoría…" />
      </div>

      <Toolbar>
        {MODULES.map((m) => (
          <FilterChip key={m.value || 'all'} active={filters.module === m.value} onClick={() => onFilterChange({ module: m.value })}>
            {m.label}{moduleCount(m.value) !== undefined ? ` · ${moduleCount(m.value)}` : ''}
          </FilterChip>
        ))}
      </Toolbar>

      <Toolbar>
        {RESULTS.map((r) => (
          <FilterChip key={r.value || 'all'} active={filters.result === r.value} onClick={() => onFilterChange({ result: r.value })}>
            {r.label}{r.value === 'ok' ? ` · ${resultTotals.ok}` : r.value === 'error' ? ` · ${resultTotals.error}` : ''}
          </FilterChip>
        ))}
      </Toolbar>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Input label="Usuario" value={filters.user} onChange={(e) => onFilterChange({ user: e.target.value })} />
        <Input label="Entidad" value={filters.entity} onChange={(e) => onFilterChange({ entity: e.target.value })} />
        <Input label="Acción" value={filters.action} onChange={(e) => onFilterChange({ action: e.target.value })} />
        <Input label="Desde" type="date" value={filters.from} onChange={(e) => onFilterChange({ from: e.target.value })} />
        <Input label="Hasta" type="date" value={filters.to} onChange={(e) => onFilterChange({ to: e.target.value })} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        dense
        empty={{ title: 'Sin registros', description: 'No hay eventos para los filtros actuales.' }}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-subtle">Página {pagination.page} de {pagination.totalPages}</span>
        <Toolbar>
          <Button variant="secondary" size="sm" iconLeft={<ChevronLeft className="h-4 w-4" />}
            disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Anterior</Button>
          <Button variant="secondary" size="sm" iconRight={<ChevronRight className="h-4 w-4" />}
            disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Siguiente</Button>
        </Toolbar>
      </div>
    </div>
  );
}
