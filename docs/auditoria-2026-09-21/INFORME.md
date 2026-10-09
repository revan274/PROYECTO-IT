# Auditoría integral de Mesa IT

| ID | Módulo | Función | Estado | Severidad | Evidencia | Problema | Recomendación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HD-001 | Tickets | Folio, creación y validaciones básicas | ✅ IMPLEMENTADO | — | `server/routes/tickets.js:183`; pruebas API; `resultados.json: F1, VALIDATION` | Folio automático; rechaza descripción vacía, activo/técnico inexistentes y usuario no autenticado. | Conservar. El folio comparte secuencia con otras entidades: saltos no implican pérdida. |
| HD-002 | Tickets | Flujo operativo básico | ✅ IMPLEMENTADO | — | `shared/ticket-rules.js:1`; `resultados.json: F1` | Crear, asignar, trabajar, resolver y cerrar responden correctamente. Asignación es un atributo, no un estado. | Conservar nomenclatura. |
| HD-003 | Tickets | Fechas de respuesta, resolución y cierre | 🐞 ERROR | ALTO | `server/routes/tickets.js:578,735`; `resultados.json: F1` | Resuelto fija `fechaCierre`; pasar a Cerrado conserva esa misma fecha. No hay primera atención ni fecha de resolución separada. | Registrar hitos distintos y ciclos de reapertura. |
| HD-004 | Tickets | Diagnóstico y solución | 🟡 PARCIAL | ALTO | `useTicketActions.ts:248`; `tickets.js:726`; F2 | Hay comentarios, pero Resolver no captura solución y el servidor acepta «Ticket resuelto» como valor automático. | Solicitar solución al resolver; diagnóstico opcional estructurado. |
| HD-005 | Tickets | Edición de cerrados y reapertura | 🟡 PARCIAL | ALTO | `tickets.js:496`; F3-F6, F7 | Se puede reasignar un cerrado y saltar entre estados; reapertura borra la fecha terminal y mantiene el vencimiento original. | Política explícita de edición, reapertura, motivo y SLA. |
| HD-006 | Tickets | Cancelación y retención | 🟡 PARCIAL | ALTO | `tickets.js:768`; `store.js:506`; TICKET_DELETE | Un técnico elimina físicamente tickets resueltos; también se eliminan adjuntos. Queda auditoría resumida, no una copia completa recuperable. No existe Cancelado. | Cancelación/archivo con motivo; separar permiso de purga y retención. |
| HD-007 | Tickets | Duplicados por reintento | 🟡 PARCIAL | MEDIO | `App.tsx:973`; `tickets.js:183`; DUPLICATE | UI bloquea guardado mientras está en curso, pero dos POST equivalentes crean dos tickets. | Clave de idempotencia para reintentos; no prohibir incidentes legítimos similares. |
| HD-008 | Tickets | Servicios sin activo y solicitud por terceros | ❌ FALTANTE | ALTO | `tickets.js:201,229,249`; `useTicketActions.ts:128` | Activo obligatorio; solicitante siempre es el usuario autenticado. Registrar una llamada a nombre de un empleado no conserva ambas identidades. | Activo opcional según tipo de solicitud; separar creador y solicitante. |
| HD-009 | Tickets | Área, categoría, impacto y urgencia | 🟡 PARCIAL | MEDIO | `TicketFormModal.tsx`; `appHelpers.ts:293`; `types/app.ts:192` | Área y falla sugerida existen, pero el área se incrusta en descripción. No hay categoría/subcategoría, impacto o urgencia propios del ticket. | Clasificación mínima estructurada; subcategoría solo si aporta valor. |
| HD-010 | Tickets | Reclasificar prioridad | ❌ FALTANTE | ALTO | `tickets.js:496`; VALIDATION | La prioridad se captura al crear, pero PATCH solo de prioridad devuelve 400. Prioridad inválida al crear se transforma silenciosamente en MEDIA. | Validación estricta, actualización autorizada y trazabilidad del cambio de SLA. |
| HD-011 | Tickets | Coherencia activo/sucursal | 🐞 ERROR | ALTO | `tickets.js:219,229`; VALIDATION | API acepta activo TJ01 con sucursal TJ02; el frontend sí restringe sus opciones. | Validar en servidor o registrar ubicación del incidente distinta con semántica explícita. |
| HD-012 | Técnicos | Asignación y reasignación manual | ✅ IMPLEMENTADO | — | `tickets.js:547`; `helpers.js:329`; F1/F3 | Valida técnico/admin activo y guarda nombre e ID; no exige asignación inmediata. | Mantener cola sin asignar; usar ID en los selectores para evitar homónimos. |
| HD-013 | Técnicos | Historial de responsables | 🟡 PARCIAL | MEDIO | `tickets.js:590,617`; `users.js:29`; F3-F6, FORMER_TECH_DELETE | Auditoría general guarda asignaciones, pero historial del ticket dice «Ticket Actualizado», sin antes/después. Un antiguo técnico puede borrarse tras reasignarlo. | Eventos con actorId y responsable anterior/nuevo; baja lógica. |
| HD-014 | Técnicos | Asignación automática | ❌ FALTANTE | OPCIONAL | Revisión de `tickets.js`, acciones UI y matriz de permisos | No se localizó motor por carga, especialidad o sucursal. La asignación manual ya permite operar. | Posponer hasta medir volumen y distribución de la carga. |
| HD-015 | Tickets | Consulta completa del historial | 🟡 PARCIAL | MEDIO | `TicketsView.tsx:278,281,282,532`; `tickets.js:590` | Backend conserva eventos, pero la UI muestra solo cuatro con comentario y descarta eventos sin comentario. | Cronología completa paginada, independiente de comentarios. |
| HD-016 | Tickets | Fechas legibles del historial | 🐞 ERROR | MEDIO | `store.js:1241`; `format.ts:4`; HISTORY_DATE | Se persiste `toLocaleString('es-MX')`; «9/10» se interpreta como septiembre y días >12 pueden no parsearse. | ISO UTC en persistencia; formato local solo al presentar. |
| HD-017 | SLA | Vencimientos por prioridad y jornada | ✅ IMPLEMENTADO | — | `shared/ticket-rules.js:18`; `sla-calendar.js`; pruebas de calendario y F2/F5 | MEDIA=24, ALTA=8, CRITICA=2 horas hábiles; calendario, zona y feriados; vencidos y próximos visibles. | Mantener fuente compartida y pruebas; aprobar tiempos con negocio. |
| HD-018 | SLA | Cumplimiento histórico | 🐞 ERROR | ALTO | `useReportKpiData.ts:35`; `useDashboardMetrics.ts:100`; SLA_KPI | Ticket cerrado dos horas tarde devuelve 100 %. Cerrados y casos sin SLA entran como cumplidos. Excel hereda el error. | Evaluar fecha de resolución contra vencimiento; separar cumplimiento de vencimiento actual. |
| HD-019 | SLA | Política administrable y esperas | 🟡 PARCIAL | MEDIO | `ticket-rules.js`; `sla-calendar.js`; `tickets.js:578` | Horas fijas en código, feriados por entorno; En Espera no pausa. No hay política por categoría ni motivos de espera. | Administrar prioridades/calendario y documentar si cada espera pausa; reglas por sucursal/impacto opcionales. |
| HD-020 | SLA | Avisos antes de vencer | ✅ IMPLEMENTADO | — | `sla-watcher.js:36,57`; `notification-ledger.js`; pruebas | Vigilante SMTP con calendario y deduplicación, no una función faltante. | Verificar configuración/entrega en staging; revisar fiabilidad en HD-021. |
| HD-021 | Notificaciones | Seguimiento y entrega fiable | 🟡 PARCIAL | MEDIO | `sla-watcher.js:80,101`; `ticket-notifications.js`; rutas tickets | Hay correo/push al crear y asignar, correo antes de vencer. No hay avisos de comentario, resolución ni vencimiento consumado. Se reserva aviso SLA antes de enviar sin reintento de entrega. | Priorizar resolución/comentario y estado de entrega; escalado de vencidos recomendado. |
| HD-022 | Dashboard | Conteos y distribución desde datos reales | ✅ IMPLEMENTADO | — | `useDashboardMetrics.ts`; `useReportTicketData.ts`; `useReportLifecycleTrendData.ts` | Estado, sucursal, técnico, antigüedad y periodos se calculan desde tickets. No se localizaron KPIs simulados en el flujo conectado. | Mantener; corregir alcance y SLA por separado. |
| HD-023 | Dashboard | Cola operativa y carga total | 🟡 PARCIAL | ALTO | `useDashboardMetrics.ts:30,61`; `DashboardView.tsx:112`; DASHBOARD_OLD_BACKLOG | El rango filtra por creación antes de contar abiertos, vencidos y carga. Un pendiente antiguo desaparece del resumen; el periodo sí está rotulado. | Separar backlog actual de tickets creados en el periodo. |
| HD-024 | Dashboard | Métricas de primera respuesta y resolución | 🟡 PARCIAL | ALTO | `appHelpers.ts:357`; `useReportKpiData.ts`; HD-003 | Hay MTTR, mediana y P90, calculados con `fechaCierre`; no existe primera respuesta ni una tasa de resolución explícita. Reapertura cambia cohortes históricas. | Medir hitos/ciclos y definir denominadores; no usar etiquetas ambiguas. |
| HD-025 | Búsqueda | Folio y solicitante en interfaz | 🐞 ERROR | ALTO | `useTicketDirectoryData.ts:84`; `tickets.js:1130`; SEARCH_UI/SEARCH_API | Frontend encuentra 0 por folio/solicitante existentes; API sí los encuentra. | Conectar criterios comunes de búsqueda. |
| HD-026 | Búsqueda | Parcial, acentos y términos combinados | ✅ IMPLEMENTADO | — | `format.ts:80`; `useTicketDirectoryData.ts:84`; SEARCH_UI | UI normaliza mayúsculas y acentos, combina tokens y permite subcadenas de descripción/activo/técnico/sucursal. | Preservar; hacer consistente el contrato con API. |
| HD-027 | Filtros | Filtros combinados y reportes | 🟡 PARCIAL | MEDIO | `useTicketUiState.ts`; `TicketsView.tsx:220`; `useReportTicketData.ts` | Tickets tiene ciclo/estado/prioridad/asignación/SLA. Reportería añade fecha/sucursal/área/técnico/atención, con estado separado. API tiene sucursal y técnico sin selector equivalente en Tickets. | Unificar o explicar alcance; añadir los filtros operativos de mayor uso. |
| HD-028 | Exportación | Excel filtrado y CSV | ✅ IMPLEMENTADO | — | `reportExcel.ts:76,125`; `csvDownload.ts`; pruebas CSV | Excel recibe tickets filtrados y genera nueve hojas; CSV de inventario/auditoría escapa comillas y neutraliza fórmulas. | Mantener; el contenido SLA requiere HD-018. CSV de tickets dedicado es opcional. |
| HD-029 | Inventario | CRUD, importación, QR y vínculo ticket→activo | ✅ IMPLEMENTADO | — | `activos.js`; `useInventoryImport`; pruebas API; F4 | Inventario, validación de duplicados, preview de importación y QR firmado. Tickets relacionan activo por tag. | Conservar herramientas y asegurar integridad de referencias. |
| HD-030 | Inventario | Integridad al renombrar/borrar | 🐞 ERROR | ALTO | `activos.js:209,308,338`; ASSET_RENAME/ASSET_DELETE | Cambiar tag no actualiza tickets. Borrar activo deja tickets huérfanos; borrado masivo tampoco verifica referencias. | ID estable y baja lógica/restricción de borrado; reparar referencias existentes. |
| HD-031 | Inventario | Historial visible desde el activo | ❌ FALTANTE | MEDIO | `AssetDetailModal.tsx`; búsqueda cruzada App/hooks | El detalle muestra datos y QR, pero no tickets históricos, recurrencias ni mantenimientos. La relación por tag ya está en datos. | Añadir pestaña de tickets; mantenimiento programado puede esperar. |
| HD-032 | Usuarios | Cuentas, roles, sesiones y baja protegida | ✅ IMPLEMENTADO | — | `users.js`; `authRuntime.js`; pruebas; VALIDATION/F8 | Roles admin/técnico/consulta/solicitante; protección de último admin, contraseñas, revocación, restricción por tickets actuales. | Mantener. La limitación de antiguos participantes está en HD-013. |
| HD-033 | Usuarios | Supervisor y alcance del técnico | 🟡 PARCIAL | MEDIO | `shared/permissions.js`; `domain/roles.js`; `tickets.js:496` | Técnico puede operar todos los tickets y activos, incluso borrar tickets. Consulta lee pero no asigna; no hay supervisor separado ni permisos configurables por UI. | Aprobar política de equipo; separar retención y administración. Supervisor independiente según necesidad. |
| HD-034 | Usuarios | Integridad de sucursales usadas | 🐞 ERROR | MEDIO | `index.js:958`; BRANCH_REMOVAL | Reemplazar catálogo elimina una sucursal referenciada y responde 200. Categorías de ticket aún no existen. | Desactivar sucursal o rechazar eliminación si está en uso. |
| HD-035 | Seguridad | Autenticación, autorización e IDOR de solicitante | ✅ IMPLEMENTADO | — | `authRuntime.js:79`; `permissions.js`; pruebas de comentarios/adjuntos; F8 | API exige sesión y permisos; solicitante ve/comenta/descarga sus tickets. No se comprobó bypass en los casos ensayados. | Conservar pruebas; esto no equivale a certificar toda la aplicación. |
| HD-036 | Seguridad | SQL, errores, CORS y límites | ✅ IMPLEMENTADO | — | `postgres-state.js`; `index.js:205,1603`; `helpers.js` | Consultas con parámetros, campos seleccionados en rutas, CORS de producción cerrado por defecto, Helmet, rate limit y errores 500 genéricos. | Verificar valores reales del despliegue; no se probó inyección exhaustiva. |
| HD-037 | Seguridad | Destinos Web Push | 🔒 SEGURIDAD | ALTO | `push-notifications.js:17,138`; PUSH_ENDPOINT | Filtro rechaza IP literal, pero admite `https://localhost/push` y dominios arbitrarios; llegan al cliente HTTP si son destinatarios y VAPID está activo. | Allowlist de proveedores y control de resolución/red. Explotabilidad real no ensayada. |
| HD-038 | Seguridad | Subida y descarga de evidencias | 🟡 PARCIAL | MEDIO | `tickets.js:883,1007`; `attachment-store.js`; pruebas de adjuntos | Límites, nombres saneados, descarga como adjunto y control de acceso. MIME lo declara cliente; no hay validación de contenido/antimalware. Guarda bytes antes de comprobar pertenencia, luego limpia. | Autorizar antes de escribir; política de archivos y análisis según riesgo. |
| HD-039 | Seguridad | Secretos y cabeceras del frontend publicado | 🟡 PARCIAL | MEDIO | `git ls-files`; `.env.production`; `wrangler.jsonc`; `public/` | Solo VITE_API_URL en .env.production; no se detectaron patrones seleccionados de claves privadas/tokens en fuente y bundle. CSP de Express no demuestra CSP del frontend Cloudflare; no hay `_headers` versionado. | Verificar cabeceras/secretos de plataforma e historial Git con escáner especializado. No afirmar filtración. |
| HD-040 | Testing | Suites, CI y cobertura | ✅ IMPLEMENTADO | — | `package.json`; `.github/workflows/ci.yml`; `cobertura.json` | 176 backend + 129 UI pasan; lint/typecheck/build y umbrales de cobertura pasan. | Mantener CI. |
| HD-041 | Testing | Pruebas de negocio, navegador y PostgreSQL real | 🟡 PARCIAL | ALTO | `useReportKpiData.test.ts`; pruebas PG con pools simulados; árbol de pruebas | Casos verdes no detectan SLA tardío, referencias y búsqueda; no se localizó suite E2E de navegador/PG real. | Integrar regresiones de esta auditoría y staging aislado. |
| HD-042 | Frontend | Zustand, sincronización y errores HTTP | ✅ IMPLEMENTADO | — | `useAppStore.ts`; `useAppBootstrap.ts`; `utils/app.ts:305`; HTTP_CLIENT_ERRORS | Selectores por campo, sesión en sessionStorage, limpieza al salir, polling visible/ETag y errores tipados/timeout. | Mantener; probar carrera de cambio de sesión con respuesta tardía en HD-041. |
| HD-043 | Frontend | Paginación y volumen transferido | 🟡 PARCIAL | MEDIO | `index.js:1175`; `TicketsView.tsx:277`; `tickets.js:1150` | API pagina opcionalmente, pero bootstrap entrega todos los tickets con historial y la UI renderiza todos los filtrados. | Usar paginación existente y detalle bajo demanda; medir antes de rediseñar persistencia. |
| HD-044 | Frontend | Rutas por rol y enlaces profundos | 🟡 PARCIAL | BAJO | `main.tsx:3`; `useAppNavigation.ts`; ROUTES_REQUESTER_SSR | HashRouter y guardas impiden vista Users para solicitante; rutas desconocidas caen a vista inicial. No hay detalle `/tickets/:id`. | Documentar URLs `/#/…`; deep link a ticket y 404 son mejoras útiles. |
| HD-045 | UX/UI | Etiquetas y teclado | 🐞 ERROR | MEDIO | `TicketFormModal.tsx:110`; FORM_LABELS_SSR; `TicketsView.tsx:449` | Render de formulario detecta 10 controles sin label/ARIA asociado. Input de archivo `hidden` dentro de label dificulta acceso por Tab. | Field/label del DS, nombres accesibles y adjuntar operable con teclado. |
| HD-046 | UX/UI | Modales, avisos y estados vacíos | ✅ IMPLEMENTADO | — | `ModalDialog.tsx`; pruebas; `Toast.tsx`; `TicketsView.tsx:552` | Focus trap, Escape, restauración de foco, aria-modal, avisos live y estados vacíos. | Conservar; contraste y tamaños requieren validación visual. |
| HD-047 | Arquitectura | Persistencia PostgreSQL y concurrencia | 🟡 PARCIAL | MEDIO | `store.js:955`; `postgres-state.js`; `attachment-store.js:28`; pruebas | Lock transaccional correcto sobre un JSONB; relaciones sin FK. Cada mutación reescribe el documento global. Sesiones y binarios sí están separados. | Corregir invariantes ahora; medir contención antes de normalizar tablas. |
| HD-048 | Arquitectura | Mantenibilidad y Design System | 🟡 PARCIAL | BAJO | App 2388 líneas; index 1687; `TicketFormModal.tsx:111`; AGENTS.md | Hay hooks/rutas/exports separados, pero orquestadores grandes y consumidores que repiten pieles pese al DS. Helpers de datos iniciales sin uso productivo localizado. | Refactor incremental y reutilizar variantes existentes; no reescritura. |

