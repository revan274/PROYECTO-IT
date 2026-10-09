import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function percentile(values, ratio) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * ratio));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + ((sorted[upper] - sorted[lower]) * (position - lower));
}

export function summarizeDurations(values) {
  const safe = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (safe.length === 0) return { samples: 0, minMs: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  return {
    samples: safe.length,
    minMs: round(Math.min(...safe)),
    meanMs: round(safe.reduce((total, value) => total + value, 0) / safe.length),
    p50Ms: round(percentile(safe, 0.5)),
    p95Ms: round(percentile(safe, 0.95)),
    maxMs: round(Math.max(...safe)),
  };
}

export function summarizeStateVolume(state) {
  const tickets = Array.isArray(state?.tickets) ? state.tickets : [];
  return {
    users: Array.isArray(state?.users) ? state.users.length : 0,
    assets: Array.isArray(state?.activos) ? state.activos.length : 0,
    supplies: Array.isArray(state?.insumos) ? state.insumos.length : 0,
    tickets: tickets.length,
    auditRows: Array.isArray(state?.auditoria) ? state.auditoria.length : 0,
    ticketHistoryEvents: tickets.reduce((total, ticket) => total + (Array.isArray(ticket?.historial) ? ticket.historial.length : 0), 0),
    ticketAttachments: tickets.reduce((total, ticket) => total + (Array.isArray(ticket?.attachments) ? ticket.attachments.length : 0), 0),
    ticketCycles: tickets.reduce((total, ticket) => total + (Array.isArray(ticket?.ciclos) ? ticket.ciclos.length : 0), 0),
  };
}

function measureRepeated(iterations, operation) {
  const durations = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    operation(index);
    durations.push(performance.now() - startedAt);
  }
  return summarizeDurations(durations);
}

async function measureSyntheticExclusiveRewrites(serialized, concurrency) {
  let queue = Promise.resolve();
  const waits = [];
  const operations = [];
  const operationCount = Math.max(concurrency * 4, 8);
  const startedAt = performance.now();

  const jobs = Array.from({ length: operationCount }, (_, index) => {
    const queuedAt = performance.now();
    const operation = queue.then(() => {
      const acquiredAt = performance.now();
      const clone = JSON.parse(serialized);
      clone.meta = { ...(clone.meta || {}), measurementProbe: index };
      JSON.stringify(clone);
      const finishedAt = performance.now();
      waits.push(acquiredAt - queuedAt);
      operations.push(finishedAt - acquiredAt);
    });
    queue = operation.catch(() => undefined);
    return operation;
  });

  await Promise.all(jobs);
  const elapsedMs = performance.now() - startedAt;
  return {
    concurrency,
    operations: operationCount,
    elapsedMs: round(elapsedMs),
    operationsPerSecond: elapsedMs > 0 ? round((operationCount * 1000) / elapsedMs, 2) : 0,
    simulatedLockWait: summarizeDurations(waits),
    parseMutateStringify: summarizeDurations(operations),
  };
}

export async function benchmarkLocalState(state, {
  iterations = 40,
  concurrencyLevels = [1, 2, 4, 8],
} = {}) {
  const safeIterations = Math.max(5, Math.min(500, Math.trunc(Number(iterations) || 40)));
  const serialized = JSON.stringify(state);
  const rawBytes = Buffer.byteLength(serialized);
  const gzipBytes = gzipSync(serialized).byteLength;

  for (let index = 0; index < 3; index += 1) {
    JSON.parse(serialized);
    JSON.stringify(state);
  }

  const parse = measureRepeated(safeIterations, () => JSON.parse(serialized));
  const stringify = measureRepeated(safeIterations, () => JSON.stringify(state));
  const fullRewriteCpu = measureRepeated(safeIterations, (index) => {
    const clone = JSON.parse(serialized);
    clone.meta = { ...(clone.meta || {}), measurementProbe: index };
    JSON.stringify(clone);
  });
  const syntheticConcurrency = [];
  for (const level of concurrencyLevels) {
    syntheticConcurrency.push(await measureSyntheticExclusiveRewrites(serialized, Math.max(1, Math.trunc(level))));
  }

  return {
    source: 'local-json-snapshot',
    document: {
      jsonBytes: rawBytes,
      gzipBytes,
      gzipRatio: rawBytes > 0 ? round(gzipBytes / rawBytes, 4) : 0,
    },
    volume: summarizeStateVolume(state),
    cpuLatency: { parse, stringify, fullRewriteCpu },
    syntheticConcurrency,
    limitations: [
      'La contención es una simulación local de exclusión serial; no mide red, PostgreSQL ni Neon.',
      'La reescritura se ejecuta en memoria y no incluye WAL, fsync, índices ni transferencia al servidor.',
    ],
  };
}

