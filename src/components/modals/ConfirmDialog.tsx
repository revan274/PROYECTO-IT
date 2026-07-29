import { useId } from 'react';
import { Button } from '../ui/Button';
import { ModalDialog } from '../ui/ModalDialog';

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
  const titleId = useId();
  const messageId = useId();

  return (
    <ModalDialog
      open
      onClose={onCancel}
      overlayClassName="z-[100]"
      className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div id={titleId} className="p-8 border-b border-slate-100 font-black uppercase text-sm text-slate-700">
        {title}
      </div>
      <div id={messageId} className="p-8 text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
        {message}
      </div>
      <div className="px-8 pb-8 flex gap-3 justify-end">
        <Button data-autofocus size="bare" className="px-5 py-2 rounded-xl text-sm normal-case" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="danger" size="bare" className="px-5 py-2 rounded-xl text-sm normal-case" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalDialog>
  );
}