**Fecha:** 21 de septiembre de 2026. **Base auditada:** commit `85bbc91`, árbol inicialmente limpio. La tabla contiene unidades de revisión, no un porcentaje de calidad ni una certificación. ✅ significa evidencia favorable dentro del alcance descrito. 🔒 se cuenta aparte de errores funcionales.

## Alcance, evidencia y límites

Se revisaron frontend, formularios, stores, hooks, rutas Express, permisos, persistencia, generadores de reportes, exportaciones, notificaciones, pruebas y despliegue versionado. Se ejecutaron suites existentes y un diagnóstico adicional reproducible: [probe.mjs](probe.mjs). Sus resultados están en [resultados.json](resultados.json); la cobertura medida está en [cobertura.json](cobertura.json).

El diagnóstico usa una API efímera en localhost, usuarios y activos sintéticos y un archivo JSON temporal; limpia sus datos al finalizar. No carga `.env`, no conecta Neon ni envía correos/push. No se modificó código de producto ni se desplegó nada. El script verifica comportamientos actuales, incluidos errores; que termine con código 0 **no significa que todos los comportamientos sean correctos**.

La herramienta de navegador devolvió inventario vacío y `Browser is not available: iab`. No fue posible comprobar visualmente 1920×1080, 1366×768, tablet o teléfono. La navegación y etiquetas se comprobaron con render de componentes/hook y DOM estático; no son pruebas visuales ni E2E. No se midieron contraste, zoom, lector de pantalla real o latencia percibida. Tampoco se consultó el esquema real de Neon, backups, secretos/configuración de Railway/Cloudflare, entrega SMTP/push real o rendimiento bajo carga. Los DDL documentados son los del código, no introspección de producción.

