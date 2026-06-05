import { useCallback, useMemo } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type {
  Activo,
  ImportAssetDetail,
  ImportAssetsResponse,
  ImportDraftState,
  ToastType,
  UserSession,
} from '../types/app';
import { apiRequest } from '../utils/app';
import { getApiErrorMessage, normalizeForCompare } from '../utils/format';
import { parseInventoryRow } from '../utils/appHelpers';
import {
  enrichAssetsWithNetworkSheet,
  parseNetworkSheetRows,
  spreadsheetCellToText,
} from '../utils/assets';

type SpreadsheetRow = Record<string, unknown>;
type NetworkSheetRow = unknown[];

interface UseInventoryImportParams {
  isReadOnly: boolean;
  ensureBackendConnected: (action?: string) => boolean;
  sessionUser: UserSession | null;
  importDraft: ImportDraftState | null;
  isApplyingImport: boolean;
  refreshData: (options?: boolean | { silent?: boolean; force?: boolean }) => Promise<void>;
  setIsImportingInventory: Dispatch<SetStateAction<boolean>>;
  setImportDraft: Dispatch<SetStateAction<ImportDraftState | null>>;
  setIsApplyingImport: Dispatch<SetStateAction<boolean>>;
  showToast: (message: string, type?: ToastType) => void;
}

/**
 * Encapsula la importación de inventario desde Excel (vista previa + confirmación)
 * y la exportación CSV de incidencias. Extraído de App.tsx sin cambios de comportamiento.
 */
export function useInventoryImport({
  isReadOnly,
  ensureBackendConnected,
  sessionUser,
  importDraft,
  isApplyingImport,
  refreshData,
  setIsImportingInventory,
  setImportDraft,
  setIsApplyingImport,
  showToast,
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
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        showToast('El archivo no tiene hojas para importar', 'warning');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: '' });
      if (rows.length === 0) {
        showToast('El archivo está vacío', 'warning');
        return;
      }

      let parsedRows: Array<{ rowNumber: number; item: Omit<Activo, 'id'> }> = [];
      let invalidRows = 0;
      const localInvalidDetails: ImportAssetDetail[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const item = parseInventoryRow(row, rowNumber);
        if (!item) {
          invalidRows += 1;
          localInvalidDetails.push({
            rowNumber,
            status: 'invalid',
            reason: 'Fila inválida o sin identificador utilizable.',
          });
          return;
        }
        parsedRows.push({ rowNumber, item });
      });

      const candidateSheetNames = workbook.SheetNames.slice(1);
      const sheetByName = candidateSheetNames.find((name) => {
        const normalized = normalizeForCompare(name);
        return normalized.includes('hoja2') || normalized.includes('red') || normalized.includes('network');
      });
      const sheetByHeader = candidateSheetNames.find((name) => {
        const sheet = workbook.Sheets[name];
        if (!sheet) return false;
        const rows = XLSX.utils.sheet_to_json<NetworkSheetRow>(sheet, { header: 1, defval: '' });
        const header = Array.isArray(rows[0]) ? rows[0] : [];
        const normalizedHeader = header.map((cell) => normalizeForCompare(spreadsheetCellToText(cell))).join(' ');
        return normalizedHeader.includes('mac') && normalizedHeader.includes('ip');
      });
      const secondSheetName = sheetByName || sheetByHeader;
      if (secondSheetName) {
        const secondSheet = workbook.Sheets[secondSheetName];
        const secondRows = XLSX.utils.sheet_to_json<NetworkSheetRow>(secondSheet, { header: 1, defval: '' });
        const networkRows = parseNetworkSheetRows(secondRows);
        parsedRows = enrichAssetsWithNetworkSheet(parsedRows, networkRows);
      }

      if (parsedRows.length === 0) {
        showToast(
          invalidRows > 0
            ? `No se importaron filas válidas. Inválidas: ${invalidRows}`
            : 'No se encontraron equipos validos',
          'warning',
        );
        return;
      }

      const payloadItems = parsedRows.map(({ rowNumber, item }) => ({ ...item, rowNumber }));
      const preview = await apiRequest<ImportAssetsResponse>('/activos/import', {
        method: 'POST',
        body: JSON.stringify({
          items: payloadItems,
          dryRun: true,
          upsert: true,
          fileName: file.name,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
      });
      setImportDraft({
        fileName: file.name,
        payloadItems,
        preview,
        localInvalidDetails,
      });
      const summary = [
        `Vista previa lista`,
        `nuevos: ${preview.created}`,
        `actualizados: ${preview.updated}`,
        `omitidos: ${preview.skipped}`,
        `inválidos: ${preview.invalid + invalidRows}`,
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

    const headers = ['Fila', 'Estado', 'TAG', 'Motivo'];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = issues.map((issue) => [
      String(issue.rowNumber || ''),
      issue.status || '',
      issue.tag || '',
      issue.reason || '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import_issues_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [importDraft, showToast]);

  const applyImportDraft = useCallback(async () => {
    if (!importDraft || isApplyingImport) return;
    const draft = importDraft;
    setIsApplyingImport(true);

    try {
      const result = await apiRequest<ImportAssetsResponse>('/activos/import', {
        method: 'POST',
        body: JSON.stringify({
          items: draft.payloadItems,
          dryRun: false,
          upsert: true,
          fileName: draft.fileName,
          usuario: sessionUser?.nombre || 'Admin IT',
          rol: sessionUser?.rol || 'admin',
        }),
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

  const importIssueRows = useMemo(
    () =>
      importDraft
        ? [...(importDraft.preview.details || []), ...importDraft.localInvalidDetails].filter(
          (detail) => detail.status === 'invalid' || detail.status === 'skipped',
        )
        : [],
    [importDraft],
  );

  return { handleImportInventory, exportImportIssuesCsv, applyImportDraft, importIssueRows };
}
