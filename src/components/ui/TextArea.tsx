import type { TextareaHTMLAttributes } from 'react';
import { controlSkin, controlStateSkin, type ControlVariant } from './controlSkin';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: ControlVariant;
  /** Estado de error visual (misma piel que Input/Select). */
  invalid?: boolean;
}

export function TextArea({
  variant = 'form',
  invalid = false,
  className,
  ...rest
}: TextAreaProps) {
  const stateClasses = variant === 'soft'
    ? (invalid ? controlStateSkin.invalid : controlStateSkin.normal)
    : (invalid ? controlStateSkin.invalid : '');
  const classes = [controlSkin[variant], stateClasses, className].filter(Boolean).join(' ');
  return <textarea className={classes} {...rest} />;
}
