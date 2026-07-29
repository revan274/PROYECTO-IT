import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAuthPersistence } from './modules/auth-persistence.js';

function createFilePersistence(dataDir) {
  return createAuthPersistence({
    backend: 'file',
    dataDir,
    tokenTtlMs: 10_000,
    loginMaxAttempts: 3,
    loginLockMs: 30_000,
    loginTrackWindowMs: 60_000,
    gcIntervalMs: 1_000,
  });
}

test('las sesiones locales persisten entre runtimes y el token se guarda como hash', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'mesa-it-auth-'));
  try {
    const firstRuntime = createFilePersistence(dataDir);
    const secondRuntime = createFilePersistence(dataDir);
    const token = 'token-secreto-de-prueba-que-no-debe-persistirse';
    const user = { id: 501, username: 'admin.integration' };

    await firstRuntime.createSession(token, user, 1_000);
    const recovered = await secondRuntime.getSession(token, 2_000);

    assert.equal(recovered?.userId, 501);
    assert.equal(recovered?.username, 'admin.integration');
    assert.equal(recovered?.issuedAt, 1_000);
    assert.equal(recovered?.expiresAt, 11_000);
    assert.equal(recovered?.authVersion, 0);

    await firstRuntime.updateSessionValidation(token, {
      ...user,
      nombre: 'Admin Integración',
      rol: 'admin',
      departamento: 'IT',
      authVersion: 2,
    }, 7);
    const validated = await secondRuntime.getSession(token, 2_000);
    assert.equal(validated?.validatedStateVersion, 7);
    assert.equal(validated?.authVersion, 2);
    assert.equal(validated?.user?.rol, 'admin');

    const persisted = await readFile(path.join(dataDir, 'auth-runtime.json'), 'utf8');
    assert.equal(persisted.includes(token), false);

    await secondRuntime.destroySession(token);
    assert.equal(await firstRuntime.getSession(token, 2_001), null);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('el bloqueo de login se comparte entre runtimes y puede limpiarse', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'mesa-it-auth-throttle-'));
  try {
    const firstRuntime = createFilePersistence(dataDir);
    const secondRuntime = createFilePersistence(dataDir);
    const keys = ['ip::127.0.0.1::admin', 'user::admin'];

    assert.equal((await firstRuntime.registerLoginFailure(keys, 1_000)).locked, false);
    assert.equal((await secondRuntime.registerLoginFailure(keys, 1_100)).locked, false);
    const thirdFailure = await firstRuntime.registerLoginFailure(keys, 1_200);

    assert.equal(thirdFailure.locked, true);
    assert.equal(thirdFailure.retryAfterSec, 30);
    assert.equal((await secondRuntime.getLoginThrottle(keys, 1_201))?.lockedUntil, 31_200);

    await firstRuntime.clearLoginFailures(keys);
    assert.equal(await secondRuntime.getLoginThrottle(keys, 1_202), null);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
