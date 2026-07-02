import type { ButtonHTMLAttributes } from 'react';

export type FilterChipTone = 'neutral' | 'critical' | 'warning' | 'brand';

const BASE = 'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border';

/** Par activo/inactivo por tono. `brand` está diseñado para superficies oscuras. */
const TONES: Record<FilterChipTone, { active: string; inactive: string }> = {
  neutral: {
    active: 'bg-slate-800 text-white border-slate-800',
    inactive: 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
  },
  critical: {
    active: 'bg-red-500 text-white border-red-500',
    inactive: 'bg-white text-red-500 border-red-200 hover:bg-red-50',
  },
  warning: {
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50',
  },
  brand: {
    active: 'bg-brand text-white border-brand',
    inactive: 'bg-white/5 text-slate-200 border-white/20 hover:bg-white/10',
  },
};

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estado de selección del filtro (obligatorio: un chip ES una selección). */
  active: boolean;
  tone?: FilterChipTone;
}

export function FilterChip({
  active,
  tone = 'neutral',
  className,
  type = 'button',
  children,
  ...rest
}: FilterChipProps) {
  const toneClasses = TONES[tone][active ? 'active' : 'inactive'];
  const classes = [BASE, toneClasses, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
