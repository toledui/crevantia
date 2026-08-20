# CREVANTIA DPO-PRO — CODEX BUNDLE V2

Este paquete reemplaza el bundle anterior como **fuente de implementación para DPO-PRO v1.0.0**.

## Qué cambió

El cliente entregó una norma actualizada y respondió las preguntas pendientes de cálculo. Además confirmó textualmente que la relación **reactivo → escala no cambia**.

Por lo tanto, este bundle ya contiene datos serializados listos para seed, sin obligar a Codex a interpretar manualmente el Excel.

## Fuente oficial

- `Norma actualizada y reactivos envío TH 170826.xlsx`
- `Respuesta a preguntas de cálculo 190826.docx`

SHA-256 Excel:

`c27903456bfc8732b87d0fdef1703dd5d3df186717bc1d3358c3568da2c67052`

## Archivos principales

### Seeds

- `seed/dpo-pro.assessment.v1.json`
- `seed/dpo-pro.reactives.v1.json`
- `seed/dpo-pro.scoring-key.v1.json`
- `seed/dpo-pro.scales.v1.json`
- `seed/dpo-pro.composites.v1.json`
- `seed/dpo-pro.norm-official.v1.json`
- `seed/dpo-pro.likert.v1.json`

### Validación

- `tests/integrity-report.json`
- `tests/expected-counts.json`
- `tests/publication-validation-spec.json`

### Documentación

- `docs/IMPLEMENTACION_Y_PUBLICACION_V1.md`
- `docs/MODELO_CALCULO_OFICIAL.md`
- `docs/AUDITORIA_FUENTE_OFICIAL.md`

## Conteos validados

- 17 preguntas de control estadístico
- 168 preguntas pareadas
- 96 pares positivos
- 72 pares negativos
- 336 reactivos
- 192 reactivos positivos
- 144 reactivos negativos
- 48 escalas
- 33 competencias normadas
- 21 métricas derivadas por promedio de deciles
- 25 preguntas Likert
- 5 dimensiones Likert × 5 preguntas
- 87 targets normativos activos

## Regla importante

Los datos activos de runtime deben venir de MySQL después del seed. El Excel queda únicamente como fuente oficial/auditoría.

No hardcodear pesos, normas, componentes ni thresholds en TypeScript.
