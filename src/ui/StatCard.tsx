import type { ComponentType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from './cn';

type Trend = { direction: 'up' | 'down' | 'flat'; label: string; good?: boolean };

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  trend?: Trend;
  onClick?: () => void;
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const ACCENT: Record<NonNullable<StatCardProps['accent']>, string> = {
  brand: 'text-brand bg-brand-soft',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-danger bg-danger-soft',
  info: 'text-info bg-info-soft',
  neutral: 'text-fg-muted bg-surface-2',
};

export function StatCard({ label, value, icon: Icon, trend, onClick, accent = 'neutral' }: StatCardProps) {
  const Comp = onClick ? 'button' : 'div';
  const trendColor = trend?.good === undefined
    ? 'text-fg-subtle'
    : trend.good ? 'text-success' : 'text-danger';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group text-left bg-surface border border-border rounded-xl shadow-card p-4 w-full',
        onClick && 'transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium text-fg-muted">{label}</span>
        {Icon && <span className={cn('h-8 w-8 grid place-items-center rounded-lg', ACCENT[accent])}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-3xl font-semibold text-fg tracking-tight tabular-nums">{value}</span>
        {trend && (
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium', trendColor)}>
            {trend.direction === 'up' ? <ArrowUpRight className="h-3.5 w-3.5" />
              : trend.direction === 'down' ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
            {trend.label}
          </span>
        )}
      </div>
    </Comp>
  );
}

/* Barra de progreso accesible para mini-charts del dashboard */
export function MeterBar({ label, value, max, tone = 'brand' }: { label: string; value: number; max: number; tone?: 'brand' | 'success' | 'danger' | 'info' | 'accent' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bar = { brand: 'bg-brand', success: 'bg-success', danger: 'bg-danger', info: 'bg-info', accent: 'bg-accent' }[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-fg-muted truncate">{label}</span>
        <span className="text-fg font-medium tabular-nums">{value}</span>
      </div>
      <div
        className="h-2 rounded-full bg-surface-3 overflow-hidden"
        role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}
      >
        <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
