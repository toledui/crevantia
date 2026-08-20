# DPO-PRO · Validación del Caso 1

## Fuente

`CREVANTIA_DPO_CODEX_BUNDLE_V2/Caso de prueba 1 DPO-PRO.xlsx`.

La prueba lee directamente la hoja `Respuestas`, rango `N1:MK2`. Las 336
columnas representan los dos reactivos de cada uno de los 168 pares; la marca
`( + )` determina el reactivo `MORE` y la marca `( - )` el reactivo `LESS`.

```text
SHA-256 del Excel: 2c11a66f897312fdd29581d7caa1ac4e4cea69b3b0df1d70052a2368e2a59db4
SHA-256 del vector: 2b6af7541e70fa8d929a7da9db4ef46b4a1d67abc3d26f788da22253be24085a
```

## Diferencia encontrada originalmente

```text
DPO-P039
manual   = DPO-R078 MORE
esperado = DPO-R077 MORE
```

El intento manual y sus ResultRun permanecen intactos. La corrección existe
únicamente en el fixture técnico aislado.

## Estado después de corregir el fixture

```text
pairs expected: 168
pairs fixture:  168
matching:       168
mismatches:       0
```

El test confirma además que `DPO-R077` recibe `MORE` y `DPO-R078` queda
implícitamente como `LESS`.

## Configuración ejecutada

```text
AssessmentVersion:  DPO-PRO v1.0.0
ScoringKeyVersion:  DPO-PRO-SCORING v1.0.0
NormVersion:        DPO-PRO-OFFICIAL v1.0.0
```

Esta ejecución no carga respuestas Likert. El fixture de las 25 preguntas de
Gestión de recursos está separado en
`backend/test/fixtures/dpo-pro-likert-test-1.json`.

## Pipeline validado

```text
168 respuestas exactas
336 contribuciones reactivas
48 escalas
33 competencias normadas
21 métricas derivadas DECILE_MEAN
0 respuestas Likert en este caso histórico
```

## Escalas críticas

```text
DPO-S001 Adaptación                 = 19
DPO-S043 Alineamiento de Acciones   = 13
```

## Competencias críticas

| Código   | Bruto | Decil |
| -------- | ----: | ----: |
| DPO-C011 | 11.67 |    D7 |
| DPO-C013 | 11.67 |    D4 |
| DPO-C014 | 10.33 |    D6 |
| DPO-C015 |  9.33 |    D4 |
| DPO-C016 | 14.00 |    D8 |
| DPO-C026 | 15.67 |   D10 |
| DPO-C031 | 12.67 |    D7 |

## Ejecución

```bash
npm run test:dpo:case1
```

Resultado esperado:

```text
DPO-PRO CASE 1
Pairs compared:             168/168 PASS
Reactive contributions:     336/336 PASS
Scales:                       48/48 PASS
Normed composites:            33/33 PASS
Norm lookup:                    PASS
Configuration versions:        PASS

RESULT: PASS
```