## Checklist ejecutivo

| Área | Implementado | Parcial | Faltante | Error | Seguridad |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tickets | 2 | 6 | 2 | 3 | 0 |
| Técnicos | 1 | 1 | 1 | 0 | 0 |
| SLA | 2 | 1 | 0 | 1 | 0 |
| Notificaciones | 0 | 1 | 0 | 0 | 0 |
| Dashboard | 1 | 2 | 0 | 0 | 0 |
| Búsqueda | 1 | 0 | 0 | 1 | 0 |
| Filtros | 0 | 1 | 0 | 0 | 0 |
| Exportación | 1 | 0 | 0 | 0 | 0 |
| Inventario | 1 | 0 | 1 | 1 | 0 |
| Usuarios | 1 | 1 | 0 | 1 | 0 |
| Seguridad | 2 | 2 | 0 | 0 | 1 |
| Testing | 1 | 1 | 0 | 0 | 0 |
| Frontend | 1 | 2 | 0 | 0 | 0 |
| UX/UI | 1 | 0 | 0 | 1 | 0 |
| Arquitectura | 0 | 2 | 0 | 0 | 0 |

Los conteos se derivan únicamente de las 48 filas anteriores. Las verificaciones visuales pendientes no se cuentan como funciones faltantes. No se confirmó un hallazgo crítico independiente; hay riesgos altos que deben resolverse antes de declarar preparación empresarial.

## Captura y visualización del ticket

| Dato | Captura/almacenamiento actual | Presentación actual | Regla recomendada |
| --- | --- | --- | --- |
| Folio | Automático mediante `nextId` | Visible como ID | Automático e inmutable; no exigir secuencia sin saltos. |
| Solicitante | Identidad de sesión: ID, username, nombre | Nombre/cargo visibles | Obligatorio; creador separado si TI captura por teléfono o correo. |
| Sucursal | Obligatoria y validada contra catálogo | Visible | Obligatoria; conservar referencias históricas. |
| Área/departamento | Área requerida en UI, concatenada a descripción; departamento de sesión | Área inferida en reportes; cargo en ticket | Área estructurada; no confundir cargo del creador con área afectada. |
| Categoría | No hay campo de categoría de ticket | Falla sugerida/descripción no equivalen a catálogo | Clasificación mínima obligatoria para triage; permitir completar por técnico. |
| Subcategoría | No localizada | No | Opcional según volumen. |
| Activo | Tag obligatorio y existencia validada | Visible; enlace Ver activo | Opcional para solicitudes de servicio sin equipo; ID estable al asociar. |
| Descripción | Obligatoria frontend/backend | Visible | Obligatoria; límites de longitud útiles. |
| Prioridad | MEDIA/ALTA/CRITICA; MEDIA por defecto | Visible | Obligatoria con default documentado; cambios auditados. BAJA no es obligatoria. |
| Impacto/urgencia | No localizados como campos | No | Opcionales al inicio; recomendados si se necesita priorización consistente. |
| Creación | ISO automática; alta histórica solo admin | Visible | Automática, diferenciada de fecha de carga de registros históricos. |
| Evidencia/fotos/archivos | Adjuntos después de crear, hasta límites configurados; fotos como archivos | Nombre, tamaño, fecha y descarga | Opcional; no afirmar que exista visor de fotografías. |
| Técnico | Opcional; valida técnico/admin activo; nombre+ID | Selector visible | Opcional al crear, cola sin responsable supervisada. |
| Comentarios | Eventos añadidos al historial | Solo cuatro últimos eventos con texto | Acceso al historial completo y distinción nota interna/pública si se requiere. |
| Diagnóstico | Texto libre en comentarios, sin campo propio | No tiene sección propia | Opcional durante atención; útil estructurarlo. |
| Solución | Comentario API opcional; Resolver UI no la pide | Puede aparecer entre comentarios | Obligatoria antes de resolver, con captura clara. |
| Primera atención | No localizada | No | Automática al primer evento de atención definido por negocio. |
| Resolución | Sin fecha propia; reutiliza `fechaCierre` | Estado Resuelto, sin hito separado | Automática por ciclo. |
| Cierre | Misma fecha que resolución en flujo normal | No hay separación clara del hito | Automática al cierre real, posterior o igual a resolución. |
| Tiempo transcurrido | Antigüedad agrupada en dashboard; fechas en tarjeta | No se localizó contador de edad dedicado por ticket | Derivado de creación para abiertos, sin almacenar contador. |
| SLA | Vencimiento almacenado; restantes derivados | Insignias activo/próximo/vencido/cerrado | Distinguir SLA cerrado cumplido/incumplido y no aplicable. |
| Historial | Persistido en ticket y auditoría general | Recorte de comentarios, no cronología completa | Eventos inmutables con actor, fecha ISO, antes/después. |

