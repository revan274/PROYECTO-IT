# Mesa IT — Reglas del proyecto

## Design System (Fase 2 — regla vigente)

**El Design System (`src/components/ui/`) es la única fuente de verdad para patrones visuales reutilizables.**

- Ningún componente nuevo puede introducir clases Tailwind repetidas si ya existe un componente del DS que cubra ese caso.
- Antes de escribir un `className` con más de ~4 utilidades, verificar si `Button`, `Badge`, `Toast` u otro componente de `src/components/ui/` ya lo cubre.
- Los componentes del DS: aceptan `className` para extensión, reenvían props nativas del elemento HTML, no contienen lógica de negocio (solo presentación), y no añaden variantes usadas una sola vez.
- Tokens de marca en `src/index.css` (`@theme`): `--color-brand` (#F58220), `--color-brand-strong` (#E06C0C), `--color-brand-green` (#8CC63F). Usar `bg-brand` / `text-brand` en lugar de `bg-[#F58220]`.

## Arquitectura (Fase 1 — vigente)

- Generadores de documentos imprimibles: `src/reports/` (funciones puras datos → HTML).
- Exportaciones CSV/Excel: `src/exports/` (reciben datos planos, sin estado React).
- Importación de inventario: `src/imports/` + hook coordinador `useInventoryImport`.
- Clientes HTTP por dominio: `src/api/` (convención preferida para nuevos clientes).
- Hooks coordinadores en `src/hooks/actions/` reciben dependencias por parámetros, no importan el store directamente.

## Validación obligatoria tras cada grupo de cambios

`npx tsc -b` · `npx eslint <archivos tocados>` · `npm run test:ui` · `npm run build` — todo en verde antes de continuar.
