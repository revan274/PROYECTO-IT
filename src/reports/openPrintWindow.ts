import type { ToastType } from '../types/app';

type NotifyFn = (message: string, type?: ToastType) => void;

export interface ReportWindowMessages {
  popupFallback: string;
  openError: string;
  openErrorLevel: ToastType;
  renderError: string;
}

/**
 * Abre un documento HTML en una ventana nueva para presentación/impresión.
 * Si el popup está bloqueado intenta un fallback vía Blob URL.
 */
export function openHtmlReportWindow(
  html: string,
  options: {
    autoPrint?: boolean;
    notify: NotifyFn;
    messages: ReportWindowMessages;
  },
): void {
  const { autoPrint = false, notify, messages } = options;
  const win = window.open('', '_blank', 'width=1200,height=900');
  if (!win) {
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const fallbackUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fallbackUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(fallbackUrl), 2000);
      notify(messages.popupFallback, 'warning');
    } catch {
      notify(messages.openError, messages.openErrorLevel);
    }
    return;
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    try {
      win.close();
    } catch {
      // no-op
    }
    notify(messages.renderError, 'error');
    return;
  }

  if (autoPrint) {
    let printed = false;
    const trigger = () => {
      if (printed || win.closed) return;
      if (win.document.readyState !== 'complete') return;
      printed = true;
      win.focus();
      win.print();
    };
    win.addEventListener('load', () => {
      window.setTimeout(trigger, 250);
    }, { once: true });
    window.setTimeout(trigger, 1200);
  }
}

/**
 * Abre una ventana pequeña que imprime automáticamente y se cierra (etiquetas).
 * Devuelve false si el popup fue bloqueado.
 */
export function openAutoPrintLabelWindow(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=580,height=420');
  if (!printWindow) return false;

  printWindow.document.write(html);
  printWindow.document.close();

  let didPrint = false;
  const triggerPrint = () => {
    if (didPrint) return;
    didPrint = true;
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  printWindow.onload = triggerPrint;
  window.setTimeout(triggerPrint, 450);
  return true;
}
