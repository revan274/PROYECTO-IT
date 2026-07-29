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

Los adjuntos y respaldos son archivos locales y no se almacenan en PostgreSQL. Si
se necesitan conservar entre despliegues, Railway debe tener un volumen persistente
montado y `DB_FILE` debe apuntar a ese volumen, o los binarios deben migrarse a
almacenamiento de objetos.

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
