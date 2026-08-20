# Report Studio - Informe de implementación

Fecha: 2026-08-20  
Plantilla inicial: `DPO-PPF 1.0.0`  
Estado: `DRAFT`

## Resultado

Se implementó Report Studio dentro del panel administrativo de Crevantia sobre la arquitectura existente Next.js + NestJS + Prisma/MySQL. La plantilla DPO-PPF conserva las 63 páginas Letter (612 x 792 pt), usa layout híbrido FLOW/ABSOLUTE y permanece sin publicar mientras existan mappings no demostrados por el material fuente.

El canvas, la vista previa de página/documento y la ruta de impresión usan el mismo renderer React. La generación final abre esa ruta con Playwright/Chromium, imprime fondos y conserva las gráficas como SVG.

## Modelos y migración

Migración aplicada: `backend/prisma/migrations/20260820220000_report_studio/migration.sql`.

- `ReportTemplate`: familia estable de plantillas.
- `ReportTemplateVersion`: snapshot JSON versionado, hash SHA-256, workflow y bloqueo de mutaciones al publicar.
- `ReportTheme`: tokens de marca, página, tipografía, headers, footers y charts.
- `ReportAsset`: binarios de tema con MIME, tamaño y SHA-256.
- `ReportClassificationSet` / `ReportClassificationRange`: clasificación editorial separada del baremo psicométrico.
- `GeneratedReport`: PDF histórico ligado opcionalmente a ResultRun, snapshot de datos, hash, bytes y páginas.

La publicación archiva la versión publicada anterior de la misma familia y vuelve inmutable la nueva versión.

## Endpoints

Todos los endpoints administrativos requieren `SUPERADMIN` o `SUPER_ADMIN`.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/admin/report-studio/templates` | Listado de familias/versiones |
| GET | `/api/v1/admin/report-studio/templates/:id` | Detalle de familia |
| GET | `/api/v1/admin/report-studio/versions/:id` | Layout, tema, bindings y datos preview |
| PATCH | `/api/v1/admin/report-studio/versions/:id` | Autosave de layout/bindings |
| PATCH | `/api/v1/admin/report-studio/versions/:id/binding` | Mapping tipado de un campo |
| POST | `/api/v1/admin/report-studio/versions/:id/clone` | Nueva versión editable |
| POST | `/api/v1/admin/report-studio/versions/:id/publish` | Publicación con guard de bindings |
| GET | `/api/v1/admin/report-studio/binding-options` | Selector legible de ResultRun |
| POST | `/api/v1/admin/report-studio/versions/:id/pdf` | Generación histórica por Chromium |
| GET | `/api/v1/admin/report-studio/generated/:id` | Descarga del PDF generado |
| GET | `/api/v1/report-studio/render-sessions/:token` | Sesión efímera y no adivinable para la ruta de impresión |

## Editor frontend

Rutas nuevas:

- `/admin/report-studio`
- `/admin/report-studio/[versionId]`
- `/report-studio/render/[token]`

Funcionalidad incluida:

- toolbar, estado de autosave, undo/redo y shortcuts;
- biblioteca arrastrable con dnd-kit;
- canvas Letter/A4 con zoom y selección;
- thumbnails reordenables y creación de páginas;
- inspector CONTENT/DATA/STYLE/LAYOUT/VISIBILITY;
- TipTap para rich text estructurado;
- selector de bindings por nombre y código;
- campos pendientes resaltados;
- preview de documento;
- generación/descarga PDF;
- publicación deshabilitada hasta resolver mappings.

## Componentes implementados

El renderer contempla los 15 tipos del catálogo:

`COVER_BLOCK`, `HEADING`, `RICH_TEXT`, `IMAGE`, `RADAR_CHART`, `MULTI_RADAR_CHART`, `DECILE_SCALE_TABLE`, `QUADRANT_CHART`, `QUADRANT_RESULT_TABLE`, `POTENTIAL_ABILITY_MATRIX`, `SUMMARY_MATRIX`, `TABLE_OF_CONTENTS`, `HEADER_FOOTER`, `PAGE_BREAK` y `STATIC_EXAMPLE_CHART`.

Radar, multi-radar y cuadrante se generan como SVG; tablas y matrices permanecen DOM/vector en el PDF.

## Seeds

Comando: `npm run seed:report-studio:v1`.

El import consume los seis seeds del bundle:

- tema Crevantia Editorial;
- clasificaciones POTENTIAL_V1 y ABILITY_V1;
- catálogo de componentes;
- presets;
- bindings;
- plantilla DPO-PPF de 63 páginas.

El seed es idempotente y recalcula `configurationHash`.

## Bindings pendientes

Quedan cuatro grupos demostrablemente incompletos:

1. ocho factores de disposición psicoemocional a la abundancia;
2. cinco potenciales psicofinancieros;
3. precursores de Generación de Ingresos;
4. precursores de Gestión de Inversiones.

No se inventó ninguna fórmula ni alias. Cada fila se puede mapear desde el inspector contra targets reales de ResultRun. Al completar todas las filas, el backend normaliza los estados compuestos y habilita publicación sin cambios de código.

## QA y regresión visual

- TypeScript frontend: aprobado.
- TypeScript backend: aprobado.
- Build de producción Next.js: aprobado.
- Build NestJS: aprobado.
- Migración MySQL: aplicada.
- Seed DPO-PPF: aplicado con 63 páginas y 4 grupos pendientes.
- Chromium: instalado y generación end-to-end aprobada.
- PDF QA: 63 páginas, Letter 612 x 792 pt, fondos impresos y 160,828 caracteres extraíbles.
- Páginas inspeccionadas: portada, 10, 16, 24, 27, 31, 33, 57 y 58.
- Correcciones después de inspección: portada anclada a hoja completa y expansión de presets compuestos en las matrices 57/58.

Archivo QA generado: `output/pdf/report-studio-dpo-ppf-preview.pdf`.

El lint global continúa fallando por deuda previa repartida en módulos de administración, comercio, Stripe y pruebas. Los archivos nuevos de Report Studio no introducen errores de compilación; el build completo sí termina correctamente.

## Estado de publicación

`DPO-PPF 1.0.0` permanece correctamente en `DRAFT`. El endpoint de publicación responde con conflicto mientras `pendingBindings > 0`; no se realizó publicación automática.
