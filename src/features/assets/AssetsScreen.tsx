import { useMemo, useState } from 'react';
import { Plus, Upload, QrCode } from 'lucide-react';
import {
  PageHeader, Toolbar, SearchInput, Button, FilterChip,
  DataTable, Badge, type Column,
} from '../../ui';

export interface AssetRow {
  id: number;
  tag: string;
  tipo: string;
  marca: string;
  estado: string;
  responsable: string;
  ubicacion: string;
  ipAddress: string;
}

type RiskFilter = 'ALL' | 'NO_OWNER' | 'NO_IP' | 'FAULT';

interface AssetsScreenProps {
  assets: AssetRow[];
  canEdit: boolean;
  onNew: () => void;
  onImport: () => void;
  onOpen: (id: number) => void;
  onScanQr: () => void;
  initialSearch?: string;
}

const RISK_LABEL: Record<RiskFilter, string> = {
  ALL: 'Todos', NO_OWNER: 'Sin responsable', NO_IP: 'Sin IP', FAULT: 'En falla',
};

export function AssetsScreen({ assets, canEdit, onNew, onImport, onOpen, onScanQr, initialSearch = '' }: AssetsScreenProps) {
  const [search, setSearch] = useState(initialSearch);
  const [risk, setRisk] = useState<RiskFilter>('ALL');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (risk === 'NO_OWNER' && a.responsable) return false;
      if (risk === 'NO_IP' && a.ipAddress) return false;
      if (risk === 'FAULT' && a.estado !== 'Falla') return false;
      if (q && !`${a.tag} ${a.tipo} ${a.marca} ${a.responsable} ${a.ipAddress} ${a.ubicacion}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [assets, search, risk]);

  const columns: Column<AssetRow>[] = [
    { key: 'tag', header: 'Etiqueta', cell: (a) => <span className="font-medium text-fg">{a.tag}</span> },
    { key: 'tipo', header: 'Tipo', cell: (a) => <span className="text-fg-muted">{a.tipo}</span> },
    { key: 'marca', header: 'Marca' },
    { key: 'estado', header: 'Estado', cell: (a) => <Badge tone={a.estado === 'Falla' ? 'danger' : 'success'} dot>{a.estado}</Badge> },
    { key: 'responsable', header: 'Responsable', cell: (a) => a.responsable || <span className="text-warning">Sin asignar</span> },
    { key: 'ubicacion', header: 'Ubicación', cell: (a) => <span className="text-fg-muted">{a.ubicacion}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activos"
        subtitle={`${rows.length} de ${assets.length}`}
        actions={
          <>
            <Button variant="secondary" iconLeft={<QrCode className="h-4 w-4" />} onClick={onScanQr}>Escanear QR</Button>
            <Button variant="secondary" iconLeft={<Upload className="h-4 w-4" />} onClick={onImport} disabled={!canEdit}>Importar</Button>
            <Button iconLeft={<Plus className="h-4 w-4" />} onClick={onNew} disabled={!canEdit}>Nuevo activo</Button>
          </>
        }
      />

      <Toolbar className="justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por tag, serie, IP, responsable…" />
        </div>
        <Toolbar>
          {(['ALL', 'NO_OWNER', 'NO_IP', 'FAULT'] as RiskFilter[]).map((r) => (
            <FilterChip key={r} active={risk === r} onClick={() => setRisk(r)}>{RISK_LABEL[r]}</FilterChip>
          ))}
        </Toolbar>
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.id}
        onRowClick={(a) => onOpen(a.id)}
        empty={{ title: 'Sin activos', description: 'Ajusta los filtros, importa un Excel o registra el primero.' }}
      />
    </div>
  );
}