Los campos `categoria` encontrados en insumos no se confundieron con una categoría de ticket. Tampoco se confunde `atencionTipo` —presencial/remoto/fuera de horario— con categoría del incidente.

## Flujos y pruebas de integridad ejecutados

| Escenario solicitado | Resultado observado | Interpretación |
| --- | --- | --- |
| 1. Crear → asignar → trabajar → resolver → cerrar | 201/200/200/200/200; estados Abierto/Abierto/En Proceso/Resuelto/Cerrado | Flujo funcional. Asignar no cambia estado. Fecha de cierre final es la de resolución. |
| 2. Crítico → SLA → resolver | Crea vencimiento; resuelve 200 | Política crítica existe. API acepta resolución sin solución propia. Calendario verificado por suite existente. |
| 3. Reasignar y revisar historial | Responsable cambia; evento local «Ticket Actualizado» vacío; auditoría general registra asignación | Operación funciona, historial visible insuficiente. |
| 4. Asociar activo y consultar relación | Bootstrap contiene ambos tickets de la prueba ligados al tag | Vínculo en datos confirmado; no hay lista histórica en detalle de activo. |
| 5. Dejar vencer y comprobar | Vencimiento sintético `ahora−60s`: `/summary` devuelve 1 vencido | Se alteró solo fixture para simular paso del tiempo. Dashboard descarta pendientes creados fuera del periodo. |
| 6. Modificar cerrado | Reasignación devuelve 200 | Cerrado no bloquea modificaciones; necesita política. |
| 7. Cerrar y reabrir | PATCH Abierto devuelve 200, elimina fechaCierre, mantiene fechaLimite | Reapertura existe; no conserva ciclos estructurados. |
| 8. Solicitante entra a administración | `/users` API 403; hook de navegación devuelve Tickets en rutas prohibidas | Guardas efectivas en casos ensayados. Acceso real por navegador pendiente. |
| Crear sin autenticación | 401 | Control correcto. No permite «ticket sin usuario» anónimo. |
| Crear sin descripción/sin activo/activo inexistente/técnico inexistente | 400 en los cuatro casos | Validaciones presentes. Activo obligatorio es limitación funcional para servicios. |
| Sucursal distinta del activo | 201 | Inconsistencia admitida por API. |
| Eliminar solicitante con tickets | 409 | Protección correcta. |
| Eliminar antiguo técnico tras reasignación | 200 | Guarda nombres históricos, pero no bloquea por participación pasada. |
| Eliminar categoría usada | No aplica: no hay catálogo de categorías de ticket | Se ensayó eliminación de sucursal referenciada: 200. |
| Cambiar solo prioridad | 400 | Reclasificación no implementada. |
| Enviar dos solicitudes iguales simultáneas | Dos 201 y dos IDs distintos | No hay idempotencia del endpoint. No equivale a probar doble clic visual. |
| Renombrar activo con tickets | 200; tag antiguo permanece en tickets | Referencia rota comprobada. |
| Borrar activo con tickets | 200; ocho tickets permanecen | Orfandad comprobada. |
| Técnico borra resuelto | 200; ticket ya no aparece | Política destructiva confirmada, no bypass de la matriz vigente. |
| Buscar por folio/solicitante | API sí; selector frontend no | Función existe en backend y no se refleja correctamente en UI. |
| SLA de ticket cerrado tarde | 100 % sobre un caso tardío | Error de fórmula confirmado. |
| Fechas locales del historial | 9/10 se interpreta como septiembre; 21/9 no parsea en Node | No usar strings regionales como formato de almacenamiento. |

La expiración de sesiones por reinicio, roles deshabilitados y acceso a adjuntos ajenos tienen además pruebas existentes verdes. No se ensayó la caída de una base PostgreSQL real.

## Métricas, búsqueda y filtros

**SLA histórico:** `isTicketSlaExpired` es una función válida para saber qué pendientes están vencidos ahora. El error es usarla para cumplimiento histórico: excluye Resuelto/Cerrado antes de comparar fechas. La fórmula `total − abiertos vencidos` incluye cerrados tardíos, abiertos aún en plazo y casos sin fecha límite como «cumplidos». Deben separarse dos métricas: pendientes vencidos ahora y proporción de resoluciones dentro del compromiso. El denominador y tratamiento de cancelados/reabiertos deben documentarse; mostrar N/D si no hay casos evaluables.

**Tiempos:** MTTR, mediana y P90 existen, pero usan creación→fechaCierre y reloj natural. No deben presentarse como horas laborables sin cambiar el cálculo. Como Resuelto/Cerrado comparten fecha, actualmente el valor se aproxima a primera resolución del ciclo vigente; no demuestra tiempo de cierre. Primera respuesta no se puede medir de forma fiable sin un hito. Reabrir elimina la fecha terminal actual; aunque exista un evento histórico, las métricas no reconstruyen todos los ciclos. Hay cálculo separado de creados/cerrados por periodo en `useReportLifecycleTrendData`; no se marcó como inexistente, pero depende del hito ambiguo.

**Dashboard:** muestra datos reales, no mocks. El periodo está anunciado, por lo que no se considera error matemático contar solo la cohorte creada en ese periodo. Sí existe una carencia operativa: carga, vencidos y críticos antiguos pueden desaparecer. Además, el salto a Tickets aplica filtros globales y puede mostrar una cantidad distinta. Conviene un bloque de backlog actual independiente y otro de evolución histórica.

**Búsqueda:** frontend usa tokens AND sobre activo, descripción, técnico, sucursal formateada y modalidad. Omite ID, solicitante y campos del equipo no presentes en esas cadenas. Backend busca una subcadena entera OR entre más campos, incluidos folio y solicitante; no comparte semántica combinada. No se midió velocidad con volumen real; ambos recorren arrays. Soporta mayúsculas/acentos mediante normalización, confirmado con «impresión»/«impresion». No se ensayaron todos los caracteres Unicode.

**Filtros:** Tickets y Reportería mantienen estados distintos. En navegación dentro de App se conserva el estado de sus hooks; no es un filtro universal ni queda completamente codificado en URL. Reportería tiene presets persistidos por usuario y limpieza. No hay filtro de categoría de ticket porque no existe ese dato estructurado. Solicitante y activo pueden localizarse por búsqueda solo después de corregir el contrato. Exportar desde Reportería usa los filtros de Reportería; no se debe prometer que hereda los de Tickets.

**Exportación:** nueve hojas XLSX con resumen, detalle y agrupaciones; CSV de inventario, auditoría y errores de importación. El CSV declara UTF-8 y escapa comillas/saltos con neutralización de fórmulas. No agrega BOM; la apertura automática de acentos en distintas versiones de Excel no fue comprobada. XLSX se genera con celdas de texto/número mediante SheetJS, pero fechas en detalle se escriben como texto localizado, no fechas numéricas de Excel. No se abrió un archivo en Excel durante esta auditoría. El error SLA sí llega al Excel, donde el tardío puede figurar «EN TIEMPO».

## Roles, seguridad y trazabilidad

| Rol | Capacidad real | Comparación funcional |
| --- | --- | --- |
| Solicitante | Crear, consultar los propios, comentar y adjuntar; borrar propio Abierto | Cubre portal básico. Borrar debe convertirse en cancelar para preservar expediente. |
| Técnico | Operar todos los tickets/activos/insumos, asignar/reasignar/resolver y borrar tickets | Más amplio que «solo los asignados». No es IDOR por sí mismo: es autorización explícita actual. Revisar mínimo privilegio. |
| Consulta | Consulta operativa, sin escrituras; no administra usuarios | No equivale a supervisor con capacidad de asignación. |
| Admin | Administración y operación; catálogo, usuarios, altas históricas y borrado masivo | Equivalente a administrador; necesita controles de retención y guardas referenciales. |

