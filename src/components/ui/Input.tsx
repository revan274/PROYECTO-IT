import type { InputHTMLAttributes } from 'react';
import { controlSkin, controlStateSkin, type ControlVariant } from './controlSkin';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: ControlVariant;
  /** Estado de error visual. Hoy solo la variante `soft` lo usa (InsumoForm). */
  invalid?: boolean;
}

export function Input({
  variant = 'form',
  invalid = false,
  className,
  ...rest
}: InputProps) {
  const stateClasses = variant === 'soft'
    ? (invalid ? controlStateSkin.invalid : controlStateSkin.normal)
    : (invalid ? controlStateSkin.invalid : '');
  const classes = [controlSkin[variant], stateClasses, className].filter(Boolean).join(' ');
  return <input className={classes} {...rest} />;
}
