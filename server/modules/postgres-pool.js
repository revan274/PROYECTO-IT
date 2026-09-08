// Resiliencia de la conexion con Neon.
//
// Neon suspende el computo tras unos minutos de inactividad y corta las conexiones ociosas:
// perder la conexion no es un fallo, es el funcionamiento normal de la plataforma. El
// codigo tiene que darlo por supuesto.
//
// El riesgo mas grave es silencioso: `pg.Pool` es un EventEmitter y emite 'error' cuando un
// cliente OCIOSO se cae. Un EventEmitter sin listener de 'error' LANZA, y como ese error
// llega de forma asincrona desde las entranas de pg, se convierte en `uncaughtException` y
// mata el proceso. Es decir: sin el manejador de abajo, que Neon se suspenda podia tumbar
// la API entera.

const TRANSIENT_PG_CODES = new Set([
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '57P01', // admin_shutdown: es lo que emite Neon al suspender el computo
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now: el computo esta arrancando
]);

const TRANSIENT_NODE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

// pg no siempre adjunta codigo a los cortes de socket; hay que mirar el mensaje.
const TRANSIENT_MESSAGES = [
  'connection terminated',
  'connection ended unexpectedly',
  'server closed the connection unexpectedly',
  'timeout exceeded when trying to connect',
  'terminating connection',
];

export function isTransientConnectionError(error) {
  if (!error) return false;
  if (TRANSIENT_PG_CODES.has(error.code) || TRANSIENT_NODE_CODES.has(error.code)) return true;
  const mensaje = String(error.message || '').toLowerCase();
  return TRANSIENT_MESSAGES.some((patron) => mensaje.includes(patron));
}

/**
 * Evita que un corte de Neon derribe el proceso. El pool descarta el cliente danado y
 * abre otro en la siguiente consulta, asi que basta con dejar constancia.
 */
export function attachPoolErrorHandler(pool, log = console.warn) {
  pool.on('error', (error) => {
    log(`Conexión con PostgreSQL perdida (se reabrirá sola): ${error?.message || error}`);
  });
  return pool;
}

/**
 * Opciones del pool ajustadas al autosuspend de Neon.
 *
 * `idleTimeoutMillis` corto es lo importante: suelta el cliente ANTES de que Neon lo corte,
 * de modo que el pool nunca guarda conexiones ya muertas.
 */
export function buildPoolOptions({ connectionString, max }, env = process.env) {
  const requiereSsl = /sslmode=require/i.test(String(connectionString || ''));
  return {
    connectionString,
    max: Math.max(1, Math.trunc(Number(max || env.PG_POOL_MAX || 4))),
    ssl: requiereSsl ? { rejectUnauthorized: false } : undefined,
    application_name: 'mesa-it',
    keepAlive: true,
    idleTimeoutMillis: Math.max(1_000, Math.trunc(Number(env.PG_IDLE_TIMEOUT_MS || 10_000))),
    // Despertar del autosuspend puede tardar unos segundos: mejor esperar que fallar.
    connectionTimeoutMillis: Math.max(5_000, Math.trunc(Number(env.PG_CONNECT_TIMEOUT_MS || 15_000))),
  };
}

/**
 * Reintenta UNA vez ante un corte transitorio. Cubre la ventana en la que Neon esta
 * despertando: el primer intento encuentra el computo suspendido y el segundo ya entra.
 * Un error de datos (clave duplicada, tabla inexistente) no se reintenta jamas.
 */
export async function withPgRetry(operacion, { delayMs = 250 } = {}) {
  try {
    return await operacion();
  } catch (error) {
    if (!isTransientConnectionError(error)) throw error;
    if (delayMs > 0) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
    return operacion();
  }
}
