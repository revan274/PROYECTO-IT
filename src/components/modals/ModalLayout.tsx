import React, { useId } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { ModalDialog } from '../ui/ModalDialog';

interface ModalLayoutProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  isBusy?: boolean;
  widthClassName?: string;
  children: React.ReactNode;
}

export function ModalLayout({
  isOpen,
  title,
  onClose,
  isBusy = false,
  widthClassName = 'max-w-lg',
  children,
}: ModalLayoutProps) {
  const titleId = useId();

  return (
    <ModalDialog
      open={isOpen}
      onClose={onClose}
      isBusy={isBusy}
      aria-labelledby={titleId}
      className={`bg-white w-full ${widthClassName} rounded-[3rem] shadow-2xl overflow-hidden`}
    >
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 font-black uppercase text-sm">
          <span id={titleId}>{title}</span>
          <Button
            variant="close"
            size="bare"
            onClick={onClose}
            disabled={isBusy}
            aria-label={`Cerrar ${title}`}
          >
            <X size={24} />
          </Button>
        </div>
        {children}
    </ModalDialog>
  );
}

export default ModalLayout;
