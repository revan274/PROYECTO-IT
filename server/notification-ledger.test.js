import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PG_LEDGER_TABLE, createNotificationLedger } from './modules/notification-ledger.js';

// Pool falso: registra las consultas y simula la semantica de la clave primaria.
function poolFalso({ fallaDdl = false } = {}) {
  const consultas = [];
  const filas = new Set();
  return {
    consultas,
    async query(sql, params) {
      consultas.push({ sql, params });
      if (sql.includes('CREATE TABLE')) {
        if (fallaDdl) throw new Error('Neon dormida');
        return { rowCount: 0, rows: [] };
      }
      const clave = `${params[0]}:${params[1]}`;
      if (filas.has(clave)) return { rowCount: 0, rows: [] };
      filas.add(clave);
      return { rowCount: 1, rows: [{ ticket_id: params[0] }] };
    },
  };
}

test('sin Postgres la constancia es de este proceso y evita repetir en la misma vida', async () => {
  const ledger = createNotificationLedger({ getPool: async () => null, backend: 'file' });

  assert.equal(await ledger.reclamar(1, 'sla'), true);
  assert.equal(await ledger.reclamar(1, 'sla'), false, 'la segunda vez ya no toca');
  assert.equal(await ledger.reclamar(1, 'otro'), true, 'otro tipo de aviso es independiente');
  assert.equal(await ledger.reclamar(2, 'sla'), true, 'otro ticket es independiente');
});

test('con Postgres solo gana quien inserta la fila: dos instancias no duplican el aviso', async () => {
  const pool = poolFalso();
  const instanciaA = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });
  const instanciaB = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });

  const ganoA = await instanciaA.reclamar(7, 'sla-por-vencer');
  const ganoB = await instanciaB.reclamar(7, 'sla-por-vencer');

  assert.equal(ganoA, true);
  assert.equal(ganoB, false, 'la segunda instancia no debe volver a avisar');
});

test('la reserva usa ON CONFLICT DO NOTHING sobre la tabla esperada', async () => {
  const pool = poolFalso();
  const ledger = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });
  await ledger.reclamar(3, 'sla-por-vencer');

  const insercion = pool.consultas.find((c) => c.sql.includes('INSERT INTO'));
  assert.ok(insercion, 'debe haber una insercion');
  assert.ok(insercion.sql.includes(PG_LEDGER_TABLE));
  assert.ok(insercion.sql.includes('ON CONFLICT'));
  assert.ok(insercion.sql.includes('DO NOTHING'));
  assert.deepEqual(insercion.params, [3, 'sla-por-vencer']);
});

test('la tabla se crea una sola vez aunque se reclamen varios avisos', async () => {
  const pool = poolFalso();
  const ledger = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });

  await ledger.reclamar(1, 'sla');
  await ledger.reclamar(2, 'sla');
  await ledger.reclamar(3, 'sla');

  const ddl = pool.consultas.filter((c) => c.sql.includes('CREATE TABLE'));
  assert.equal(ddl.length, 1, 'el DDL debe estar memoizado');
});

test('un fallo de DDL no queda cacheado: se reintenta en la siguiente reserva', async () => {
  let intentos = 0;
  const pool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE')) {
        intentos += 1;
        // La base estaba dormida en el primer intento; despierta despues.
        if (intentos === 1) throw new Error('Neon dormida');
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [{ ticket_id: params[0] }] };
    },
  };
  const ledger = createNotificationLedger({ getPool: async () => pool, backend: 'postgres' });

  await assert.rejects(() => ledger.reclamar(1, 'sla'));
  assert.equal(await ledger.reclamar(1, 'sla'), true, 'debe recuperarse en el siguiente intento');
  assert.equal(intentos, 2);
});

test('el backend queda expuesto para el diagnostico', () => {
  const conPg = createNotificationLedger({ getPool: async () => null, backend: 'postgres' });
  const sinPg = createNotificationLedger({ getPool: async () => null, backend: 'file' });

  assert.equal(conPg.usaPostgres, true);
  assert.equal(sinPg.usaPostgres, false);
});
