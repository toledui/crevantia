# CREVANTIA — Publicación de la primera versión oficial de DPO-PRO

## Objetivo

Completar la implementación de la evaluación DPO-PRO dentro de Crevantia y dejar publicada la **primera versión oficial de la prueba**, con:

- banco definitivo de preguntas;
- reactivos y pares;
- asignación reactivo → escala;
- clave de puntuación;
- 48 escalas;
- competencias y métricas derivadas;
- sección Likert;
- normas oficiales;
- conversión a deciles;
- versionado;
- trazabilidad;
- auditoría;
- pruebas de regresión;
- publicación de la primera versión oficial.

El proyecto ya existe. **No crear un proyecto nuevo ni rehacer la arquitectura.**

Trabajar sobre el código actual e integrar/ajustar lo necesario.

---

# 1. Fuente de verdad

Usar como fuentes principales:

```text
/CREVANTIA_DPO_CODEX_BUNDLE
```

y los archivos nuevos entregados por el cliente:

```text
Norma actualizada y reactivos envío TH 170826.xlsx
Respuesta a preguntas de cálculo 190826.docx
```

La nueva norma entregada en el Excel reemplaza a la norma anterior.

No usar como norma activa la versión antigua `GLOBAL_412`.

La versión oficial debe construirse a partir de la **norma actualizada entregada por el cliente**.

---

# 2. Confirmación final del cliente

El cliente confirmó expresamente que:

> “sí, eso no cambia.”

Esto se refiere a la relación:

```text
reactivo → escala
```

Por lo tanto:

- conservar el mismo mapeo reactivo → escala usado en la versión anterior;
- usar los textos, polaridades y puntuaciones de reactivos del Excel actualizado;
- considerar definitiva esa relación para esta primera versión oficial.

No volver a solicitar validación sobre este punto.

---

# 3. Estructura oficial de la evaluación

La versión oficial queda compuesta por:

## 3.1 Control estadístico

```text
17 preguntas
```

Estas preguntas:

- no forman parte del scoring psicométrico;
- deben guardarse como datos de control;
- pueden ser utilizadas posteriormente para segmentación, análisis y construcción de nuevas normas.

Debe existir un tipo:

```text
STATISTICAL_CONTROL
```

---

## 3.2 Pares positivos

```text
96 preguntas pareadas
192 afirmaciones positivas
```

Cada pregunta contiene dos afirmaciones.

El usuario debe seleccionar:

```text
Me identifico más
Me identifico menos
```

---

## 3.3 Pares negativos

```text
72 preguntas pareadas
144 afirmaciones negativas
```

Total preguntas pareadas:

```text
96 + 72 = 168
```

Total afirmaciones:

```text
192 + 144 = 336
```

---

## 3.4 Gestión de recursos — Likert

Versión definitiva:

```text
25 preguntas
```

No son 31.

Las 25 preguntas:

- están incluidas en el Excel actualizado;
- están agrupadas en 5 dimensiones;
- hay 5 preguntas por dimensión.

Dimensiones:

```text
INGRESO
GASTO
AHORRO
DEUDA
INVERSION
```

---

# 4. Modelo de versionado obligatorio

La primera publicación debe generar versiones inmutables.

Como mínimo:

```text
AssessmentVersion
ScoringKeyVersion
NormVersion
ResultRun
```

Recomendado:

```text
Assessment
AssessmentVersion

ScoringKey
ScoringKeyVersion

NormSet
NormVersion

ReportMappingVersion
```

La prueba oficial debe quedar publicada con identificadores semejantes a:

```text
AssessmentVersion:
DPO-PRO v1.0.0

ScoringKeyVersion:
DPO-PRO-SCORING v1.0.0

NormVersion:
DPO-PRO-NORM v1.0.0
```

Los nombres concretos pueden adaptarse al esquema actual.

---

# 5. Estado de publicación

Usar estados claros:

