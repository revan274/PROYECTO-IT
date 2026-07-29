import { takeCoverage } from 'node:v8';
import { startServer } from './index.js';
import { closeStore } from './store.js';

const server = startServer();
let shutdownStarted = false;

async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;

  const forceExitTimer = setTimeout(() => {
    console.error(`Cierre forzado tras recibir ${signal}.`);
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await closeStore();
  } catch (error) {
    console.error(`No se pudo cerrar el servidor tras recibir ${signal}.`, error);
    process.exitCode = 1;
  } finally {
    if (process.env.NODE_V8_COVERAGE) takeCoverage();
    if (process.connected) process.disconnect();
    clearTimeout(forceExitTimer);
  }
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

if (process.channel) {
  process.once('message', (message) => {
    if (message?.type === 'shutdown') void shutdown('IPC');
  });
}
