# Implementacion posterior a la auditoria

Numeracion de la solicitud de 30 tareas; no corresponde al backlog de 18 tareas del informe original. Sin despliegues ni cambios en bases de produccion.

| Tarea | Estado | Frontend | Backend | Base de datos | Tests |
| --- | --- | --- | --- | --- | --- |
| TASK-HD-001 - Relaciones activos/tickets/sucursales | Implementada; revision de datos reales pendiente | Tipos y regla de sucursal compartida | Validaciones y guardas atomicas | activoId; normalizacion compatible JSONB/JSON | 180 backend, 129 UI, tsc/lint/build verdes |
| TASK-HD-002 - Cancelar y archivar expedientes | Implementada | Motivo, cancelar/archivar y estado separado | Retencion atomica; DELETE prohibido | Metadatos de cancelacion/archivo; conserva binarios | 181 backend, 130 UI, tsc/lint/build verdes |
| TASK-HD-003 - Destinos Web Push | Implementada; entrega real pendiente | Rechazo explicado y suscripcion rechazada retirada | Allowlist y DNS validado en socket TLS | Suscripciones legacy no admitidas descartadas al normalizar | 186 backend, 130 UI, tsc/lint/build verdes |
| TASK-HD-004 - Hitos y fechas ISO | Implementada | Cuatro hitos visibles y N/D legacy | Primera atencion, resolucion y cierre separados | fechasVersion=1; fechas desconocidas null, originales conservados | 189 backend, 130 UI, tsc/lint/build verdes |
| TASK-HD-005 - Transiciones y reapertura | Implementada | Selector valido y motivo de reapertura | Maquina de estados; cerrados protegidos | Ultima reapertura y evento con actor/motivo/estado anterior | 190 backend, 130 UI, tsc/lint/build verdes |
| TASK-HD-006 - Solucion obligatoria | Implementada | Modal DS con solucion y diagnostico, reintento conserva texto | Obligatoria en PATCH, resolve e historicos terminales | Campos estructurados y copia en evento | 191 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-007 - Ciclos de atencion | Implementada | Detalle de todos los ciclos | Reapertura inicia ciclo con nuevo vencimiento | Ciclos anteriores preservados, hitos y solucion por ciclo | 192 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-008 - Area y categoria estructuradas | Implementada | Selectores dependientes y administrador de catalogos | Validacion activa/compatible y proteccion de uso | IDs estables y etiquetas historicas; migracion conservadora | 195 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-009 - Reclasificacion de prioridad | Implementada | Selector operativo en pendientes | Validacion estricta, recálculo y auditoría | Actualiza solo ciclo vigente; ciclos previos congelados | 197 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-010 - Creador y solicitante | Implementada | Selector para editores y autor visible | Identidades separadas y autorización por solicitante | createdByUserId/requesterUserId; legacy pendiente explícito | 198 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-011 - Servicios sin activo | Implementada | Tipo explícito y activo opcional | Regla incidente/servicio validada | activoId nullable solo para servicios | 200 backend, 132 UI, tsc/lint/build verdes |
| TASK-HD-012 - SLA historico | Implementada | Dashboard/reportes/Excel alineados; N/D real | Evaluador puro compartido en frontend | Usa fechaResolucion y fechaLimite válidas | 200 backend, 135 UI, tsc/lint/build verdes |
| TASK-HD-013 - Versionado de politica SLA | Implementada | Política, compromiso y resultado visibles por ciclo | Instantánea versionada y resultado congelado | SLA, calendario, vencimiento y revisiones dentro de cada ciclo | 203 backend, 136 UI, tsc/lint/build verdes |
| TASK-HD-014 - Esperas y pausas | Implementada | Modal exige motivo y explica la regla | Pausa/reanudación con minutos hábiles y trazabilidad | Esperas y ajustes de vencimiento por ciclo | 208 backend, 138 UI, tsc/lint/build verdes |
| TASK-HD-015 - Backlog actual | Implementada | Backlog global y bloque histórico separados | Selectores puros por fecha de cada hito | Sin cambio de esquema | 208 backend, 140 UI, tsc/lint/build verdes |
| TASK-HD-016 - Primera respuesta | Implementada | Promedio, mediana y P90 en reportes | Cálculo puro creación→primera atención | Usa hitos existentes; datos incompletos quedan N/D | 208 backend, 141 UI, tsc/lint/build verdes |
| TASK-HD-017 - Tiempo de resolucion | Implementada | Promedio, mediana y P90 por ciclo en UI, Excel e imprimible | Cálculo puro por ciclos resueltos | Usa inicio/resolución por ciclo; legado explícito | 208 backend, 142 UI, tsc/lint/build verdes |
| TASK-HD-018 - Busqueda compartida | Implementada | Hook usa índice compartido y datos de activos/catálogos | GET tickets usa el mismo matcher AND | Sin cambio de esquema | 211 backend, 143 UI, tsc/lint/build verdes |
| TASK-HD-019 - Filtros combinados | Implementada | 10 dimensiones, limpiar, conteo y vacío; estado persiste al navegar | Selectores puros sobre tickets autorizados | Sin cambio de esquema | 211 backend, 144 UI, tsc/lint/build verdes |
| TASK-HD-020 - Exportacion consistente | Implementada | Excel/CSV usan filas filtradas y muestran cantidad | Sin cambio | Sin cambio de esquema | 211 backend, 146 UI, tsc/lint/build verdes |
| TASK-HD-021 - Cronologia completa | Implementada | Timeline completo y carga progresiva de 10 eventos | Eventos tipados con actor, fecha y antes/después | Normalización compatible del historial legacy | 212 backend, 148 UI, tsc/lint/build verdes |
| TASK-HD-022 - Incidencias por activo | Implementada | Historial, recurrencia de 90 días y acceso al ticket | Usa tickets ya autorizados del bootstrap | Relación por activoId; fallback legacy controlado | 212 backend sin cambios, 150 UI, tsc/lint/build verdes |
| TASK-HD-023 - Aviso de resolucion | Implementada; entrega real pendiente de SMTP | Sin cambio visual | Aviso al solicitante por ID en ambos endpoints de resolución | Sin cambio de esquema | 214 backend, 150 UI, tsc/lint/build verdes |
| TASK-HD-024 - Aviso de comentarios | Implementada; entrega real pendiente de SMTP | Marca accesible “requiere respuesta” por comentario | Destinatario según actor y vínculo estable; sin aviso por defecto | Evento conserva requiereRespuesta | 216 backend, 150 UI, tsc/lint/build verdes |
| TASK-HD-025 - Entrega y reintentos | Implementada; validación con proveedores reales pendiente | Sin cambio visual | Ledger pending/sent/failed, confirmación, deduplicación y hasta 3 intentos | Migración compatible de mesa_it_avisos_enviados | 215 backend, 150 UI, tsc/lint/build verdes |
| TASK-HD-026 - Accesibilidad y Design System | Implementada | Labels/ARIA, DS existente y adjuntos por teclado | Sin cambio | Sin cambio de esquema | 215 backend sin cambios, 151 UI, tsc/lint/build verdes |
| TASK-HD-027 - Responsive real | Implementada | Validación visual en cuatro tamaños; acciones de áreas corregidas en móvil | Sin cambio | Sin cambio de esquema | 215 backend sin cambios, 151 UI, tsc/lint/build verdes |
| TASK-HD-028 - Paginacion operativa | Implementada | 20 por página y detalle completo bajo demanda | Resúmenes en bootstrap/listado; GET de detalle autorizado | Sin cambio de esquema | 216 backend, 152 UI, tsc/lint/build verdes |
| TASK-HD-029 - Medicion de persistencia | Implementada | Sin cambio visual | Medidor y CLI reproducible; documentación de ejecución | Línea base local: 139,560 B JSON, ciclo p95 0.93 ms; sin migración propuesta hasta medir PostgreSQL/Neon representativo | 4 regresiones nuevas; 220 backend, 152 UI, tsc/lint/build verdes |
| TASK-HD-030 - Regresiones de negocio | Implementada | Clave por intención conservada durante reintentos | Idempotencia atómica, replay sin efectos laterales y conflicto 409; matriz de bugs cubierta | Registro de claves/huellas con caducidad de 24 h dentro de `meta` | 5 regresiones nuevas; 225 backend, 152 UI, tsc/lint/build verdes |

