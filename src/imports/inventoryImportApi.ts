import type { ImportAssetsResponse, ImportDraftState } from '../types/app';
import { apiRequest } from '../utils/app';
import type { ParsedInventoryRow } from './inventoryWorkbook';

/**
 * Transforma filas parseadas al payload que espera el endpoint de importación.
 */
export function buildImportPayloadItems(parsedRows: ParsedInventoryRow[]): ImportDraftState['payloadItems'] {
  return parsedRows.map(({ rowNumber, item }) => ({ ...item, rowNumber }));
}

export interface InventoryImportRequestOptions {
  items: ImportDraftState['payloadItems'];
  fileName: string;
  dryRun: boolean;
  usuario: string;
  rol: string;
}

/**
 * Única llamada al endpoint /activos/import.
 * Con dryRun=true devuelve la vista previa (detección de conflictos en servidor);
 * con dryRun=false confirma la importación.
 */
export function requestInventoryImport(options: InventoryImportRequestOptions): Promise<ImportAssetsResponse> {
  return apiRequest<ImportAssetsResponse>('/activos/import', {
    method: 'POST',
    body: JSON.stringify({
      items: options.items,
      dryRun: options.dryRun,
      upsert: true,
      fileName: options.fileName,
      usuario: options.usuario,
      rol: options.rol,
    }),
  });
}
