import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildTicketPushPayload,
  createPushNotifier,
  normalizePushSubscription,
  planTicketPushRecipients,
} from './modules/push-notifications.js';

const VAPID_ENV = {
  VAPID_SUBJECT: 'mailto:it@example.test',
  VAPID_PUBLIC_KEY: 'A'.repeat(87),
  VAPID_PRIVATE_KEY: 'B'.repeat(43),
};

const USERS = [
  { id: 1, username: 'admin', nombre: 'Admin', rol: 'admin', activo: true },
  { id: 2, username: 'tecnico', nombre: 'Técnico', rol: 'tecnico', activo: true },
  { id: 3, username: 'consulta', nombre: 'Consulta', rol: 'consulta', activo: true },
];

function subscription(userId, username, suffix) {
  return {
    endpoint: `https://push.example.test/subscription/${suffix}`,
    keys: { p256dh: 'a'.repeat(88), auth: 'b'.repeat(24) },
    userId,
    username,
  };
}

test('normaliza suscripciones y rechaza endpoints inseguros', () => {
  assert.equal(normalizePushSubscription(subscription(2, 'tecnico', 'one')).userId, 2);
  assert.equal(normalizePushSubscription({ ...subscription(2, 'tecnico', 'one'), endpoint: 'http://127.0.0.1/internal' }), null);
});

test('un ticket crítico notifica a quienes pueden atender; uno asignado solo a su técnico', () => {
  assert.deepEqual([...planTicketPushRecipients({ prioridad: 'CRITICA' }, USERS)], [1, 2]);
  assert.deepEqual([...planTicketPushRecipients({ prioridad: 'ALTA', asignadoA: 'Técnico' }, USERS)], [2]);
});

test('envía un payload mínimo y limpia suscripciones expiradas', async () => {
  const sent = [];
  const removed = [];
  const notifier = createPushNotifier({
    env: VAPID_ENV,
    sendNotification: async (item, payload) => {
      if (item.endpoint.endsWith('/expired')) {
        const error = new Error('Gone');
        error.statusCode = 410;
        throw error;
      }
      sent.push(JSON.parse(payload));
    },
  });

  const result = await notifier.notifyTicketCreated({
    ticket: { id: 18, prioridad: 'CRITICA', activoTag: 'PC-18' },
    users: USERS,
    subscriptions: [subscription(1, 'admin', 'ok'), subscription(2, 'tecnico', 'expired')],
    removeSubscription: async (endpoint) => removed.push(endpoint),
  });

  assert.equal(result.sent, 1);
  assert.equal(sent[0].body, 'Ticket #18 · CRITICA · PC-18');
  assert.deepEqual(removed, ['https://push.example.test/subscription/expired']);
  assert.equal(buildTicketPushPayload({ id: 1, prioridad: 'ALTA' }).url, '/#/tickets');
});

test('una asignación llega solo al nuevo responsable', async () => {
  const sent = [];
  const notifier = createPushNotifier({
    env: VAPID_ENV,
    sendNotification: async (item, payload) => sent.push({ item, payload: JSON.parse(payload) }),
  });

  const result = await notifier.notifyTicketAssigned({
    ticket: { id: 19, prioridad: 'ALTA', activoTag: 'PC-19' },
    assigneeId: 2,
    subscriptions: [subscription(1, 'admin', 'admin'), subscription(2, 'tecnico', 'tecnico')],
  });

  assert.equal(result.sent, 1);
  assert.equal(sent[0].item.userId, 2);
  assert.equal(sent[0].payload.title, 'Mesa IT: ticket asignado');
  assert.match(sent[0].payload.body, /Asignado a ti/);
});