## TASK-HD-001

- La relacion usa activoId; el tag visible se sincroniza al editar/importar sin modificar eventos historicos. Solo se migran tags legacy unicos. IDs ausentes, tags ambiguos y referencias inexistentes se marcan activoReferenciaPendiente para revision, sin reasignacion posterior por reutilizacion de tags.
- Alta normal e historica exigen sucursal del activo conocida y coincidente. Frontend/backend comparten resolucion por codigo exacto. La sucursal del ticket conserva la ubicacion del incidente: trasladar el activo despues no cambia ese dato historico.
- Borrado individual y masivo rechazan con 409 activos usados; masivo es todo o nada. Activos sin referencias siguen siendo eliminables. Sucursales usadas pueden desactivarse, pero no eliminarse. La interfaz muestra los errores de API mediante sus avisos existentes.
- No se borran codigos historicos desconocidos durante la normalizacion. integrity:check identifica las referencias pendientes. La correccion de datos reales requiere examinar esos datos; esta implementacion no conecto produccion ni garantiza ausencia de huerfanos preexistentes.
- Verificado: renombrado, importacion por serial, identidad/historial conservados, incompatibilidad de sucursal en altas normales/historicas, rechazo de borrados, desactivacion conservadora y eliminacion permitida de activo sin tickets.
- Validacion: npx tsc -b, ESLint de archivos tocados, 180/180 backend, 129/129 UI y build verdes. UI requirio ejecucion fuera del sandbox por lectura de esbuild; no fue fallo funcional.

## TASK-HD-002

Politica aplicada: cancelar solo pendientes; solicitante solo sus propios Abiertos, editores cualquier pendiente. Archivar solo terminados por editores; conserva el estado terminal. Motivo obligatorio (1-2000 caracteres), actor, ISO UTC, estado anterior y evento anexado. No se libera stock historico al cancelar: su consumo previo sigue registrado. Purga fisica deshabilitada para todos los roles; habilitarla requiere una politica administrativa independiente, no un permiso implicito de tecnico/admin.

