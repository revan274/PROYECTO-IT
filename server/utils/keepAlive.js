import https from 'node:https';

export function startKeepAlive(url, interval = 14 * 60 * 1000) {
  if (!url) {
    console.log('[Keep-Alive] No se proporciono una URL para el ping.');
    return;
  }

  console.log(`[Keep-Alive] Iniciando pings a ${url} cada ${interval / 1000 / 60} minutos.`);

  setInterval(() => {
    https.get(url, (res) => {
      console.log(`[Keep-Alive] Ping enviado a ${url} - Status: ${res.statusCode}`);
      // Consumir la respuesta para evitar fugas de memoria
      res.on('data', () => {});
      res.on('end', () => {});
    }).on('error', (err) => {
      console.error(`[Keep-Alive] Error al hacer ping a ${url}:`, err.message);
    });
  }, interval);
}
