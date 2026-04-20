import React from 'react';
import { PlusCircle, Search, MinusCircle, History, Trash2 } from 'lucide-react';
import { InsumoFormModal } from '../modals/InsumoFormModal';
import { SupplyHistoryModal } from '../modals/SupplyHistoryModal';
import type { FormDataState, Insumo, InsumoErrors, InsumoField, InsumoTouchedState, SupplyAuditMovement } from '../../types/app';

type ModalType = 'activo' | 'insumo' | 'ticket';
type SupplyStatusFilter = 'TODOS' | 'AGOTADO' | 'BAJO' | 'OK';

interface SupplySummary {
  totalInsumos: number;
  bajoMinimo: number;
  agotados: number;
  totalUnidades: number;
}

interface InsumoFormModalConfig {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  insumoTouched: InsumoTouchedState;
  validationErrors: InsumoErrors;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
  onTouchField: (field: InsumoField) => void;
}

interface SuppliesViewProps {
  canEdit: boolean;
  openModal: (type: ModalType | string) => void;
  supplySummary: SupplySummary;
  supplySearchTerm: string;
  setSupplySearchTerm: React.Dispatch<React.SetStateAction<string>>;
  supplyCategoryFilter: string;
  setSupplyCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  supplyCategoryOptions: string[];
  supplyStatusFilter: SupplyStatusFilter;
  setSupplyStatusFilter: React.Dispatch<React.SetStateAction<SupplyStatusFilter>>;
  filteredSupplies: Insumo[];
  insumos: Insumo[];
  reponerCriticos: (amount: number) => Promise<void>;
  getSupplyHealthStatus: (item: Insumo) => 'AGOTADO' | 'BAJO' | 'OK';
  supplyAuditMovementsByInsumoId: Record<number, SupplyAuditMovement[]>;
  openInsumoEditModal: (insumo: Insumo) => void;
  eliminarInsumo: (id: number, e: React.MouseEvent) => void;
  formatDateTime: (dateString: string) => string;
  selectedSupplyHistoryItem: Insumo | null;
  setSelectedSupplyHistoryItem: React.Dispatch<React.SetStateAction<Insumo | null>>;
  selectedSupplyMovements: SupplyAuditMovement[];
  ajustarStock: (id: number, adjust: number) => void;
  supplyStockDrafts: Record<number, string>;
  setSupplyStockDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  confirmarStockManual: (id: number) => Promise<void>;
  insumoFormModal: InsumoFormModalConfig;
}

