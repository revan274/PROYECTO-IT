import { useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-[#8CC63F]' : type === 'error' ? 'bg-red-500' : 'bg-[#F58220]';

  return (
    <div className={`fixed bottom-6 right-6 ${bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50`}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
      <span className="font-black text-xs uppercase tracking-wide">{message}</span>
    </div>
  );
}
