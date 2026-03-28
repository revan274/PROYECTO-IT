import type { Activo, AssetQrResolveResponse, EstadoActivo } from '../types/app';

export const LOCAL_QR_PREFIX = 'mtiqr0';
export const LOCAL_QR_TOKEN_PATTERN = /mtiqr0\.\d+\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)?/;

export function buildAssetQrCanvasId(assetId: number): string {
  return `asset-qr-${assetId}`;
}

export function sanitizeQrTokenSegment(value: string, fallback: string): string {
  const sanitized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 80);
  return sanitized || fallback;
}

export function buildAssetQrPayload(asset: Activo): string {
  const idRaw = Number(asset.id);
  const id = Number.isFinite(idRaw) && idRaw > 0 ? Math.trunc(idRaw) : 0;
  const tag = sanitizeQrTokenSegment(asset.tag || '', 'ACTIVO');
  const serial = sanitizeQrTokenSegment(asset.serial || '', 'NA');
  return `${LOCAL_QR_PREFIX}.${id}.${tag}.${serial}`;
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

export function extractLocalQrToken(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const direct = raw.match(LOCAL_QR_TOKEN_PATTERN);
  if (direct) return direct[0];

  try {
    const url = new URL(raw);
    const tokenFromQuery = String(url.searchParams.get('token') || '').trim();
    if (tokenFromQuery && LOCAL_QR_TOKEN_PATTERN.test(tokenFromQuery)) {
      const matched = tokenFromQuery.match(LOCAL_QR_TOKEN_PATTERN);
      if (matched) return matched[0];
    }
    const fromPath = decodeURIComponent(url.pathname).match(LOCAL_QR_TOKEN_PATTERN);
    if (fromPath) return fromPath[0];
  } catch {
    return '';
  }

  return '';
}

export function parseLocalQrAsset(value: string): Activo | null {
  const token = extractLocalQrToken(value);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 3) return null;

  const id = Number(parts[1]);
  const tag = String(parts[2] || '').trim().toUpperCase();
  const serial = String(parts[3] || '').trim().toUpperCase();
  if (!Number.isFinite(id) || id <= 0 || !tag) return null;

  return toActivoFromQrLookup({
    id: Math.trunc(id),
    tag,
    serial: serial || `${tag}-SN`,
  });
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
