import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { mutatePostgresStateWithLock } from './modules/postgres-state.js';

function cloneDb(db) {
  return JSON.parse(JSON.stringify(db));
}

function createSharedPostgresState() {
  const shared = {
    data: { meta: { nextId: 10, revision: 1 }, counter: 0 },
    version: 1,
    locked: false,
    waiters: [],
  };

  function acquire() {
    if (!shared.locked) {
      shared.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => shared.waiters.push(resolve));
  }

  function release() {
    const next = shared.waiters.shift();
    if (next) next();
    else shared.locked = false;
  }

  function createClient() {
    let ownsLock = false;
    return {
      async query(sql, params = []) {
        const statement = String(sql).trim();
        if (statement === 'BEGIN') return { rows: [] };
        if (statement.includes('FOR UPDATE')) {
          await acquire();
          ownsLock = true;
          return {
            rows: [{ data: cloneDb(shared.data), version: shared.version }],
          };
        }
        if (statement.startsWith('UPDATE mesa_it_state')) {
          shared.data = JSON.parse(params[0]);
          shared.version = Number(params[1]);
          return { rows: [] };
        }
        if (statement === 'COMMIT' || statement === 'ROLLBACK') {
          if (ownsLock) {
            ownsLock = false;
            release();
          }
          return { rows: [] };
        }
        throw new Error(`Consulta inesperada: ${statement}`);
      },
    };
  }

  return { shared, createClient };
}

test('FOR UPDATE conserva ambas mutaciones concurrentes del documento JSONB', async () => {
  const runtime = createSharedPostgresState();
  const normalize = (db) => cloneDb(db);
  const increment = async (db) => {
    const current = db.counter;
    await delay(10);
    db.counter = current + 1;
  };

  await Promise.all([
    mutatePostgresStateWithLock(runtime.createClient(), normalize, increment),
    mutatePostgresStateWithLock(runtime.createClient(), normalize, increment),
  ]);

  assert.equal(runtime.shared.data.counter, 2);
  assert.equal(runtime.shared.version, 3);
  assert.equal(runtime.shared.data.meta.revision, 3);
});

test('una mutación fallida ejecuta ROLLBACK y no escribe estado parcial', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      const statement = String(sql).trim();
      statements.push(statement);
      if (statement.includes('FOR UPDATE')) {
        return {
          rows: [{
            data: { meta: { nextId: 10, revision: 4 }, counter: 1 },
            version: 4,
          }],
        };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    mutatePostgresStateWithLock(client, cloneDb, async (db) => {
      db.counter = 99;
      throw new Error('fallo esperado');
    }),
    /fallo esperado/,
  );

  assert.equal(statements.includes('ROLLBACK'), true);
  assert.equal(statements.includes('COMMIT'), false);
  assert.equal(statements.some((statement) => statement.startsWith('UPDATE mesa_it_state')), false);
});
