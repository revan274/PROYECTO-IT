import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

type DialogSize = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<DialogSize, string> = {
  sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl',
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: DialogSize;
  footer?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}

export function Dialog({ open, onClose, title, description, size = 'md', footer, busy, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) { onClose(); return; }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    // foco inicial al primer control del panel
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(t);
      lastFocused.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative w-full bg-surface border border-border rounded-xl shadow-pop',
          'max-h-[90vh] flex flex-col animate-[dialogIn_.16s_ease-out]',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-fg truncate">{title}</h2>
            {description && <p id={descId} className="text-sm text-fg-subtle mt-0.5">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" aria-label="Cerrar" onClick={onClose} disabled={busy} className="-mr-1.5">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="px-5 py-4 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-2/40">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