No se localizaron endpoints para editar o borrar entradas individuales de historial. El PATCH de tickets toma campos específicos; no copia `req.body` íntegro al ticket. La auditoría general encadena hashes y guarda contexto/instantáneas saneadas. Esto ayuda a detectar alteraciones, pero no es almacenamiento inmutable externo: un administrador de base de datos puede sustituir el documento y sus hashes. El borrado de tickets conserva una instantánea truncada de auditoría; no permite reconstruir archivos borrados ni historiales extensos.

**HD-037, riesgo SSRF:** un usuario autenticado que reciba notificaciones —por ejemplo técnico— puede registrar una URL HTTPS arbitraria. Al crear/asignar un ticket, el notificador la entrega a `web-push`. La función de validación permite localhost y nombres que pueden resolver a redes privadas. Se comprobó la aceptación local, sin generar tráfico interno ni explotar servicios. El riesgo depende de VAPID activo, claves push válidas, conectividad y TLS del destino; no se afirma acceso efectivo a metadatos o exfiltración. Corregir con proveedores permitidos y validación de destino al conectar; comprobar que resolver DNS no eluda el control. Referencia técnica: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

**Subidas:** nombres normalizados, rutas restringidas y archivos servidos como descarga; no hay ejecución de archivos demostrada. No se verifican firmas binarias ni se escanea contenido. Los límites de tamaño/cantidad y permisos reducen el riesgo, pero no certifican archivos inocuos. Autorizar antes de almacenar evita escrituras transitorias de adjuntos a tickets ajenos; el código actualmente limpia después de rechazar.

**Secretos:** inspección de nombres de archivos versionados y patrones seleccionados de cadenas PostgreSQL con credenciales, claves privadas y tokens conocidos en código público/backend/bundle. No se encontraron coincidencias en ese alcance; no es un escaneo de todo el historial Git ni del entorno de producción. `.env.production` versionado contiene solo `VITE_API_URL`, una URL pública de API, no una credencial. Seeds y tests contienen contraseñas/hashes de demostración; hay rechazo de credenciales demo en producción. No se publican valores de secretos en este informe.

**CORS/HTTPS:** producción falla cerrado para orígenes cruzados cuando falta allowlist. Desarrollo permite orígenes sin configuración. El cliente usa Authorization Bearer y el token está en sessionStorage, accesible al JavaScript de la misma página; no se encontró un XSS explotable que lo robe. Helmet protege respuestas Express, pero no demuestra cabeceras del HTML servido por Cloudflare. No se evaluaron CSP/HSTS efectivos ni permisos de cuentas de infraestructura.

## Persistencia, arquitectura y rendimiento

| Estructura definida en código | Restricciones/índices | Observación |
| --- | --- | --- |
| `mesa_it_state` | PK `id`, CHECK id=1, data JSONB NOT NULL, version, updated_at | Entidades de negocio dentro de un documento; no hay FK/UNIQUE por ticket, activo o username en SQL. |
| `mesa_it_attachments` | PK storage_path, ticket_id NOT NULL e índice por ticket_id; contenido BYTEA | Binarios en PostgreSQL cuando DATABASE_URL está configurado; **no dependen únicamente del disco efímero**. Sin FK al ticket JSONB. |
| Sesiones | PK hash de token, índices user_id y expiración | Sesión persistente, revocación y limpieza; favorable. |
| Intentos de login | Clave por intento/identidad y estado de bloqueo | Persistencia de control de intentos, con pruebas. |
| Ledger de avisos | Clave compuesta ticket/tipo de aviso | Deduplicación; no confirma entrega exitosa ni ciclos de reapertura. |

Las mutaciones PostgreSQL usan `BEGIN`, `SELECT … FOR UPDATE`, UPDATE parametrizado y COMMIT/ROLLBACK: no se comprobó pérdida de actualizaciones en esa implementación. Los tests simulan el pool; falta ejecutarlos contra PostgreSQL real. El backend JSON local también se probó funcionalmente; no se ensayaron múltiples procesos escribiendo simultáneamente ese archivo.

No tiene sentido proponer índices SQL de categoría/estado para acelerar filtros que hoy ocurren sobre arrays después de leer el documento. Primero: asegurar integridad en operaciones, conectar paginación, descargar historiales bajo demanda y medir tamaños/latencia/espera de lock. Si las mediciones justifican separar tickets, se puede hacer gradualmente dentro de PostgreSQL; no se necesita cambiar de stack.

No se identificó un patrón N+1 evidente en las rutas principales revisadas: reutilizan `req.appDb` y hay prueba dedicada. El coste dominante potencial es leer/serializar/reescribir todo el estado y transferir bootstrap completo. Existe compresión y ETag, y polling cada 60 segundos solo visible; son mejoras reales. Tickets renderiza `filteredTickets.map` sin paginación, aunque inventario y auditoría sí tienen controles de página.

Build observado: chunk principal 468.23 kB, 150.81 kB gzip; SheetJS 499.55 kB, 162.96 kB gzip, cargado dinámicamente. Vistas separadas en chunks. Estos tamaños no demuestran lentitud por sí mismos. No hubo perfil de CPU, medición de red móvil, carga concurrente ni benchmark de Neon; no se inventan percentiles.

Zustand usa selectores por campo y almacena entidades compartidas, estado de conexión, sesión, tema y diálogos. Formularios/filtros están principalmente en hooks locales. La limpieza de sesión borra datos. App consume muchas entidades y orquesta gran número de hooks/props; eso es mantenibilidad y posible coste de render, no una medición de renders desperdiciados. La respuesta de bootstrap no tiene una comprobación explícita de generación de sesión al completarse: añadir un caso de respuesta tardía tras logout/cambio de usuario antes de declararlo un bug confirmado.

## UX, accesibilidad, responsive y Design System

La tarjeta de ticket expone folio, activo, solicitante, sucursal, estado, prioridad, responsable y fechas; agrupa detalles para reducir densidad. Hay mensajes de vacío, confirmaciones de borrado, estados de subida y bloqueo del formulario durante guardado. El problema visible desde código es que «Resolver» realmente deja Resuelto mientras el toast dice «Ticket cerrado» (`useTicketActions.ts`), lo que refuerza la confusión entre hitos.

