import React from 'react';
import { Save } from 'lucide-react';
import { SUPPLY_UNIT_OPTIONS } from '../../constants/app';
import type { FormDataState, InsumoErrors, InsumoField, InsumoTouchedState } from '../../types/app';
import { digitsOnly, preventInvalidIntegerInputKeys } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Input } from '../ui/Input';
import { ModalLayout } from './ModalLayout';

interface InsumoFormModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  formData: FormDataState;
  isSaving: boolean;
  canSubmit: boolean;
  insumoTouched: InsumoTouchedState;
  validationErrors: InsumoErrors;
  supplyCategoryOptions: string[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onChange: (updates: Partial<FormDataState>) => void;
  onTouchField: (field: InsumoField) => void;
}

export function InsumoFormModal({
  isOpen,
  title,
  submitLabel,
  formData,
  isSaving,
  canSubmit,
  insumoTouched,
  validationErrors,
  supplyCategoryOptions,
  onClose,
  onSubmit,
  onChange,
  onTouchField,
}: InsumoFormModalProps) {
  return (
    <ModalLayout isOpen={isOpen} title={title} onClose={onClose} isBusy={isSaving}>
      <form onSubmit={onSubmit} className="p-10 space-y-4 max-h-[72vh] overflow-y-auto">
        <Field error={insumoTouched.nombre ? validationErrors.nombre : null}>
          <Input
            variant="soft"
            className="w-full"
            invalid={Boolean(insumoTouched.nombre && validationErrors.nombre)}
            required
            autoFocus
            placeholder="NOMBRE"
            value={formData.nombre || ''}
            onBlur={() => onTouchField('nombre')}
            onChange={(e) => onChange({ nombre: e.target.value })}
          />
        </Field>
        <Field error={insumoTouched.unidad ? validationErrors.unidad : null}>
          <>
            <Input
              variant="soft"
              className="w-full"
              invalid={Boolean(insumoTouched.unidad && validationErrors.unidad)}
              required
              placeholder="UNIDAD"
              value={formData.unidad || ''}
              onBlur={() => onTouchField('unidad')}
              onChange={(e) => onChange({ unidad: e.target.value })}
              list="supply-unit-options"
            />
            <datalist id="supply-unit-options">
              {SUPPLY_UNIT_OPTIONS.map((unidad) => (
                <option key={unidad} value={unidad} />
              ))}
            </datalist>
          </>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field error={insumoTouched.stock ? validationErrors.stock : null}>
            <Input
              variant="soft"
              className="w-full"
              invalid={Boolean(insumoTouched.stock && validationErrors.stock)}
              required
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="STOCK"
              value={String(formData.stock ?? '')}
              onBlur={() => onTouchField('stock')}
              onKeyDown={preventInvalidIntegerInputKeys}
              onChange={(e) => onChange({ stock: digitsOnly(e.target.value) })}
            />
          </Field>
          <Field error={insumoTouched.min ? validationErrors.min : null}>
            <Input
              variant="soft"
              className="w-full"
              invalid={Boolean(insumoTouched.min && validationErrors.min)}
              required
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="MINIMO"
              value={String(formData.min ?? '')}
              onBlur={() => onTouchField('min')}
              onKeyDown={preventInvalidIntegerInputKeys}
              onChange={(e) => onChange({ min: digitsOnly(e.target.value) })}
            />
          </Field>
        </div>
        <Field error={insumoTouched.categoria ? validationErrors.categoria : null}>
          <select
            required
            value={formData.categoria || ''}
            onBlur={() => onTouchField('categoria')}
            onChange={(e) => onChange({ categoria: e.target.value.toUpperCase() })}
            className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${
              insumoTouched.categoria && validationErrors.categoria
                ? 'bg-red-50/40 border border-red-200 text-red-700'
                : 'bg-slate-50 border border-slate-100 text-slate-700'
            }`}
          >
            <option value="" disabled>Selecciona categoría...</option>
            {supplyCategoryOptions.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
        </Field>
        <div className="space-y-1">
          <input
            placeholder="UBICACION (Opcional)"
            value={formData.ubicacionInsumo || ''}
            onBlur={() => onTouchField('ubicacion')}
            onChange={(e) => onChange({ ubicacionInsumo: e.target.value })}
            className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none bg-slate-50 border border-slate-100 ${
              insumoTouched.ubicacion && validationErrors.ubicacion
                ? 'border-red-200 text-red-700 placeholder:text-red-300'
                : ''
            }`}
          />
        </div>
        <div className="space-y-1">
          <input
            placeholder="PROVEEDOR / MARCA (Opcional)"
            value={formData.proveedor || ''}
            onBlur={() => onTouchField('proveedor')}
            onChange={(e) => onChange({ proveedor: e.target.value })}
            className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none bg-slate-50 border border-slate-100 ${
              insumoTouched.proveedor && validationErrors.proveedor
                ? 'border-red-200 text-red-700 placeholder:text-red-300'
                : ''
            }`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Button size="bare" className="w-full py-5 rounded-2xl" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button variant="primary" size="cta" disabled={!canSubmit} type="submit">
            <Save size={18} /> {submitLabel}
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
}

