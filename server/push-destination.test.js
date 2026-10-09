import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPushAgent, isPublicPushAddress } from './modules/push-destination.js';
import { createPushNotifier, normalizePushSubscription } from './modules/push-notifications.js';

const subscription = (endpoint) => ({ endpoint, userId: 1, username: 'tech', keys: { p256dh: 'a'.repeat(88), auth: 'b'.repeat(24) } });
const lookupAgent = (agent, hostname, options = {}) => new Promise((resolve, reject) => {
  agent.options.lookup(hostname, options, (error, address, family) => error ? reject(error) : resolve({ address, family }));
});

test('push allows only approved providers and rejects credentials, fragments and deceptive hosts', () => {
  for (const endpoint of ['https://localhost/push', 'https://internal/push', 'https://127.1/push',
    'https://[::1]/push', 'https://2130706433/push', 'https://evil.test/push',
    'https://fcm.googleapis.com.evil.test/push', 'https://evilpush.apple.com/push',
    'https://fcm.googleapis.com:444/push', 'https://user:password@fcm.googleapis.com/push',
    'https://fcm.googleapis.com/push#secret', 'http://fcm.googleapis.com/push']) {
    assert.equal(normalizePushSubscription(subscription(endpoint)), null, endpoint);
  }
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2.notify.windows.com']) {
    assert.ok(normalizePushSubscription(subscription(`https://${host}/token`)));
  }
});

test('private, reserved, mapped and translation IP ranges cannot be push destinations', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1', '192.0.2.1', '::1', '::',
    '::ffff:127.0.0.1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', '64:ff9b::a00:1', '2001:db8::1', '2002:7f00:1::']) {
    assert.equal(isPublicPushAddress(address), false, address);
  }
  for (const address of ['8.8.8.8', '142.250.1.1', '2606:4700::1111']) assert.equal(isPublicPushAddress(address), true);
});

test('actual socket lookup rejects mixed DNS results and rechecks each new connection', async () => {
  let calls = 0;
  const agent = createPushAgent((_hostname, _options, callback) => {
    calls += 1;
    callback(null, calls === 1 ? [{ address: '8.8.8.8', family: 4 }] : [
      { address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 },
    ]);
  });
  assert.deepEqual(await lookupAgent(agent, 'fcm.googleapis.com'), { address: '8.8.8.8', family: 4 });
  await assert.rejects(lookupAgent(agent, 'fcm.googleapis.com', { all: true }), { code: 'PUSH_DESTINATION_BLOCKED' });
  await assert.rejects(lookupAgent(agent, 'localhost'), { code: 'PUSH_DESTINATION_BLOCKED' });
  assert.equal(calls, 2, 'unapproved hostname must not trigger DNS');
  agent.destroy();
});

test('notifier supplies protected TLS agent, rejects private DNS, and never logs subscription secrets', async () => {
  const logs = [];
  const notifier = createPushNotifier({
    env: { VAPID_SUBJECT: 'mailto:it@example.test', VAPID_PUBLIC_KEY: 'a'.repeat(87), VAPID_PRIVATE_KEY: 'b'.repeat(43) },
    lookup: (_host, _options, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]),
    sendNotification: async (item, _payload, options) => {
      assert.equal(options.timeout, 15000);
      await lookupAgent(options.agent, new URL(item.endpoint).hostname);
      assert.fail('private destination must never be sent');
    },
    log: (...values) => logs.push(values),
  });
  const result = await notifier.notifyTicketAssigned({ ticket: { id: 1 }, assigneeId: 1,
    subscriptions: [subscription('https://fcm.googleapis.com/SECRET_TOKEN')] });
  assert.equal(result.sent, 0);
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET_TOKEN|127\.0\.0\.1|fcm\.googleapis/);
});
