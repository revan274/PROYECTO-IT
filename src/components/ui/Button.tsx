import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'toolbar' | 'cta';

const BASE = 'inline-flex items-center justify-center gap-2 font-black uppercase';

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA naranja de marca (login, guardar, nuevo ticket…)
  primary: 'bg-brand text-white rounded-2xl disabled:opacity-50',
  // Botón neutro de toolbars, filtros y cancelar (estilo normalizado)
  secondary: 'border border-slate-200 bg-white text-slate-600 rounded-2xl hover:bg-slate-50 disabled:opacity-50',
  // Acción destructiva suave (limpiar, eliminar en toolbars)
  danger: 'border border-red-200 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 disabled:opacity-40',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-4 py-3 text-xs',
  md: 'px-5 py-3 text-xs',
  lg: 'px-6 py-3 text-xs',
  // Botón de barra de acciones de vista (responsive, texto 11px)
  toolbar: 'w-full xl:w-auto min-w-0 px-6 py-3 sm:px-8 sm:py-4 text-[11px] leading-tight',
  // CTA de formulario/login a ancho completo
  cta: 'w-full py-5 shadow-xl hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
