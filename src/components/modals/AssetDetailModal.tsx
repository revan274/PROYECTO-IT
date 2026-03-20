import { Download, Pencil, Printer, QrCode, Trash2, X } from 'lucide-react';
import { Suspense } from 'react';
import type { ComponentType, MouseEvent } from 'react';
import { Badge } from '../ui/Badge';

interface AssetDetail {
  id: number;
  tag: string;
  tipo: string;
  marca: string;
  modelo?: string;
  estado: 'Operativo' | 'Falla';
  fechaCompra: string;
  serial?: string;
  idInterno?: string;
  equipo?: string;
  ubicacion?: string;
  departamento?: string;
  responsable?: string;
  ipAddress?: string;
  macAddress?: string;
  anydesk?: string;
  passwordRemota?: string;
  cpu?: string;
  ram?: string;
  ramTipo?: string;
  disco?: string;
  tipoDisco?: string;
  aniosVida?: string;
  comentarios?: string;
}

interface LazyQrCanvasLikeProps {
  id: string;
  value: string;
  size: number;
  includeMargin: boolean;
  level: 'L' | 'M' | 'Q' | 'H';
  bgColor: string;
  fgColor: string;
}

interface SessionUserLike {
  rol?: string;
}

interface AssetDetailModalProps {
  asset: AssetDetail | null;
  sessionUser: SessionUserLike | null;
  canEdit: boolean;
  selectedAssetQrLoading: boolean;
  selectedAssetQrMode: 'signed' | 'local' | 'legacy';
  selectedAssetQrIssuedAt: string | null;
  effectiveSelectedAssetQrValue: string;
  LazyQRCodeCanvas: ComponentType<LazyQrCanvasLikeProps>;
  buildAssetQrCanvasId: (assetId: number) => string;
  formatDateTime: (value?: string) => string;
  onClose: () => void;
  onEdit: () => void;
  onDownloadQr: () => void;
  onPrintQr: () => void;
  onDeleteAsset: (assetId: number, event: MouseEvent<HTMLButtonElement>) => Promise<boolean>;
}

export function AssetDetailModal({
  asset,
  sessionUser,
  canEdit,
  selectedAssetQrLoading,
  selectedAssetQrMode,
  selectedAssetQrIssuedAt,
  effectiveSelectedAssetQrValue,
  LazyQRCodeCanvas,
  buildAssetQrCanvasId,
  formatDateTime,
  onClose,
  onEdit,
  onDownloadQr,
  onPrintQr,
  onDeleteAsset,
}: AssetDetailModalProps) {
  if (!asset) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[86vh] flex flex-col">
        <div className="bg-slate-800 text-white p-8 md:p-10 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black uppercase leading-none">{asset.tag}</h2>
            <p className="opacity-70 font-bold mt-2 uppercase text-sm">
              {asset.tipo} | {asset.marca}
              {asset.modelo ? ` | ${asset.modelo}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={asset.estado}>{asset.estado}</Badge>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider border-white/20 bg-white/10">
                Compra: {asset.fechaCompra || 'N/D'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full">
            <X />
          </button>
        </div>

        <div className="p-8 md:p-10 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-slate-800">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificacion</p>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Serial</p>
                <p className="font-black">{asset.serial || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">ID Interno</p>
                <p className="font-black">{asset.idInterno || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Equipo</p>
                <p className="font-black">{asset.equipo || asset.tipo || 'N/D'}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicacion y Responsable</p>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Ubicacion</p>
                <p className="font-black">{asset.ubicacion || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Departamento</p>
                <p className="font-black">{asset.departamento || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Responsable</p>
                <p className="font-black">{asset.responsable || 'N/D'}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Red y Acceso</p>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">IP</p>
                <p className="font-black">{asset.ipAddress || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">MAC</p>
                <p className="font-black">{asset.macAddress || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Anydesk</p>
                <p className="font-black">{asset.anydesk || 'N/D'}</p>
              </div>
              {sessionUser?.rol === 'admin' && (
                <div className="text-sm">
                  <p className="font-black text-amber-600 uppercase">Password Remota</p>
                  <p className="font-black text-amber-700">{asset.passwordRemota || 'N/D'}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hardware</p>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">CPU</p>
                <p className="font-black">{asset.cpu || 'N/D'}</p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">RAM</p>
                <p className="font-black">
                  {asset.ram || 'N/D'}
                  {asset.ramTipo ? ` ${asset.ramTipo}` : ''}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Disco</p>
                <p className="font-black">
                  {asset.disco || 'N/D'}
                  {asset.tipoDisco ? ` ${asset.tipoDisco}` : ''}
                </p>
              </div>
              <div className="text-sm">
                <p className="font-black text-slate-500 uppercase">Anios de Vida</p>
                <p className="font-black">{asset.aniosVida || 'N/D'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Comentarios</p>
            <p className="text-sm font-semibold text-slate-600">{asset.comentarios || 'Sin comentarios.'}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-fit rounded-2xl bg-white border border-slate-200 p-3 shadow-sm mx-auto lg:mx-0">
                <Suspense fallback={<div className="w-[220px] h-[220px] grid place-items-center text-[10px] font-black uppercase tracking-wider text-slate-400">Generando QR...</div>}>
                  <LazyQRCodeCanvas
                    id={buildAssetQrCanvasId(asset.id)}
                    value={effectiveSelectedAssetQrValue}
                    size={220}
                    includeMargin
                    level="L"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </Suspense>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Codigo QR del Activo</p>
                  <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                    <QrCode size={16} /> {asset.tag}
                  </h4>
                  <span className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    selectedAssetQrLoading
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : selectedAssetQrMode === 'signed'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedAssetQrLoading
                      ? 'Firmando QR...'
                      : selectedAssetQrMode === 'signed'
                        ? 'QR Firmado (HMAC)'
                        : 'QR Local (sin firma)'}
                  </span>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {selectedAssetQrMode === 'signed'
                      ? 'El QR contiene un token firmado por backend. No expone detalles sensibles en claro.'
                      : 'Modo fallback local: token compacto sin firma (mtiqr0). Usa backend online para firma segura.'}
                  </p>
                  {selectedAssetQrMode === 'signed' && selectedAssetQrIssuedAt && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      Firmado: {formatDateTime(selectedAssetQrIssuedAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={selectedAssetQrLoading}
                    onClick={onDownloadQr}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download size={14} /> Descargar QR
                  </button>
                  <button
                    type="button"
                    disabled={selectedAssetQrLoading}
                    onClick={onPrintQr}
                    className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-black uppercase text-blue-700 hover:bg-blue-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Printer size={14} /> Imprimir Etiqueta
                  </button>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  Formato sugerido para Zebra GK420t: 55 x 35 mm.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              disabled={!canEdit}
              onClick={onEdit}
              className="w-full py-4 border-2 border-blue-100 text-blue-600 font-black uppercase rounded-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Pencil size={16} /> Editar Activo
            </button>
            <button
              disabled={!canEdit}
              onClick={async (e) => {
                const removed = await onDeleteAsset(asset.id, e);
                if (removed) onClose();
              }}
              className="w-full py-4 border-2 border-red-100 text-red-500 font-black uppercase rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={16} /> Dar de baja definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
