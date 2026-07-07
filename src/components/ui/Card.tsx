import type { HTMLAttributes } from 'react';

export type CardVariant = 'panel' | 'muted' | 'hero' | 'glass' | 'stat';
export type CardTone = 'blue' | 'green' | 'orange';

const VARIANTS: Record<CardVariant, string> = {
  // Panel KPI / informativo blanco
  panel: 'bg-white border border-slate-100 rounded-2xl p-4',
  // Sección agrupadora suave (formularios, detalle) — opacidad normalizada a /40
  muted: 'rounded-2xl border border-slate-100 bg-slate-50/40 p-5',
  // Tarjetón hero (KPIs grandes de Dashboard/Reports)
  hero: 'bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl',
  // Contenedor raíz de vista
  glass: 'glass-panel bg-white/90 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden',
  // KPI tintada con hover-lift (el tinte va en `tone`)
  stat: 'rounded-2xl border p-4 hover-lift backdrop-blur-sm',
};

const STAT_TONES: Record<CardTone, string> = {
  blue: 'border-blue-100 bg-blue-50/80',
  green: 'border-green-100 bg-green-50/80',
  orange: 'border-orange-100 bg-orange-50/80',
};

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  /** Solo aplica con variant="stat". */
  tone?: CardTone;
  as?: 'div' | 'section' | 'button';
}

export function Card({
  variant = 'panel',
  tone,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  const toneClasses = variant === 'stat' && tone ? STAT_TONES[tone] : '';
  const classes = [VARIANTS[variant], toneClasses, className].filter(Boolean).join(' ');
  const buttonProps = Tag === 'button' ? { type: 'button' as const } : {};
  return (
    <Tag className={classes} {...buttonProps} {...rest}>
      {children}
    </Tag>
  );
}
