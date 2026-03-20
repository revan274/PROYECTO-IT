import type { ReactNode } from 'react';
import { normalizeForCompare } from '../../utils/format';

interface BadgeProps {
  children: ReactNode;
  variant?: string;
}

export function Badge({ children, variant }: BadgeProps) {
  const styles: Record<string, string> = {
    critica: 'bg-orange-100 text-orange-700 border-orange-200',
    operativo: 'bg-[#f4fce3] text-[#4a7f10] border-[#d8f5a2]',
    falla: 'bg-red-50 text-red-700 border-red-100',
    abierto: 'bg-blue-50 text-blue-700 border-blue-100',
    'en proceso': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'en espera': 'bg-amber-50 text-amber-700 border-amber-100',
    resuelto: 'bg-green-50 text-green-700 border-green-100',
    cerrado: 'bg-slate-100 text-slate-600 border-slate-200',
    presencial: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    remoto: 'bg-violet-50 text-violet-700 border-violet-100',
    entrada: 'bg-green-50 text-green-700 border-green-100',
    salida: 'bg-amber-50 text-amber-700 border-amber-100',
    baja: 'bg-slate-100 text-slate-600 border-slate-300',
    'baja logica': 'bg-slate-100 text-slate-600 border-slate-300',
    'baja activo': 'bg-slate-100 text-slate-600 border-slate-300',
    'baja usuario': 'bg-slate-100 text-slate-600 border-slate-300',
    'alta activo': 'bg-green-50 text-green-700 border-green-100',
    'alta usuario': 'bg-green-50 text-green-700 border-green-100',
    'registro nuevo': 'bg-green-50 text-green-700 border-green-100',
    'nuevo ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'ticket creado': 'bg-blue-50 text-blue-700 border-blue-100',
    'ticket en proceso': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'ticket en espera': 'bg-amber-50 text-amber-700 border-amber-100',
    'ticket resuelto': 'bg-green-50 text-green-700 border-green-100',
    'ticket cerrado': 'bg-slate-100 text-slate-600 border-slate-300',
    'ticket eliminado': 'bg-red-50 text-red-700 border-red-100',
    'asignacion ticket': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'comentario ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'adjunto ticket': 'bg-blue-50 text-blue-700 border-blue-100',
    'catalogos actualizados': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'importacion activos': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'importacion inventario': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  };

  const key = normalizeForCompare(String(variant || 'default'));
  let style = styles[key];
  if (!style) {
    if (key.includes('baja')) style = 'bg-slate-100 text-slate-600 border-slate-300';
    else if (key.includes('error') || key.includes('elimin')) style = 'bg-red-50 text-red-700 border-red-100';
    else if (key.includes('entrada') || key.includes('alta') || key.includes('resuelto')) style = 'bg-green-50 text-green-700 border-green-100';
    else if (key.includes('salida') || key.includes('espera')) style = 'bg-amber-50 text-amber-700 border-amber-100';
    else if (key.includes('proceso') || key.includes('asign')) style = 'bg-indigo-50 text-indigo-700 border-indigo-100';
    else style = 'bg-slate-100 text-slate-700 border-slate-300';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${style}`}>
      {children}
    </span>
  );
}
