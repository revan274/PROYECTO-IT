import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from './cn';

type ToastTone = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; tone: ToastTone; message: string; sticky?: boolean }

interface ToastApi {
  show: (message: string, tone?: ToastTone, opts?: { sticky?: boolean }) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
};

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const TONE_CLS: Record<ToastTone, string> = {
  success: 'text-success', error: 'text-danger', warning: 'text-warning', info: 'text-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>((message, tone = 'success', opts) => {
    const id = ++seq.current;
    const sticky = opts?.sticky ?? tone === 'error';
    setItems((xs) => [...xs.slice(-3), { id, tone, message, sticky }]);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    warning: (m) => show(m, 'warning'),
    info: (m) => show(m, 'info'),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,22rem)]" aria-live="polite" aria-atomic="false">
        {items.map((t) => <ToastRow key={t.id} item={t} onClose={() => remove(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = ICONS[item.tone];
  useEffect(() => {
    if (item.sticky) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [item.sticky, onClose]);

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 bg-surface border border-border rounded-lg shadow-pop px-4 py-3',
        'animate-[toastIn_.18s_ease-out]',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', TONE_CLS[item.tone])} />
      <p className="text-sm text-fg flex-1 leading-snug">{item.message}</p>
      <button onClick={onClose} aria-label="Cerrar notificación" className="text-fg-subtle hover:text-fg">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
