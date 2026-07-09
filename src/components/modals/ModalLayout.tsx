import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className={`bg-white w-full ${widthClassName} rounded-[3rem] shadow-2xl overflow-hidden`}>
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 font-black uppercase text-sm">
          {title}
          <Button variant="close" size="bare" onClick={onClose} disabled={isBusy}>
            <X size={24} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

