import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ModalDialog } from '../ui/ModalDialog';

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
  const titleId = useId();
  const messageId = useId();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConfirm(value);
  };

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
      <form onSubmit={handleSubmit}>
        <div className="p-8 flex flex-col gap-4">
          <p id={messageId} className="text-slate-600 text-sm leading-relaxed">{message}</p>
          <Input
            data-autofocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl px-4 py-2 text-sm"
            placeholder="Opcional"
          />
        </div>
        <div className="px-8 pb-8 flex gap-3 justify-end">
          <Button size="bare" className="px-5 py-2 rounded-xl text-sm normal-case" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="bare" className="px-5 py-2 rounded-xl text-sm normal-case" type="submit">
            Aceptar
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
