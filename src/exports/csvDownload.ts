/**
 * Serialización CSV y descarga de archivos en el navegador.
 * Única fuente del patrón blob → object URL → click → revoke.
 */

export function neutralizeSpreadsheetFormula(value: string): string {
  const firstMeaningfulCharacter = value.trimStart().charAt(0);
  const startsWithControlPrefix = /^[\t\r]/.test(value);
  if (startsWithControlPrefix || ['=', '+', '-', '@'].includes(firstMeaningfulCharacter)) {
    return `'${value}`;
  }
  return value;
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const escapeCsv = (value: string) => {
    const safeValue = neutralizeSpreadsheetFormula(value);
    return `"${safeValue.replace(/"/g, '""')}"`;
  };
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCsv(headers: string[], rows: string[][], fileName: string): void {
  downloadTextFile(buildCsvContent(headers, rows), fileName, 'text/csv;charset=utf-8;');
}
