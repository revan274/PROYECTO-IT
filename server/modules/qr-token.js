import { createHmac, timingSafeEqual } from 'node:crypto';

const QR_TOKEN_PREFIX = 'mtiqr1';
export const QR_TOKEN_SCHEME = 'mti-hs256-v1';
const QR_SIGNING_SECRET = String(
  process.env.QR_SIGNING_SECRET || process.env.AUTH_TOKEN_SECRET || 'mesa-it-qr-dev-secret-change-me',
).trim() || 'mesa-it-qr-dev-secret-change-me';

function asNonEmptyString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(base64url) {
  const raw = asNonEmptyString(base64url);
  if (!raw) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  const base64 = raw
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(raw.length / 4) * 4, '=');
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function signQrPayload(payloadBase64Url) {
  const digest = createHmac('sha256', QR_SIGNING_SECRET)
    .update(String(payloadBase64Url || ''))
    .digest();
  return toBase64Url(digest);
}

function secureEqualsText(left, right) {
  const leftText = asNonEmptyString(left);
  const rightText = asNonEmptyString(right);
  if (!leftText || !rightText || leftText.length !== rightText.length) return false;
  try {
    return timingSafeEqual(Buffer.from(leftText), Buffer.from(rightText));
  } catch {
    return false;
  }
}

export function buildSignedAssetQrToken(asset) {
  const payload = {
    v: 1,
    t: 'activo',
    aid: Number(asset?.id) || 0,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadBase64Url = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = signQrPayload(payloadBase64Url);
  return {
    scheme: QR_TOKEN_SCHEME,
    token: `${QR_TOKEN_PREFIX}.${payloadBase64Url}.${signature}`,
    payload,
  };
}

export function verifySignedAssetQrToken(token) {
  const raw = asNonEmptyString(token);
  if (!raw) return { ok: false };

  const [prefix, payloadBase64Url, signature] = raw.split('.');
  if (prefix !== QR_TOKEN_PREFIX || !payloadBase64Url || !signature) return { ok: false };

  const expectedSignature = signQrPayload(payloadBase64Url);
  if (!secureEqualsText(expectedSignature, signature)) return { ok: false };

  const payloadBuffer = fromBase64Url(payloadBase64Url);
  if (!payloadBuffer) return { ok: false };

  let payload;
  try {
    payload = JSON.parse(payloadBuffer.toString('utf8'));
  } catch {
    return { ok: false };
  }

  const version = toInt(payload?.v);
  const type = asNonEmptyString(payload?.t).toLowerCase();
  const assetId = toInt(payload?.aid);
  const issuedAtEpoch = toInt(payload?.iat);
  if (version !== 1 || type !== 'activo' || assetId === null || assetId <= 0 || issuedAtEpoch === null || issuedAtEpoch <= 0) {
    return { ok: false };
  }

  return {
    ok: true,
    payload: {
      v: version,
      t: type,
      aid: assetId,
      iat: issuedAtEpoch,
    },
  };
}

export function buildAssetQrLookupResponse(asset) {
  return {
    id: Number(asset?.id) || 0,
    tag: asNonEmptyString(asset?.tag).toUpperCase(),
    tipo: asNonEmptyString(asset?.tipo || asset?.equipo).toUpperCase(),
    marca: asNonEmptyString(asset?.marca),
    modelo: asNonEmptyString(asset?.modelo),
    serial: asNonEmptyString(asset?.serial).toUpperCase(),
    estado: asNonEmptyString(asset?.estado) || 'Operativo',
    ubicacion: asNonEmptyString(asset?.ubicacion),
    responsable: asNonEmptyString(asset?.responsable),
    departamento: asNonEmptyString(asset?.departamento).toUpperCase(),
  };
}
