import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';

import { benchmarkLocalState, buildPersistenceMarkdown, summarizeDurations, summarizeStateVolume } from '../modules/persistence-metrics.js';
import { buildPoolOptions } from '../modules/postgres-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

async function measurePostgres(connectionString, iterations) {
  const pool = new Pool(buildPoolOptions({ connectionString, max: 4 }));
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '15s'");
    const sizeResult = await client.query(`
      SELECT pg_column_size(data)::bigint AS jsonb_bytes,
             octet_length(data::text)::bigint AS text_bytes,
             data
      FROM mesa_it_state
      WHERE id = 1
    `);
    if (!sizeResult.rows[0]) throw new Error('No existe mesa_it_state.id=1.');
    const state = sizeResult.rows[0].data || {};
    const readDurations = [];
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      await client.query('SELECT data FROM mesa_it_state WHERE id = 1');
      readDurations.push(performance.now() - startedAt);
    }

    await client.query('BEGIN');
    let tempRewriteLatency;
    try {
      await client.query('CREATE TEMP TABLE mesa_it_state_measurement (id integer PRIMARY KEY, data jsonb NOT NULL) ON COMMIT DROP');
      await client.query('INSERT INTO mesa_it_state_measurement (id, data) VALUES (1, $1::jsonb)', [JSON.stringify(state)]);
      const rewriteDurations = [];
      for (let index = 0; index < iterations; index += 1) {
        const startedAt = performance.now();
        await client.query(
          "UPDATE mesa_it_state_measurement SET data = jsonb_set(data, '{meta,measurementProbe}', to_jsonb($1::integer), true) WHERE id = 1",
          [index],
        );
        rewriteDurations.push(performance.now() - startedAt);
      }
      tempRewriteLatency = summarizeDurations(rewriteDurations);
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }

    const holder = await pool.connect();
    const waiter = await pool.connect();
    const holdMs = 100;
    let waitMs = 0;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock($1, $2)', [1296386387, 20260921]);
      await waiter.query('BEGIN');
      const waitStartedAt = performance.now();
      const waitPromise = waiter.query('SELECT pg_advisory_xact_lock($1, $2)', [1296386387, 20260921]);
      await new Promise((resolve) => { setTimeout(resolve, holdMs); });
      await holder.query('COMMIT');
      await waitPromise;
      waitMs = performance.now() - waitStartedAt;
      await waiter.query('COMMIT');
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await waiter.query('ROLLBACK').catch(() => undefined);
      holder.release();
      waiter.release();
    }

    return {
      source: 'postgres-readonly-plus-session-temp',
      document: {
        jsonbBytes: Number(sizeResult.rows[0].jsonb_bytes),
        textBytes: Number(sizeResult.rows[0].text_bytes),
      },
      volume: summarizeStateVolume(state),
      readLatency: summarizeDurations(readDurations),
      tempRewriteLatency,
      lockProbe: { type: 'advisory-transaction-lock', holdMs, waitMs: round(waitMs) },
      guarantees: [
        'No se actualiza mesa_it_state.',
        'Las reescrituras ocurren en una tabla temporal de sesión y se revierten.',
        'La espera usa un advisory lock reservado; no bloquea la fila de negocio.',
      ],
    };
  } finally {
    client.release();
    await pool.end();
  }
}

const filePath = path.resolve(projectRoot, readArg('file', process.env.MEASURE_STATE_FILE || 'server/data/runtime/db.json'));
const iterations = Math.max(5, Math.min(200, Math.trunc(Number(readArg('iterations', '40')) || 40)));
const outputJson = readArg('output-json');
const outputMarkdown = readArg('output-markdown');
const postgresUrl = String(process.env.MEASURE_DATABASE_URL || '').trim();

const state = JSON.parse(await readFile(filePath, 'utf8'));
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  input: {
    localFile: path.relative(projectRoot, filePath).replaceAll('\\', '/'),
    iterations,
    postgresMeasured: Boolean(postgresUrl),
  },
  local: await benchmarkLocalState(state, { iterations }),
  postgres: postgresUrl ? await measurePostgres(postgresUrl, iterations) : null,
  decision: 'NO_MIGRATION_DECISION_WITHOUT_REPRESENTATIVE_POSTGRES_EVIDENCE',
};

const json = `${JSON.stringify(report, null, 2)}\n`;
const markdown = buildPersistenceMarkdown(report);
if (outputJson) await writeFile(path.resolve(projectRoot, outputJson), json, 'utf8');
if (outputMarkdown) await writeFile(path.resolve(projectRoot, outputMarkdown), markdown, 'utf8');
process.stdout.write(json);