Expedientes cancelados/archivados no permiten PATCH, resolver ni borrar adjuntos; guardas dentro de la transaccion. Comentarios y descargas autorizadas siguen disponibles. Dashboard muestra Cancelado como estado separado; se excluye de pendientes y del denominador SLA existente, reportes no lo cuentan como resuelto y Excel muestra NO APLICA. La formula historica SLA restante se corregira en TASK-HD-012.

Pruebas verifican cancelacion con evidencia descargable identica, historial previo conservado, autor/motivo/fecha, bloqueo de purga para admin/tecnico/solicitante, bloqueo de reactivacion y borrado de adjuntos, IDOR de cancelacion y archivo de resuelto conservando estado. Validaciones obligatorias verdes: 181 backend, 130 UI.

## TASK-HD-003

Allowlist de fcm.googleapis.com, updates.push.services.mozilla.com, subdominios de push.apple.com y notify.windows.com. Se rechazan credenciales, fragmentos, puertos alternos, localhost, IP literales y dominios ajenos antes de cualquier conexion. Un agente HTTPS dedicado valida todas las respuestas DNS usadas por el socket y entrega exclusivamente direcciones publicas; no hay segunda resolucion sin validar. TLS conserva hostname/SNI/certificado. web-push no sigue redirects (comprobado en la dependencia instalada). Timeout 15 segundos y errores sin endpoints, claves ni cuerpo de proveedor.

La normalizacion descarta suscripciones no admitidas; no cambia updatedAt de las validas. La UI muestra el rechazo y retira la suscripcion local ante HTTP 400. Pruebas simuladas de DNS privado/mixto, nuevas conexiones, prefijos IPv4/IPv6, dominios falsos, limpieza de expiradas y envio a proveedor permitido. No se enviaron notificaciones reales ni se probaron credenciales VAPID de produccion.

