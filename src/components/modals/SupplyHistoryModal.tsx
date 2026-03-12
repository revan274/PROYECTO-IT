import { X } from 'lucide-react';

interface SupplyHistoryItem {
  nombre: string;
  unidad?: string;
}

interface SupplyMovementRow {
  logId: number;
  insumoId: number;
  accion: string;
  cantidad: number;
  usuario: string;
  fecha: string;
  timestampMs: number;
}

interface SupplyHistoryModalProps {
  item: SupplyHistoryItem | null;
  movements: SupplyMovementRow[];
  formatDateTime: (value?: string) => string;
  onClose: () => void;
}

export function SupplyHistoryModal({
  item,
  movements,
  formatDateTime,
  onClose,
}: SupplyHistoryModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de movimientos</p>
            <h3 className="text-lg font-black uppercase text-slate-800">{item.nombre}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Registros: {movements.length} | Unidad: {item.unidad || 'Piezas'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-red-500"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-8 space-y-3 max-h-[68vh] overflow-y-auto">
          {movements.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-8 text-center">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Sin movimientos registrados para este insumo.
              </p>
            </div>
          ) : (
            movements.slice(0, 80).map((movement, index) => (
              <div
                key={`${movement.logId}-${movement.timestampMs}-${movement.insumoId}-${index}`}
                className="rounded-2xl border border-slate-100 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-black uppercase text-slate-700">
                    {movement.accion} {movement.cantidad > 0 ? `(${movement.cantidad})` : ''}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {movement.usuario}
                  </p>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {formatDateTime(movement.fecha)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
