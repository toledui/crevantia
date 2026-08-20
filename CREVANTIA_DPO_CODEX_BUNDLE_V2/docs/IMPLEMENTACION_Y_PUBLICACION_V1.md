# Codex — Implementación y publicación DPO-PRO v1.0.0

## Objetivo

Usa este bundle como fuente de datos para terminar el módulo de evaluación, dejar la nueva norma completamente cargada en MySQL y publicar la primera versión oficial de DPO-PRO.

El proyecto ya existe. No lo reinicies.

## Regla de precedencia

Para configuración matemática y banco de preguntas, usa en este orden:

1. Los JSON de `seed/` de este BUNDLE V2.
2. Los archivos oficiales de `source/` para auditoría.
3. El bundle anterior únicamente como referencia histórica.

No vuelvas a reconstruir los datos manualmente desde el Excel si ya están serializados en `seed/`.

## Seeds que debes consumir

### Assessment

`seed/dpo-pro.assessment.v1.json`

Contiene:

- 17 controles estadísticos;
- 168 pares;
- 336 reactivos visibles;
- 25 preguntas Likert.

### Reactivos y mapeo

`seed/dpo-pro.reactives.v1.json`

Contiene por reactivo:

- polaridad;
- peso;
- pareja;
- scaleCode;
- scoreIfMore;
- scoreIfLess.

El cliente confirmó que `reactivo -> escala` no cambia.

### Scoring

`seed/dpo-pro.scoring-key.v1.json`

Debe persistirse como `ScoringKeyVersion v1.0.0`.

### Escalas

`seed/dpo-pro.scales.v1.json`

48 escalas.

### Competencias y derivados

`seed/dpo-pro.composites.v1.json`

Contiene:

- 33 `RAW_MEAN_THEN_NORM`;
- 21 `DECILE_MEAN`;
- aliases de reporte.

### Norma oficial

`seed/dpo-pro.norm-official.v1.json`

Este archivo contiene **todos los thresholds activos de la nueva norma**, no solo instrucciones para leer el Excel.

Incluye:

- 48 normas de escala;
- 33 normas de competencia;
- 6 normas Likert;
- metadatos de tablas fuente no activas.

### Likert

`seed/dpo-pro.likert.v1.json`

Contiene las 25 preguntas, dimensiones, fórmula y baremos.

## Importante: qué NO debes publicar

Dentro de `dpo-pro.norm-official.v1.json` existe `sourceTablesNotActive`.

No publiques automáticamente esos elementos.

En particular:

- `Situación Financiera` como tabla duplicada;
- `Búsqueda de Significado Psicoproductivo`;
- `Cuadrantes`;
- normas históricas `ESTILO`.

Las dos primeras tablas problemáticas de competencias no forman parte de las 33 competencias oficialmente normadas en la nueva matriz.

## Implementación de métodos

El backend debe soportar:

```ts
DIRECT_SCALE_NORM
RAW_MEAN_THEN_NORM
DECILE_MEAN
DIRECT_ALIAS
```

### DIRECT_SCALE_NORM

Suma reactivos -> raw scale -> norm -> decile.

### RAW_MEAN_THEN_NORM

Promedio de raw scores de escalas -> norm de competencia -> decile.

### DECILE_MEAN

Promedio de deciles de escalas -> resultado. Sin nueva norma.

### DIRECT_ALIAS

Mismo resultado de la entidad fuente, distinto nombre de presentación.

## Likert

Por dimensión:

```ts
raw = average(fiveAnswers)
decile = lookupNorm(raw)
```

Todas las respuestas son directas 1..5 y tienen el mismo peso.

## Modelo de normas editable

La nueva norma debe publicarse como versión inmutable.

Flujo futuro:

`PUBLISHED -> CLONE -> DRAFT -> VALIDATE -> APPROVE -> PUBLISH`

No editar thresholds de una versión publicada.

## Validaciones antes de publicar

Lee:

- `tests/expected-counts.json`
- `tests/publication-validation-spec.json`
- `tests/integrity-report.json`

Implementa un comando equivalente a:

```bash
npm run validate:dpo:v1
```

Debe fallar si los conteos o integridad no coinciden.

## Seed idempotente

Crear comando equivalente a:

```bash
npm run seed:dpo:v1
```

Debe:

1. importar AssessmentVersion;
2. importar preguntas;
3. importar reactivos;
4. importar ScoringKeyVersion;
5. importar escalas;
6. importar composites;
7. importar derived metrics;
8. importar NormVersion;
9. importar Likert;
10. validar;
11. no modificar una versión ya publicada.

## Publicación

Después de pasar:

- lint;
- build;
- unit tests;
- integration tests;
- validate:dpo:v1;
- prueba E2E;

publicar:

- AssessmentVersion `DPO-PRO v1.0.0`;
- ScoringKeyVersion `DPO-PRO-SCORING v1.0.0`;
- NormVersion `DPO-PRO-OFFICIAL v1.0.0`.

Marcar explícitamente esas versiones como activas para nuevas aplicaciones.

## E2E obligatorio

Debe probarse:

1. crear intento;
2. guardar control estadístico;
3. responder 168 pares;
4. responder 25 Likert;
5. enviar;
6. calcular 48 escalas;
7. normalizar 48 escalas;
8. calcular y normalizar 33 competencias;
9. calcular 21 métricas DECILE_MEAN;
10. calcular 5 dimensiones Likert y, si se usa, Total;
11. guardar ResultRun con versiones;
12. demostrar auditoría de contribuciones;
13. comprobar que el frontend del evaluado nunca recibe pesos, escalas, normas ni fórmulas.

## Reporte al terminar

Genera:

`DPO_PRO_V1_PUBLICATION_REPORT.md`

Incluye:

- migraciones;
- archivos modificados;
- conteos insertados;
- versiones publicadas;
- hashes;
- tests;
- validación de norma;
- diferencias respecto a datos previos;
- cualquier warning no bloqueante.

No des por finalizada la tarea hasta que DPO-PRO v1 pueda calcularse completamente desde MySQL sin abrir el Excel.
