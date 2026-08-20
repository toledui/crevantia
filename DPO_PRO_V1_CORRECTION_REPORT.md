# DPO-PRO v1 · Reporte de corrección Bundle V2

## Versiones usadas antes

El resultado histórico `cmt1rf4yz005khsi91ojbrcm3` utilizó:

| Componente | ID | Versión | Estado |
| --- | --- | ---: | --- |
| Assessment | `assessment-version-dpo-pro-official-v1` | 1 (`DPO-PRO-v1.0.0`) | PUBLISHED |
| Scoring | `scoring-key-version-dpo-pro-official-v1` | 1 (`DPO-PRO-SCORING 1.0.0`) | PUBLISHED |
| Norma | `norm-version-dpo-pro-official-v1` | 1 (`DPO-PRO-OFFICIAL 1.0.0`) | PUBLISHED |
| Motor | `dpo-engine-v2` | — | activo |

Hash reproducible del resultado: `d9a99434f4d67db4fae4921a4dadf8b2b9c43d019fc9be43ff8480491c1fa81e`.

La selección de versiones era correcta. El defecto estaba en la representación decimal de algunos límites que habían llegado a MySQL redondeados.

## Versiones después

Se conservan las mismas versiones oficiales publicadas y la asignación explícita de `AssessmentActiveConfiguration`. No se activó ni mezcló `GLOBAL_412`; ese norm set no está presente.

La norma publicada fue resincronizada desde Bundle V2 y el resultado histórico no fue sobrescrito. Se creó:

- Recalificación: `cmt1rtcls0000h4i9intr0h4c`.
- Resultado original: `cmt1rf4yz005khsi91ojbrcm3`.
- Razón: `Corrección y sincronización con Bundle V2 oficial`.

## Auditoría

| Configuración | Registros | Diferencias contra V2 |
| --- | ---: | ---: |
| Scoring rules | 336 | 0 |
| Escalas | 48 | 0 |
| Composites RAW_MEAN_THEN_NORM | 33 | 0 |
| Derivados DECILE_MEAN | 21 | 0 |
| Targets normativos | 87 | 0 |
| Thresholds | 870 | 0 |
| Preguntas/reglas Likert | 25 | 0 |

Cada escala contiene exactamente siete reactivos: cuatro positivos y tres negativos. Las cinco dimensiones Likert contienen cinco preguntas directas, peso 1.

## Causas raíz de las siete diferencias

### DPO-C011, DPO-C026 y DPO-C031

El bruto era correcto. Los límites periódicos del JSON se enviaban al adaptador como `number`; algunos fueron persistidos redondeados hacia arriba. La comparación sin redondeo previo quedaba entonces un decil abajo.

El seed ahora convierte explícitamente cada límite a `Prisma.Decimal` desde su representación textual y audita la sincronización de las 870 filas.

### DPO-C013, DPO-C014, DPO-C015 y DPO-C016

Las composiciones y las 336 reglas coinciden con Bundle V2. Las cuatro diferencias se explican mediante una sola respuesta:

| Par | Intento manual | Caso 1 esperado |
| --- | --- | --- |
| `DPO-P039` | `DPO-R078` MORE | `DPO-R077` MORE |

Ambos reactivos comparten el par. Cambiar la selección reduce `DPO-S043` en 3 puntos y aumenta `DPO-S001` en 2. Esas dos escalas participan precisamente en las cuatro competencias afectadas, produciendo exactamente los cuatro brutos esperados. No se modificó ninguna regla para forzar resultados.

## Caso 1 automatizado

Fixture pareado: `backend/test/fixtures/dpo-pro-case-1-paired.json`.

Las 25 respuestas Likert están aisladas en
`backend/test/fixtures/dpo-pro-likert-test-1.json` y no forman parte del Caso 1
histórico.

Comando: `npm run test:dpo:case1`.

Resultado verificado:

- 336 contribuciones.
- 48 escalas y 48 deciles.
- 33 competencias y 33 deciles.
- 21 métricas `DECILE_MEAN`.
- 25 contribuciones Likert y 5 dimensiones.
- Las siete regresiones señaladas pasan con bruto y decil esperados.

Los datos completos están en [DPO_CASE_1_RESULT.json](./DPO_CASE_1_RESULT.json) y el desglose legible en [DPO_CASE_1_VALIDATION.md](./DPO_CASE_1_VALIDATION.md).
