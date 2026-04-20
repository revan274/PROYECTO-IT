import React from 'react';
import { Save } from 'lucide-react';
import { SUPPLY_UNIT_OPTIONS } from '../../constants/app';
import type { FormDataState, InsumoErrors, InsumoField, InsumoTouchedState } from '../../types/app';
import { digitsOnly, preventInvalidIntegerInputKeys } from '../../utils/format';
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
        <div className="space-y-1">
          <input
            required
            autoFocus
            placeholder="NOMBRE"
            value={formData.nombre || ''}
            onBlur={() => onTouchField('nombre')}
            onChange={(e) => onChange({ nombre: e.target.value })}
            className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${
              insumoTouched.nombre && validationErrors.nombre
                ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                : 'bg-slate-50 border border-slate-100'
            }`}
          />
          {insumoTouched.nombre && validationErrors.nombre && (
            <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
              {validationErrors.nombre}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <input
            required
            placeholder="UNIDAD"
            value={formData.unidad || ''}
            onBlur={() => onTouchField('unidad')}
            onChange={(e) => onChange({ unidad: e.target.value })}
            list="supply-unit-options"
            className={`w-full p-5 rounded-2xl text-sm font-black uppercase outline-none ${
              insumoTouched.unidad && validationErrors.unidad
                ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                : 'bg-slate-50 border border-slate-100'
            }`}
          />
          <datalist id="supply-unit-options">
            {SUPPLY_UNIT_OPTIONS.map((unidad) => (
              <option key={unidad} value={unidad} />
            ))}
          </datalist>
          {insumoTouched.unidad && validationErrors.unidad && (
            <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
              {validationErrors.unidad}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <input
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
              className={`w-full p-5 rounded-2xl text-sm font-black outline-none ${
                insumoTouched.stock && validationErrors.stock
                  ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                  : 'bg-slate-50 border border-slate-100'
              }`}
            />
            {insumoTouched.stock && validationErrors.stock && (
              <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                {validationErrors.stock}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <input
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
              className={`w-full p-5 rounded-2xl text-sm font-black outline-none ${
                insumoTouched.min && validationErrors.min
                  ? 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300'
                  : 'bg-slate-50 border border-slate-100'
              }`}
            />
            {insumoTouched.min && validationErrors.min && (
              <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
                {validationErrors.min}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1">
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
            <option value="" disabled>Selecciona categoria...</option>
            {supplyCategoryOptions.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria}</option>
            ))}
          </select>
          {insumoTouched.categoria && validationErrors.categoria && (
            <p className="px-1 text-[10px] font-black uppercase tracking-wider text-red-500">
              {validationErrors.categoria}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-full py-5 border border-slate-200 text-slate-600 rounded-2xl font-black uppercase hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            disabled={!canSubmit}
            type="submit"
            className="w-full py-5 bg-[#F58220] text-white rounded-2xl font-black uppercase shadow-xl hover:opacity-90 flex justify-center gap-2 disabled:opacity-50"
          >
            <Save size={18} /> {submitLabel}
          </button>
        </div>
      </form>
    </ModalLayout>
  );
}

export default InsumoFormModal;
