import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'close';
export type ButtonSize = 'bare' | 'icon' | 'sm' | 'md' | 'lg' | 'toolbar' | 'cta';

const BASE = 'inline-flex items-center justify-center font-black uppercase';

/** Piel: color, borde, hover y opacidad de deshabilitado. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white disabled:opacity-50',
  secondary: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50',
  dark: 'bg-slate-800 text-white disabled:opacity-50',
  // Cerrar modal (X)
  close: 'text-slate-300 hover:text-red-500 disabled:opacity-40',
};

/** Forma: padding, tipografía, radio y ancho. */
const SIZES: Record<ButtonSize, string> = {
  bare: '',
  icon: 'w-10 h-10 rounded-xl',
  sm: 'gap-2 px-4 py-3 text-xs rounded-2xl',
  md: 'gap-2 px-5 py-3 text-xs rounded-2xl',
  lg: 'gap-2 px-6 py-3 text-xs rounded-2xl',
  // Barra de acciones de vista (responsive, texto 11px)
  toolbar: 'gap-2 w-full xl:w-auto min-w-0 px-6 py-3 sm:px-8 sm:py-4 text-[11px] leading-tight rounded-2xl',
  // CTA de formulario/login a ancho completo
  cta: 'gap-2 w-full py-5 shadow-xl hover:opacity-90 rounded-2xl',
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
