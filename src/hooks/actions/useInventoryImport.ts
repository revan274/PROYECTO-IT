import { useCallback, type ChangeEvent } from 'react';
import { downloadImportIssuesCsv } from '../../exports/importIssuesCsv';
import { buildImportPayloadItems, requestInventoryImport } from '../../imports/inventoryImportApi';
import { parseInventoryWorkbook } from '../../imports/inventoryWorkbook';
import type { ImportDraftState, ToastType } from '../../types/app';
import { getApiErrorMessage } from '../../utils/format';

interface ImportSessionUser {
  nombre?: string;
  rol?: string;
}

export interface UseInventoryImportParams {
  isReadOnly: boolean;
  sessionUser: ImportSessionUser | null;
  importDraft: ImportDraftState | null;
  isApplyingImport: boolean;
  ensureBackendConnected: (actionLabel: string) => boolean;
  refreshData: (force: boolean) => Promise<unknown>;
  showToast: (message: string, type?: ToastType) => void;
  setImportDraft: (draft: ImportDraftState | null) => void;
  setIsApplyingImport: (value: boolean) => void;
  setIsImportingInventory: (value: boolean) => void;
}

/**
 * Orquesta el flujo de importación de inventario:
 * archivo → parseo/validación (inventoryWorkbook) → vista previa dry-run
 * (inventoryImportApi) → confirmación → refresco de datos.
 * Solo coordina estado y feedback; el trabajo pesado vive en src/imports/.
 */
export function useInventoryImport({
  isReadOnly,
  sessionUser,
  importDraft,
  isApplyingImport,
  ensureBackendConnected,
  refreshData,
  showToast,
  setImportDraft,
  setIsApplyingImport,
  setIsImportingInventory,
}: UseInventoryImportParams) {
  const handleImportInventory = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) {
      showToast('Tu rol no permite importar inventario', 'warning');
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ensureBackendConnected('Importar inventario')) return;

    setIsImportingInventory(true);
    setImportDraft(null);

    try {
      const parsed = await parseInventoryWorkbook(file);
      if (parsed.status === 'no-sheets') {
        showToast('El archivo no tiene hojas para importar', 'warning');
        return;
      }
      if (parsed.status === 'empty') {
        showToast('El archivo está vacío', 'warning');
        return;
      }
      if (parsed.parsedRows.length === 0) {
        showToast(
          parsed.invalidRowsCount > 0
            ? `No se importaron filas válidas. Inválidas: ${parsed.invalidRowsCount}`
            : 'No se encontraron equipos validos',
          'warning',
        );
        return;
      }

      const payloadItems = buildImportPayloadItems(parsed.parsedRows);
      const preview = await requestInventoryImport({
        items: payloadItems,
        fileName: file.name,
        dryRun: true,
        usuario: sessionUser?.nombre || 'Admin IT',
        rol: sessionUser?.rol || 'admin',
      });
      setImportDraft({
        fileName: file.name,
        payloadItems,
        preview,
        localInvalidDetails: parsed.localInvalidDetails,
      });
      const summary = [
        `Vista previa lista`,
        `nuevos: ${preview.created}`,
        `actualizados: ${preview.updated}`,
        `omitidos: ${preview.skipped}`,
        `inválidos: ${preview.invalid + parsed.invalidRowsCount}`,
      ];
      showToast(summary.join(' | '), preview.created + preview.updated > 0 ? 'success' : 'warning');
    } catch (error) {
      const message = getApiErrorMessage(error) || 'No se pudo leer/importar el archivo';
      showToast(message, 'error');
    } finally {
      setIsImportingInventory(false);
    }
  }, [ensureBackendConnected, isReadOnly, sessionUser, setImportDraft, setIsImportingInventory, showToast]);

  const exportImportIssuesCsv = useCallback(() => {
    if (!importDraft) return;

    const issues = [
      ...(importDraft.preview.details || []),
      ...importDraft.localInvalidDetails,
    ].filter((detail) => detail.status === 'invalid' || detail.status === 'skipped');

    if (issues.length === 0) {
      showToast('No hay incidencias para exportar', 'warning');
      return;
    }

    downloadImportIssuesCsv(issues);
  }, [importDraft, showToast]);

  const applyImportDraft = useCallback(async () => {
    if (!importDraft || isApplyingImport) return;
    const draft = importDraft;
    setIsApplyingImport(true);

    try {
      const result = await requestInventoryImport({
        items: draft.payloadItems,
        fileName: draft.fileName,
        dryRun: false,
        usuario: sessionUser?.nombre || 'Admin IT',
        rol: sessionUser?.rol || 'admin',
      });
      await refreshData(true);
      const invalidTotal = result.invalid + draft.localInvalidDetails.length;
      const parts = [
        `Creados: ${result.created}`,
        `actualizados: ${result.updated}`,
        `omitidos: ${result.skipped}`,
        `inválidos: ${invalidTotal}`,
      ];
      showToast(parts.join(' | '), invalidTotal > 0 ? 'warning' : 'success');
      setImportDraft(null);
    } catch (error) {
      const message = getApiErrorMessage(error) || 'No se pudo confirmar la importación';
      showToast(message, 'error');
    } finally {
      setIsApplyingImport(false);
    }
  }, [importDraft, isApplyingImport, refreshData, sessionUser, setImportDraft, setIsApplyingImport, showToast]);

  return {
    handleImportInventory,
    exportImportIssuesCsv,
    applyImportDraft,
  };
}
