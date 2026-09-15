<!--
PR: refactor/app-tsx-extraction  ->  main
Título sugerido:
refactor(app): extraer builders de HTML y hooks de dominio desde App.tsx
Crear PR en: https://github.com/revan274/PROYECTO-IT/pull/new/refactor/app-tsx-extraction
-->

## Resumen
Divide el componente `App.tsx` (~4.5k líneas, *god component*) en módulos enfocados **sin cambios de comportamiento**. Trabajo en tres fases incrementales, verificando `tsc` + `eslint` + `vitest` tras cada paso.

**`src/App.tsx`: 4564 → 2472 líneas (~46% menos).**

## Qué se extrajo

### Builders de HTML puros — `src/utils/printing/`
- `assetLabel.ts` — etiqueta QR imprimible del activo (60×40mm)
- `reportPresentation.ts` — reporte ejecutivo IT (A4 multipágina)
- `travelSheet.ts` — formato mensual de movilidad/viáticos

### Hooks de métricas — `src/hooks/metrics/`
- `useSupplyMetrics` — resumen/opciones/lista filtrada de insumos
- `useInventoryMetrics` — riesgos, opciones y activos filtrados/ordenados
- `useDashboardMetrics` — series, tendencias y KPIs del dashboard
- `useReportMetrics` — cómputos de reportería y viáticos
- `useUserMetrics` — usuarios filtrados/ordenados y conteos

### Hooks de orquestación — `src/hooks/`
- `useInventoryImport` — importación Excel (preview + confirmar) y CSV de incidencias
- `useReportExports` — exportar/imprimir reporte (PDF/Excel/presentación) y formato de viáticos

## Notas
- Extracción mecánica preservando la lógica; los efectos de DOM (`window.open`, `print`, descargas) permanecen en sus call-sites.
- `useReportExports` recibe el objeto completo de `useReportMetrics` tipado vía `ReturnType<typeof useReportMetrics>` para evitar ~50 anotaciones manuales.
- App.tsx queda como shell: estado → hooks de dominio → wiring de handlers → JSX de rutas.

## Verificación
- `tsc -b --noEmit`: sin errores
- `eslint .`: 0 problemas
- `vitest run`: 13/13 tests
- `vite build`: OK
