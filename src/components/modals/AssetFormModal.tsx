import React from 'react';
import { Save } from 'lucide-react';
import type { EstadoActivo, FormDataState } from '../../types/app';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
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
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Requeridos: Tag, Tipo, Marca, Serial, Ubicación</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                required
                placeholder="TAG *"
                value={formData.tag || ''}
                variant="form"
                onChange={(e) => onChange({ tag: e.target.value })}
              />
              <Input
                placeholder="ID INTERNO"
                value={formData.idInterno || ''}
                variant="form"
                onChange={(e) => onChange({ idInterno: e.target.value })}
              />
              <Input
                required
                placeholder="SERIAL *"
                value={formData.serial || ''}
                variant="form"
                onChange={(e) => onChange({ serial: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                required
                placeholder="TIPO *"
                value={formData.tipo || ''}
                variant="form"
                onChange={(e) => onChange({ tipo: e.target.value })}
              />
              <Input
                required
                placeholder="MARCA *"
                value={formData.marca || ''}
                variant="form"
                onChange={(e) => onChange({ marca: e.target.value })}
              />
              <Input
                placeholder="MODELO"
                value={formData.modelo || ''}
                variant="form"
                onChange={(e) => onChange({ modelo: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación y Estado</p>
            <div className="space-y-1">
              <Input
                placeholder="NOMBRE VISIBLE PARA SOLICITANTES (EJ. CAJA 1, IMPRESORA MOSTRADOR)"
                value={formData.nombreVisible || ''}
                variant="form" className="w-full"
                onChange={(e) => onChange({ nombreVisible: e.target.value })}
              />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                Es el nombre que verá el solicitante al levantar el ticket. Si lo dejas vacío se genera automático (ej. COMPUTADORA 1).
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                required
                placeholder="UBICACION *"
                value={formData.ubicacion || ''}
                variant="form"
                onChange={(e) => onChange({ ubicacion: e.target.value })}
              />
              <Input
                placeholder="DEPARTAMENTO"
                value={formData.departamento || ''}
                variant="form"
                onChange={(e) => onChange({ departamento: e.target.value })}
              />
              <Input
                placeholder="RESPONSABLE"
                value={formData.responsable || ''}
                variant="form"
                onChange={(e) => onChange({ responsable: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                value={formData.fechaCompra || ''}
                variant="form"
                onChange={(e) => onChange({ fechaCompra: e.target.value })}
              />
              <Select
                value={formData.estado || 'Operativo'}
                variant="form"
                onChange={(e) => onChange({ estado: e.target.value as EstadoActivo })}
              >
                <option value="Operativo">Operativo</option>
                <option value="Falla">Falla</option>
              </Select>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Red y Acceso</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="IP ADDRESS"
                value={formData.ipAddress || ''}
                variant="form"
                onChange={(e) => onChange({ ipAddress: e.target.value })}
              />
              <Input
                placeholder="MAC ADDRESS"
                value={formData.macAddress || ''}
                variant="form"
                onChange={(e) => onChange({ macAddress: e.target.value })}
              />
              <Input
                placeholder="ANYDESK"
                value={formData.anydesk || ''}
                variant="form"
                onChange={(e) => onChange({ anydesk: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hardware y Ciclo de Vida</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="CPU"
                value={formData.cpu || ''}
                variant="form"
                onChange={(e) => onChange({ cpu: e.target.value })}
              />
              <Input
                placeholder="RAM"
                value={formData.ram || ''}
                variant="form"
                onChange={(e) => onChange({ ram: e.target.value })}
              />
              <Input
                placeholder="TIPO RAM"
                value={formData.ramTipo || ''}
                variant="form"
                onChange={(e) => onChange({ ramTipo: e.target.value })}
              />
              <Input
                placeholder="DISCO"
                value={formData.disco || ''}
                variant="form"
                onChange={(e) => onChange({ disco: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="TIPO DISCO"
                value={formData.tipoDisco || ''}
                variant="form"
                onChange={(e) => onChange({ tipoDisco: e.target.value })}
              />
              <Input
                placeholder="ANOS DE VIDA"
                value={formData.aniosVida || ''}
                variant="form"
                onChange={(e) => onChange({ aniosVida: e.target.value })}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comentarios</p>
            <TextArea
              variant="form"
              className="w-full h-24"
              placeholder="COMENTARIOS"
              value={formData.comentarios || ''}
              onChange={(e) => onChange({ comentarios: e.target.value })}
            />
          </section>
        </div>

        <Button variant="primary" size="cta" className="mt-4" disabled={!canSubmit} type="submit">
          <Save size={18} /> {submitLabel}
        </Button>
      </form>
    </ModalLayout>
  );
}