export const SuppliesView: React.FC<SuppliesViewProps> = ({
  canEdit,
  openModal,
  supplySummary,
  supplySearchTerm,
  setSupplySearchTerm,
  supplyCategoryFilter,
  setSupplyCategoryFilter,
  supplyCategoryOptions,
  supplyStatusFilter,
  setSupplyStatusFilter,
  filteredSupplies,
  insumos,
  reponerCriticos,
  getSupplyHealthStatus,
  supplyAuditMovementsByInsumoId,
  openInsumoEditModal,
  eliminarInsumo,
  formatDateTime,
  selectedSupplyHistoryItem,
  setSelectedSupplyHistoryItem,
  selectedSupplyMovements,
  ajustarStock,
  supplyStockDrafts,
  setSupplyStockDrafts,
  confirmarStockManual,
  insumoFormModal,
}) => {
  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <h3 className="font-black text-slate-800 uppercase text-xl">GestiÃ³n de Stock</h3>
          <button
            disabled={!canEdit}
            onClick={() => openModal('insumo')}
            className="bg-[#8CC63F] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
          >
            <PlusCircle size={18} /> Registrar Insumo
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Insumos</p>
            <p className="text-2xl font-black text-slate-800">{supplySummary.totalInsumos}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bajo MÃ­nimo</p>
            <p className="text-2xl font-black text-amber-500">{supplySummary.bajoMinimo}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Agotados</p>
            <p className="text-2xl font-black text-red-500">{supplySummary.agotados}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidades Totales</p>
            <p className="text-2xl font-black text-slate-800">{supplySummary.totalUnidades}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              value={supplySearchTerm}
              onChange={(e) => setSupplySearchTerm(e.target.value)}
              placeholder="Buscar insumo..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl glass-input  bg-white text-xs font-black uppercase text-slate-500 outline-none focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <select
            value={supplyCategoryFilter}
            onChange={(e) => setSupplyCategoryFilter(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
          >
            <option value="TODAS">Todas categorÃ­as</option>
            {supplyCategoryOptions.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={supplyStatusFilter}
              onChange={(e) => setSupplyStatusFilter(e.target.value as SupplyStatusFilter)}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-100 bg-white text-xs font-black uppercase text-slate-500"
            >
              <option value="TODOS">Todos</option>
              <option value="AGOTADO">Agotado</option>
              <option value="BAJO">Bajo</option>
              <option value="OK">OK</option>
            </select>
            <button
              onClick={() => {
                setSupplySearchTerm('');
                setSupplyCategoryFilter('TODAS');
                setSupplyStatusFilter('TODOS');
              }}
              className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Mostrando: {filteredSupplies.length} / {insumos.length}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Orden: Agotado &gt; Bajo &gt; OK
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSupplyStatusFilter('AGOTADO')}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
              supplyStatusFilter === 'AGOTADO'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
            }`}
          >
            Ver agotados ({supplySummary.agotados})
          </button>
          <button
            onClick={() => setSupplyStatusFilter('BAJO')}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
              supplyStatusFilter === 'BAJO'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
            }`}
          >
            Ver bajo mÃ­nimo ({supplySummary.bajoMinimo})
          </button>
          <button
            onClick={() => setSupplyStatusFilter('TODOS')}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
              supplyStatusFilter === 'TODOS'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Ver todos
          </button>
          <button
            disabled={!canEdit}
            onClick={() => void reponerCriticos(5)}
            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border bg-[#f4fce3] text-[#5e8f1d] border-[#d8f5a2] hover:bg-[#e8f9c8] disabled:opacity-50"
          >
            Reponer crÃ­ticos +5
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredSupplies.map((item) => {
            const supplyStatus = getSupplyHealthStatus(item);
            const isLow = supplyStatus === 'BAJO' || supplyStatus === 'AGOTADO';
            const progress =
              item.min > 0
                ? Math.max(0, Math.min(100, Math.round((item.stock / item.min) * 100)))
                : item.stock > 0
                  ? 100
                  : 0;
            const statusTone =
              supplyStatus === 'AGOTADO'
                ? 'text-red-500'
                : supplyStatus === 'BAJO'
                  ? 'text-amber-500'
                  : 'text-slate-800';
            const supplyMovements = supplyAuditMovementsByInsumoId[item.id] || [];
            const latestMovement = supplyMovements[0];

            return (
              <div
                key={item.id}
                className={`bg-white p-8 rounded-[2.5rem] border ${isLow ? 'border-red-100 ring-2 ring-red-50' : 'border-slate-100'} shadow-xl relative`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {item.categoria}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!canEdit}
                      onClick={() => openInsumoEditModal(item)}
                      className="px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                      title="Editar insumo"
                    >
                      Editar
                    </button>
                    <button
                      disabled={!canEdit}
                      onClick={(e) => eliminarInsumo(item.id, e)}
                      className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
                      title="Eliminar insumo"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <h4 className="font-black text-slate-800 uppercase text-sm mb-4 h-10">{item.nombre}</h4>
                <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Ãšltimo movimiento
                  </p>
                  {latestMovement ? (
                    <>
                      <p className="mt-1 text-[11px] font-black uppercase text-slate-700">
                        {latestMovement.accion} {latestMovement.cantidad > 0 ? `(${latestMovement.cantidad})` : ''}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {latestMovement.usuario} | {formatDateTime(latestMovement.fecha)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Sin movimientos registrados
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedSupplyHistoryItem(item)}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#F58220] hover:text-orange-600"
                  >
                    <History size={12} /> Historial ({supplyMovements.length})
                  </button>
                </div>

                <div className="mb-3">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      supplyStatus === 'AGOTADO'
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : supplyStatus === 'BAJO'
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-green-50 text-green-600 border-green-200'
                    }`}
                  >
                    {supplyStatus}
                  </span>
                </div>

                <div className="mb-6">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${supplyStatus === 'AGOTADO' ? 'bg-red-500' : supplyStatus === 'BAJO' ? 'bg-amber-500' : 'bg-[#8CC63F]'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cobertura mÃ­n: {progress}% | Estado: {supplyStatus}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3 mb-2 h-16">
                  <button
                    disabled={!canEdit}
                    onClick={() => ajustarStock(item.id, -1)}
                    title="Reducir stock (-1)"
                    className="w-12 h-12 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all border border-red-100 shadow-sm disabled:opacity-40"
                  >
                    <MinusCircle size={24} />
                  </button>

                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      disabled={!canEdit}
                      className={`w-24 text-center text-4xl font-black bg-transparent outline-none ${statusTone}`}
                      value={supplyStockDrafts[item.id] ?? String(item.stock)}
                      onChange={(e) =>
                        setSupplyStockDrafts((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      onBlur={() => void confirmarStockManual(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === 'Escape') {
                          setSupplyStockDrafts((prev) => {
                            if (!(item.id in prev)) return prev;
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <span className="text-[10px] font-black text-slate-400 uppercase -mt-1">
                      MÃ­n: {item.min} | Unidad: {item.unidad || 'Piezas'}
                    </span>
                  </div>

                  <button
                    disabled={!canEdit}
                    onClick={() => ajustarStock(item.id, 1)}
                    title="Incrementar stock (+1)"
                    className="w-12 h-12 flex items-center justify-center bg-[#f4fce3] hover:bg-[#e8f9c8] text-[#5e8f1d] rounded-xl transition-all border border-[#d8f5a2] shadow-sm disabled:opacity-40"
                  >
                    <PlusCircle size={24} />
                  </button>
                </div>

                <div className="flex justify-center gap-2">
                  <button
                    disabled={!canEdit}
                    onClick={() => ajustarStock(item.id, -5)}
                    className="px-3 py-1 rounded-lg border border-red-100 bg-red-50 text-red-600 text-[10px] font-black uppercase disabled:opacity-40"
                    title="Reducir stock (-5)"
                  >
                    -5
                  </button>
                  <button
                    disabled={!canEdit}
                    onClick={() => ajustarStock(item.id, 5)}
                    className="px-3 py-1 rounded-lg border border-lime-100 bg-[#f4fce3] text-[#5e8f1d] text-[10px] font-black uppercase disabled:opacity-40"
                    title="Incrementar stock (+5)"
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSupplies.length === 0 && (
          <div className="bg-white border border-slate-100 rounded-[2rem] p-8 text-center text-slate-400 text-xs font-black uppercase tracking-wider">
            No hay insumos con los filtros actuales.
          </div>
        )}
      </div>

      <InsumoFormModal
        isOpen={insumoFormModal.isOpen}
        title={insumoFormModal.title}
        submitLabel={insumoFormModal.submitLabel}
        formData={insumoFormModal.formData}
        isSaving={insumoFormModal.isSaving}
        canSubmit={insumoFormModal.canSubmit}
        insumoTouched={insumoFormModal.insumoTouched}
        validationErrors={insumoFormModal.validationErrors}
        supplyCategoryOptions={supplyCategoryOptions}
        onClose={insumoFormModal.onClose}
        onSubmit={insumoFormModal.onSubmit}
        onChange={insumoFormModal.onChange}
        onTouchField={insumoFormModal.onTouchField}
      />
      <SupplyHistoryModal
        item={selectedSupplyHistoryItem}
        movements={selectedSupplyMovements}
        formatDateTime={formatDateTime}
        onClose={() => setSelectedSupplyHistoryItem(null)}
      />
    </>
  );
};

export default SuppliesView;
