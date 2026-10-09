import { createHash } from 'node:crypto';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function createTicketIdempotencyContext({ key, actorId, scope, payload }) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalizedKey)) {
    throw Object.assign(new Error('Idempotency-Key debe tener entre 8 y 128 caracteres seguros.'), { status: 400 });
  }

  const normalizedActorId = Math.trunc(Number(actorId));
  if (!Number.isSafeInteger(normalizedActorId) || normalizedActorId <= 0) {
    throw Object.assign(new Error('No se pudo identificar al autor de la solicitud.'), { status: 400 });
  }
  const normalizedScope = String(scope || '').trim();
  const canonicalPayload = JSON.stringify(canonicalize(payload ?? null));
  const fingerprint = createHash('sha256')
    .update(`${normalizedScope}\n${normalizedActorId}\n${canonicalPayload}`)
    .digest('hex');

  return {
    storageKey: `${normalizedActorId}:${normalizedScope}:${normalizedKey}`,
    fingerprint,
    key: normalizedKey,
    actorId: normalizedActorId,
    scope: normalizedScope,
  };
}

function getRegistry(db) {
  if (!db.meta || typeof db.meta !== 'object') db.meta = {};
  if (!db.meta.ticketCreationIdempotency || typeof db.meta.ticketCreationIdempotency !== 'object' || Array.isArray(db.meta.ticketCreationIdempotency)) {
    db.meta.ticketCreationIdempotency = {};
  }
  return db.meta.ticketCreationIdempotency;
}

function cleanExpiredEntries(db, nowMs) {
  const registry = getRegistry(db);
  const ticketIds = new Set((Array.isArray(db.tickets) ? db.tickets : []).map((ticket) => Number(ticket.id)));
  for (const [storageKey, record] of Object.entries(registry)) {
    const expiresAtMs = Date.parse(String(record?.expiresAt || ''));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || !ticketIds.has(Number(record?.ticketId))) {
      delete registry[storageKey];
    }
  }
  return registry;
}

export function findTicketCreationReplay(db, context, { nowMs = Date.now() } = {}) {
  if (!context) return { status: 'new' };
  const registry = cleanExpiredEntries(db, nowMs);
  const record = registry[context.storageKey];
  if (!record) return { status: 'new' };
  if (record.fingerprint !== context.fingerprint) return { status: 'conflict' };
  const ticket = db.tickets.find((item) => Number(item.id) === Number(record.ticketId));
  if (!ticket) {
    delete registry[context.storageKey];
    return { status: 'new' };
  }
  return { status: 'replay', ticket };
}

export function rememberTicketCreation(db, context, ticketId, {
  nowMs = Date.now(),
  retentionMs = DEFAULT_RETENTION_MS,
} = {}) {
  if (!context) return;
  const registry = cleanExpiredEntries(db, nowMs);
  registry[context.storageKey] = {
    fingerprint: context.fingerprint,
    ticketId: Number(ticketId),
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + retentionMs).toISOString(),
  };
}
