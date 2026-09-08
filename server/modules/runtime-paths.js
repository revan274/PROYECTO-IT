// Dónde vive el estado en disco.
//
// Solo aplica cuando NO hay `DATABASE_URL`: en producción el estado está en PostgreSQL y estas
// rutas quedan sin uso. Sirven para desarrollo local y como respaldo del arranque.
//
// Antes existía una regla implícita: si el directorio `/var/data` estaba presente, el runtime
// se mudaba ahí en silencio. Era la convención de disco montado de Render, plataforma que el
// proyecto abandonó. Quedó como código muerto que sugería que montar algo en `/var/data` tenía
// efecto, cuando no lo tiene, y el mismo tipo de resolución implícita ya había costado una
// pérdida de adjuntos.
//
// Ahora el único control es `DB_FILE`: explícito, revisable y sin efectos por descubrimiento.
import path from 'node:path';

export function resolveRuntimePaths({ dbFile, defaultDataDir, cwd = process.cwd() }) {
  const configurado = String(dbFile || '').trim();
  const resuelto = configurado
    ? path.resolve(cwd, configurado)
    : path.join(defaultDataDir, 'runtime', 'db.json');
  const dataDir = path.dirname(resuelto);

  return {
    dbFile: resuelto,
    dataDir,
    backupDir: path.join(dataDir, 'backups'),
    // La semilla viaja con el código, no con el estado: mover DB_FILE no debe dejar
    // al servidor sin datos iniciales.
    seedFile: path.join(defaultDataDir, 'db.seed.json'),
  };
}
