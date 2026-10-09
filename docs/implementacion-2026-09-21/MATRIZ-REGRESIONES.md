# Matriz de regresiones de negocio

Cada fila apunta a una prueba que exige el comportamiento correcto. Las pruebas no se limitan a documentar el fallo encontrado.

| Regresión solicitada | Oráculo de negocio | Cobertura principal |
| --- | --- | --- |
| Ticket resuelto tarde | Cuenta como SLA incumplido aun cuando ya está Resuelto/Cerrado | `src/utils/sla.test.ts` — «un resuelto tarde es incumplido aunque ya esté cerrado» |
| Prioridad modificada | PATCH acepta solo prioridad válida, recalcula el ciclo actual y conserva antes/después | `server/api.integration.test.js` — `TASK-HD-009` |
| Activo renombrado | La relación por ID y el historial sobreviven al cambio de tag | `server/api.integration.test.js` — `TASK-HD-001`; `server/asset-relations.test.js` |
| Activo eliminado | El borrado individual y masivo se rechaza si existen referencias | `server/api.integration.test.js` — `TASK-HD-001` |
| Sucursal eliminada | No se puede quitar una sucursal en uso; desactivarla conserva la etiqueta histórica | `server/api.integration.test.js` — `TASK-HD-001` |
| Búsqueda por folio | UI y API encuentran el folio con el mismo contrato AND, parcial y sin acentos | `src/hooks/useTicketDirectoryData.test.ts`; `server/api.integration.test.js`; `server/ticket-search.test.js` |
| Búsqueda por solicitante | UI y API incluyen identidad visible del solicitante sin ampliar su alcance | Los mismos tres archivos de búsqueda y las pruebas de autorización HTTP |
| Reapertura | Exige motivo, congela el ciclo previo y crea un ciclo nuevo sin sobrescribir hitos | `server/api.integration.test.js` — `TASK-HD-005` y `TASK-HD-007` |
| Historial | Cronología conserva creación, asignación, prioridad, comentario, solución y cierre con actor, ISO y before/after | `server/api.integration.test.js` — `TASK-HD-021`; `src/utils/ticketHistory.test.ts` |
| Ticket duplicado | Dos POST concurrentes con la misma intención devuelven un solo ID; payload distinto con la misma clave da 409; claves distintas permiten incidencias iguales | `server/api.integration.test.js` — `TASK-HD-030`; `server/ticket-idempotency.test.js` |
| Permisos | Consulta no escribe, solicitante no administra, técnico no administra catálogos y solicitante conserva sus operaciones propias | Matriz HTTP en `server/api.integration.test.js`; `server/permissions.test.js`; `src/utils/roles.test.ts` |
| SLA | Calendario, feriados, sábados, esperas, política versionada y resultado congelado mantienen la definición de negocio | `server/business-calendar.test.js`, `server/sla-policy.test.js`, `server/ticket-lifecycle.test.js`, `src/utils/sla.test.ts` |

## Contrato de idempotencia

El cliente envía `Idempotency-Key` al crear un ticket normal o histórico. Conserva la misma clave mientras reintenta el mismo endpoint y payload; la descarta después de una respuesta exitosa o cuando cambia la intención.

El servidor conserva durante 24 horas la huella SHA-256 canónica, el actor, el ámbito y el ID resultante dentro de `meta.ticketCreationIdempotency`. La comprobación ocurre dentro del mismo lock transaccional usado por la mutación del documento:

- primera solicitud: `201`, `Idempotency-Replayed: false`;
- reintento idéntico: `200`, mismo ticket, `Idempotency-Replayed: true`, sin repetir auditoría, stock ni notificaciones;
- misma clave con payload distinto: `409`;
- claves distintas: solicitudes independientes aunque el contenido sea igual.

La clave no sustituye las validaciones, la autenticación ni los permisos. Los clientes que no la envían conservan compatibilidad, pero no obtienen deduplicación de reintentos.