```text
DRAFT
IN_REVIEW
APPROVED
PUBLISHED
ARCHIVED
BLOCKED
```

Para esta entrega:

```text
AssessmentVersion = PUBLISHED
ScoringKeyVersion = PUBLISHED
NormVersion = PUBLISHED
```

Una vez publicada una versión:

```text
NO SE PUEDE MODIFICAR
```

Cualquier cambio futuro debe crear una nueva versión.

---

# 6. Precarga oficial de preguntas

Actualizar los seeds usando el Excel oficial.

Debe quedar precargado:

```text
17 statistical control questions
168 pair questions
336 reactives
25 Likert questions
```

Todos deben tener:

- código estable;
- orden;
- sección;
- obligatoriedad;
- tipo;
- estado activo.

---

# 7. Reactivos pareados

Cada reactivo debe tener identidad propia.

Modelo conceptual:

```text
Reactive
- id
- code
- pairQuestionId
- position
- text
```

No guardar scoring directamente en el objeto visible al evaluado si ya existe separación por versión.

---

# 8. Clave oficial de puntuación

La clave de puntuación debe ser completamente data-driven.

Cada reactivo debe tener, dentro de la versión de scoring:

```text
reactiveId
scaleId
polarity
fixedWeight
scoreIfMore
scoreIfLess
```

Regla actual:

## Reactivo positivo

```text
MORE = fixedWeight
LESS = 0
```

## Reactivo negativo

```text
MORE = 0
LESS = fixedWeight
```

Implementar mediante:

```ts
contribution =
  selection === "MORE"
    ? rule.scoreIfMore
    : rule.scoreIfLess;
```

No hardcodear el comportamiento exclusivamente según `polarity`.

---

# 9. Asignación reactivo → escala

Usar el mapeo existente del scoring anterior.

El cliente confirmó que:

```text
reactivo → escala
```

no cambia.

Por tanto:

- conservar el `scaleId` anterior de cada uno de los 336 reactivos;
- validar que todos los reactivos tengan exactamente una escala válida;
- detener publicación si algún reactivo queda sin escala.

---

# 10. Escalas

La prueba contiene:

```text
48 escalas
```

Cada escala debe quedar registrada con:

```text
id
code
name
status
```

El cálculo bruto es:

```text
rawScaleScore =
SUM(appliedScore de los reactivos pertenecientes a esa escala)
```

Guardar:

```text
rawScore
```

sin redondear antes de normalizar.

---

# 11. Competencias

La nueva documentación confirma que existen tres formas de obtener resultados finales.

## Caso A — Escala normalizada directamente

```text
puntaje bruto de escala
↓
norma de esa escala
↓
decil
```

---

## Caso B — Competencia construida con puntajes brutos

```text
2 o más escalas
↓
promedio de puntajes brutos
↓
norma de competencia
↓
decil
```

Ejemplo:

```text
Empuje
= promedio(
  Energía.rawScore,
  Esfuerzo.rawScore,
  Tenacidad.rawScore
)
```

Después:

```text
rawCompositeScore
↓
NormVersion
↓
decil
```

---

## Caso C — Resultado construido con valores ya normalizados

El cliente confirmó que algunos resultados se calculan así:

```text
2 o más escalas/competencias ya convertidas a decil
↓
promedio de deciles
↓
resultado final
```

En este caso:

```text
NO aplicar otra norma
```

Esto debe ser soportado explícitamente.

---

# 12. Métodos de cálculo

Agregar una estrategia configurable:

```text
DIRECT_SCALE_NORM
RAW_MEAN_THEN_NORM
DECILE_MEAN
```

Opcionalmente:

```text
WEIGHTED_RAW_MEAN_THEN_NORM
WEIGHTED_DECILE_MEAN
DIRECT_DERIVED
```

No usar fórmulas dinámicas con `eval()`.

---

# 13. Tabla de combinaciones

Usar como fuente oficial la tabla del Excel actualizado que indica:

