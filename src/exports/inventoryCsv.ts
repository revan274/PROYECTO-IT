import type { Activo } from '../types/app';
import { downloadCsv } from './csvDownload';

/**
 * Exporta el inventario filtrado como CSV.
 * Recibe únicamente los activos ya filtrados; no depende de estado de UI.
 */
export function downloadInventoryCsv(activos: Activo[]): void {
  const headers = [
    'TAG',
    'SERIAL',
    'ID_INTERNO',
    'TIPO',
    'MARCA',
    'MODELO',
    'ESTADO',
    'RESPONSABLE',
    'DEPARTAMENTO',
    'UBICACION',
    'IP',
    'MAC',
    'CPU',
    'RAM',
    'DISCO',
    'ANIOS_VIDA',
    'COMENTARIOS',
  ];
  const rows = activos.map((asset) => [
    asset.tag,
    asset.serial,
    asset.idInterno || '',
    asset.tipo,
    asset.marca,
    asset.modelo || '',
    asset.estado,
    asset.responsable || '',
    asset.departamento || '',
    asset.ubicacion || '',
    asset.ipAddress || '',
    asset.macAddress || '',
    asset.cpu || '',
    asset.ram || '',
    asset.disco || '',
    asset.aniosVida || '',
    asset.comentarios || '',
  ]);
  downloadCsv(headers, rows, `inventario_filtrado_${new Date().toISOString().slice(0, 10)}.csv`);
}
