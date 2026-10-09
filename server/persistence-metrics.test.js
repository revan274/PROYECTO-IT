import assert from 'node:assert/strict';
import test from 'node:test';

import { benchmarkLocalState, buildPersistenceMarkdown, percentile, summarizeDurations, summarizeStateVolume } from './modules/persistence-metrics.js';

const state = {
  meta: { revision: 3 },
  users: [{ id: 1 }],
  activos: [{ id: 2 }, { id: 3 }],
  insumos: [{ id: 4 }],
  auditoria: [{ id: 5 }, { id: 6 }, { id: 7 }],
  tickets: [
    { id: 8, historial: [{}, {}], attachments: [{}], ciclos: [{}] },
    { id: 9, historial: [{}], attachments: [], ciclos: [{}, {}] },
  ],
};

test('resume volumen sin contar valores ausentes como entidades', () => {
  assert.deepEqual(summarizeStateVolume(state), {
    users: 1,
    assets: 2,
    supplies: 1,
    tickets: 2,
    auditRows: 3,
    ticketHistoryEvents: 3,
    ticketAttachments: 1,
    ticketCycles: 3,
  });
});

test('percentiles y resumen usan interpolación estable', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.deepEqual(summarizeDurations([1, 2, 3]), {
    samples: 3,
    minMs: 1,
    meanMs: 2,
    p50Ms: 2,
    p95Ms: 2.9,
    maxMs: 3,
  });
});

test('benchmark local mide tamaño, latencia y espera serial sin mutar el estado', async () => {
  const before = JSON.stringify(state);
  const result = await benchmarkLocalState(state, { iterations: 5, concurrencyLevels: [1, 2] });

  assert.equal(JSON.stringify(state), before);
  assert.equal(result.document.jsonBytes, Buffer.byteLength(before));
  assert.equal(result.volume.tickets, 2);
  assert.equal(result.cpuLatency.fullRewriteCpu.samples, 5);
  assert.deepEqual(result.syntheticConcurrency.map((entry) => entry.concurrency), [1, 2]);
  assert.equal(result.syntheticConcurrency.every((entry) => entry.operations > 0), true);
});

test('informe distingue la línea base local de PostgreSQL pendiente', async () => {
  const local = await benchmarkLocalState(state, { iterations: 5, concurrencyLevels: [1] });
  const markdown = buildPersistenceMarkdown({ generatedAt: '2026-10-09T00:00:00.000Z', local, postgres: null });
  assert.match(markdown, /No se proporcionó `MEASURE_DATABASE_URL`/);
  assert.match(markdown, /No se propone normalizar todavía/);
});