```text
competencia
escalas que la integran
tipo de cálculo
```

Precargarla en base de datos.

Debe ser posible consultar administrativamente:

```text
Competencia
→ Componentes
→ Método de agregación
→ Norma utilizada
```

---

# 14. Norma oficial actualizada

La norma anterior queda obsoleta para nuevas evaluaciones.

Crear una nueva versión oficial desde el Excel actualizado.

Ejemplo conceptual:

```text
NormSet:
DPO-PRO OFFICIAL

NormVersion:
v1.0.0
status = PUBLISHED
```

Guardar metadatos:

```text
name
version
sourceFile
effectiveDate
populationLabel
sampleSize
lookupMethod
numericMode
roundingMode
createdAt
publishedAt
configurationHash
```

---

# 15. La Norma debe ser editable por versiones

Nunca permitir editar una norma publicada.

Flujo:

```text
PUBLISHED v1
↓
CLONE
↓
DRAFT v2
↓
EDIT
↓
VALIDATE
↓
APPROVE
↓
PUBLISH
```

La versión anterior se conserva.

---

# 16. Targets normativos

Registrar todos los targets oficiales de la nueva norma.

Tipos soportados:

```text
SCALE
COMPOSITE
DERIVED_METRIC
LEGACY_STYLE_PROFILE
LIKERT_DIMENSION
```

No importar targets antiguos que ya no formen parte de la nueva norma oficial, salvo que sigan siendo requeridos por el nuevo Excel.

---

# 17. Baremos / thresholds

La nueva norma no tiene los duplicados que tenía la anterior.

Usar exclusivamente los valores del Excel actualizado.

Modelo:

```text
NormThreshold
- normTargetId
- decile
- lowerBound
- ordinal
```

El lookup sigue siendo por límite inferior:

```text
último lowerBound <= score
```

Ejemplo:

```text
D1 = 0
D2 = 15
D3 = 18
D4 = 20
D5 = 22
D6 = 24
D7 = 26
D8 = 27
D9 = 29
D10 = 31
```

Si:

```text
rawScore = 26
```

entonces:

```text
decil = 7
```

---

# 18. Precisión numérica

Mantener compatibilidad con Excel:

```text
numericMode = EXCEL_BINARY64
roundingMode = NONE_BEFORE_NORM_LOOKUP
```

Usar el valor sin redondear para calcular el decil.

Separar:

```text
rawScore
displayScore
```

Ejemplo:

```text
rawScore = 15.666666666666666
displayScore = 15.67
```

---

# 19. Sección Likert oficial

La sección Likert ya puede considerarse completamente especificada.

Las respuestas son:

```text
1 = Falso completamente
2 = Moderadamente falso
3 = Ni falso ni verdadero
4 = Moderadamente verdadero
5 = Verdadero completamente
```

Todas las preguntas:

```text
son positivas
```

Por tanto:

```text
1 = menor puntuación
5 = mayor puntuación
```

No hay preguntas invertidas.

---

# 20. Peso Likert

Todas las preguntas Likert:

```text
tienen el mismo peso
```

No implementar ponderaciones especiales.

---

# 21. Asignación Likert → dimensión

Usar el Excel actualizado.

Cada una de las 25 preguntas debe estar asignada exactamente a una de:

```text
INGRESO
GASTO
AHORRO
DEUDA
INVERSION
```

Cada dimensión debe contener exactamente:

```text
5 preguntas
```

Agregar validación:

```text
5 preguntas por dimensión
```

Si no se cumple:

```text
bloquear publicación
```

---

# 22. Cálculo Likert

Para cada dimensión:

```text
rawLikertDimension =
promedio de las 5 respuestas
```

Ejemplo:

```text
Ingreso:
5 + 4 + 3 + 5 + 4 = 21
21 / 5 = 4.2
```

Luego:

```text
4.2
↓
norma Likert de Ingreso
↓
decil
```

No sumar.

