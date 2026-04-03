import type { Activo, AssetQrResolveResponse, EstadoActivo } from '../types/app';

export function buildAssetQrCanvasId(assetId: number): string {
  return `asset-qr-${assetId}`;
}

export function extractSignedQrToken(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const tokenPattern = /mtiqr1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  const direct = raw.match(tokenPattern);
  if (direct) return direct[0];

  try {
    const url = new URL(raw);
    const tokenFromQuery = String(url.searchParams.get('token') || '').trim();
    if (tokenFromQuery && tokenPattern.test(tokenFromQuery)) return tokenFromQuery;
    const fromPath = decodeURIComponent(url.pathname).match(tokenPattern);
    if (fromPath) return fromPath[0];
  } catch {
    return '';
  }

  return '';
}

export function toActivoFromQrLookup(lookup: AssetQrResolveResponse['asset'] | Record<string, unknown>): Activo | null {
  if (!lookup || typeof lookup !== 'object') return null;
  const id = Number((lookup as { id?: unknown }).id);
  const tag = String((lookup as { tag?: unknown }).tag || '').trim().toUpperCase();
  const tipo = String((lookup as { tipo?: unknown }).tipo || '').trim().toUpperCase() || 'EQUIPO';
  const marca = String((lookup as { marca?: unknown }).marca || '').trim() || 'SIN MARCA';
  const serial = String((lookup as { serial?: unknown }).serial || '').trim().toUpperCase();
  const estadoRaw = String((lookup as { estado?: unknown }).estado || '').trim().toLowerCase();
  const estado: EstadoActivo = estadoRaw.includes('falla') ? 'Falla' : 'Operativo';
  const ubicacion = String((lookup as { ubicacion?: unknown }).ubicacion || '').trim() || 'SIN UBICACION';
  const responsable = String((lookup as { responsable?: unknown }).responsable || '').trim();
  const departamento = String((lookup as { departamento?: unknown }).departamento || '').trim().toUpperCase();
  const modelo = String((lookup as { modelo?: unknown }).modelo || '').trim();
  if (!Number.isFinite(id) || id <= 0 || !tag) return null;

  return {
    id: Math.trunc(id),
    tag,
    tipo,
    marca,
    modelo,
    ubicacion,
    estado,
    serial: serial || `${tag}-SN`,
    fechaCompra: '',
    responsable,
    departamento,
  };
}
