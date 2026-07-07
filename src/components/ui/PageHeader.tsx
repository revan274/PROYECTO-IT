import type { ReactNode } from 'react';

const EYEBROW_CLASSES = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
const SECTION_TITLE_CLASSES = 'text-lg font-black uppercase text-slate-800';

export interface PageHeaderProps {
  /** `view`: título de vista (Outfit, tracking-tight). `section`: título de tarjeta/sección. */
  variant?: 'view' | 'section';
  /** Solo variant="view": lg = text-2xl (vistas ricas) · md = text-xl (vistas simples). */
  size?: 'lg' | 'md';
  eyebrow?: ReactNode;
  title: ReactNode;
  className?: string;
}

/**
 * Bloque eyebrow + título. Las acciones a la derecha y su wrapper responsive
 * son layout del consumidor (los breakpoints varían por vista: md/lg/xl).
 */
export function PageHeader({
  variant = 'view',
  size = 'lg',
  eyebrow,
  title,
  className,
}: PageHeaderProps) {
  const titleClasses = variant === 'view'
    ? `font-black font-['Outfit'] text-slate-800 uppercase tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-xl'}`
    : SECTION_TITLE_CLASSES;

  return (
    <div className={className}>
      {eyebrow != null && <p className={EYEBROW_CLASSES}>{eyebrow}</p>}
      <h3 className={titleClasses}>{title}</h3>
    </div>
  );
}
