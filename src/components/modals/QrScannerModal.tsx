import { ScanLine, X } from 'lucide-react';
import type { MutableRefObject } from 'react';

interface QrScannerModalProps {
  open: boolean;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  isScannerActive: boolean;
  isCameraSupported: boolean;
  scannerStatus: string;
  manualInput: string;
  isResolving: boolean;
  onClose: () => void;
  onManualInputChange: (value: string) => void;
  onResolve: () => void | Promise<void>;
  onClear: () => void;
}

export function QrScannerModal({
  open,
  videoRef,
  isScannerActive,
  isCameraSupported,
  scannerStatus,
  manualInput,
  isResolving,
  onClose,
  onManualInputChange,
  onResolve,
  onClear,
}: QrScannerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolución Segura QR</p>
            <h3 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2">
              <ScanLine size={18} /> Escanear Activo
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-red-500">
            <X size={22} />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Camara</p>
            <div className="aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-200">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isScannerActive
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {isScannerActive ? 'Camara activa' : 'Camara inactiva'}
              </span>
              {!isCameraSupported && (
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                  Sin soporte nativo de scanner
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500">{scannerStatus}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolución Manual</p>
            <textarea
              value={manualInput}
              onChange={(e) => onManualInputChange(e.target.value)}
              placeholder="Pega aquí mtiqr1..., mtiqr0... o JSON legacy del QR"
              className="w-full h-56 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono text-slate-700 outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isResolving || !manualInput.trim()}
                onClick={() => void onResolve()}
                className="px-5 py-3 rounded-2xl bg-[#F58220] text-white text-xs font-black uppercase disabled:opacity-50"
              >
                {isResolving ? 'Resolviendo...' : 'Resolver QR'}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Compatible con QR firmado (mtiqr1), QR local compacto (mtiqr0) y JSON legacy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