La inspección DOM del formulario administrativo normal encontró **10 controles sin label programático ni aria-label/aria-labelledby**; incluye selects, textarea y campos deshabilitados de contexto. No significa que todos carezcan de texto visual cercano: falta asociación accesible. Debe reutilizarse `Field`/Input/Select/TextArea del DS. La recomendación coincide con [W3C: etiquetado de controles](https://www.w3.org/WAI/tutorials/forms/labels/). El selector de archivo oculto necesita una alternativa de teclado, por ejemplo input visualmente oculto pero enfocable y botón accesible.

ModalDialog implementa foco inicial, retención/restauración, Escape y aria-modal; sus pruebas pasan. Toast tiene role=status/alert y aria-live. Textos pequeños de 10px, formulario con p-10 y padding del modal merecen revisión móvil, pero no se afirma desbordamiento sin render real. La existencia de breakpoints y overflow-x no certifica experiencia responsive. Quedan sin ejecutar las cuatro resoluciones solicitadas y contraste en temas claro/oscuro.

Se usan componentes del DS, pero `variant="plain"` acompañado de muchas clases de color/borde/radio repetidas en formularios evita aprovechar las pieles existentes. Debe aplicarse la regla del proyecto: variante actual primero, layout en consumidor, nueva variante solo si hay ≥2 consumidores reales. No se recomienda crear un DS nuevo.

## Notificaciones: prioridad funcional

| Evento | Estado actual | Necesidad para este producto |
| --- | --- | --- |
| Nuevo ticket | Correo general/responsable/difusión y push según reglas | OBLIGATORIA alguna señal operativa fiable; ya existe, verificar entrega. |
| Asignación/reasignación | Correo al nuevo responsable y push | OBLIGATORIA para que el responsable se entere; ya existe. |
| Comentario | No se localizó envío en endpoint | RECOMENDADA, especialmente cuando requiere respuesta del solicitante. |
| Cambio de estado genérico | No localizado | OPCIONAL para todos los cambios; evitar ruido. |
| Próximo SLA | Correo vigilante + indicador UI | RECOMENDADA; existe. |
| SLA vencido | Indicador/filtro; vigilante excluye ya vencidos | RECOMENDADA notificación/escalado a coordinación; no obligatoriedad de email. |
| Resuelto/cerrado | Estado visible; no aviso específico al solicitante | RECOMENDADA con prioridad alta para cerrar el circuito de atención. |

La asignación automática por carga es opcional; por sucursal podría resultar útil si hay equipos de soporte territoriales; por especialidad requiere un catálogo y volumen que hoy no están demostrados. Antes de automatizar, corregir los conteos de carga y la identificación por ID.

## Pruebas, errores y deuda técnica

| Validación ejecutada | Resultado |
| --- | --- |
| TypeScript `tsc -b` | Verde, ejecutado como parte de build y comprobación final. |
| ESLint | Verde sobre proyecto antes del diagnóstico; script de diagnóstico revisado aparte. |
| Backend | 176/176; ninguna omitida. |
| UI | 129/129 en 21 archivos. |
| Build | Verde. Advertencia de deprecación de punycode; no fallo de aplicación. |
| Cobertura backend | Líneas/sentencias 73.61 %, ramas 62.57 %, funciones 84.24 %. |
| Cobertura UI | Líneas 48.91 %, sentencias 47.46 %, ramas 38.67 %, funciones 45.96 %. |
| Runtime | Node 24.13.1 local; CI declara Node 20.19.0. No se afirma reproducción exacta del CI. |

Esbuild necesitó ejecución fuera del sandbox por denegación de lectura de directorios; el reintento autorizado pasó. No fue un fallo del producto. Las primeras versiones del script diagnóstico requirieron ajustar JSX automático; el resultado final reproducible está en resultados.json.

Hay pruebas de creación/actualización, stock atómico, permisos, asignación, estados, reapertura, adjuntos, sesiones, calendario, watcher, reportes y filtros. Faltan oráculos funcionales correctos para SLA histórico y pruebas de interacción de los flujos completos. `useTicketActions` tiene 5.6 % de líneas cubiertas en la ejecución medida; exportaciones XLSX/reportes impresos no tienen cobertura funcional suficiente. La prueba actual de KPI espera que cerrados sin fecha límite entren como cumplidos, por lo que un test verde puede consolidar una definición incorrecta.

El cliente HTTP se ensayó con respuestas 401/403/404/500, fallo de red y timeout inyectados: preserva status y produce mensaje de timeout. Bootstrap maneja sesión rechazada y marca desconexión; acciones muestran toast. No se probó visualmente recuperación tras desconexión ni caída real de Neon. El timeout aborta fetch; conviene probar respuestas cuyo cuerpo quede detenido, pues el temporizador se limpia al recibir cabeceras. No se declara ese caso reproducido.

| Elemento localizado | Clasificación | Evaluación |
| --- | --- | --- |
| Datos iniciales y hashes demo, fixtures, mocks en tests | DESARROLLO | No se halló sustitución de KPIs conectados por mocks; producción tiene guardas de seed/demo. |
| `cloneInitial…` exportados y datos iniciales frontend sin consumidor productivo localizado | DEUDA TÉCNICA | Revisar/eliminar si ya no tienen propósito; no implican datos falsos en dashboard activo. |
| Constantes de sucursales, fallas, horas SLA y viáticos | CONFIGURACIÓN/DEUDA TÉCNICA | Algunas son defaults/plantillas reales. Mover a catálogo solo lo que cambia por operación. |
| `console.log` de arranque, watcher y scripts de diagnóstico | OPERACIÓN | No son automáticamente un bug; considerar logging estructurado, sin secretos. |
| App/index extensos y pieles repetidas | DEUDA TÉCNICA | Extraer por dominio conforme se toquen funciones. |
| Destinos push arbitrarios | RIESGO DE SEGURIDAD | HD-037; requiere control explícito. |
| TODO/FIXME | Sin marcador pendiente relevante localizado | La palabra española «TODO» en confirmación de borrado no se consideró deuda automática. |

## Backlog de desarrollo — 18 tareas

Las tareas se apoyan en hallazgos anteriores. No autorizan una implementación automática ni cambian el stack. Las prioridades son relativas a uso empresarial; no todas las mejoras opcionales se incluyen.

### TASK-HD-001 — Preservar relaciones de activos y catálogos

**Problema:** HD-011/030/034 permiten referencias inconsistentes o huérfanas. **Estado actual:** tickets enlazan tag y código, sin restricciones SQL. **Cambio requerido:** identidad estable de activo, validación de ubicación y baja lógica/restricción en catálogos; analizar y reparar referencias existentes sin reasignarlas a ciegas. **Frontend:** AssetFormModal, AssetDetailModal, useAssetActions, catálogo en UsersView/App. **Backend:** rutas activos, importación, tickets y PATCH catalogos. **Base de datos:** añadir activoId compatible con legado y marcas de baja dentro del modelo actual; no obliga a migrar fuera de JSONB.

**Criterios de aceptación:**

- [ ] Renombrar o importar cambios de tag conserva relación e historial.
- [ ] Borrado individual/masivo y de sucursal no deja referencias huérfanas.
- [ ] Activo/sucursal incompatibles se rechazan o usan una excepción explícita documentada.

**Prioridad:** Alta.

### TASK-HD-002 — Cancelar y archivar tickets con retención

**Problema:** HD-006/033 permite borrar expedientes completos por técnico. **Estado actual:** DELETE quita ticket y adjuntos; auditoría es resumida. **Cambio requerido:** cancelar/archivar con motivo y política de purga separada; aplicar autorización en backend. **Frontend:** TicketsView/useTicketActions/ConfirmDialog. **Backend:** DELETE/PATCH tickets y shared/permissions. **Base de datos:** estado o marca de archivo, motivo, actor y fecha; conservar binarios según política.

**Criterios de aceptación:**

- [ ] Cancelación conserva comentarios, evidencias y vínculos.
- [ ] Técnico no purga un ticket cerrado ni sus adjuntos por API directa.
- [ ] Métricas distinguen cancelados de resueltos y una política explícita controla purga.

**Prioridad:** Alta.

### TASK-HD-003 — Restringir destinos de Web Push

**Problema:** HD-037 admite destinos arbitrarios. **Estado actual:** solo protocolo, puerto e IP literal se filtran. **Cambio requerido:** proveedores explícitos y validación de resolución/destino de red. **Frontend:** usePushNotifications, mensajes ante endpoint rechazado. **Backend:** normalizePushSubscription/createPushNotifier y endpoint de registro. **Base de datos:** depuración controlada de suscripciones no permitidas.

**Criterios de aceptación:**

- [ ] localhost, nombres internos y dominios no aprobados se rechazan sin conexión.
- [ ] Suscripciones legítimas soportadas siguen recibiendo notificaciones.
- [ ] Pruebas cubren DNS/normalización y el rechazo no revela secretos ni URLs sensibles.

**Prioridad:** Alta.

### TASK-HD-004 — Definir hitos y transiciones del ticket

**Problema:** HD-003/004/005/016/024 mezcla resolución, cierre y fechas regionales. **Estado actual:** libre cambio de estado, un hito terminal y solución opcional. **Cambio requerido:** reglas de transición, primera atención, resolución, cierre, motivo de reapertura y captura de solución; fechas ISO. **Frontend:** TicketsView, TicketFormModal, useTicketActions y mensajes. **Backend:** PATCH tickets/resolve, shared/ticket-rules, normalización de store. **Base de datos:** hitos y ciclos; preservar datos legacy sin inventar fechas desconocidas.

**Criterios de aceptación:**

- [ ] Resolver requiere solución; cerrar registra hito posterior independiente.
- [ ] Reapertura conserva ciclo anterior y exige motivo; cerrado aplica política de edición.
- [ ] Fechas ambiguas legacy se identifican y eventos nuevos usan ISO UTC.
- [ ] Primera atención se fija una vez por definición aprobada y tiene prueba de cálculo.

**Prioridad:** Alta.

### TASK-HD-005 — Cronología completa e identidades estables

**Problema:** HD-013/015 oculta eventos y pierde detalle de responsables. **Estado actual:** solo cuatro textos en UI y asignación genérica en historial. **Cambio requerido:** timeline con eventos tipados, actorId, anterior/nuevo, todos los comentarios y paginación. **Frontend:** TicketsView y selectores de técnico por ID. **Backend:** auditoría/tickets/users. **Base de datos:** eventos anexables con IDs; baja lógica de participantes históricos.

**Criterios de aceptación:**

- [ ] Ver más de cuatro eventos sin perder cambios sin comentario.
- [ ] Reasignación muestra responsables anterior/nuevo y fecha exacta.
- [ ] Homónimos se distinguen y bajas de participantes conservan identidad histórica.

**Prioridad:** Media. **Dependencias:** TASK-HD-004.

### TASK-HD-006 — Capturar solicitudes de servicio y de terceros

**Problema:** HD-008 impide registrar solicitudes sin activo y atribuir llamadas al solicitante real. **Estado actual:** activo requerido y usuario de sesión siempre solicitante. **Cambio requerido:** tipo de solicitud, activo opcional y selección autorizada de solicitante; mantener creador. **Frontend:** TicketFormModal/useTicketActions. **Backend:** creación/históricos y reglas de acceso. **Base de datos:** creatorId/requesterId separados, activoId nullable cuando corresponda.

**Criterios de aceptación:**

- [ ] Solicitud de acceso o servicio general se crea sin inventar un activo.
- [ ] Técnico captura a nombre de empleado sin falsificar al creador.
- [ ] Solicitante solo accede a los tickets que le corresponden; pruebas IDOR cubren ambas identidades.

**Prioridad:** Alta. **Dependencias:** TASK-HD-001/004.

### TASK-HD-007 — Clasificar y reclasificar con validación compartida

**Problema:** HD-009/010 guarda área en texto y no permite corregir prioridad. **Estado actual:** catálogo de fallas UI; prioridad inválida cae a MEDIA. **Cambio requerido:** área/categoría propios, prioridad validada y cambio auditado; impacto/urgencia solo con política aprobada. **Frontend:** formulario, filtros, tarjetas y reportes. **Backend:** tickets/catalogos y normalizadores. **Base de datos:** campos/catálogos compatibles con legado; extraer área de descripciones con trazabilidad.

**Criterios de aceptación:**

- [ ] PATCH autorizado cambia prioridad, deja antes/después y rechaza valores desconocidos.
- [ ] Categoría/área no dependen de analizar descripción nueva.
- [ ] Desactivar categoría usada conserva etiqueta histórica y no crea huérfanos.

**Prioridad:** Alta. **Dependencias:** TASK-HD-001/004.

### TASK-HD-008 — Corregir SLA histórico y versionar política

**Problema:** HD-018/019/024 contabiliza tardíos como cumplidos. **Estado actual:** función de pendientes vencidos reutilizada como cumplimiento; tiempos en código. **Cambio requerido:** evaluador histórico separado, denominador documentado, política por prioridad/calendario y reglas de espera/reapertura. **Frontend:** useReportKpiData, useDashboardMetrics, badges, reportExcel/executiveReport. **Backend:** calendario, normalización y cambios de prioridad. **Base de datos:** versión de política/vencimiento por ciclo y resultado cuando se resuelve.

**Criterios de aceptación:**

- [ ] Un único resuelto tarde produce 0 % de cumplimiento, no 100 %.
- [ ] Sin SLA evaluable se muestra N/D; cancelados y abiertos no se confunden con resueltos a tiempo.
- [ ] Cambio de prioridad o calendario no altera resultados históricos ya cerrados.
- [ ] UI/Excel/reporte imprimible coinciden para fechas nulas, reaperturas y límites de jornada.

**Prioridad:** Alta. **Dependencias:** TASK-HD-004/007.

### TASK-HD-009 — Separar backlog actual y resultados por periodo

**Problema:** HD-023 oculta pendientes antiguos y carga total. **Estado actual:** cohorte por creación antes de todos los conteos. **Cambio requerido:** bloque actual de abiertos/vencidos/críticos/sin asignar/carga y bloque histórico por periodo. **Frontend:** useDashboardMetrics/DashboardView y acciones de navegación. **Backend:** alinear summary si se usa. **Base de datos:** sin cambio necesario.

**Criterios de aceptación:**

- [ ] Ticket abierto de hace seis meses permanece visible en backlog actual.
- [ ] Clic en indicador abre una lista con exactamente el mismo alcance.
- [ ] Conteos y carga se agrupan por ID de técnico y distinguen métricas históricas.

**Prioridad:** Alta. **Dependencias:** TASK-HD-004/008.

### TASK-HD-010 — Unificar búsqueda, filtros y exportación

**Problema:** HD-025/027 contradice capacidades de backend e interfaz. **Estado actual:** búsquedas distintas; filtros separados por módulo. **Cambio requerido:** contrato común por folio, solicitante, técnico, activo/descripción/sucursal/clasificación; filtros combinables y alcance de exportación explícito. **Frontend:** useTicketDirectoryData/useTicketUiState/TicketsView/ReportState. **Backend:** GET tickets y paginación. **Base de datos:** sin índice adicional mientras filtro siga en memoria.

**Criterios de aceptación:**

- [ ] Folio y solicitante existentes aparecen en UI.
- [ ] Acentos, mayúsculas, subcadenas y varios términos tienen resultados consistentes UI/API.
- [ ] Limpiar/restaurar filtros y exportar conserva el alcance visible declarado.

**Prioridad:** Alta. **Dependencias:** TASK-HD-007.

### TASK-HD-011 — Completar el circuito de notificaciones

**Problema:** HD-021 carece de aviso de resolución/comentario y puede consumir reserva SLA sin entrega. **Estado actual:** envíos best effort y ledger por ticket/tipo. **Cambio requerido:** resolución al solicitante, comentarios relevantes, estado de entrega/reintento acotado; escalado de vencidos configurable. **Frontend:** preferencias/estado de notificación si resultan necesarios. **Backend:** ticket-notifications, watcher, ledger, mailer/push. **Base de datos:** evento/ciclo, intento y resultado de entrega sin guardar contenido sensible innecesario.

**Criterios de aceptación:**

- [ ] Solicitante recibe resolución y respuesta relevante según preferencias.
- [ ] Fallo SMTP transitorio no marca como entregado; reintento no duplica envío exitoso.
- [ ] Eventos de un nuevo ciclo no quedan bloqueados por el ledger del anterior.

**Prioridad:** Media. **Dependencias:** TASK-HD-003/004/008.

### TASK-HD-012 — Mostrar tickets e incidencias desde el activo

**Problema:** HD-031 no permite consultar el historial del equipo desde su detalle. **Estado actual:** vínculo solo por ticket/tag. **Cambio requerido:** pestaña de incidencias históricas con acceso al ticket y resumen de repetición. **Frontend:** AssetDetailModal/useAssetDirectoryData. **Backend:** filtro por activoId/detalle si se necesita. **Base de datos:** aprovechar identidad estable; sin tabla de mantenimiento obligatoria.

**Criterios de aceptación:**

- [ ] Activo muestra tickets abiertos y terminales con fechas/estado.
- [ ] Renombrarlo no pierde historial.
- [ ] Permisos de consulta siguen aplicándose en servidor.

**Prioridad:** Media. **Dependencias:** TASK-HD-001/005/010.

### TASK-HD-013 — Accesibilidad y coherencia del Design System

**Problema:** HD-045/048 tiene controles sin nombre accesible y estilos repetidos. **Estado actual:** DS y modal accesible existen. **Cambio requerido:** asociar labels, acceso de teclado a adjuntos, errores por campo y reutilización de pieles; revisar responsive real. **Frontend:** TicketFormModal, TicketsView, Field y componentes existentes. **Backend:** sin cambios salvo mensajes de validación. **Base de datos:** ninguno.

**Criterios de aceptación:**

- [ ] Todos los controles tienen nombre accesible y error asociado.
- [ ] Crear/adjuntar/comentar es operable por teclado con foco visible.
- [ ] Validación visual en 1920×1080, 1366×768, tablet y móvil sin acciones inaccesibles.
- [ ] No se añaden variantes DS de un solo consumidor.

**Prioridad:** Media.

### TASK-HD-014 — Paginar la operación y medir límites

**Problema:** HD-043/047 carga/renderiza el historial completo y serializa mutaciones globales. **Estado actual:** endpoints con paginación opcional, bootstrap grande y ETag/compresión. **Cambio requerido:** consumir páginas y detalles bajo demanda; medir con datos representativos. **Frontend:** bootstrap/coreData/TicketsView/directorios. **Backend:** bootstrap, GET tickets, métricas y lectura de detalle. **Base de datos:** ninguna migración inicial; proponer separación solo si las mediciones lo justifican.

**Criterios de aceptación:**

- [ ] Lista no descarga/renderiza todos los historiales para mostrar una página.
- [ ] Filtros, totales y exportación mantienen exactitud con múltiples páginas.
- [ ] Informe de carga mide bytes, latencia y espera de locks con volumen acordado.

**Prioridad:** Media. **Dependencias:** TASK-HD-010/012.

### TASK-HD-015 — Regresiones de negocio y resiliencia

**Problema:** HD-041 deja errores fuera de suites verdes. **Estado actual:** buenas suites unitarias/integración con JSON local y PG simulado. **Cambio requerido:** convertir reproducciones en pruebas con expectativas correctas; agregar flujos de navegador/PG real en entorno aislado. **Frontend:** pruebas de hooks, acciones, formularios, navegación y exportación. **Backend:** integración de transiciones, integridad, permisos, adjuntos y PG. **Base de datos:** fixture temporal y migraciones de prueba, nunca producción.

**Criterios de aceptación:**

- [ ] Flujos 1–8 detectan regresión con asserts de negocio, no solo códigos 200.
- [ ] Pruebas de API/base caída, timeout, 401/403/500, recuperación y respuesta tardía tras logout.
- [ ] CSV/XLSX mantienen filtros, caracteres ñ/acentos y fechas con expectativas verificables.
- [ ] CI usa Node declarado y ejecuta la suite aplicable.

**Prioridad:** Alta. **Dependencias:** acompañar cada corrección; E2E después del flujo estabilizado.

### TASK-HD-016 — Verificar despliegue, respaldo y archivos

**Problema:** HD-038/039 y límites de auditoría impiden certificar operación empresarial. **Estado actual:** infraestructura documentada, adjuntos PG y cabeceras Express; configuración real no inspeccionada. **Cambio requerido:** comprobar staging/producción de forma controlada: cabeceras frontend, CORS, secretos, backup/restauración conjunta y política de archivos; autorizar antes de escribir adjunto. **Frontend:** `_headers`/configuración Cloudflare si falta; mensajes de adjuntos. **Backend:** upload y configuración Railway/Neon. **Base de datos:** procedimiento probado de respaldo/restauración de estado, binarios y sesiones según política.

**Criterios de aceptación:**

- [ ] Evidencia de cabeceras efectivas, HTTPS y orígenes permitidos/rechazados.
- [ ] Restauración aislada recupera ticket y adjunto verificando integridad.
- [ ] Escáner de secretos revisa árbol/historial sin publicar valores.
- [ ] Archivo no autorizado se rechaza antes de persistir bytes; política de tipos documentada.

**Prioridad:** Alta para liberación; media para mejoras no bloqueantes de archivos.

### TASK-HD-017 — Hacer idempotente la creación

**Problema:** HD-007 duplica tickets ante reintento. **Estado actual:** bloqueo UI, pero endpoint procesa cada POST. **Cambio requerido:** clave por intención de envío, conservada ante timeout/reintento y validada en servidor. **Frontend:** useTicketActions/formulario. **Backend:** POST tickets/historical si aplica. **Base de datos:** registro de clave, actor y resultado con expiración; exclusión atómica.

**Criterios de aceptación:**

- [ ] Dos envíos concurrentes con misma clave devuelven un solo ticket.
- [ ] Misma clave con payload distinto se rechaza claramente.
- [ ] Dos incidencias intencionales iguales con claves distintas son válidas.

**Prioridad:** Media.

### TASK-HD-018 — Reducir orquestación y documentación contradictoria

**Problema:** HD-048 aumenta coste de mantenimiento; README contiene afirmaciones antiguas sobre adjuntos locales que contradicen la sección posterior. **Estado actual:** arquitectura ya separada parcialmente; App/index aún grandes. **Cambio requerido:** extraer coordinación por dominio al modificarla, eliminar helpers muertos confirmados y actualizar documentación de adjuntos y rutas hash. **Frontend:** App/useSessionActions/utils/app. **Backend:** index y README. **Base de datos:** ninguno.

**Criterios de aceptación:**

- [ ] Nuevos clientes de dominio usan src/api y acciones reciben dependencias.
- [ ] Componentes reutilizan DS y no cambian comportamiento por refactor.
- [ ] Documentación coincide con Neon para binarios y `/#/tickets` para navegación.

**Prioridad:** Baja; ejecución incremental junto con tareas funcionales.

## Plan de implementación por dependencias

| Fase | Tareas | Condición de salida |
| --- | --- | --- |
| 1 — Seguridad e integridad | 003 (push), 001 (referencias), 002 (retención), controles urgentes de 016; regresiones 015 | No crear huérfanos ni purgar expedientes operativos; destinos push restringidos. No hay crítico confirmado, se priorizan riesgos altos. |
| 2 — Funcionalidad Help Desk | 004 → 005/006/007 → 008; 017; 011 después de hitos/SLA | Solicitud completa, solución/hitos verificables, SLA histórico correcto y trazabilidad. |
| 3 — Operación | 009 y 010 → 012 → 014; completar 011 | Backlog visible, búsqueda fiable, reportes/exportaciones consistentes y consulta del activo. |
| 4 — Calidad | 013, E2E/resiliencia de 015, verificación completa 016; 018 incremental | Pruebas reales de navegador y PG, responsive/accesibilidad, recuperación y despliegue verificables. |

Los tests se añaden con cada corrección, no se posponen todos a fase 4. Tras cada grupo: `npx tsc -b`, ESLint de archivos tocados, `npm run test:ui`, `npm run build`, más backend/integración cuando corresponda. No se propone reemplazar React, Express, PostgreSQL, Zustand ni los proveedores actuales.

## Resultado final

**1. Estado actual:** aplicación funcional de operación TI con tickets, inventario, insumos, usuarios, auditoría, reportes, correo y push; arquitectura adecuada para evolucionar. La principal deuda está en semántica del ciclo, integridad referencial, retención y exactitud de métricas.

**2. Correctamente implementado:** creación/folio, validaciones básicas, asignación manual, estados y reapertura, permisos de servidor, aislamiento de solicitante, consumo de stock atómico, sesiones persistentes, adjuntos con límites/descarga autorizada, calendario SLA, avisos preventivos, filtros/reportes, QR firmado, CSV protegido, foco de modales, CI y pruebas.

**3. Parcial:** historial visible, solución, edición de cerrados, política de espera/SLA, notificaciones de seguimiento, filtro operativo por dimensiones, carga total, alcance por rol, archivos, paginación, verificación de infraestructura y accesibilidad.

**4. Faltante:** primera atención y resolución separadas; solicitud sin activo y creador/solicitante distintos; categoría estructurada, reclasificación de prioridad; cronología completa en UI, cancelación conservadora y pestaña de tickets desde activo. Supervisor específico, asignación automática, subcategorías profundas y mantenimiento programado no son obligatorios para comenzar a operar.

**5. Bugs comprobados:** cumplimiento SLA tardío=100 %, búsqueda UI omite folio/solicitante, fechas de cierre/resolución indistintas, activo/sucursal inconsistentes, referencias rotas por edición/borrado, eliminación de sucursal en uso y fechas regionales ambiguas. La falta de backlog global y edición de cerrados se describen como limitaciones/políticas incompletas, no como bypass de seguridad.

**6. Vulnerabilidades:** validación insuficiente de destino push con riesgo SSRF condicionado; aceptación reproducida, explotación de red no ejecutada. Permisos destructivos amplios y manejo de archivos son riesgos adicionales de diseño; no se demostró SQL injection, XSS, filtración de secretos ni IDOR de solicitante en los casos ensayados.

**7. Deuda técnica:** estado global en JSONB sin restricciones por entidad, grandes orquestadores, duplicación de pieles, semánticas de filtro divergentes, cobertura UI desigual y documentación desactualizada en algunos párrafos.

**8. Backlog prioritario:** proteger datos y destinos externos → hitos y clasificación → SLA/métricas → búsqueda y operación → calidad visual, carga y recuperación. Las 18 tareas detallan dependencias y criterios.

**9. Nivel de preparación: OPERATIVO INTERNO CON RESERVAS.** Supera un prototipo y tiene funciones/pruebas suficientes para uso interno supervisado. No puede calificarse aún como «preparado para producción empresarial» con esta evidencia: hay pérdida de relaciones y borrados destructivos permitidos, indicadores SLA incorrectos, captura incompleta de atención, un riesgo de destinos push y verificaciones reales de infraestructura/navegador pendientes. Esta clasificación evalúa el código probado; no certifica disponibilidad ni seguridad del despliegue actual.
