# Modelo de cálculo oficial DPO-PRO v1.0.0

## 1. Pares

El participante responde 168 pares:

- 96 pares positivos.
- 72 pares negativos.

Se almacena `selectedMoreReactiveCode`. El otro reactivo queda implícitamente como `LESS`.

## 2. Puntuación de reactivos

Cada reactivo tiene una regla versionada:

- `scoreIfMore`
- `scoreIfLess`
- `scaleCode`

Regla oficial actual:

- positivo: MORE = peso, LESS = 0;
- negativo: MORE = 0, LESS = peso.

El motor debe usar los campos de configuración, no una condición hardcodeada.

## 3. Escalas

Cada escala suma las contribuciones de sus 7 reactivos.

La configuración oficial contiene 48 escalas y cada una conserva:

- 4 reactivos positivos;
- 3 reactivos negativos.

`rawScaleScore = SUM(appliedScore)`.

## 4. Resultados normalizados

El cliente confirmó tres métodos:

### A. DIRECT_SCALE_NORM

`rawScaleScore -> tabla normativa de la escala -> decil`

### B. RAW_MEAN_THEN_NORM

`promedio de puntajes brutos de 2+ escalas -> norma de competencia -> decil`

La matriz oficial contiene 33 competencias de este tipo.

### C. DECILE_MEAN

`promedio de 2+ resultados ya convertidos a decil -> resultado final`

No se vuelve a aplicar norma.

La matriz oficial contiene 21 métricas derivadas de este tipo.

## 5. Norma

El lookup es por límite inferior:

`decil = último threshold cuyo lowerBound <= score`

No redondear antes del lookup.

Usar compatibilidad `EXCEL_BINARY64`.

## 6. Likert

25 preguntas, todas directas, peso igual.

Dimensiones:

- Ingreso
- Gasto
- Ahorro
- Deuda
- Inversión

Cada dimensión tiene exactamente 5 preguntas.

`rawDimensionScore = AVERAGE(5 respuestas)`

Luego:

`rawDimensionScore -> norma Likert correspondiente -> decil`

La fuente también contiene una norma `TOTAL`; se serializó como target normativo adicional.

## 7. Aliases de reporte

La matriz oficial indica que ciertos nombres cambian solo para presentación.

Ejemplos:

- Salud Financiera -> Cuadrante financiero
- Satisfacción -> Cuadrante de satisfacción

Los 10 estilos/perfiles también se modelan como aliases directos a competencias ya calculadas.

No recalcular ni aplicar una norma nueva por cambiar el nombre.
