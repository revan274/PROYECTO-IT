import type { Activo, ImportAssetDetail } from '../types/app';
import { parseInventoryRow } from '../utils/appHelpers';
import {
  enrichAssetsWithNetworkSheet,
  parseNetworkSheetRows,
  spreadsheetCellToText,
} from '../utils/assets';
import { normalizeForCompare } from '../utils/format';

type SpreadsheetRow = Record<string, unknown>;
type NetworkSheetRow = unknown[];
type XlsxModule = typeof import('xlsx');
type Workbook = import('xlsx').WorkBook;

export interface ParsedInventoryRow {
  rowNumber: number;
  item: Omit<Activo, 'id'>;
}

export type InventoryWorkbookResult =
  | { status: 'no-sheets' }
  | { status: 'empty' }
  | {
    status: 'parsed';
    parsedRows: ParsedInventoryRow[];
    invalidRowsCount: number;
    localInvalidDetails: ImportAssetDetail[];
  };

/**
 * Hoja secundaria de red: por nombre (hoja2/red/network) o por encabezado (MAC + IP).
 */
function findNetworkSheetName(XLSX: XlsxModule, workbook: Workbook): string | undefined {
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
  return sheetByName || sheetByHeader;
}

/**
 * Lee y valida un workbook de inventario: hoja principal → filas de activos,
 * hoja de red opcional → enriquecimiento MAC/IP.
 * Función pura respecto a React: recibe un File, devuelve un resultado tipado.
 */
export async function parseInventoryWorkbook(file: File): Promise<InventoryWorkbookResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { status: 'no-sheets' };

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: '' });
  if (rows.length === 0) return { status: 'empty' };

  let parsedRows: ParsedInventoryRow[] = [];
  const localInvalidDetails: ImportAssetDetail[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const item = parseInventoryRow(row, rowNumber);
    if (!item) {
      localInvalidDetails.push({
        rowNumber,
        status: 'invalid',
        reason: 'Fila inválida o sin identificador utilizable.',
      });
      return;
    }
    parsedRows.push({ rowNumber, item });
  });

  const networkSheetName = findNetworkSheetName(XLSX, workbook);
  if (networkSheetName) {
    const secondSheet = workbook.Sheets[networkSheetName];
    const secondRows = XLSX.utils.sheet_to_json<NetworkSheetRow>(secondSheet, { header: 1, defval: '' });
    const networkRows = parseNetworkSheetRows(secondRows);
    parsedRows = enrichAssetsWithNetworkSheet(parsedRows, networkRows);
  }

  return {
    status: 'parsed',
    parsedRows,
    invalidRowsCount: localInvalidDetails.length,
    localInvalidDetails,
  };
}