No ponderar.

---

# 23. Norma Likert

Precargar las tablas incluidas en el Excel actualizado.

Debe existir una norma específica para:

```text
INGRESO
GASTO
AHORRO
DEUDA
INVERSION
```

y cualquier target adicional que el Excel oficial contemple.

Usar la misma arquitectura de:

```text
NormTarget
NormThreshold
```

No hardcodear los puntos de corte.

---

# 24. Control estadístico

Precargar las 17 preguntas iniciales.

No forman parte del score.

Crear respuestas separadas:

```text
StatisticalControlAnswer
```

o integrarlas en el modelo genérico existente.

Debe quedar claro que:

```text
includeInScoring = false
```

---

# 25. Nivel máximo de ingreso

Una de las preguntas de control estadístico puede requerir valores configurables según moneda.

No bloquear la publicación de la prueba por esto.

Implementar inicialmente de forma configurable:

```text
country
currency
incomeRangeSet
```

Si el proyecto todavía no soporta localización avanzada, usar una configuración inicial en MXN y dejar la estructura preparada para futuras monedas.

No mezclar este dato con el scoring psicométrico.

---

# 26. ResultRun oficial

Cada evaluación finalizada debe generar un snapshot inmutable:

```text
ResultRun
```

Guardar:

```text
attemptId
assessmentVersionId
scoringKeyVersionId
normVersionId
engineVersion
configurationHash
calculatedAt
status
```

Esto garantiza reproducibilidad.

---

# 27. ResultValues

Guardar todos los resultados intermedios y finales.

Mínimo:

```text
SCALE_RAW
SCALE_DECILE

COMPOSITE_RAW
COMPOSITE_DECILE

DERIVED_DECILE_MEAN

LIKERT_RAW
LIKERT_DECILE
```

Ejemplo:

```json
{
  "targetType": "SCALE",
  "targetCode": "ADAPTACION",
  "rawScore": 26,
  "decile": 7
}
```

---

# 28. Auditoría por reactivo

Debe ser posible reconstruir por qué una persona obtuvo un resultado.

Guardar o poder reconstruir:

```text
reactiveId
pairQuestionId
selection
scaleId
scoreIfMore
scoreIfLess
appliedScore
```

Esto es importante para soporte y validación técnica.

---

# 29. Pipeline oficial de cálculo

## Pareados

```text
ForcedChoiceAnswers
↓
ReactiveScoringRules
↓
ReactiveContributions
↓
ScaleRawScores
↓
ScaleDeciles
↓
Composite calculations
↓
CompositeDeciles
↓
Derived DECILE_MEAN results
↓
ResultRun
```

## Likert

```text
LikertAnswers
↓
5 respuestas por dimensión
↓
promedio bruto
↓
norma correspondiente
↓
decil
↓
ResultRun
```

---

# 30. Validaciones previas a publicación

Antes de publicar la primera versión oficial ejecutar un validador.

Debe confirmar:

## Assessment

```text
17 control questions
168 pair questions
336 reactives
25 Likert questions
```

## Pairing

```text
96 positive pairs
72 negative pairs
```

## Scoring

```text
336 scoring rules
336 reactive→scale mappings
```

## Scales

```text
48 scales
```

## Likert

```text
5 dimensions
5 questions per dimension
25 total
```

## Norm

Cada target debe tener:

```text
D1
D2
D3
D4
D5
D6
D7
D8
D9
D10
```

salvo targets de tipo `DECILE_MEAN` que no requieren norma.

---

# 31. Validaciones de integridad

Bloquear publicación si existe:

```text
reactivo sin pareja
reactivo sin scoring rule
reactivo sin escala
escala inexistente
componente inexistente
pregunta Likert sin dimensión
dimensión Likert con != 5 preguntas
norm target incompleto
threshold inválido
D1-D10 faltante
referencia circular en composites
```

---

# 32. Golden tests

Actualizar los golden tests usando:

