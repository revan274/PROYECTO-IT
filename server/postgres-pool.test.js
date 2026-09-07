import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

import {
  buildPoolOptions,
  attachPoolErrorHandler,
  isTransientConnectionError,
  withPgRetry,
} from './modules/postgres-pool.js';

test('un error de cliente ocioso NO derriba el proceso', () => {
  const pool = new EventEmitter();
  const registrado = [];
  attachPoolErrorHandler(pool, (mensaje) => registrado.push(mensaje));

  // Sin listener, un EventEmitter lanza aqui y Node lo convierte en uncaughtException.
  assert.doesNotThrow(() => {
    pool.emit('error', new Error('Connection terminated unexpectedly'));
  });
  assert.equal(registrado.length, 1);
  assert.match(registrado[0], /Connection terminated unexpectedly/);
});

test('reconoce los cortes tipicos de Neon como transitorios', () => {
  const transitorios = [
    Object.assign(new Error('Connection terminated unexpectedly'), {}),
    Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' }),
    Object.assign(new Error('the database system is starting up'), { code: '57P03' }),
    Object.assign(new Error('connection failure'), { code: '08006' }),
  ];
  for (const error of transitorios) {
    assert.equal(isTransientConnectionError(error), true, error.message);
  }
});

test('no confunde un error de datos con uno de conexion', () => {
  const permanentes = [
    Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    Object.assign(new Error('relation "mesa_it_state" does not exist'), { code: '42P01' }),
    new Error('algo se rompio en el codigo'),
    null,
  ];
  for (const error of permanentes) {
    assert.equal(isTransientConnectionError(error), false, error?.message || 'null');
  }
});

test('withPgRetry reintenta una vez cuando Neon estaba despertando', async () => {
  let intentos = 0;
  const resultado = await withPgRetry(async () => {
    intentos += 1;
    if (intentos === 1) {
      throw Object.assign(new Error('Connection terminated unexpectedly'), {});
    }
    return 'ok';
  }, { delayMs: 0 });

  assert.equal(resultado, 'ok');
  assert.equal(intentos, 2, 'debe reintentar exactamente una vez');
});

test('withPgRetry no reintenta un error permanente', async () => {
  let intentos = 0;
  await assert.rejects(
    withPgRetry(async () => {
      intentos += 1;
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    }, { delayMs: 0 }),
    /duplicate key/,
  );
  assert.equal(intentos, 1, 'un error de datos no se reintenta');
});

test('withPgRetry se rinde si el corte persiste', async () => {
  let intentos = 0;
  await assert.rejects(
    withPgRetry(async () => {
      intentos += 1;
      throw Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    }, { delayMs: 0 }),
    /ECONNRESET/,
  );
  assert.equal(intentos, 2, 'no debe reintentar indefinidamente');
});

test('las opciones del pool cierran conexiones antes de que Neon las corte', () => {
  const opciones = buildPoolOptions({ connectionString: 'postgres://u:p@host/db?sslmode=require' }, {});

  assert.equal(opciones.keepAlive, true, 'keepAlive evita cortes por inactividad de red');
  assert.equal(opciones.idleTimeoutMillis > 0, true);
  assert.equal(opciones.idleTimeoutMillis <= 30_000, true, 'debe soltar el cliente antes que Neon');
  assert.equal(opciones.connectionTimeoutMillis >= 5_000, true, 'Neon tarda en despertar del autosuspend');
  assert.deepEqual(opciones.ssl, { rejectUnauthorized: false }, 'sslmode=require en la URL');
});

test('sin sslmode=require no se fuerza ssl', () => {
  const opciones = buildPoolOptions({ connectionString: 'postgres://u:p@localhost/db' }, {});
  assert.equal(opciones.ssl, undefined);
});
