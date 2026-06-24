import type { ReactNode } from 'react';
import { cn, variant } from './cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-soft text-neutral',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-neutral', brand: 'bg-brand', success: 'bg-success',
  warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
};

export function Badge({ children, tone = 'neutral', size = 'md', dot = false, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        variant(TONES, tone, 'neutral'),
        variant(SIZES, size, 'md'),
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', variant(DOTS, tone, 'neutral'))} />}
      {children}
    </span>
  );
}

/* --- Mapeo de dominio Mesa IT a tono semántico (estados de ticket, prioridad, etc.) --- */
const DOMAIN_TONE: Record<string, BadgeTone> = {
  // prioridad
  critica: 'danger', alta: 'warning', media: 'info', baja: 'neutral',
  // estado ticket
  abierto: 'info', 'en proceso': 'brand', 'en espera': 'warning',
  resuelto: 'success', cerrado: 'neutral',
  // activos / sla
  operativo: 'success', falla: 'danger', vencido: 'danger', 'en tiempo': 'success',
  // atención
  presencial: 'info', remoto: 'brand', traslado: 'warning',
};

export function toneForDomain(value: string | undefined): BadgeTone {
  return DOMAIN_TONE[String(value || '').trim().toLowerCase()] ?? 'neutral';
}
