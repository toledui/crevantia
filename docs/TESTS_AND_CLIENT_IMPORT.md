# Pruebas, versiones e importación del cliente

## Archivos analizados

- `DPO_PRO 5.0 - Google Forms.pdf`: 12 campos de control, 96 pares positivos y 72 pares negativos.
- `_DPO Express V 6.0 Mac 24 (Ejemplo).xlsm`: 336 afirmaciones con escala, polaridad y puntuación por afirmación.
- `Estructura de la prueba y cálculo de resultados.pdf`: define 168 pares, 48 escalas, alrededor de 33 competencias y conversión a deciles.
- `Gestión de recursos - Google Forms.pdf`: contiene 25 preguntas Likert.
- `Reporte PPF (Ejemplo, todavía se va a modificar).pdf`: referencia para una fase posterior de reportes.

## Discrepancia pendiente

El documento de estructura declara 31 preguntas Likert, pero el formulario recibido contiene 25. La versión importada conserva una advertencia explícita y queda en borrador. Faltan seis reactivos por confirmar con el cliente.

## Flujo administrativo

1. Crear una prueba o seleccionar una existente.
2. Crear una versión en borrador, vacía o clonada.
3. Importar el libro XLSM/XLSX autorizado.
4. Revisar secciones, cantidades y advertencias.
5. Publicar cuando el contenido haya sido validado.

Las versiones publicadas son inmutables. Para modificar contenido se crea una versión nueva; al publicar, la versión publicada anterior se archiva.

## Importador DPO

El importador requiere las hojas `BaseResultados` y `Puntuación`. Valida:

- 336 afirmaciones.
- 192 afirmaciones positivas, agrupadas en 96 pares.
- 144 afirmaciones negativas, agrupadas en 72 pares.
- Correspondencia de cada afirmación con escala, polaridad y puntuación.

La importación no ejecuta el motor psicométrico ni publica la versión. Las reglas de escalas, competencias, normas y deciles se implementarán después de validar los insumos con el cliente.
