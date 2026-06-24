import type { ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string> { value: T; label: string; count?: number }

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" aria-orientation="horizontal" className={cn('flex items-center gap-1 border-b border-border', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
              active ? 'text-fg border-brand' : 'text-fg-subtle border-transparent hover:text-fg',
            )}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span className={cn(
                'ml-2 rounded-full px-1.5 py-0.5 text-[11px]',
                active ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-fg-subtle',
              )}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* Filtros tipo chip (Linear/Jira) */
export function FilterChip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium border transition-colors',
        active ? 'bg-brand-soft text-brand border-brand/30' : 'bg-surface text-fg-muted border-border hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}
