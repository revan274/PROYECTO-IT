import { X } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../ui/Button';
import { ModalDialog } from '../ui/ModalDialog';

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
  const titleId = useId();
  if (!item) return null;

  return (
    <ModalDialog
      open={Boolean(item)}
      onClose={onClose}
      aria-labelledby={titleId}
      className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden"
    >
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de movimientos</p>
            <h3 id={titleId} className="text-lg font-black uppercase text-slate-800">{item.nombre}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              Registros: {movements.length} | Unidad: {item.unidad || 'Piezas'}
            </p>
          </div>
          <Button variant="close" size="bare" onClick={onClose} aria-label="Cerrar historial de insumo">
            <X size={22} />
          </Button>
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
    </ModalDialog>
  );
}