```text
Norma actualizada
+
scoring actualizado
```

No seguir validando contra la norma antigua.

Si el caso de ejemplo anterior todavía puede reproducirse con la norma nueva, registrar ambos resultados:

```text
legacyExpected
officialV1Expected
```

La norma nueva es la referencia para nuevas evaluaciones.

---

# 33. Test de punta a punta

Crear al menos un test completo:

```text
1. crear/usar usuario de prueba
2. asignar DPO-PRO v1
3. responder 168 pares
4. responder 25 Likert
5. completar 17 control fields
6. enviar evaluación
7. calcular
8. generar ResultRun
9. validar 48 escalas
10. validar competencias
11. validar deciles
12. validar Likert
```

---

# 34. Publicación de la prueba

Una vez que:

```text
lint = PASS
build = PASS
unit tests = PASS
integration tests = PASS
DPO validation = PASS
golden test = PASS
```

publicar:

```text
DPO-PRO v1.0.0
```

Estado:

```text
PUBLISHED
```

---

# 35. Configuración activa

Crear una relación o configuración que indique:

```text
activeAssessmentVersion
activeScoringKeyVersion
activeNormVersion
```

Las nuevas evaluaciones deben usar automáticamente esas versiones.

Nunca buscar simplemente:

```text
"última versión"
```

Debe haber una versión publicada y activa explícita.

---

# 36. Reproducibilidad histórica

Cuando en el futuro exista:

```text
DPO-PRO v1.1
Norm v2
Scoring v2
```

las evaluaciones realizadas con v1 deben seguir mostrando sus resultados originales.

Nunca recalcular automáticamente.

---

# 37. Recalificación manual

Permitir administrativamente:

```text
Recalcular con otra norma
```

pero crear:

```text
new ResultRun
```

No sobrescribir.

Guardar:

```text
recalculationOfResultRunId
requestedById
reason
```

---

# 38. Administración de normas

Dejar funcionando:

```text
listar normas
ver versiones
clonar
editar DRAFT
validar
aprobar
publicar
archivar
comparar
```

Solo `DRAFT` puede modificarse.

---

# 39. Editor de baremos

Mostrar tabla:

```text
Target | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10
```

Debe ser posible editar el clon de una norma.

No permitir edición directa de la v1 publicada.

---

# 40. Importación futura de normas

Crear importador JSON/CSV o Excel si la arquitectura actual lo permite.

Debe:

```text
crear nueva DRAFT
validar
mostrar errores
permitir revisar
publicar solo después de aprobación
```

No reemplazar silenciosamente la norma actual.

---

# 41. Hash de configuración

Generar hash determinístico de:

```text
AssessmentVersion
ScoringKeyVersion
NormVersion
engineVersion
```

Guardar en:

```text
ResultRun.configurationHash
```

---

# 42. Seguridad

El frontend del evaluado nunca debe recibir:

```text
weights
scaleId
polarity
scoreIfMore
scoreIfLess
normThresholds
composite formulas
```

Todo scoring ocurre en backend.

---

# 43. API del reproductor

El frontend solo recibe:

```json
{
  "questionId": "...",
  "type": "FORCED_CHOICE_PAIR",
  "reactives": [
    {
      "id": "...",
      "text": "..."
    },
    {
      "id": "...",
      "text": "..."
    }
  ]
}
```

Para Likert:

```json
{
  "questionId": "...",
  "type": "LIKERT",
  "text": "...",
  "options": [
    {"value":1,"label":"Falso completamente"},
    {"value":2,"label":"Moderadamente falso"},
    {"value":3,"label":"Ni falso ni verdadero"},
    {"value":4,"label":"Moderadamente verdadero"},
    {"value":5,"label":"Verdadero completamente"}
  ]
}
```

---

# 44. Seed oficial

Crear un seed idempotente oficial, por ejemplo:

```bash
npm run seed:dpo:official-v1
```