Referencias de proveedores: [Mozilla](https://mozilla-services.github.io/autopush-rs/), [Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [Google](https://firebase.google.com/docs/reference/fcm/rest), [Microsoft](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config). Defensa de red: [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## TASK-HD-004

Primera atencion se registra una sola vez al entrar en En Proceso o resolver directamente; asignar no cuenta. Resolver no fija cierre; cerrar registra un instante independiente. Al reabrir se conservan hitos anteriores en un evento antes de limpiar el ciclo actual (modelo completo de ciclos pendiente en 007). Eventos nuevos usan ISO UTC; detalle muestra los cuatro hitos. Historicos mantienen fechas expresamente capturadas y no infieren primera atencion ni resolucion de un cierre.

Migracion idempotente: fechas regionales se conservan en fechaLegacy/fecha*Legacy con fecha normalizada null; fechaCierre del esquema anterior se conserva en fechaTerminalLegacy porque no demuestra cierre real. No se inventan creacion, vencimiento ni eventos ausentes. No se modifica evidencia anterior para aparentar datos completos. Esta migracion puede reducir cohortes historicas evaluables, deliberadamente, hasta revisar los registros legacy.

189 pruebas backend, 130 UI, TypeScript, ESLint y build verdes.

## TASK-HD-005

Se conserva la nomenclatura existente: Abierto representa nuevo/reabierto y asignacion es un atributo. Abierto pasa a En Proceso, En Espera o Resuelto; En Proceso/En Espera alternan entre si o resuelven; Resuelto cierra o reabre a Abierto; Cerrado solo reabre formalmente a Abierto. Cancelado/archivado no reactivan. Cierre directo desde pendiente rechazado. Reapertura exige motivo 1-2000 caracteres y registra actor, ISO UTC y estado anterior. Cerrado no admite otras ediciones operativas. Comentarios anexados siguen permitidos como informacion adicional.

190 backend, 130 UI, TypeScript, ESLint y build verdes. Reglas compartidas usadas por API y opciones del selector, con validacion atomica antes de modificar datos.

## TASK-HD-006

Modal reutiliza ModalLayout/Field/TextArea/Button con labels y errores asociados; solucion obligatoria, diagnostico opcional (hasta 8000 caracteres). Mantiene texto ante fallo y evita doble envio mientras guarda. Selector Resuelto y boton Resolver abren la misma captura. API exige solucion explicita en ambas rutas y en altas historicas terminales. Detalle muestra ambos campos y evento conserva la solucion. No se rellena solucion para expedientes anteriores.

191 backend y 132 UI, TypeScript, ESLint y build verdes; incluye rechazos de valores vacios/tipo incorrecto/longitud, y reintento de formulario.

## TASK-HD-007

Cada ticket nuevo inicia ciclo 1. Cada reapertura agrega ciclo con inicio, motivo/actor, vencimiento recalculado desde reapertura y primera atencion propia; la primera atencion global no se sobrescribe. Ciclo anterior conserva prioridad, responsable, solucion, diagnostico, hitos y vencimiento. Se permite consultar todos los ciclos desde detalle. El modelo legacy solo reconstruye el ciclo conocido y lo marca como incompleto, sin fabricar ciclos perdidos. Prueba API verifica igualdad profunda del ciclo anterior despues de nueva atencion/resolucion y persistencia. Versionado completo de politica y evaluador historico corresponden a 013/012.

192 backend, 132 UI, TypeScript, ESLint y build verdes.

## TASK-HD-008

Los tickets nuevos guardan `areaId`, `categoriaId` y una copia de los nombres visibles. Área y categoría son obligatorias, deben estar activas y la categoría debe pertenecer al área. La descripción queda como texto propio y deja de incorporar el prefijo `Área afectada`. El formulario filtra categorías al cambiar de área y las tarjetas muestran ambas etiquetas.

Administradores pueden agregar, renombrar, activar, desactivar y retirar opciones desde Usuarios. La API normaliza IDs, rechaza pares incompatibles y bloquea con 409 la eliminación de un área o categoría usada; desactivarla conserva tickets y etiquetas históricas. Renombrar el catálogo tampoco reescribe la etiqueta almacenada en expedientes anteriores.

La migración solo asigna IDs cuando una descripción legacy coincide de forma inequívoca con `Área afectada: … | …`; cualquier registro sin coincidencia exacta queda `clasificacionPendiente` para revisión. No se inventa una categoría por palabras parecidas. Verificado con creación válida, par incompatible, alta y desactivación de catálogos, protección referencial y persistencia de nombres. 195 backend, 132 UI, TypeScript, ESLint y build verdes.

## TASK-HD-009

Técnico y administrador pueden reclasificar tickets activos desde la tarjeta. El backend acepta exclusivamente `MEDIA`, `ALTA` o `CRITICA`; un valor desconocido ya no cae silenciosamente en MEDIA, tanto en creación como en altas históricas y PATCH. Tickets terminales requieren reapertura antes de cambiar prioridad.

El vencimiento se recalcula desde el inicio del ciclo vigente con el calendario laboral existente. El evento registra actor, prioridad anterior/nueva y ambos vencimientos; la auditoría general conserva los mismos datos. `syncTicketCycle` actualiza el ciclo actual y no toca ciclos anteriores ya congelados. Verificado con prioridad inválida, recálculo MEDIA→ALTA, persistencia atómica, historial y bloqueo tras resolución. 197 backend, 132 UI, TypeScript, ESLint y build verdes.

## TASK-HD-010

Los tickets nuevos guardan `createdByUserId` y `requesterUserId` junto con copias de nombre/username. Un empleado que crea su ticket queda en ambas identidades; técnico o administrador puede seleccionar un usuario activo y el formulario distingue “Registrado por” de “Solicitante”. La tarjeta muestra al creador cuando difiere del solicitante.

La visibilidad, comentarios, adjuntos y demás controles de solicitante usan `requesterUserId` como autoridad, con `solicitadoPorId` como alias compatible. Un solicitante no puede atribuir el ticket a otra persona y un ID inexistente/inactivo se rechaza. Registros legacy conservan el solicitante fuerte disponible, pero dejan `createdByUserId=null` y `createdByLegacyPending=true` porque no hay evidencia para inventar quién capturó el caso. Verificado con captura por llamada, acceso del solicitante correcto, intento de suplantación, usuario inexistente y autoregistro. 198 backend, 132 UI, TypeScript, ESLint y build verdes.

## TASK-HD-011

El formulario distingue `INCIDENTE_ACTIVO` y `SOLICITUD_SERVICIO`. El incidente sigue exigiendo un activo existente de la misma sucursal. En un servicio el activo es opcional; si se proporciona, conserva el vínculo estable y se valida igual. Tarjetas y exportaciones muestran “Solicitud de servicio”/“SIN ACTIVO” en vez de inventar un TAG, y el botón Ver activo solo aparece cuando existe relación.

La API aplica la misma regla a altas normales e históricas. Un servicio crítico sin activo no modifica el estado de inventario. Los tickets anteriores se normalizan como incidentes porque el esquema previo exigía equipo. Verificado con servicio sin activo, servicio relacionado, incidente incompleto, tipo desconocido e inventario sin cambios laterales. 200 backend, 132 UI, TypeScript, ESLint y build verdes.

## TASK-HD-012

Se separaron dos conceptos. El SLA operativo continúa contando únicamente pendientes actualmente vencidos mediante `isTicketSlaExpired`. El cumplimiento histórico usa `evaluateTicketHistoricalSla`: solo Resuelto/Cerrado con `fechaResolucion` y `fechaLimite` válidas entra al denominador; resolución hasta el límite es CUMPLIDO y después del límite es INCUMPLIDO. Cancelados, abiertos y fechas insuficientes quedan fuera y, si no hay evaluables, el porcentaje es `null` y la UI muestra N/D.

Dashboard, Reportería, Excel y reporte imprimible consumen el mismo evaluador/etiquetador. El detalle distingue CUMPLIDO, INCUMPLIDO, N/D, VENCIDO y EN TIEMPO según corresponda. La tarjeta de dashboard ya no llama “vencidos” a los incumplimientos históricos; el vencido operativo permanece en su indicador independiente. Regresiones cubren tardío cerrado, puntual, datos incompletos, abiertos y denominador vacío. 200 backend, 135 UI, TypeScript, ESLint y build verdes.

## TASK-HD-013

Cada ciclo nuevo conserva una instantánea del SLA asignado: prioridad, horas, fecha de asignación, inicio, vencimiento, zona horaria, jornada, feriados y versión de política. La versión puede definirse con `SLA_POLICY_VERSION`; cuando falta, se deriva mediante SHA-256 de las horas y el calendario efectivos, de modo que un cambio real de configuración genera otra identidad. La instantánea también incluye el ID y número de ciclo.

Reclasificar prioridad agrega una revisión con las asignaciones anterior y nueva, actor, fecha y motivo. Resolver congela `CUMPLIDO` o `INCUMPLIDO` junto con las fechas y versión usadas; el evaluador de dashboard/reportes da preferencia a ese resultado persistido, por lo que modificar campos visibles después no reescribe el histórico. Reabrir limpia únicamente el resultado actual, crea otra asignación para el ciclo nuevo y deja el anterior sin cambios.

Los tickets anteriores reciben una instantánea explícitamente marcada `reconstruccionLegacy`, con prioridad y vencimiento conocidos, pero versión, horas y calendario en N/D. No se atribuye una política histórica que los datos no demuestran. Verificado con cambio de calendario/versionado, creación, reclasificación, resolución, cierre, reapertura y persistencia del ciclo congelado. 203 backend, 136 UI, TypeScript, ESLint y build verdes.

## TASK-HD-014

Entrar a En Espera exige seleccionar un motivo válido; la API rechaza transiciones sin motivo aunque se invoque directamente. La política central compartida queda definida así: usuario, proveedor y refacción pausan el SLA; autorización no lo pausa. El modal muestra la consecuencia antes de guardar, por lo que el estado por sí solo no decide silenciosamente el comportamiento.

Cada espera guarda motivo, etiqueta, regla aplicada, inicio, fin, actor y minutos hábiles pausados dentro del ciclo. Al reanudar o resolver, el servidor cuenta únicamente minutos dentro de la jornada y fuera de feriados, extiende el vencimiento por esa cantidad y registra una revisión SLA con compromiso anterior/nuevo. Una espera sin pausa conserva el vencimiento. Resolver directamente desde En Espera también cierra la espera antes de congelar el resultado histórico.

Registros ya existentes en En Espera sin evento estructurado no reciben un motivo inventado. La regla se aplica desde las nuevas transiciones. Verificado con rechazo sin motivo, autorización sin pausa, espera de usuario con pausa, reanudación, resolución desde espera, calendario con sábado corto y persistencia por ciclo. 208 backend, 138 UI, TypeScript, ESLint y build verdes.

## TASK-HD-015

El dashboard separa el snapshot operativo del rango histórico. Backlog actual calcula sobre todos los tickets pendientes accesibles al usuario, sin filtrar por creación: abiertos, críticos, vencidos, sin asignar, En Proceso, carga por técnico y aging. Un ticket abierto de hace seis meses permanece en esos conteos cuando el período es Hoy o 30 días.

El bloque Métricas del período usa la fecha propia de cada hito: creados por `fechaCreacion`, resueltos por `fechaResolucion` y cerrados por `fechaCierre`. El cumplimiento SLA del período se calcula sobre las resoluciones de esa ventana. Distribución, sucursal y actividad reciente continúan rotuladas como cohorte histórica del período. Los indicadores de backlog se rotulan como snapshot y dejaron de mostrar tendencias basadas en una cohorte de creación.

Los accesos a Abiertos, Críticos, Sin asignar y SLA vencido abren Tickets con el mismo alcance global; Críticos ahora fuerza además el filtro de pendientes para no incluir terminales. Pruebas cubren un pendiente de 180 días, una resolución actual de un ticket antiguo, cierre, SLA y carga por técnico. 208 backend, 140 UI, TypeScript, ESLint y build verdes.

## TASK-HD-016

Primera respuesta se calcula exclusivamente como `fechaPrimeraAtencion - fechaCreacion`. No usa resolución, cierre, asignación ni comentarios como sustitutos. El cálculo es tiempo natural transcurrido; no se etiqueta como horas laborables. Fechas ausentes, inválidas o anteriores a la creación quedan fuera del conjunto y se muestran como N/D cuando no hay casos evaluables.

Reportería muestra promedio, mediana y P90 en un bloque identificado como Atención inicial, con una aclaración visible de que no es tiempo de resolución. La mediana incluye comparativo contra el período anterior. El mismo conjunto de valores aparece en Excel y en el reporte ejecutivo imprimible. Las regresiones usan tiempos de 1, 3 y 10 horas y comprueban promedio 4.7, mediana 3 y P90 8.6, además de omitir hitos inválidos. 208 backend, 141 UI, TypeScript, ESLint y build verdes.

## TASK-HD-017

El MTTR se define como tiempo natural desde el inicio de cada ciclo hasta su resolución. Cada ciclo resuelto aporta una observación; por ello un ticket reabierto puede aportar varios tiempos independientes y conserva la historia de cada atención. En registros legacy sin ciclos se usa `fechaCreacion → fechaResolucion`. `fechaCierre` nunca sustituye una resolución ausente ni amplía el tiempo técnico con el cierre administrativo.

Reportería, Excel y el reporte ejecutivo muestran promedio, mediana y P90 con la misma definición visible. Fechas ausentes, inválidas o invertidas quedan fuera y producen N/D cuando no existe una resolución evaluable. La regresión cubre dos ciclos de 4 y 2 horas, un legado de 3 horas cuyo cierre ocurre después y un cerrado sin resolución; obtiene promedio/mediana 3 y P90 3.8 sin incorporar el cierre. 208 backend sin cambios en esta tarea, 142 UI, TypeScript, ESLint y build verdes.

## TASK-HD-018

Frontend y `GET /api/tickets` consumen `shared/ticket-search.js`. El contrato forma un único texto normalizado con folio, nombre/usuario del solicitante, técnico, ID/tag y datos descriptivos del activo, descripción, código/nombre de sucursal, área y categoría. La consulta se normaliza sin distinguir mayúsculas ni acentos, conserva coincidencia parcial y exige que todos los términos aparezcan, aunque estén en campos distintos.

La UI resuelve el activo por ID estable y usa el tag como compatibilidad legacy; la API aplica la misma precedencia. La prueba del matcher verifica todos los campos y términos con acentos, la prueba del hook combina folio/solicitante/serie/categoría/sucursal y la integración HTTP cubre búsquedas multi término y el caso sin coincidencia. 211 backend, 143 UI, TypeScript, ESLint y build verdes.

## TASK-HD-019

Tickets permite combinar estado, prioridad, técnico, sucursal, área, categoría, solicitante, activo, fecha de creación y SLA; conserva además los filtros anteriores de ciclo y asignación. Técnico, solicitante y activo se comparan por ID y mantienen una compatibilidad controlada por nombre/tag para expedientes legacy sin ID. El SLA distingue vencido operativo, pendiente en tiempo, cumplimiento, incumplimiento y casos no evaluables.

El rango de fechas incluye completos ambos días. Cambiar de vista no desmonta el estado de `App`, por lo que la selección se conserva durante la navegación de la sesión. “Limpiar filtros” restablece todas las dimensiones y la búsqueda; los accesos desde dashboard/reportes también limpian primero el alcance anterior antes de aplicar su filtro. La vista anuncia “Mostrando X de Y tickets accesibles” y conserva el estado vacío existente.

La prueba combina simultáneamente las diez dimensiones y exige un único resultado. 211 backend sin cambios adicionales, 144 UI, TypeScript, ESLint y build verdes.

## TASK-HD-020

Excel y el nuevo CSV de Reportería reciben exclusivamente `reportTickets`, el conjunto ya filtrado por fecha, sucursal, área, estado, prioridad, atención y técnico. Ambos formatos usan el mismo constructor de filas y conservan el mismo orden; no leen ni heredan los filtros del módulo Tickets. La interfaz muestra “Exportando X registros según los filtros de Reportería” y el aviso de cada descarga repite la cantidad.

Las filas incluyen IDs numéricos, fechas ISO de creación/primera atención/resolución/cierre, clasificación y datos operativos. El CSV usa el serializador central que escapa comillas y neutraliza `=`, `+`, `-`, `@`, tabulador y retorno antes de que una hoja de cálculo pueda interpretarlos. Las regresiones comprueban cantidad exacta, ID numérico, fecha, `ñ`, `á é í ó ú` y una fórmula maliciosa. 211 backend sin cambios, 146 UI, TypeScript, ESLint y build verdes.

## TASK-HD-021

El detalle de cada ticket muestra una cronología completa ordenada por fecha, separada de la captura de comentarios. Ya no descarta eventos sin texto ni limita la consulta a los cuatro comentarios recientes. Presenta diez eventos inicialmente y permite cargar diez más sin perder el contexto del ticket.

Los eventos nuevos usan una estructura común con `actorId`, nombre mostrado, fecha ISO UTC, tipo, acción, estado, valores `before`/`after` y comentario opcional. Se generan eventos específicos para creación, asignación/reasignación, prioridad, estado, espera, reapertura, diagnóstico/solución, cierre, cancelación, comentarios y altas/bajas de adjuntos. La interfaz expone diagnóstico, solución y los cambios relevantes sin depender de una frase genérica.

La normalización conserva entradas anteriores, convierte fechas regionales solo cuando son inequívocas y marca como `null` lo desconocido; no inventa actor, fecha ni valores previos. La prueba HTTP recorre creación, asignación, prioridad, comentario, diagnóstico/solución y cierre, y comprueba atribución, ISO, tipos y cambios estructurados. Las utilidades UI verifican orden y representación de valores. 212 backend, 148 UI, TypeScript, ESLint y build verdes.

## TASK-HD-022

El detalle del activo incorpora la sección Incidencias / Tickets. Ordena el historial más reciente primero y muestra folio, fecha de creación, categoría, problema, estado, prioridad, técnico y solución. El estado vacío es explícito. Cada entrada incluye “Abrir ticket”, que cierra el modal, limpia filtros incompatibles y abre Tickets buscando el folio seleccionado.

La relación prioriza `activoId`. El tag solo se usa para expedientes legacy sin ID y sin marca de referencia pendiente; un ticket con otro ID nunca se asocia por coincidencia de tag. El conjunto procede de los tickets ya autorizados para el usuario, por lo que la vista no amplía acceso. El indicador de 90 días cuenta únicamente incidentes del activo con fecha válida dentro de la ventana, sin predicción ni heurísticas.

Las regresiones cubren ID estable, compatibilidad legacy, rechazo de ID ajeno/tag reutilizado, orden cronológico, exclusión de servicios y ventana de 90 días. 212 backend sin cambios en esta tarea, 150 UI, TypeScript, ESLint y build verdes.

## TASK-HD-023

Resolver un ticket, tanto mediante el endpoint dedicado como mediante la transición general, prepara un único aviso dirigido al solicitante activo identificado por `requesterUserId`/`solicitadoPorId`. No se busca por nombre ni se difunde a técnicos o buzones generales, evitando homónimos y exposición a destinatarios ajenos. Un expediente legacy sin identidad fuerte no recibe un correo atribuido por conjetura.

El mensaje contiene únicamente folio, resumen, solución, técnico y fecha de resolución. Omite prioridad, sucursal, activo, SLA, datos del solicitante y demás contexto no necesario. Todo texto de usuario se escapa para HTML. El envío conserva el comportamiento no bloqueante existente; la confirmación y reintentos se completarán en TASK-HD-025.

Las pruebas verifican destinatario por ID, ausencia de destinatario sin identidad fuerte, contenido exigido y exclusión de campos adicionales. 214 backend, 150 UI, TypeScript, ESLint y build verdes. La entrega real depende de SMTP configurado y no se ensayó contra producción.

## TASK-HD-024

Agregar un comentario no envía avisos por defecto. El autor debe marcar explícitamente “Este comentario requiere respuesta”; el valor se envía a la API, se guarda en el evento de historial y se limpia junto con el borrador después de guardar. La casilla usa el componente `Input`, tiene label programático y mantiene disponible el flujo por teclado.

Cuando el solicitante pide respuesta se avisa únicamente al técnico asignado por ID; si todavía no hay responsable, se usa solo el buzón operativo general. Cuando soporte pide respuesta se avisa únicamente al solicitante identificado por ID. Se excluye al propio autor y no se resuelven destinatarios por nombres. El mensaje contiene folio, comentario, autor y fecha, sin activo, sucursal, prioridad o SLA.

Las pruebas cubren ambos sentidos de conversación, el fallback de ticket sin asignar, la falta de difusión y el contenido mínimo. 216 backend, 150 UI, TypeScript, ESLint y build verdes. La entrega real depende de SMTP configurado y se aborda con estados/reintentos en TASK-HD-025.

## TASK-HD-025

El ledger de notificaciones registra `pending` al adquirir un envío, `sent` únicamente después de que el proveedor confirma `sent: true` y `failed` cuando devuelve o lanza un error. Conserva número de intentos, error resumido, actualización, próxima fecha de reintento y token de lease. La actualización por token impide que un proceso atrasado cambie el resultado de otro intento.

La adquisición usa `INSERT ... ON CONFLICT ... DO UPDATE` condicionado por estado, fecha y máximo de intentos. Un `sent` no se vuelve a enviar; un `failed` espera antes de reintentar y se detiene después de tres intentos; un `pending` abandonado puede recuperarse al expirar su lease. Las claves distinguen creación, asignación concreta, comentario, resolución por ciclo y aviso SLA por ciclo, evitando tanto duplicados como el bloqueo de un ciclo reabierto.

La tabla existente se migra de forma compatible: filas históricas se consideran enviadas y `enviado_en` deja de completarse al crear un pendiente. En desarrollo con archivo se aplica la misma máquina de estados en memoria. SLA reintenta en sus siguientes pasadas; creación, asignación, resolución y comentario programan hasta tres intentos sin bloquear la petición HTTP.

Las regresiones observan `pending` durante el envío, confirman `sent` solo tras éxito, ejercitan `failed → retry → sent`, máximo de intentos, deduplicación, SQL atómico y recuperación de DDL. 215 backend, 150 UI, TypeScript, ESLint y build verdes. Falta comprobar entrega y reintentos contra SMTP/Neon reales en staging.

## TASK-HD-026

El formulario de tickets usa `Field` y asociaciones `htmlFor`/`id` para tipo, sucursal, activo, área, categoría, modalidad, descripción, falla sugerida, prioridad, técnico, solicitante, creador, sucursal informativa y campos históricos. Los formularios de activos e insumos, el escáner QR y el prompt incorporan nombres accesibles explícitos donde el diseño aún usa placeholders compactos. Los botones solo icono conservan su `aria-label` y los botones con texto mantienen nombre visible.

El selector de adjuntos del ticket dejó de usar `display:none`: el input queda visualmente oculto con `sr-only`, permanece en el orden de Tab y el contenedor muestra un anillo de foco. La importación de inventario se activa con un botón nativo accesible y el input asociado también tiene nombre. Se reutilizaron `Field`, `Input`, `Select`, `TextArea` y `Button`; no se creó ninguna piel ni variante nueva.

Una regresión DOM renderiza el formulario administrativo completo y falla si un `input`, `select`, `textarea` o `button` queda sin label, `aria-label`, `aria-labelledby` o texto accesible. 215 backend sin cambios en esta tarea, 151 UI, TypeScript, ESLint y build verdes.

## TASK-HD-027

La aplicación se revisó en navegador real local con viewports de 1920×1080, 1366×768, 768×1024 y 390×844. Se inspeccionaron Dashboard, Inventario, Tickets, Reportería, Insumos, Auditoría y Usuarios, además de los formularios de alta de activo y ticket. En los cuatro tamaños el documento conserva su ancho de viewport, el menú lateral se transforma en panel móvil y los encabezados, métricas, filtros y modales siguen siendo utilizables.

La revisión móvil descubrió un problema reproducible en Usuarios: cada fila de Áreas y categorías mantenía nombre, estado y eliminación en una sola línea; el botón de eliminación quedaba recortado fuera de la tarjeta. La fila ahora usa dos columnas en móvil, coloca el nombre en una línea completa y mantiene estado y acción dentro del ancho; desde `sm` recupera la distribución horizontal. Se reutilizaron `Input` y `Button` existentes, sin añadir variantes ni rediseñar la vista.

La comprobación posterior confirmó los botones de eliminación completamente dentro de 390 px y ausencia de desbordamiento horizontal. TypeScript, ESLint del componente, 151 UI y build verdes. El build conserva la advertencia ya existente por un chunk principal de 502.26 kB; TASK-HD-028 aborda transferencia y carga operativa.

## TASK-HD-028

El bootstrap y `GET /api/tickets` dejaron de serializar `historial` y `attachments` para cada ticket. El resumen conserva los campos usados por búsqueda, filtros, dashboard, reportes y exportaciones, y añade `historialCount`, `attachmentCount` y `ultimoComentario`. De esta forma los totales y cálculos siguen operando sobre todos los tickets autorizados sin transferir cada cronología ni la lista completa de evidencias. La versión del ETag de bootstrap subió a v3 para evitar reutilizar una representación anterior durante una sesión activa.

`GET /api/tickets/:id` devuelve el expediente completo únicamente bajo demanda y aplica el mismo alcance por usuario; un solicitante obtiene 404 para un ticket ajeno. La vista muestra 20 resúmenes por página, permite elegir 10/20/50 y conserva los filtros antes de paginar. Al abrir “Ver detalle” obtiene ciclos, adjuntos y cronología, presenta carga/error/reintento y vuelve a pedir el detalle si cambia el resumen de un ticket expandido. Subidas respetan `attachmentCount` antes de disponer del detalle.

La integración verifica que bootstrap y páginas omiten las colecciones pesadas, conservan conteos/comentario, y que el endpoint de detalle incluye ambas colecciones con autorización. La UI comprueba que no existe petición de detalle antes de expandir, que aparece la cronología después de hacerlo y que 21 resúmenes se reparten en páginas 20+1. 216 backend, 152 UI, TypeScript, ESLint y build verdes. El bootstrap aún entrega todos los resúmenes porque dashboard, filtros y exportación necesitan el conjunto completo; la medición de TASK-HD-029 determinará si conviene mover también esos agregados al servidor.

## TASK-HD-029

Se añadió `npm run persistence:measure`, un diagnóstico reproducible que no modifica el documento de negocio ni ejecuta migraciones. El modo local mide volumen por entidad, bytes JSON/gzip, parseo, serialización, ciclo completo de reescritura y espera sintética con concurrencias 1/2/4/8. El modo PostgreSQL solo se habilita con `MEASURE_DATABASE_URL`: consulta tamaño y volumen reales, mide lecturas, reescribe una tabla temporal que se descarta con `ROLLBACK` y usa dos conexiones con un advisory lock reservado para observar espera. Nunca actualiza `mesa_it_state`.

La línea base local quedó guardada en `MEDICION-PERSISTENCIA.json` y `MEDICION-PERSISTENCIA.md`: 139,560 bytes compactos, 17,889 bytes gzip, ciclo parsear→mutar→serializar p95 de 0.93 ms y espera sintética p95 de 20.529 ms con concurrencia 8. La muestra contiene 154 activos y 98 filas de auditoría, pero cero tickets; por ello no se usa para extrapolar producción ni autoriza un rediseño.

La decisión registrada es conservar la arquitectura actual hasta ejecutar la medición contra un staging representativo y contrastar lectura, reescritura y espera de lock p95 con un SLO acordado. El README documenta ese procedimiento y advierte no usar producción para pruebas de concurrencia. Las pruebas verifican cálculos, percentiles, ausencia de mutación y el texto de decisión. 220 backend, 152 UI, TypeScript, ESLint y build verdes; el build mantiene la advertencia del chunk principal de 505.02 kB.

## TASK-HD-030

Los fallos pedidos quedaron trazados a pruebas con oráculos de negocio en `MATRIZ-REGRESIONES.md`: SLA tardío, reclasificación de prioridad, renombrado/borrado de activos, eliminación de sucursales, búsqueda por folio y solicitante, reapertura, cronología, permisos y política SLA. Las regresiones ejercitan API y UI o utilidades compartidas según corresponda; no consideran correcto un código 200 por sí solo, sino hitos, relaciones, alcance, resultado histórico y persistencia esperados.

Se cerró además el hueco de tickets duplicados. El formulario genera una `Idempotency-Key` por intención, la conserva si la petición falla o expira y solo la cambia al modificar el payload o completar con éxito. El servidor calcula una huella canónica ligada al actor y al endpoint, y la comprueba dentro del mismo lock de `updateDb`. Una repetición idéntica devuelve el mismo ticket con 200 y no repite stock, auditoría ni notificaciones; reutilizar la clave con datos distintos devuelve 409; dos claves distintas permiten registrar dos incidencias legítimamente iguales. El mismo contrato cubre altas normales e históricas y expira a las 24 horas.

La prueba HTTP lanza dos POST concurrentes y verifica un único expediente persistido, encabezado de replay, conflicto y creación independiente. Las unitarias cubren orden canónico del payload, caducidad, referencia desaparecida y formato de clave. Resultado final: 225 backend y 152 UI en verde, además de TypeScript, ESLint dirigido y build. El build conserva la advertencia no bloqueante del chunk principal de 505.38 kB.
