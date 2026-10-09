import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOTIFICATION_STATES, PG_LEDGER_TABLE, createNotificationLedger, entregarNotificacion } from './modules/notification-ledger.js';

test('pending solo cambia a sent después de que el proveedor confirma', async () => {
  const ledger = createNotificationLedger({ getPool: async () => null, backend: 'file' });
  let stateDuringSend;
  const result = await entregarNotificacion({
    ledger, ticketId: 1, tipo: 'resuelto:ciclo-1',
    enviar: async () => {
      stateDuringSend = (await ledger.obtener(1, 'resuelto:ciclo-1')).status;
      return { sent: true };
    },
  });
  assert.equal(stateDuringSend, NOTIFICATION_STATES.PENDING);
  assert.equal(result.status, NOTIFICATION_STATES.SENT);
  assert.equal((await ledger.obtener(1, 'resuelto:ciclo-1')).status, NOTIFICATION_STATES.SENT);
});

test('un fallo queda failed y permite reintento controlado sin duplicar éxitos', async () => {
  const ledger = createNotificationLedger({ getPool: async () => null, backend: 'file' });
  let calls = 0;
  const send = async () => ({ sent: ++calls > 1, reason: 'SEND_ERROR' });
  const first = await entregarNotificacion({ ledger, ticketId: 2, tipo: 'comentario:9', enviar: send, retryDelayMs: 0 });
  assert.equal(first.status, NOTIFICATION_STATES.FAILED);
  assert.equal((await ledger.obtener(2, 'comentario:9')).attempts, 1);
  const second = await entregarNotificacion({ ledger, ticketId: 2, tipo: 'comentario:9', enviar: send, retryDelayMs: 0 });
  assert.equal(second.status, NOTIFICATION_STATES.SENT);
  assert.equal((await ledger.obtener(2, 'comentario:9')).attempts, 2);
  const duplicate = await entregarNotificacion({ ledger, ticketId: 2, tipo: 'comentario:9', enviar: send, retryDelayMs: 0 });
  assert.equal(duplicate.skipped, true);
  assert.equal(calls, 2);
});

test('los reintentos se detienen al alcanzar el máximo', async () => {
  const ledger = createNotificationLedger({ getPool: async () => null, backend: 'file' });
  let calls = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await entregarNotificacion({ ledger, ticketId: 3, tipo: 'sla:ciclo-1', maxAttempts: 3, retryDelayMs: 0,
      enviar: async () => { calls += 1; return { sent: false, reason: 'SEND_ERROR' }; } });
  }
  assert.equal(calls, 3);
  assert.equal((await ledger.obtener(3, 'sla:ciclo-1')).attempts, 3);
});

test('Postgres crea/migra estados y adquiere con conflicto atómico', async () => {
  const queries = [];
  const pool = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes('INSERT INTO')) return { rowCount: 1, rows: [{ status: 'pending', attempts: 1 }] };
    return { rowCount: 0, rows: [] };
  } };
  const ledger = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });
  const started = await ledger.iniciar(7, 'sla:ciclo-2');
  assert.equal(started.acquired, true);
  const ddl = queries.find((query) => query.sql.includes('CREATE TABLE'));
  const insert = queries.find((query) => query.sql.includes('INSERT INTO'));
  assert.ok(ddl.sql.includes(PG_LEDGER_TABLE));
  assert.match(ddl.sql, /status|attempts|next_retry_at/);
  assert.match(insert.sql, /ON CONFLICT[\s\S]*status = 'failed'/);
  assert.equal(insert.params[0], 7);
  assert.equal(insert.params[1], 'sla:ciclo-2');
});

test('un DDL fallido se reintenta', async () => {
  let ddlAttempts = 0;
  const pool = { async query(sql) {
    if (sql.includes('CREATE TABLE')) {
      ddlAttempts += 1;
      if (ddlAttempts === 1) throw new Error('Neon dormida');
    }
    return { rowCount: 1, rows: [{}] };
  } };
  const ledger = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });
  await assert.rejects(() => ledger.iniciar(1, 'sla'));
  assert.equal((await ledger.iniciar(1, 'sla')).acquired, true);
  assert.equal(ddlAttempts, 2);
});
