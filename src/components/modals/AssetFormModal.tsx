import React from 'react';
import { Save } from 'lucide-react';
import type { EstadoActivo, FormDataState } from '../../types/app';
import { ModalLayout } from './ModalLayout';

interface AssetFormModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
}

export function AssetFormModal({
  isOpen,
  title,
  submitLabel,
  formData,
  isSaving,
  canSubmit,
  onClose,
  onSubmit,
  onChange,
}: AssetFormModalProps) {
  return (
    <ModalLayout
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isBusy={isSaving}
      widthClassName="max-w-5xl"
    >
      <form onSubmit={onSubmit} className="p-10 space-y-4 max-h-[72vh] overflow-y-auto">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Datos Base</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Requeridos: Tag, Tipo, Marca, Serial, Ubicacion</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                required
                placeholder="TAG *"
                value={formData.tag || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ tag: e.target.value })}
              />
              <input
                placeholder="ID INTERNO"
                value={formData.idInterno || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ idInterno: e.target.value })}
              />
              <input
                required
                placeholder="SERIAL *"
                value={formData.serial || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ serial: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                required
                placeholder="TIPO *"
                value={formData.tipo || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ tipo: e.target.value })}
              />
              <input
                required
                placeholder="MARCA *"
                value={formData.marca || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ marca: e.target.value })}
              />
              <input
                placeholder="MODELO"
                value={formData.modelo || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ modelo: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicacion y Estado</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                required
                placeholder="UBICACION *"
                value={formData.ubicacion || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ ubicacion: e.target.value })}
              />
              <input
                placeholder="DEPARTAMENTO"
                value={formData.departamento || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ departamento: e.target.value })}
              />
              <input
                placeholder="RESPONSABLE"
                value={formData.responsable || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ responsable: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="date"
                value={formData.fechaCompra || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ fechaCompra: e.target.value })}
              />
              <select
                value={formData.estado || 'Operativo'}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ estado: e.target.value as EstadoActivo })}
              >
                <option value="Operativo">Operativo</option>
                <option value="Falla">Falla</option>
              </select>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Red y Acceso</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                placeholder="IP ADDRESS"
                value={formData.ipAddress || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ ipAddress: e.target.value })}
              />
              <input
                placeholder="MAC ADDRESS"
                value={formData.macAddress || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ macAddress: e.target.value })}
              />
              <input
                placeholder="ANYDESK"
                value={formData.anydesk || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ anydesk: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hardware y Ciclo de Vida</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                placeholder="CPU"
                value={formData.cpu || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ cpu: e.target.value })}
              />
              <input
                placeholder="RAM"
                value={formData.ram || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ ram: e.target.value })}
              />
              <input
                placeholder="TIPO RAM"
                value={formData.ramTipo || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ ramTipo: e.target.value })}
              />
              <input
                placeholder="DISCO"
                value={formData.disco || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ disco: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="TIPO DISCO"
                value={formData.tipoDisco || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ tipoDisco: e.target.value })}
              />
              <input
                placeholder="ANOS DE VIDA"
                value={formData.aniosVida || ''}
                className="p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100"
                onChange={(e) => onChange({ aniosVida: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
            <textarea
              placeholder="COMENTARIOS"
              value={formData.comentarios || ''}
              className="w-full p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase h-24 outline-none focus:ring-4 focus:ring-blue-100"
              onChange={(e) => onChange({ comentarios: e.target.value })}
            />
          </section>
        </div>

        <button
          disabled={!canSubmit}
          type="submit"
          className="w-full py-5 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl hover:opacity-90 mt-4 flex justify-center gap-2 disabled:opacity-50"
        >
          <Save size={18} /> {submitLabel}
        </button>
      </form>
    </ModalLayout>
  );
}

export default AssetFormModal;
