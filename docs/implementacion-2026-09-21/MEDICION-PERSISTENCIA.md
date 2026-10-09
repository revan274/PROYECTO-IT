# Medición de persistencia JSONB

**Generado:** 2026-10-09T21:23:50.918Z

## Alcance

La medición no modifica el documento de negocio ni ejecuta migraciones. El modo PostgreSQL, cuando se habilita explícitamente, lee `mesa_it_state`, reescribe solo una tabla temporal de sesión y usa un advisory lock reservado para medir espera.

## Snapshot local

- Tamaño JSON compacto: 139560 bytes.
- Tamaño gzip: 17889 bytes (12.82 % del original).
- Volumen: 0 tickets, 0 eventos, 0 ciclos, 0 adjuntos, 154 activos y 98 filas de auditoría.
- Parse p50/p95: 0.307/0.384 ms.
- Stringify p50/p95: 0.355/0.56 ms.
- Ciclo parsear→mutar→serializar p50/p95: 0.663/0.93 ms.

### Contención sintética local

| Concurrencia | Operaciones | ops/s | Espera p50 | Espera p95 | Reescritura p95 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 8 | 1373.86 | 2.695 ms | 4.885 ms | 0.876 ms |
| 2 | 8 | 1394.46 | 2.347 ms | 4.698 ms | 0.888 ms |
| 4 | 16 | 1438.22 | 5.089 ms | 9.92 ms | 0.812 ms |
| 8 | 32 | 1437.03 | 10.641 ms | 20.529 ms | 0.849 ms |

## PostgreSQL

No se proporcionó `MEASURE_DATABASE_URL`; no se midieron latencia, tamaño físico JSONB ni espera de locks en PostgreSQL/Neon.

## Decisión

**No se propone normalizar todavía.** El snapshot local sirve como línea base de volumen y costo de CPU. La decisión requiere ejecutar el modo PostgreSQL en un staging representativo y comparar p95 de lectura, reescritura y espera de lock bajo concurrencia con el SLO operativo acordado.

La normalización se justificará si la medición real muestra crecimiento o contención sostenida que incumple ese SLO; no por el tamaño del código ni por una estimación local aislada.
