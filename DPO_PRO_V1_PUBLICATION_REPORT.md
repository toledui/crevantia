# Informe de implementación y publicación — DPO-PRO v1.0.0

Fecha de verificación: 2026-08-19 (America/Mexico_City)

## Estado

La configuración oficial `DPO-PRO-v1.0.0` fue implementada, migrada, sembrada y activada en la base local. El motor funciona sin depender de Excel o Word durante la ejecución.

Configuración activa:

- Assessment: `assessment-dpo-pro`
- AssessmentVersion: `assessment-version-dpo-pro-official-v1`
- ScoringKeyVersion: `scoring-key-version-dpo-pro-official-v1`
- NormVersion: `norm-version-dpo-pro-official-v1`
- ReportMappingVersion: `report-mapping-version-dpo-pro-official-v1`
- ActiveConfiguration: `active-configuration-dpo-pro-official-v1`

## Fuente auditada

Se auditó `CREVANTIA_DPO_CODEX_BUNDLE_V2`, incluyendo el libro oficial, el documento de reglas, los JSON derivados, el manifiesto SHA-256 y la especificación de publicación. Los hashes de los archivos fuente coinciden con `manifest.json`.

Se consideran activos únicamente los elementos identificados como oficiales en el bundle. Quedaron fuera del cálculo:

- la escala duplicada `Situación Financiera`;
- las fuentes malformadas `Búsqueda Significado` y `Cuadrantes`;
- los 10 baremos de estilos heredados marcados como no activos.

## Contrato publicado

| Elemento | Cantidad |
| --- | ---: |
| Campos de control estadístico | 17 |
| Pares de elección forzada | 168 |
| Pares positivos / negativos | 96 / 72 |
| Reactivos | 336 |
| Reactivos positivos / negativos | 192 / 144 |
| Escalas pareadas | 48 |
| Composites normalizados | 33 |
| Métricas derivadas `DECILE_MEAN` | 21 |
| Preguntas Likert | 25 |
| Dimensiones Likert | 5 |
| Alias directos de reporte | 12 |
| Targets activos de norma | 87 |
| Umbrales | 870 |

## Implementación

- Se agregó una configuración activa atómica que fija las versiones exactas de assessment, scoring, norma y mapeo de reporte.
- Se incorporaron los tipos de target Likert y alias, los métodos `DECILE_MEAN` y `DIRECT_ALIAS`, y la clasificación de escalas pareadas/Likert.
- El motor calcula selección forzada, composites, promedios de deciles, cinco dimensiones Likert, total Likert y alias de reporte.
- Los intentos fijan la configuración activa y los resultados guardan trazabilidad, hashes, contribuciones, valores normalizados y diagnósticos.
- El recálculo con una norma futura conserva el resultado oficial histórico y reconstruye métricas derivadas y alias con los nuevos deciles.
- El payload del jugador no expone pesos, reglas, escalas, fórmulas ni baremos.
- El validador de publicación impide publicar DPO-PRO con conteos incompletos.
- La semilla oficial es idempotente y valida hashes/configuración antes de actualizar.
- La semilla elimina la familia normativa heredada `GLOBAL_412 / NORMA 412` cuando no contiene resultados históricos, reasigna intentos sin calificar a la norma oficial y conserva únicamente `DPO-PRO-OFFICIAL`.

La migración aplicada es `20260820023000_dpo_official_v1`. Prisma reporta las 8 migraciones al día.

## Verificación ejecutada

- `npm run validate:dpo:v1`: PASS, incluidos 87 targets y 870 umbrales.
- `npm run seed:dpo:v1`: PASS en ejecución repetida (idempotencia).
- `npm run verify:dpo:v1:db`: PASS. Recorrió captura completa, finalización y recálculo; produjo 336 contribuciones y 120 valores. Los datos E2E sintéticos se eliminaron al finalizar.
- `npm run test`: PASS, 16 suites y 55 pruebas.
- `npm run typecheck`: PASS en frontend y backend.
- `npm run build`: PASS en frontend y backend.
- ESLint dirigido a todos los archivos modificados para DPO-PRO: PASS.

El lint global del repositorio continúa fallando por deuda preexistente fuera del alcance DPO-PRO (14 errores en frontend y 213 en backend). No afecta el typecheck, build ni las pruebas anteriores; no se modificaron esos módulos ajenos para ocultar la deuda.

## Nota operativa

El render visual del `.docx` no pudo ejecutarse porque el entorno no tiene LibreOffice/`soffice`. Su contenido sí fue extraído y auditado estructuralmente, y el `.xlsx` fue inspeccionado y renderizado por hoja. Esta limitación no existe en runtime: los documentos fuente no son necesarios para evaluar.

## Edición versionada posterior a la publicación

- Una evaluación publicada puede consultarse y editarse desde el administrador. El primer guardado crea automáticamente otra versión en borrador y conserva intacta la publicada.
- La clonación incluye assessment, scoring y mapeo de reporte. Al publicar, la configuración nueva se activa atómicamente.
- Los resultados terminados conservan las versiones originales. Los intentos incompletos incompatibles se eliminan y sus asignaciones vuelven a estado `AVAILABLE`.
- Una norma publicada también puede editarse desde sus valores visibles. El primer guardado crea otra versión en borrador; después sigue validación, revisión, aprobación y publicación.
- Al publicar una norma, los intentos todavía no calificados se reasignan a ella sin borrar sus respuestas. Los resultados históricos no se modifican.