export function buildPersistenceMarkdown(report) {
  const local = report.local;
  const pg = report.postgres;
  const lines = [
    '# Medición de persistencia JSONB',
    '',
    `**Generado:** ${report.generatedAt}`,
    '',
    '## Alcance',
    '',
    'La medición no modifica el documento de negocio ni ejecuta migraciones. El modo PostgreSQL, cuando se habilita explícitamente, lee `mesa_it_state`, reescribe solo una tabla temporal de sesión y usa un advisory lock reservado para medir espera.',
    '',
    '## Snapshot local',
    '',
    `- Tamaño JSON compacto: ${local.document.jsonBytes} bytes.`,
    `- Tamaño gzip: ${local.document.gzipBytes} bytes (${round(local.document.gzipRatio * 100, 2)} % del original).`,
    `- Volumen: ${local.volume.tickets} tickets, ${local.volume.ticketHistoryEvents} eventos, ${local.volume.ticketCycles} ciclos, ${local.volume.ticketAttachments} adjuntos, ${local.volume.assets} activos y ${local.volume.auditRows} filas de auditoría.`,
    `- Parse p50/p95: ${local.cpuLatency.parse.p50Ms}/${local.cpuLatency.parse.p95Ms} ms.`,
    `- Stringify p50/p95: ${local.cpuLatency.stringify.p50Ms}/${local.cpuLatency.stringify.p95Ms} ms.`,
    `- Ciclo parsear→mutar→serializar p50/p95: ${local.cpuLatency.fullRewriteCpu.p50Ms}/${local.cpuLatency.fullRewriteCpu.p95Ms} ms.`,
    '',
    '### Contención sintética local',
    '',
    '| Concurrencia | Operaciones | ops/s | Espera p50 | Espera p95 | Reescritura p95 |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
    ...local.syntheticConcurrency.map((entry) => `| ${entry.concurrency} | ${entry.operations} | ${entry.operationsPerSecond} | ${entry.simulatedLockWait.p50Ms} ms | ${entry.simulatedLockWait.p95Ms} ms | ${entry.parseMutateStringify.p95Ms} ms |`),
    '',
    '## PostgreSQL',
    '',
  ];

  if (!pg) {
    lines.push('No se proporcionó `MEASURE_DATABASE_URL`; no se midieron latencia, tamaño físico JSONB ni espera de locks en PostgreSQL/Neon.');
  } else {
    lines.push(
      `- Tamaño JSONB: ${pg.document.jsonbBytes} bytes; texto JSON: ${pg.document.textBytes} bytes.`,
      `- Lectura completa p50/p95: ${pg.readLatency.p50Ms}/${pg.readLatency.p95Ms} ms.`,
      `- Reescritura en tabla temporal p50/p95: ${pg.tempRewriteLatency.p50Ms}/${pg.tempRewriteLatency.p95Ms} ms.`,
      `- Espera observada con advisory lock retenido ${pg.lockProbe.holdMs} ms: ${pg.lockProbe.waitMs} ms.`,
    );
  }

  lines.push(
    '',
    '## Decisión',
    '',
    '**No se propone normalizar todavía.** El snapshot local sirve como línea base de volumen y costo de CPU. La decisión requiere ejecutar el modo PostgreSQL en un staging representativo y comparar p95 de lectura, reescritura y espera de lock bajo concurrencia con el SLO operativo acordado.',
    '',
    'La normalización se justificará si la medición real muestra crecimiento o contención sostenida que incumple ese SLO; no por el tamaño del código ni por una estimación local aislada.',
    '',
  );
  return lines.join('\n');
}
