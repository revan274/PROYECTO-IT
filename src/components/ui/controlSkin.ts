/**
 * Pieles compartidas por los controles de formulario (Input, Select, TextArea).
 * Única fuente de verdad de clases; NO es un componente base ni una jerarquía.
 * El layout (w-full, flex-1, márgenes) es responsabilidad del consumidor.
 */

export type ControlVariant = 'form' | 'formMuted' | 'filter' | 'soft';

export const controlSkin: Record<ControlVariant, string> = {
  // Formulario glass sobre superficie blanca (AssetForm y afines)
  form: 'p-4 bg-white glass-input rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100',
  // Formulario glass gris; sin caso tipográfico (login/usuarios definen uppercase/lowercase según el dato)
  formMuted: 'p-4 bg-slate-50 glass-input rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-100',
  // Control compacto de barras de filtros (borde normalizado a slate-200)
  filter: 'px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase text-slate-600 disabled:opacity-50',
  // Formulario suave con estados de validación (InsumoForm); sin glass a propósito
  soft: 'p-5 rounded-2xl text-sm font-black uppercase outline-none',
};

/** Estados de superficie para la variante `soft` (y futuras validaciones). */
export const controlStateSkin = {
  normal: 'bg-slate-50 border border-slate-100',
  invalid: 'bg-red-50/40 border border-red-200 text-red-700 placeholder:text-red-300',
};
