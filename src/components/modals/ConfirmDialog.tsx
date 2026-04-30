import React, { useEffect } from 'react';

interface ConfirmDialogProps {
  message: string;
  title?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  title = 'Confirmar',
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-slate-100 font-black uppercase text-sm text-slate-700">
          {title}
        </div>
        <div className="p-8 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
          {message}
        </div>
        <div className="px-8 pb-8 flex gap-3 justify-end">
          <button
            autoFocus
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
