import type { SelectHTMLAttributes } from 'react';
import { controlSkin, controlStateSkin, type ControlVariant } from './controlSkin';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: ControlVariant;
  /** Estado de error visual (misma piel que Input). */
  invalid?: boolean;
}

export function Select({
  variant = 'form',
  invalid = false,
  className,
  children,
  ...rest
}: SelectProps) {
  const stateClasses = variant === 'soft'
    ? (invalid ? controlStateSkin.invalid : controlStateSkin.normal)
    : (invalid ? controlStateSkin.invalid : '');
  const classes = [controlSkin[variant], stateClasses, className].filter(Boolean).join(' ');
  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  );
}
