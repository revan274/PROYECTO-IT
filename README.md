# Mesa IT

Sistema de mesa de ayuda IT con frontend React y backend Node/Express.

## Requisitos
- Node.js 20.19+

## Instalacion
```bash
npm install
```

## Ejecucion
```bash
npm run dev:full
```

Servicios por defecto:
- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`

Tambien puedes correrlos por separado:
```bash
npm run dev
npm run dev:server
```

## Cobertura y versión de Node

CI ejecuta con **Node 20.19.0** y aplica umbrales de cobertura. El proveedor `v8` cuenta
funciones de forma distinta entre versiones de Node: con Node 24 la cobertura de funciones da
por encima del umbral y con Node 20 daba por debajo, así que una comprobación verde en local
podía fallar en CI sin que ningún test fallara.

Para comprobar cobertura igual que CI, usa la misma versión:

```bash
npx -y -p node@20.19.0 node ./node_modules/vitest/vitest.mjs run --coverage
```

## Scripts
- `npm run dev`
- `npm run dev:server`
- `npm run dev:full`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:server`
- `npm run test:server:coverage`
- `npm run test:ui`
- `npm run test:ui:coverage`

## Variables de entorno
Revisa `.env.example`. Variables principales:
- `VITE_API_URL`
- `VITE_API_TIMEOUT_MS`
- `VITE_AUTHOR_BRAND`
- `PORT`
- `CORS_ORIGINS`
- `TRUST_PROXY`
- `AUTH_LOGIN_MAX_ATTEMPTS`
- `AUTH_LOGIN_LOCK_MS`
- `AUTH_LOGIN_TRACK_WINDOW_MS`
- `AUTH_LOGIN_GC_MS`
- `AUTH_DISALLOW_DEMO_PASSWORDS`
- `ALLOW_PRODUCTION_SEED`
- `DATABASE_URL`
- `TICKET_ATTACHMENT_MAX_BYTES`
- `TICKET_ATTACHMENT_MAX_COUNT`
- `VITE_TICKET_ATTACHMENT_MAX_BYTES`
- `VITE_TICKET_ATTACHMENT_MAX_COUNT`
- `PAGINATION_DEFAULT_SIZE`
- `PAGINATION_MAX_SIZE`
- `DB_FILE`
- `DB_BACKUP_ENABLE`
- `DB_BACKUP_KEEP`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (notificaciones por correo; deshabilitadas si `SMTP_USER`/`SMTP_PASS` están vacíos)
- `NOTIFY_TICKET_EMAIL` (correo fijo que recibe siempre la notificación de ticket nuevo)

## Notificaciones por correo de tickets nuevos
Al crear un ticket (`POST /api/tickets`), el sistema intenta notificar por correo (SMTP) a:
- `NOTIFY_TICKET_EMAIL`, si está configurado (siempre).
- El correo del técnico asignado (campo `email` del usuario), si el ticket ya viene asignado y ese usuario tiene correo cargado.

El envío es asíncrono y best-effort: si SMTP falla o no está configurado, la creación del ticket
nunca se ve afectada; el error solo queda en el log del servidor. Los tickets históricos
(`POST /api/tickets/historical`) no generan notificación.

## Datos locales
- El repo conserva un seed sanitizado en `server/data/db.seed.json`.
- Si defines `DATABASE_URL`, el backend usa Postgres/Neon como almacenamiento principal del estado (`users`, `activos`, `insumos`, `tickets`, `auditoria`, `catalogos`).
- En el primer arranque con `DATABASE_URL`, si la base está vacía, el backend la inicializa desde `DB_FILE` si existe o desde `server/data/db.seed.json`.
- La base runtime local no se versiona y por defecto vive en `server/data/runtime/db.json`.
- Si el proceso detecta un disco montado en `/var/data`, usa `/var/data/runtime/db.json` como runtime por defecto.
- Si el runtime DB no existe, el backend lo inicializa automáticamente desde el seed.
- En producción, si `DB_FILE` no existe, el backend falla por seguridad salvo que habilites `ALLOW_PRODUCTION_SEED=true` de forma temporal.
- `server/data/backups/` y `server/data/runtime/` se consideran datos locales.
- Los adjuntos de tickets y respaldos siguen siendo archivos locales; Neon no cubre esos binarios.

