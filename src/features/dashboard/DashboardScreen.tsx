import { Activity, ShieldCheck, Ticket, AlertTriangle, UserX, Loader, Timer, PackageX, Network, Clock } from 'lucide-react';
import {
  PageHeader, FilterChip, Toolbar, StatCard, MeterBar, Card, CardHeader, CardBody, Badge, toneForDomain,
} from '../../ui';
import { DASHBOARD_RANGES } from '../../constants/app';

interface Trend { label: string; toneClass: string }
interface Bar { label: string; count: number }
interface DashTicket { id: number; activoTag: string; descripcion: string; prioridad: string; estado: string; asignadoA?: string }

interface DashboardScreenProps {
  role: string;
  periodLabel: string;
  range: string;
  onRangeChange: (value: string) => void;

  health: number;
  openCount: number;
  criticalCount: number;
  unassignedCount: number;
  inProcessCount: number;
  slaExpiredCount: number;
  openTrend: Trend;
  criticalTrend: Trend;
  slaTrend: Trend;
  slaCompliancePct: number;
  slaCompliantCount: number;
  slaTotalCount: number;

  lowStockCount: number;
  assetsNoOwner: number;
  assetsHighLife: number;
  duplicateNet: number;

  recentTickets: DashTicket[];
  topOwners: Array<[string, number]>;
  ownerMax: number;
  stateBars: Bar[];
  stateMax: number;
  branchBars: Bar[];
  branchMax: number;
  agingBars: Bar[];
  agingMax: number;

  onFocusTicket: (focus: 'ABIERTOS' | 'CRITICA' | 'SIN_ASIGNAR' | 'SLA' | 'EN_PROCESO') => void;
  onFocusInventory: (focus: 'SIN_RESP' | 'VIDA_ALTA' | 'DUP_RED') => void;
  onView: (view: 'tickets' | 'inventory' | 'supplies') => void;
  onOpenRecent: (ticket: DashTicket) => void;
}

const TITLE: Record<string, string> = {
  admin: 'Resumen ejecutivo',
  tecnico: 'Panel técnico',
  consulta: 'Panel operativo',
};

function trendProp(t: Trend) {
  const good = !/red|amber|orange/i.test(t.toneClass);
  return { direction: 'flat' as const, label: t.label, good };
}

