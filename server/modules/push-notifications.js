import webpush from 'web-push';
import { roleHasPermission } from '../../shared/permissions.js';

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;

function text(value) {
  return String(value ?? '').trim();
}

function validUserId(value) {
  const id = Math.trunc(Number(value));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validSubscriptionEndpoint(value) {
  const endpoint = text(value);
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return '';

  try {
    const url = new URL(endpoint);
    // Los navegadores entregan endpoints HTTPS de servicios push. Rechazar IPs y
    // puertos no estándar evita que esta ruta autenticada se convierta en SSRF.
    if (url.protocol !== 'https:' || (url.port && url.port !== '443')) return '';
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(':')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function validSubscriptionKey(value) {
  const key = text(value);
  return key.length > 0 && key.length <= MAX_KEY_LENGTH && BASE64_URL.test(key) ? key : '';
}

/** No se conserva información adicional del navegador: solo lo imprescindible para Web Push. */
export function normalizePushSubscription(raw, owner = {}) {
  const endpoint = validSubscriptionEndpoint(raw?.endpoint);
  const p256dh = validSubscriptionKey(raw?.keys?.p256dh);
  const auth = validSubscriptionKey(raw?.keys?.auth);
  const userId = validUserId(owner.userId ?? raw?.userId);
  const username = text(owner.username ?? raw?.username).toLowerCase().slice(0, 120);
  if (!endpoint || !p256dh || !auth || !userId || !username) return null;

  return {
    endpoint,
    keys: { p256dh, auth },
    userId,
    username,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePushSubscriptionList(items) {
  const byEndpoint = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizePushSubscription(item);
    if (normalized) byEndpoint.set(normalized.endpoint, normalized);
  }
  return Array.from(byEndpoint.values());
}

export function getPushConfiguration(env = process.env) {
  const subject = text(env.VAPID_SUBJECT);
  const publicKey = text(env.VAPID_PUBLIC_KEY);
  const privateKey = text(env.VAPID_PRIVATE_KEY);
  const looksLikeKey = (key) => key.length >= 40 && key.length <= 256 && BASE64_URL.test(key);
  const validSubject = subject.startsWith('mailto:') || /^https:\/\//i.test(subject);

  if (!subject && !publicKey && !privateKey) {
    return { enabled: false, reason: 'NOT_CONFIGURED', publicKey: '' };
  }
  if (!validSubject || !looksLikeKey(publicKey) || !looksLikeKey(privateKey)) {
    return { enabled: false, reason: 'INVALID_CONFIGURATION', publicKey: '' };
  }
  return { enabled: true, subject, publicKey, privateKey };
}

function isTicketResponder(user) {
  return user && user.activo !== false && roleHasPermission(user.rol, 'tickets.update');
}

/** Mantiene la misma política de atención que el correo, sin revelar destinatarios ni correos. */
export function planTicketPushRecipients(ticket, users) {
  const activeUsers = (Array.isArray(users) ? users : []).filter(isTicketResponder);
  const isCritical = text(ticket?.prioridad).toUpperCase() === 'CRITICA';
  const assignee = text(ticket?.asignadoA);
  const recipients = isCritical || !assignee
    ? activeUsers
    : activeUsers.filter((user) => user.nombre === assignee);
  return new Set(recipients.map((user) => validUserId(user.id)).filter(Boolean));
}

export function buildTicketPushPayload(ticket) {
  const priority = text(ticket?.prioridad).toUpperCase() || 'NORMAL';
  return {
    title: priority === 'CRITICA' ? 'Mesa IT: ticket crítico' : 'Mesa IT: nuevo ticket',
    body: `Ticket #${ticket.id} · ${priority}${ticket?.activoTag ? ` · ${text(ticket.activoTag).slice(0, 80)}` : ''}`,
    url: '/#/tickets',
    tag: `mesa-it-ticket-${ticket.id}`,
  };
}

export function createPushNotifier({
  env = process.env,
  sendNotification = webpush.sendNotification.bind(webpush),
  log = console.error,
} = {}) {
  const configuration = getPushConfiguration(env);

  async function notifyTicketCreated({ ticket, users, subscriptions, removeSubscription = async () => {} }) {
    if (!configuration.enabled) return { sent: 0, skipped: 'NOT_CONFIGURED' };

    const recipientIds = planTicketPushRecipients(ticket, users);
    const destinations = normalizePushSubscriptionList(subscriptions)
      .filter((subscription) => recipientIds.has(subscription.userId));
    if (destinations.length === 0) return { sent: 0, skipped: 'NO_SUBSCRIPTIONS' };

    const payload = JSON.stringify(buildTicketPushPayload(ticket));
    const options = {
      vapidDetails: {
        subject: configuration.subject,
        publicKey: configuration.publicKey,
        privateKey: configuration.privateKey,
      },
      TTL: 60 * 60,
      urgency: text(ticket?.prioridad).toUpperCase() === 'CRITICA' ? 'high' : 'normal',
      topic: `ticket-${ticket.id}`.slice(0, 32),
    };

    const results = await Promise.allSettled(destinations.map(async (subscription) => {
      try {
        await sendNotification(subscription, payload, options);
        return true;
      } catch (error) {
        const statusCode = Number(error?.statusCode);
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(subscription.endpoint);
        } else {
          log(`No se pudo enviar la notificación push del ticket #${ticket?.id}:`, error);
        }
        return false;
      }
    }));

    return { sent: results.filter((result) => result.status === 'fulfilled' && result.value).length };
  }

  return {
    getPublicConfiguration: () => ({
      enabled: configuration.enabled,
      ...(configuration.enabled ? { publicKey: configuration.publicKey } : { reason: configuration.reason }),
    }),
    notifyTicketCreated,
  };
}
