import React, { useEffect, useRef, useState } from 'react';

interface PromptDialogProps {
  message: string;
  title?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  message,
  title = 'Ingresar',
  defaultValue = '',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

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
        <form onSubmit={handleSubmit}>
          <div className="p-8 flex flex-col gap-4">
            <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Opcional"
            />
          </div>
          <div className="px-8 pb-8 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Aceptar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
