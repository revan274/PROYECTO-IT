// Marcador de persistencia del almacenamiento de adjuntos.
//
// Responde empiricamente a una pregunta que no se puede contestar leyendo el codigo:
// ¿el directorio de adjuntos sobrevive a un redespliegue? En Railway el sistema de archivos
// del contenedor es efimero salvo que haya un volumen montado, y la configuracion vive en el
// dashboard, no en el repositorio.
//
// El servidor escribe este marcador en cada arranque. Si tras un redespliegue `firstSeenAt`
// conserva la fecha original, el almacenamiento es persistente. Si se reinicia a la fecha de
// hoy, es efimero y los adjuntos se estan perdiendo en cada despliegue.
//
// Nunca lanza: un fallo de disco no debe impedir que la API arranque.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STORAGE_MARKER_FILE = '.storage-marker.json';

export async function touchStorageMarker(dir, options = {}) {
  const now = options.now || Date.now;
  const vacio = { firstSeenAt: null, lastSeenAt: null, bootCount: null, survivedRestart: false, error: null };

  try {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, STORAGE_MARKER_FILE);

    let previo = null;
    try {
      previo = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      // Marcador ausente o corrupto: se reinicia. No es motivo para fallar el arranque.
      previo = null;
    }

    const previoValido = previo
      && typeof previo.firstSeenAt === 'string'
      && Number.isFinite(Number(previo.bootCount));

    const bootCount = previoValido ? Math.trunc(Number(previo.bootCount)) + 1 : 1;
    const firstSeenAt = previoValido ? previo.firstSeenAt : new Date(now()).toISOString();
    const marcador = {
      firstSeenAt,
      lastSeenAt: new Date(now()).toISOString(),
      bootCount,
    };

    await writeFile(file, `${JSON.stringify(marcador, null, 2)}\n`, 'utf8');

    return {
      ...marcador,
      // Con disco efimero cada arranque estrena contenedor, asi que un bootCount mayor que 1
      // solo puede venir de un almacenamiento que sobrevivio al reinicio.
      survivedRestart: bootCount > 1,
      error: null,
    };
  } catch (error) {
    return { ...vacio, error: error?.message || String(error) };
  }
}