## API (resumen)
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/bootstrap`
- `GET /api/summary`
- `GET /api/catalogos`
- `PATCH /api/catalogos` (admin)
- `GET /api/users`
- `POST /api/users` (admin)
- `PATCH /api/users/:id` (admin)
- `DELETE /api/users/:id` (admin)
- `GET /api/activos`
- `GET /api/activos/riesgos`
- `POST /api/activos`
- `POST /api/activos/import`
- `DELETE /api/activos/:id`
- `POST /api/insumos`
- `PATCH /api/insumos/:id/stock`
- `DELETE /api/insumos/:id`
- `GET /api/tickets`
- `POST /api/tickets`
- `POST /api/tickets/historical` (admin) — registro retroactivo de tickets pasados
- `PATCH /api/tickets/:id`
- `PATCH /api/tickets/:id/resolve`
- `POST /api/tickets/:id/comments`
- `POST /api/tickets/:id/attachments`
- `GET /api/tickets/:id/attachments/:attachmentId/download`
- `DELETE /api/tickets/:id/attachments/:attachmentId`
- `GET /api/auditoria`

## Notas
- Todas las rutas de datos requieren `Authorization: Bearer <token>`.
- Los permisos se validan por rol en sesión autenticada.
- Las credenciales remotas de activos ya no se almacenan ni se exponen desde la aplicación.
- En producción debes definir `QR_SIGNING_SECRET`; el backend rechaza valores inseguros por defecto.

## Roles y permisos
- `admin`: acceso total, gestión de catálogos, usuarios y borrado masivo.
- `tecnico`: operación IT sobre activos, insumos y tickets; no gestiona usuarios.
- `consulta`: lectura de operación, reportes y auditoría; no modifica datos.
- `solicitante`: solo flujo de tickets propios; puede crear tickets, comentar, adjuntar y eliminar tickets abiertos creados por sí mismo.
- El rol `admin` debe permanecer activo en el catálogo para evitar bloquear la administración del sistema.

## Despliegue actual

La topología versionada separa los dos servicios:

- Frontend React: Cloudflare Workers/Assets, configurado en `wrangler.jsonc`.
- API Node/Express: Railway, iniciada con `npm start`.
- Persistencia principal: PostgreSQL mediante `DATABASE_URL`.

No existe un `render.yaml` en este repositorio. El despliegue conjunto en Render no
forma parte de la configuración actual.

### API en Railway

1. Conecta el repositorio a un servicio Railway con Node.js 20 o superior.
2. Usa `npm start` como comando de inicio. Railway debe proporcionar `PORT`.
3. Configura, como mínimo:
   - `DATABASE_URL`: conexión PostgreSQL de producción.
   - `CORS_ORIGINS`: origen exacto del frontend de Cloudflare, sin comodines.
   - `QR_SIGNING_SECRET`: secreto largo, aleatorio y exclusivo del entorno.
   - `TRUST_PROXY=1`: un salto de proxy delante de Express.
   - `AUTH_DISALLOW_DEMO_PASSWORDS=true`.
4. Verifica `https://<servicio-railway>/api/health` antes de publicar el frontend.

### Dónde viven los adjuntos

**Con `DATABASE_URL` definido (Neon), los binarios adjuntos se guardan en PostgreSQL**, en
la tabla `mesa_it_attachments`, junto al estado y cubiertos por los mismos respaldos. Ya no
dependen del disco del contenedor, que en Railway es efímero salvo que haya un volumen
montado: antes cada despliegue los borraba mientras la base conservaba los metadatos,
dejando tickets que listaban evidencia imposible de descargar.

Los bytes van a una **tabla propia, nunca al documento JSONB**: ese documento se reescribe
entero bajo un lock global en cada mutación, así que meterle megabytes serializaría toda la
aplicación.

La lectura cae a disco cuando no hay fila, así que los adjuntos anteriores a la migración que
aún sobrevivan se siguen descargando con normalidad. No hay que migrar nada a mano.

Sin `DATABASE_URL` (desarrollo local) se sigue usando el sistema de archivos, y ahí sí
aplican `ATTACHMENTS_DIR` y la advertencia de arranque descritas abajo.

Si `ATTACHMENTS_DIR` no se define, el destino se deriva del directorio de `DB_FILE`.
Esa derivación es una trampa cuando se usa PostgreSQL: `DB_FILE` deja de tener efecto
sobre el estado, nadie lo configura, y los adjuntos caen en el disco efímero del
contenedor. En ese caso el servidor emite una advertencia explícita en el arranque:

```
ADVERTENCIA: Los adjuntos de tickets se guardan en "...", derivado del directorio de datos.
```

Si ves esa línea en los logs de Railway, los adjuntos no están a salvo.

#### Comprobar si el volumen es realmente persistente

La configuración de volúmenes vive en el panel de Railway, no en el repositorio, así que el
código no puede saberla. El servidor la comprueba de forma empírica: en cada arranque
escribe `.storage-marker.json` en el directorio de adjuntos y registra desde cuándo está en
uso. En los logs aparece como:

```
Almacenamiento de adjuntos en uso desde 2026-09-07T16:47:38.065Z (arranque #2, sobrevivio a reinicios anteriores).
```

**Procedimiento:** despliega, anota esa fecha, fuerza un redespliegue y vuelve a mirar.

- La fecha **se conserva** y el contador sube → el volumen es persistente. Los adjuntos están a salvo.
- La fecha **se reinicia** a hoy y el contador vuelve a `#1` → el disco es efímero. Cada
  despliegue borra los adjuntos.

El mismo dato está en `npm run integrity:check` y en `GET /api/diagnostics/storage`
(solo administradores), que además reporta el resumen de integridad:

```json
{
  "storageBackend": "postgres",
  "attachments": {
    "dir": "/mnt/volumen/adjuntos",
    "source": "ATTACHMENTS_DIR",
    "durabilityRisk": false,
    "marker": { "firstSeenAt": "...", "bootCount": 4, "survivedRestart": true }
  },
  "integrity": { "total": 0, "byType": {} }
}
```

### Auditoría de integridad

El estado vive en un único documento JSONB sin foreign keys: la base de datos no puede
rechazar un ticket que apunta a un activo borrado ni dos registros con el mismo id. El
comando `npm run integrity:check` verifica esas garantías (solo lectura) y sale con código
1 si encuentra hallazgos, para poder engancharlo a un monitoreo:

```bash
npm run integrity:check              # local
# Contra la base real: basta la cadena de conexión de Neon, no hace falta ninguna CLI.
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npm run integrity:check
```

Detecta: adjuntos cuyo archivo ya no está en disco, archivos huérfanos que nadie
referencia, tickets apuntando a activos o usuarios inexistentes, e ids duplicados.

### Frontend en Cloudflare

1. Define en `.env.production` la URL absoluta de la API:
   `VITE_API_URL=https://<servicio-railway>/api`.
2. Autentica Wrangler en el entorno de despliegue.
3. Ejecuta:

```bash
npm run deploy
```

El script compila el frontend y publica `dist/` usando `wrangler.jsonc`. Después del
despliegue, confirma que el origen publicado coincide exactamente con
`CORS_ORIGINS` en Railway.
