import type { Activo } from '../../types/app';
import type { AssetRow } from './AssetsScreen';

/** Adapta un Activo del store a la fila de AssetsScreen (sin lógica de negocio). */
export function adaptActivoToRow(asset: Activo): AssetRow {
  return {
    id: asset.id,
    tag: String(asset.tag ?? ''),
    tipo: String(asset.tipo ?? ''),
    marca: String(asset.marca ?? ''),
    estado: String(asset.estado ?? ''),
    responsable: String(asset.responsable ?? ''),
    ubicacion: String(asset.ubicacion ?? ''),
    ipAddress: String(asset.ipAddress ?? ''),
  };
}

export function adaptActivosForScreen(activos: Activo[]): AssetRow[] {
  return activos.map(adaptActivoToRow);
}
