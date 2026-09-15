<!--
PR: fix/pulido-ui-y-aislamiento-tests  ->  main
Título sugerido:
fix(ui): plegar la lista de tickets, cubrir el modo oscuro y destruncar los filtros
Crear PR en: https://github.com/revan274/PROYECTO-IT/pull/new/fix/pulido-ui-y-aislamiento-tests
Copia todo lo que va debajo de esta marca como cuerpo del PR.
-->

Cuatro arreglos visuales en las pantallas de operación diaria. Cada uno medido antes y después, y verificado con captura de la aplicación corriendo en local contra datos reales (27 tickets), no solo con las pruebas.

## 1. La lista de tickets montaba cada tarjeta completamente desplegada

`filteredTickets.map()` renderizaba los paneles de *Adjuntos* y *Comentarios* de todos los tickets a la vez, con su campo de texto y su campo de archivo, **estuvieran vacíos o no**.

Medido con 27 tickets: **498 px de alto por tarjeta** y **83 campos de entrada** en pantalla. Extrapolado a los 143 tickets reales de producción: unos **75 000 px de scroll (93 pantallas)** y ~430 campos montados simultáneamente.

Los dos paneles pasan a plegarse por defecto tras un interruptor que conserva los contadores (`Adjuntos (2) | Comentarios (4)`), para no perder el rastro de lo que hay dentro. **La cabecera y la fila de acciones no se pliegan**: cambiar estado y asignación desde la lista es el flujo diario del técnico y no debe costar un clic extra.

## 2. La cabecera del ticket repetía información y estaba en mayúsculas

`Estado`, `Tipo de atención` y `Traslado` se mostraban como insignia **y** como control editable en la misma tarjeta. Gastaban una fila entera de insignias sin añadir nada. Quedan las tres únicas: folio, prioridad y SLA.

El folio pasa de `slate-300` — era el texto de menor contraste de toda la tarjeta — a `slate-500` con cifras tabulares, porque es el identificador que la gente dice por teléfono.

Los metadatos dejan las mayúsculas y los segundos. `formatDateTime` **no se toca**: alimenta auditoría, adjuntos, exportaciones a Excel y reportes impresos, donde el segundo y el año completo sí importan. Se añade `formatDateTimeCompact` aparte, con pruebas que no comparan cadenas literales porque `toLocaleString` depende del idioma del entorno.

**Resultado combinado (1 + 2), medido con los mismos 27 tickets:**

| | Antes | Después |
|---|---|---|
| Alto por tarjeta | 498 px | **323 px** (−35 %) |
| Campos de entrada | 83 | **29** (−65 %) |
| Tickets visibles sin scroll | 3 | **5** |

## 3. El modo oscuro dejaba pantallas enteras en claro

El tema oscuro no usa variantes `dark:` (solo hay 7 en todo el proyecto): un bloque `html.dark` en `index.css` reescribe las clases claras. Lo que no está en ese bloque conserva su color claro sobre fondo oscuro.

Auditadas las **129 clases de color** que usa el código contra el bloque: **67 no tenían cobertura**. Las peores eran las variantes con opacidad, porque el bloque cubría `bg-blue-50` pero no `bg-blue-50/80`, que es la que el código escribe.

- **Usuarios y Auditoría**: las tres tarjetas de cabecera (`bg-blue-50/80`, `bg-green-50/80`, `bg-orange-50/80`) se pintaban **casi blancas** sobre la página oscura.
- **Reportería**: la sección "Formato mensual de viajes IT" (`bg-amber-50/30`, `bg-amber-50/50`, `bg-slate-50/60`) salía como una **losa gris con el texto ilegible**, y los botones *Abrir formato* / *Imprimir formato* perdían el contraste (`bg-amber-100` con `text-amber-800`, ninguno reescrito).

Quedan 30 clases sin cubrir, revisadas una a una, y están bien así: rellenos saturados `-500` de botones, chips y barras de gráfica; `slate-700/800/900` que ya son oscuros; texto que ya es claro; y anillos de foco.

Todas las reglas nuevas viven bajo `html.dark`, así que el tema claro no puede cambiar — verificado además con captura de Reportería en claro.

## 4. Las etiquetas de los filtros se cortaban a media palabra

Reportería repartía sus nueve filtros en `xl:grid-cols-9`: columnas iguales de ~105 px para etiquetas que necesitan ~150. En pantalla se leía `SUCURS`, `PRIORII`, `ATENCI`, `TÉCNICO`, `NOMBRE EN FO`, `MIREYA SANDO`. Lo mismo en la fila de viajes (`xl:grid-cols-7`) y en el panel de usuarios (`xl:grid-cols-4` dentro de una columna estrecha): `TODOS LOS RO`, `TODOS LOS CA`.

Las tres pasan al patrón que **ya usan Tickets e Inventario**: `auto-fit` con mínimo de 12 rem, de modo que cada filtro reclama el ancho que necesita y la fila se parte cuando toca.

**Auditoría se deja como está**: sus cuatro columnas tienen ~250 px y no truncan. Comprobado en captura antes de decidir, no supuesto.

## Validación

- `npx tsc -b`, `npm run lint`, `npm run build` — en verde.
- `npm run test:server:coverage` y `npm run test:ui:coverage` — en verde, umbrales cumplidos.
- **127 pruebas** de UI (6 nuevas para `formatDateTimeCompact`), 20 ficheros.
- Reproducido además con **Node 20.19.0**, que es la versión de la CI.
- Desplegado del panel verificado en navegador: 0 paneles → clic → 1 panel completo con `aria-expanded="true"` → clic → vuelve a 0, sin fugas.

## Riesgo conocido, no introducido por este PR

El umbral de cobertura de *functions* en UI pasa por **0,35 puntos** bajo Node 20 (45,35 % frente al mínimo de 45). Es el mismo margen estrecho que ya dejó la CI en rojo anteriormente. No lo aborda este PR, pero conviene tenerlo presente: cualquier función nueva sin cubrir lo tumba.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
