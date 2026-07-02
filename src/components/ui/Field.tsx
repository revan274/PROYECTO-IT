import type { ReactNode } from 'react';

const LABEL_CLASSES = 'block text-[10px] font-black uppercase tracking-widest text-slate-400';
const ERROR_CLASSES = 'px-1 text-[10px] font-black uppercase tracking-wider text-red-500';
const HINT_CLASSES = 'text-[10px] text-slate-400 font-black uppercase tracking-wider';

export interface FieldProps {
  /** Etiqueta del campo. ReactNode para permitir composición. */
  label?: ReactNode;
  /** Asociación explícita con el id del control. No se generan ids automáticos. */
  htmlFor?: string;
  /** Texto de ayuda. Se oculta mientras exista `error`. */
  hint?: ReactNode;
  /** Mensaje de error del campo. */
  error?: ReactNode;
  className?: string;
  /** Un único control (Input, Select, TextArea o nativo). */
  children: ReactNode;
}

/**
 * Patrón semántico etiqueta + control + ayuda/error.
 * Solo flujo vertical interno; el layout externo es del consumidor.
 */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  const classes = ['space-y-1', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {label != null && (
        <label htmlFor={htmlFor} className={LABEL_CLASSES}>
          {label}
        </label>
      )}
      {children}
      {error
        ? <p className={ERROR_CLASSES}>{error}</p>
        : hint
          ? <p className={HINT_CLASSES}>{hint}</p>
          : null}
    </div>
  );
}
