# Paquete de implementación Crevantia / DPO-PRO

## Orden recomendado de lectura

1. `docs/ANALISIS_Y_PLAN_IMPLEMENTACION_MOTOR_DPO_PRO.md`
2. `docs/PENDIENTES_PARA_VALIDACION_DEL_CLIENTE.md`
3. `docs/BANCO_PREGUNTAS_DPO_PRO.md`
4. `docs/MATRIZ_TECNICA_ESCALAS_Y_COMPOSICIONES.md`
5. `tests/validation-report.json`

## Archivos para el seed

- `seed/dpo-pro.question-bank.v1.json`
- `seed/dpo-pro.scoring-key.v6.json`
- `seed/dpo-pro.norm.global-412.v1.json`

## Caso dorado

- `tests/dpo-pro.golden-case.excel-example.json`

Codex debe implementar primero el validador y el caso dorado. No debe comenzar por las pantallas de reportes ni inventar la parte Likert.