export function DashboardScreen(p: DashboardScreenProps) {
  const isAdmin = p.role === 'admin';
  const isTech = p.role === 'tecnico';

  return (
    <div className="space-y-6">
      <PageHeader
        title={TITLE[p.role] || 'Panel operativo'}
        subtitle={`Período: ${p.periodLabel}`}
        actions={
          <Toolbar>
            {DASHBOARD_RANGES.map((r) => (
              <FilterChip key={r.value} active={p.range === r.value} onClick={() => p.onRangeChange(r.value)}>{r.label}</FilterChip>
            ))}
          </Toolbar>
        }
      />

      {/* KPIs por rol */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <>
            <StatCard label="Salud IT" value={`${p.health}%`} icon={Activity} accent="success" />
            <StatCard label="SLA cumplido" value={`${p.slaCompliancePct}%`} icon={ShieldCheck} accent="info" trend={trendProp(p.slaTrend)} />
            <StatCard label="Tickets abiertos" value={p.openCount} icon={Ticket} accent="brand" trend={trendProp(p.openTrend)} onClick={() => p.onFocusTicket('ABIERTOS')} />
            <StatCard label="Críticos" value={p.criticalCount} icon={AlertTriangle} accent="danger" trend={trendProp(p.criticalTrend)} onClick={() => p.onFocusTicket('CRITICA')} />
          </>
        )}
        {isTech && (
          <>
            <StatCard label="Tickets abiertos" value={p.openCount} icon={Ticket} accent="brand" onClick={() => p.onFocusTicket('ABIERTOS')} />
            <StatCard label="Sin asignar" value={p.unassignedCount} icon={UserX} accent="warning" onClick={() => p.onFocusTicket('SIN_ASIGNAR')} />
            <StatCard label="En proceso" value={p.inProcessCount} icon={Loader} accent="info" onClick={() => p.onFocusTicket('EN_PROCESO')} />
            <StatCard label="SLA vencido" value={p.slaExpiredCount} icon={Timer} accent="danger" onClick={() => p.onFocusTicket('SLA')} />
          </>
        )}
        {!isAdmin && !isTech && (
          <>
            <StatCard label="Stock bajo" value={p.lowStockCount} icon={PackageX} accent="warning" onClick={() => p.onView('supplies')} />
            <StatCard label="Sin responsable" value={p.assetsNoOwner} icon={UserX} accent="neutral" onClick={() => p.onFocusInventory('SIN_RESP')} />
            <StatCard label="Vida útil alta" value={p.assetsHighLife} icon={Clock} accent="info" onClick={() => p.onFocusInventory('VIDA_ALTA')} />
            <StatCard label="Duplicados de red" value={p.duplicateNet} icon={Network} accent="danger" onClick={() => p.onFocusInventory('DUP_RED')} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        {!isAdmin && !isTech ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Distribución por estado" subtitle="Tickets" />
            <CardBody className="space-y-3">
              {p.stateBars.map((b) => <MeterBar key={b.label} label={b.label} value={b.count} max={p.stateMax} tone="accent" />)}
              {p.stateBars.length === 0 && <p className="text-sm text-fg-subtle">Sin datos en el período.</p>}
            </CardBody>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader title="Actividad reciente" subtitle={`Últimos tickets · ${p.periodLabel}`} />
            <CardBody className="space-y-2">
              {p.recentTickets.map((t) => (
                <button key={t.id} onClick={() => p.onOpenRecent(t)}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge tone={toneForDomain(t.prioridad)} size="sm" dot>{t.prioridad}</Badge>
                    <Badge tone={toneForDomain(t.estado)} size="sm">{t.estado}</Badge>
                    <span className="ml-auto text-xs text-fg-subtle tabular-nums">#{t.id}</span>
                  </div>
                  <p className="text-sm text-fg truncate">{t.activoTag} · {t.descripcion}</p>
                </button>
              ))}
              {p.recentTickets.length === 0 && <p className="text-sm text-fg-subtle">Sin tickets en el período.</p>}
            </CardBody>
          </Card>
        )}

        {/* Columna lateral */}
        <Card>
          <CardHeader title={isAdmin ? 'SLA y antigüedad' : isTech ? 'Carga por técnico' : 'Riesgos de inventario'} />
          <CardBody className="space-y-4">
            {isAdmin && (
              <>
                <MeterBar label="SLA cumplido" value={p.slaCompliantCount} max={Math.max(1, p.slaTotalCount)} tone="success" />
                <div className="space-y-3">
                  {p.agingBars.map((b) => <MeterBar key={b.label} label={b.label} value={b.count} max={p.agingMax} tone="danger" />)}
                </div>
              </>
            )}
            {isTech && (
              <div className="space-y-3">
                {p.topOwners.map(([owner, count]) => <MeterBar key={owner} label={owner} value={count} max={p.ownerMax} tone="brand" />)}
                {p.topOwners.length === 0 && <p className="text-sm text-fg-subtle">Sin tickets asignados.</p>}
              </div>
            )}
            {!isAdmin && !isTech && (
              <div className="space-y-3">
                <MeterBar label="Sin responsable" value={p.assetsNoOwner} max={Math.max(1, p.assetsNoOwner + p.assetsHighLife + p.duplicateNet)} tone="danger" />
                <MeterBar label="Vida útil alta" value={p.assetsHighLife} max={Math.max(1, p.assetsNoOwner + p.assetsHighLife + p.duplicateNet)} tone="info" />
                <MeterBar label="Duplicados de red" value={p.duplicateNet} max={Math.max(1, p.assetsNoOwner + p.assetsHighLife + p.duplicateNet)} tone="accent" />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Distribución por sucursal (admin) */}
      {isAdmin && (
        <Card>
          <CardHeader title="Tickets por sucursal" subtitle={p.periodLabel} />
          <CardBody className="space-y-3">
            {p.branchBars.map((b) => <MeterBar key={b.label} label={b.label} value={b.count} max={p.branchMax} tone="accent" />)}
            {p.branchBars.length === 0 && <p className="text-sm text-fg-subtle">Sin tickets en el período.</p>}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