Debe insertar o actualizar únicamente registros de configuración no publicados.

Si la v1 ya está publicada:

```text
no modificarla
```

---

# 45. Reporte técnico de publicación

Al terminar generar:

```text
DPO_PRO_V1_PUBLICATION_REPORT.md
```

Debe contener:

```text
Assessment Version
Scoring Version
Norm Version
Fecha
Hashes
Cantidad de preguntas
Cantidad de reactivos
Cantidad de escalas
Cantidad de competencias
Cantidad de norm targets
Cantidad de thresholds
Tests ejecutados
Resultado golden test
Resultado E2E
Warnings
Estado final
```

---

# 46. Estado esperado al finalizar

Debe quedar:

```text
DPO-PRO v1.0.0                  PUBLISHED
DPO-PRO-SCORING v1.0.0          PUBLISHED
DPO-PRO-NORM v1.0.0             PUBLISHED
```

y:

```text
activeAssessmentVersion = v1.0.0
activeScoringKeyVersion = v1.0.0
activeNormVersion = v1.0.0
```

---

# 47. No hacer

No:

```text
usar la norma antigua como oficial
hardcodear baremos
hardcodear pesos
hardcodear reactivo→escala
hardcodear competencias
usar Excel en runtime
modificar una versión publicada
recalcular resultados históricos automáticamente
exponer scoring al frontend
inventar nuevas reglas
```

---

# 48. Fuente definitiva de runtime

Después de publicar v1, el sistema debe poder funcionar sin Excel.

El runtime debe depender únicamente de:

```text
MySQL
+
AssessmentVersion
+
ScoringKeyVersion
+
NormVersion
```

El Excel queda como documento fuente y evidencia histórica.

---

# 49. Tarea inmediata para Codex

1. Inspeccionar el proyecto existente.
2. Inspeccionar `/CREVANTIA_DPO_CODEX_BUNDLE`.
3. Importar y revisar el Excel actualizado.
4. Incorporar la confirmación final de que `reactivo → escala` no cambia.
5. Comparar la configuración existente con la nueva.
6. Crear las migraciones necesarias.
7. Actualizar el seed oficial.
8. Precargar las 17 preguntas de control.
9. Precargar las 168 preguntas pareadas.
10. Precargar los 336 reactivos.
11. Precargar las 25 preguntas Likert.
12. Precargar el scoring oficial.
13. Precargar las 48 escalas.
14. Precargar competencias y métodos A/B/C.
15. Precargar la norma oficial nueva.
16. Precargar la norma Likert.
17. Implementar/ajustar el motor.
18. Ejecutar validadores.
19. Ejecutar tests.
20. Ejecutar golden tests.
21. Ejecutar E2E.
22. Corregir diferencias.
23. Publicar Assessment v1.
24. Publicar Scoring v1.
25. Publicar Norm v1.
26. Marcar esas versiones como activas.
27. Generar `DPO_PRO_V1_PUBLICATION_REPORT.md`.

---

# 50. Condición final

No considerar la tarea terminada hasta que pueda demostrarse:

```text
una evaluación nueva
↓
contesta todo el cuestionario
↓
se finaliza
↓
se puntúan reactivos
↓
se calculan 48 escalas
↓
se calculan competencias
↓
se aplican normas
↓
se obtienen deciles
↓
se calculan resultados DECILE_MEAN
↓
se calculan 5 dimensiones Likert
↓
se guardan resultados inmutables
↓
se puede auditar qué versión produjo cada resultado
```

Al finalizar reportar claramente:

- qué se modificó;
- qué migraciones se crearon;
- qué datos se importaron;
- qué versiones quedaron publicadas;
- qué tests pasaron;
- si existe alguna diferencia respecto al Excel oficial;
- si queda algún warning no bloqueante.

La prioridad es dejar **DPO-PRO v1 oficialmente publicable, reproducible y completamente configurable desde base de datos**, con la norma oficial nueva al 100% configurada.
