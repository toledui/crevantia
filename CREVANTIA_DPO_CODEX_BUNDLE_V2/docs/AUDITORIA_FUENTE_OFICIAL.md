# Auditoría de la fuente oficial

## Resultado

**PASS para publicación técnica de los datos activos.**

## Reactivos

Se compararon los 336 reactivos del Excel actualizado contra la clave reconstruida previamente.

Resultado:

- texto: 336/336 coinciden;
- polaridad: 336/336 coinciden;
- peso: 336/336 coinciden;
- mapeo reactivo → escala: conservado de la clave validada y confirmado por el cliente como sin cambios.

## Norma pareada

La nueva norma se identifica en el libro como:

`NORMA 480 - ELECCIÓN PAREADA`

Se extrajeron:

- 48 targets de escala activos;
- 33 targets de competencia activos.

Todos los targets activos tienen:

- deciles 1 a 10;
- thresholds numéricos;
- límites estrictamente ascendentes.

## Norma Likert

La nueva norma se identifica como:

`NORMA 80 - LIKERT`

Se extrajeron 6 targets:

- Ingreso
- Gasto
- Ahorro
- Deuda
- Inversión
- Total

Todos tienen deciles 1 a 10 y límites válidos.

## Tablas presentes en el Excel que NO deben publicarse como targets activos

### Situación Financiera

Está presente como tabla normativa adicional, pero sus thresholds son idénticos a Salud Financiera y la matriz oficial indica que los nombres pueden cambiar en una sección del reporte sin cálculo diferente.

Se conserva como evidencia de origen, no como target activo duplicado.

### Búsqueda de Significado Psicoproductivo

La tabla fuente todavía contiene un valor final que no es el decil 10. Además no aparece dentro de la sección oficial `COMPETENCIA NORMADA`.

Se preserva en `sourceTablesNotActive` y **no se publica como target activo**.

### Cuadrantes

Misma situación: tabla fuente con secuencia final inválida y fuera de la matriz oficial de competencias normadas.

No se publica como target activo.

### ESTILO

Las diez tablas normativas históricas de estilo se preservan para auditoría, pero la nueva matriz indica aliases directos desde competencias.

No deben convertirse automáticamente en targets activos de v1 salvo que el proyecto ya tenga una necesidad explícita y validada para ellas.

## Fuente

Excel SHA-256:

`c27903456bfc8732b87d0fdef1703dd5d3df186717bc1d3358c3568da2c67052`
