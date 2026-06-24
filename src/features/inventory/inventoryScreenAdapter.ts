import type { Insumo } from '../../types/app';
import type { SupplyRow, SupplyStatus } from './InventoryScreen';

type StatusResolver = (item: Insumo) => SupplyStatus;

/**
 * Adapta un Insumo del store a la fila de InventoryScreen.
 * Reutiliza el resolvedor de estado de salud existente (getSupplyHealthStatus),
 * sin duplicar reglas de stock mínimo.
 */
export function adaptInsumoToRow(item: Insumo, getStatus: StatusResolver): SupplyRow {
  return {
    id: item.id,
    nombre: String(item.nombre ?? ''),
    categoria: String(item.categoria ?? ''),
    unidad: String(item.unidad ?? ''),
    stock: Number(item.stock ?? 0),
    min: Number(item.min ?? 0),
    status: getStatus(item),
  };
}

export function adaptInsumosForScreen(insumos: Insumo[], getStatus: StatusResolver): SupplyRow[] {
  return insumos.map((item) => adaptInsumoToRow(item, getStatus));
}
