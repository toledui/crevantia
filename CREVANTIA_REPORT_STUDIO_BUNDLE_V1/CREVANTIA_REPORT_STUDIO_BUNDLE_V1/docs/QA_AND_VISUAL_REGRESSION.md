# QA y regresión visual

## Fuentes
- PDF objetivo: `reference/source/Reporte PPF (Ejemplo, todavía se va a modificar)(1).pdf`
- Reporte técnico actual: `reference/source/Reporte_DPO-PRO_Luis_Antonio_Toledo_Mendez.pdf`

## Páginas visuales prioritarias
1, 10, 16, 24, 27, 31, 33, 57, 58, 59, 63.

## Pruebas
- template schema válido;
- 63 páginas precargadas;
- no bindings rotos READY;
- preview con Sample Data;
- preview con ResultRun real;
- render PDF;
- enlaces;
- header/footer;
- page breaks;
- TOC;
- SVG nítidos;
- ninguna gráfica rasterizada;
- ninguna página desbordada;
- ninguna variable sin resolver en versión publicable.

## Regresión
Generar PNG de las páginas prioritarias y comparar visualmente con `reference/key-pages`.

## Binding gate
Los bindings configurables pendientes son warning durante edición y ERROR al publicar.
