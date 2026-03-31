# Mesa IT

Sistema de mesa de ayuda IT con frontend React y backend Node/Express.

## Requisitos
- Node.js 20+

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
- `npm run test:ui`

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
- La base runtime local no se versiona y por defecto vive en `server/data/runtime/db.json`.
- Si el proceso detecta un disco montado en `/var/data`, usa `/var/data/runtime/db.json` como runtime por defecto.
- Si el runtime DB no existe, el backend lo inicializa automaticamente desde el seed.
- En produccion, si `DB_FILE` no existe, el backend falla por seguridad salvo que habilites `ALLOW_PRODUCTION_SEED=true` de forma temporal.
- `server/data/backups/` y `server/data/runtime/` se consideran datos locales.

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
- `PATCH /api/tickets/:id`
- `PATCH /api/tickets/:id/resolve`
- `POST /api/tickets/:id/comments`
- `POST /api/tickets/:id/attachments`
- `GET /api/tickets/:id/attachments/:attachmentId/download`
- `DELETE /api/tickets/:id/attachments/:attachmentId`
- `GET /api/auditoria`

## Notas
- Todas las rutas de datos requieren `Authorization: Bearer <token>`.
- Los permisos se validan por rol en sesion autenticada.
- Las credenciales remotas de activos ya no se almacenan ni se exponen desde la aplicacion.
- En produccion debes definir `QR_SIGNING_SECRET`; el backend rechaza valores inseguros por defecto.

## Despliegue en Render (1 servicio)
Este repo incluye `render.yaml` para desplegar frontend + API en el mismo dominio.

1. Sube el repo a GitHub.
2. En Render: `New` -> `Blueprint` -> conecta el repo.
3. Render detecta `render.yaml` y crea el servicio `mesa-it`.
4. Configura variables sensibles en Render:
   - `CORS_ORIGINS`: URL publica del servicio (ej: `https://mesa-it.onrender.com`)
   - `QR_SIGNING_SECRET`: secreto largo y unico
   - El blueprint monta un disco en `/var/data` y permite bootstrap inicial del DB con `ALLOW_PRODUCTION_SEED=true`.
   - Despues del primer arranque exitoso puedes cambiar `ALLOW_PRODUCTION_SEED=false` si quieres fail-closed estricto.
5. Deploy.

El backend sirve automaticamente `dist/` cuando existe build, y la API queda en `/api`.
