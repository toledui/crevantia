# CODEX - Implementar Report Studio de 0 a 100

## Objetivo

Construye Report Studio sobre el proyecto Crevantia existente y precarga `DPO-PPF v1`
usando exclusivamente este bundle como especificación inicial.

## Lee primero

1. `README.md`
2. `docs/REPORT_STUDIO_ARCHITECTURE_MASTER.md`
3. `docs/COMPONENT_CATALOG.md`
4. `docs/DPO_PPF_PAGE_MAP.md`
5. `docs/QA_AND_VISUAL_REGRESSION.md`

## Seeds

Importar:

- `seed/report-theme-crevantia-v1.json`
- `seed/report-classifications-v1.json`
- `seed/report-component-catalog-v1.json`
- `seed/report-presets-v1.json`
- `seed/report-bindings-v1.json`
- `seed/report-template-dpo-ppf-v1.json`

## Implementación

### Backend
Crear/adaptar:
- ReportTemplate
- ReportTemplateVersion
- ReportTheme
- ReportAsset
- ReportClassificationSet
- GeneratedReport

Persistir layout JSON estructurado y versionado.

### Frontend
Construir:
- top toolbar;
- component library;
- A4/Letter page canvas;
- page thumbnails;
- properties inspector;
- binding picker;
- rich text;
- drag/drop;
- zoom;
- preview;
- publish flow.

### Renderer
Un único renderer React para:
- editor preview;
- full preview;
- PDF.

PDF:
- Playwright/Chromium;
- print backgrounds;
- CSS page size;
- SVG charts;
- no raster screenshots para gráficas.

## Componentes obligatorios
Implementar todos los tipos de `seed/report-component-catalog-v1.json`.

## Primera plantilla
`seed/report-template-dpo-ppf-v1.json` ya contiene las 63 páginas del documento fuente.

Cada página tiene:
- sección;
- modo FLOW o ABSOLUTE;
- archivo de copy;
- bloques especiales cuando aplica.

## Bindings

### READY
Usarlos directamente.

### CONFIGURABLE_NEEDS_FINAL_MAPPING_REVIEW
NO inventar fuente matemática.
La UI debe permitir seleccionar el binding desde ResultRun.
La plantilla puede publicarse cuando el administrador termine esos mappings.

Esto afecta principalmente:
- 8 factores de abundancia;
- 5 potenciales psicofinancieros;
- parte de precursores de Ingreso;
- precursores de Inversión.

El editor debe resolver estos puntos sin cambio de código.

## Layout
La referencia fuente es Letter 612×792 pt.
No la conviertas automáticamente a A4 durante la reproducción de la primera plantilla.
Report Studio sí debe soportar A4 para nuevas plantillas.

## QA
Comparar visualmente contra:
- `reference/key-pages/*.png`
- PDF de referencia.

Generar screenshots/PDF de:
- portada;
- p10;
- p16;
- p24;
- p27;
- p31;
- p33;
- p57;
- p58.

No se requiere pixel-perfect, pero debe conservar:
- jerarquía;
- posición relativa;
- densidad;
- estilo editorial;
- tablas/gráficas equivalentes;
- legibilidad de impresión.

## Publicación
No publicar automáticamente DPO-PPF v1 mientras existan bindings con estado
`CONFIGURABLE_NEEDS_FINAL_MAPPING_REVIEW`.

Sí dejar:
- editor terminado;
- plantilla precargada;
- preview operativo;
- campos pendientes resaltados en el inspector.

## Entregable
Genera `REPORT_STUDIO_IMPLEMENTATION_REPORT.md` con:
- modelos;
- migraciones;
- endpoints;
- componentes;
- seeds;
- visual regression;
- bindings pendientes;
- estado de publicación.
