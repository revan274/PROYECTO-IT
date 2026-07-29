import { useEffect, useRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export interface ModalDialogProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  isBusy?: boolean;
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
}

export function ModalDialog({
  open,
  onClose,
  children,
  isBusy = false,
  closeOnBackdrop = true,
  overlayClassName,
  className,
  ...rest
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(isBusy);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const initialFocus = dialog.querySelector<HTMLElement>('[autofocus], [data-autofocus]')
      || getFocusableElements(dialog)[0]
      || dialog;
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isBusyRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={[
        'fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6',
        overlayClassName,
      ].filter(Boolean).join(' ')}
    >
      {closeOnBackdrop && !isBusy && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Cerrar diálogo al seleccionar el fondo"
          className="absolute inset-0 cursor-default bg-transparent"
          onClick={() => onCloseRef.current()}
        />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={['relative z-10', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}
