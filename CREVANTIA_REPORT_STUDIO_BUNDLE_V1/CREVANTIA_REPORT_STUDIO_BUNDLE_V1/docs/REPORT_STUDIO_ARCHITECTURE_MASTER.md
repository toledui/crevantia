# CREVANTIA — REPORT STUDIO
## Prompt maestro para Codex: editor profesional de plantillas PDF

Actúa como **arquitecto de software senior, diseñador UX/UI de herramientas creativas y desarrollador full-stack especializado en editores visuales, generación de PDF y sistemas de reporting versionados**.

El proyecto Crevantia ya existe y funciona. La evaluación DPO-PRO v1, scoring, norma, ResultRun y resultados ya están implementados.

Tu tarea ahora es construir **Report Studio**, un editor profesional dentro del panel administrativo de Crevantia para diseñar, versionar, previsualizar y publicar plantillas de reportes PDF dinámicos.

NO debes rehacer el proyecto ni la evaluación.

---

# 1. OBJETIVO DEL REPORT STUDIO

Necesitamos pasar de un reporte técnico generado automáticamente a un sistema editorial profesional en el que un administrador pueda construir reportes como el documento de referencia del cliente.

El sistema debe permitir:

- diseñar páginas A4;
- agregar bloques de texto;
- agregar títulos y subtítulos;
- insertar imágenes y logos;
- insertar gráficas dinámicas;
- insertar tablas dinámicas;
- vincular bloques a resultados del `ResultRun`;
- configurar estilos;
- mover y reordenar bloques;
- insertar saltos de página;
- clonar plantillas;
- versionar plantillas;
- generar vista previa;
- generar PDF final;
- publicar una versión inmutable;
- usar diferentes plantillas sobre el mismo ResultRun.

La evaluación NO se recalcula para cambiar de plantilla.

Arquitectura conceptual:

```text
ResultRun
   │
   ├── ReportTemplateVersion A → PDF PPF
   ├── ReportTemplateVersion B → PDF Ejecutivo
   └── ReportTemplateVersion C → PDF Marca Blanca
```

---

# 2. DOCUMENTOS DE REFERENCIA

Usa como referencia visual y funcional los PDFs que se encuentran en el proyecto o workspace:

```text
Reporte_DPO-PRO_Luis_Antonio_Toledo_Mendez.pdf
Reporte PPF (Ejemplo, todavía se va a modificar)(1).pdf
```

El segundo PDF es la referencia principal de diseño editorial.

No copies logos o marcas antiguas de manera hardcodeada.

Logo, nombre comercial, colores y datos generales deben venir de Settings o del Theme de la plantilla.

---

# 3. PRINCIPIO FUNDAMENTAL

Report Studio debe ser:

```text
DATA DRIVEN
+
COMPONENT BASED
+
VERSIONED
+
A4 FIRST
```

No guardar un HTML gigante como única plantilla.

No permitir JavaScript libre en plantillas.

No utilizar `eval()`.

No permitir que una plantilla ejecute código arbitrario.

---

# 4. ARQUITECTURA GENERAL

Frontend:

```text
Next.js
TypeScript
React
CSS / componentes propios del proyecto
```

Backend:

```text
NestJS
Prisma
MySQL
```

Renderer PDF recomendado:

```text
React/HTML renderer
↓
Chromium
↓
Playwright
↓
PDF
```

Las gráficas deben renderizarse como:

```text
SVG
```

y no como screenshots rasterizados.

---

# 5. NUEVOS MODELOS

Adaptar al schema actual, pero conceptualmente crear:

```text
ReportTemplate
ReportTemplateVersion
ReportPage
ReportBlock
ReportTheme
ReportAsset
ReportClassificationSet
GeneratedReport
```

## ReportTemplate

Representa una familia:

```text
DPO-PPF
DPO-EJECUTIVO
CORPORATIVO
WHITE-LABEL
```

Campos sugeridos:

```text
id
code
name
description
status
createdAt
updatedAt
```

---

# 6. ReportTemplateVersion

Campos:

```text
id
reportTemplateId
version
status

themeId
layoutJson

createdById
reviewedById
approvedById
publishedById

createdAt
updatedAt
publishedAt

configurationHash
```

Estados:

```text
DRAFT
IN_REVIEW
APPROVED
PUBLISHED
ARCHIVED
```

Una versión `PUBLISHED` es inmutable.

---

# 7. ReportPage

Puede ser entidad o parte de `layoutJson`.

Concepto:

```text
id
templateVersionId
order
pageType
background
headerEnabled
footerEnabled
```

Tipos:

```text
COVER
CONTENT
SECTION
SUMMARY
BACK_COVER
```

---

# 8. ReportBlock

Cada bloque debe tener:

```text
id
pageId
type
order
layout
style
binding
content
settings
```

Ejemplo conceptual:

```json
{
  "type": "RADAR_CHART",
  "layout": {
    "x": 120,
    "y": 180,
    "width": 480,
    "height": 300
  },
  "binding": {
    "metrics": [
      "DPO-C014",
      "DPO-C031",
      "DPO-C011"
    ]
  },
  "settings": {
    "min": 1,
    "max": 10,
    "fillOpacity": 0.25
  }
}
```

---

# 9. REPORT STUDIO — DISEÑO VISUAL

Diseñar una interfaz inspirada en herramientas creativas profesionales, pero conservando la identidad visual de Crevantia.

Paleta:

```text
Azul noche       #080B12
Índigo            #302B78
Cian              #00C2E8
Miel              #D6A94F
Marfil            #F4F2EC
Gris azulado      #9CA6B8
```

No hacer un editor genérico tipo SaaS.

Debe sentirse como una herramienta editorial de escritorio.

---

# 10. LAYOUT PRINCIPAL DEL EDITOR

Diseño desktop:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Report Studio     DPO-PPF v1 · DRAFT     Undo Redo   Preview   Guardar    │
├───────────────┬─────────────────────────────────────────────┬────────────────┤
│ COMPONENTES   │                                             │ PROPIEDADES    │
│               │               ÁREA DE TRABAJO               │                │
│ Contenido     │                                             │ Bloque         │
│ Resultados    │            ┌──────────────────┐             │ Posición       │
│ Especiales    │            │                  │             │ Tamaño         │
│               │            │      A4          │             │ Estilo         │
│               │            │                  │             │ Datos          │
│               │            │                  │             │ Condiciones    │
│               │            └──────────────────┘             │                │
├───────────────┴─────────────────────────────────────────────┴────────────────┤
│ PÁGINAS  01  02  03  04  05  +                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Dimensiones aproximadas:

```text
Left sidebar: 260px
Right inspector: 320px
Top toolbar: 64px
Bottom pages strip: 90px
Canvas background: #E8EBEF
Page: white A4
```

---

# 11. CANVAS A4

El centro debe mostrar una página real:

```text
210mm × 297mm
```

Escalado visualmente.

Debe soportar:

```text
Zoom 50%
Zoom 75%
Zoom 100%
Fit Page
Fit Width
```

Mostrar:

- márgenes;
- guías;
- bleed opcional;
- cuadrícula opcional;
- snapping.

No usar un canvas gráfico opaco si complica el renderer.

El modelo debe poder representarse con DOM/React y luego reutilizarse para preview/PDF.

---

# 12. NAVEGADOR DE PÁGINAS

En la parte inferior:

```text
[01] [02] [03] [04] [05] [+]
```

Cada thumbnail debe:

- mostrar mini preview;
- poder reordenarse;
- duplicarse;
- eliminarse;
- ocultarse condicionalmente.

Acciones:

```text
Duplicate page
Move before
Move after
Delete
Set as section opener
```

---

# 13. PANEL IZQUIERDO — BIBLIOTECA DE BLOQUES

Categorías:

## Contenido

```text
Heading
Subheading
Rich Text
Text
Image
Logo
Divider
Spacer
Callout
Page Break
```

## Datos del evaluado

```text
Full Name
Assessment Name
Assessment Date
User Metadata
Report Date
```

## Resultados

```text
Single Metric
Radar Chart
Multi Radar Chart
Decile Scale Table
Quadrant Chart
Potential / Ability Matrix
Summary Matrix
Results Table
```

## Layout

```text
2 Columns
3 Columns
Stack
Grid
Section Container
```

## Especiales

```text
Cover
Table of Contents
Header
Footer
Page Number
Legal Notice
CTA Block
```

---

# 14. INSPECTOR DERECHO

Cuando se selecciona un bloque debe mostrar tabs:

```text
CONTENT
DATA
STYLE
LAYOUT
VISIBILITY
```

---

# 15. TAB CONTENT

Para texto:

```text
Text
Rich text editor
Bold
Italic
Underline
Lists
Alignment
Links
Variables
```

Usar TipTap o equivalente.

No permitir HTML arbitrario inseguro.

---

# 16. TAB DATA

Debe existir un selector visual de datos:

```text
RESULT DATA

Scales
├── DPO-S001 Adaptación
├── DPO-S002 Mente Abierta
└── ...

Composites
├── DPO-C001 Proactividad
├── DPO-C014 Visión estratégica
└── ...

Derived Metrics
├── DPO-DM-001 ...
└── ...

Likert
├── Ingreso
├── Gasto
├── Ahorro
├── Deuda
└── Inversión

Aliases
├── Cuadrante financiero
├── Cuadrante satisfacción
├── Adaptable
└── ...
```

El usuario no necesita conocer IDs.

Mostrar nombre legible y código pequeño debajo.

---

# 17. VARIABLES DINÁMICAS

Permitir variables seguras:

```text
{{person.fullName}}
{{person.firstName}}
{{assessment.name}}
{{assessment.completedAt}}

{{scale.DPO-S001.decile}}
{{scale.DPO-S001.rawScore}}

{{composite.DPO-C014.decile}}
{{composite.DPO-C014.rawScore}}

{{likert.INGRESO.decile}}
{{likert.INGRESO.rawScore}}

{{report.generatedAt}}
```

Implementar un resolver tipado.

No usar eval.

---

# 18. VISIBILIDAD CONDICIONAL

Implementar constructor visual:

```text
Mostrar si:
[Composite] [Visión estratégica] [Decile] [>=] [8]
```

Guardar como AST seguro:

```json
{
  "field": "composite.DPO-C014.decile",
  "operator": ">=",
  "value": 8
}
```

Operadores:

```text
=
!=
>
>=
<
<=
IN
NOT_IN
```

---

# 19. THEMES

Crear `ReportTheme`.

Debe configurar:

```text
logo
secondaryLogo
primaryColor
secondaryColor
accentColor
textColor
mutedColor
pageBackground
headingFontFamily
bodyFontFamily
baseFontSize
header
footer
```

Los Settings globales pueden alimentar valores por defecto.

La plantilla puede sobreescribirlos.

---

# 20. PORTADA

Crear `CoverBlock`.

Debe poder incluir:

```text
Logo
Report Title
Report Subtitle
Person Name
Month / Year
Legal Notice
Background image or solid color
```

Todo configurable.

---

# 21. COMPONENTE: RADAR_CHART

Debe soportar:

```text
3 axes
4 axes
5 axes
6+ axes
```

Configuración:

```text
metrics
labels
min = 1
max = 10
showGrid
showLabels
showValues
fill
stroke
```

Render SVG.

El mismo componente debe servir para:

```text
3 capacidades
5 habilidades
5 potenciales
```

---

# 22. RADAR DE 3 CAPACIDADES

Preset oficial:

```text
Visión estratégica      DPO-C014
Competencia financiera  DPO-C031
Autodominio              DPO-C011
```

Debe tener preset:

```text
PRESET_3_CAPACIDADES
```

Incluye:

```text
Section heading
Radar
Decile table
Optional explanatory text
```

---

# 23. COMPONENTE: DECILE_SCALE_TABLE

Este es uno de los componentes principales.

Debe mostrar:

```text
              POR DESARROLLAR | MEDIO | ALTO | GRAN POTENCIAL
Métrica 1     □ □ □ □ □ □ ● □ □ □
Métrica 2     □ □ □ ● □ □ □ □ □ □
Métrica 3     □ □ □ □ □ □ □ □ ● □
```

Configurable:

```text
metrics
classificationSetId
showDot
showValue
showHeader
compact
rowHeight
```

---

# 24. ReportClassificationSet

Separar del baremo psicométrico.

Norma:

```text
raw score → decile
```

Clasificación:

```text
decile → label
```

Crear:

```text
ReportClassificationSet
ReportClassificationRange
```

Ejemplo:

```text
POTENTIAL_V1

1-3  Potencial por desarrollar
4-5  Potencial medio
6-8  Alto potencial
9-10 Gran potencial
```

Otro:

```text
ABILITY_V1

1-3  Habilidad por desarrollar
4-5  Habilidad media
6-8  Habilidad alta
9-10 Gran habilidad
```

No hardcodear estos rangos dentro del componente.

---

# 25. COMPONENTE: QUADRANT_CHART

Debe replicar la gráfica del reporte.

Ejes:

```text
X = Situación financiera
Y = Satisfacción
```

Debe mostrar:

```text
top-left     Despreocupación
top-right    Realización
bottom-left  Frustración
bottom-right Mezquindad
```

Debe permitir:

```text
xMetric
yMetric
splitX
splitY
labels
dot
```

Render SVG.

---

# 26. PRESET CUADRANTES

Crear:

```text
PRESET_CUADRANTES_REALIZACION
```

Incluye:

```text
2-row Decile Scale Table
Quadrant Chart
Quadrant Result Table
Rich text
```

---

# 27. COMPONENTE: MULTI_RADAR_CHART

Debe soportar múltiples series.

Uso principal:

```text
Habilidad
vs
Potencial
```

Configuración:

```text
axes
series[]
legend
fillOpacity
strokeWidth
```

Ejemplo:

```json
{
  "axes": ["Ingreso","Gasto","Ahorro","Deuda","Inversión"],
  "series": [
    {
      "name": "Habilidad",
      "binding": "likert"
    },
    {
      "name": "Potencial",
      "binding": "derived"
    }
  ]
}
```

Render SVG.

---

# 28. COMPONENTE: POTENTIAL_ABILITY_MATRIX

Tabla 2×2:

```text
                       HABILIDAD
                LOW                  HIGH

POTENCIAL HIGH  Potencial             Fortaleza
                no explotado          manifiesta

          LOW   Capacidad             Habilidad
                por desarrollar       aprendida
```

Debe poder clasificar automáticamente cada dimensión.

No hardcodear texto en renderer.

Configurable en plantilla.

---

# 29. COMPONENTE: SUMMARY_MATRIX

Debe soportar muchas filas.

Uso para:

```text
3 capacidades
2 cuadrantes
8 factores
5 habilidades
5 potenciales
20 precursores
```

Debe poder agrupar:

```text
group title
rows
classification colors
dot
```

Debe manejar división automática entre páginas.

---

# 30. OCHO FACTORES DE ABUNDANCIA

Crear preset:

```text
PRESET_8_FACTORES
```

El reporte usa:

```text
Merecimiento y autoconfianza
Proyectar el futuro
Control de las finanzas
Administración congruente
Tolerar las tensiones
Confiabilidad y Rectitud
Tenacidad
Aprovechamiento de talentos
```

Los bindings deben seleccionarse desde configuración, no hardcodearse en el renderer.

---

# 31. HABILIDAD FINANCIERA

Preset:

```text
PRESET_HABILIDAD_FINANCIERA
```

Incluye:

```text
Radar 5 ejes
Decile scale table
Rich text
```

Bindings:

```text
LIKERT-INGRESO
LIKERT-GASTO
LIKERT-AHORRO
LIKERT-DEUDA
LIKERT-INVERSION
```

---

# 32. POTENCIAL PSICOFINANCIERO

Preset:

```text
PRESET_POTENCIAL_PSICOFINANCIERO
```

Incluye:

```text
Radar 5 ejes
Decile scale table
Rich text
```

Los 5 bindings deben venir de Derived Metrics configurados.

---

# 33. BALANCE HABILIDAD / POTENCIAL

Preset:

```text
PRESET_BALANCE_HABILIDAD_POTENCIAL
```

Incluye:

```text
Multi Radar
Potential Ability Matrix
Rich text
```

---

# 34. 20 PRECURSORES

Crear preset reutilizable por grupo:

```text
PRESET_4_PRECURSORES
```

Configurable con:

```text
title
intro
4 metrics
4 names
descriptions
highText
lowText
```

Grupos:

```text
Ingresos
Gasto
Ahorro
Deuda
Inversión
```

---

# 35. TEXTOS DE ALTO / BAJO

No hardcodear en PDF renderer.

Crear:

```text
ReportInterpretation
```

Campos:

```text
code
metricCode
rangeMin
rangeMax
title
body
version
```

o permitir bloques RichText condicionales.

Ejemplo:

```text
if Visión estratégica <= 3
mostrar texto LOW
```

```text
if Visión estratégica >= 8
mostrar texto HIGH
```

---

# 36. PÁGINAS LARGAS Y FLUJO DE TEXTO

El PDF del cliente tiene mucho contenido editorial.

Debe existir un modo:

```text
FLOW_LAYOUT
```

para páginas de texto.

Los bloques de texto deben poder fluir automáticamente entre páginas.

No forzar absolutamente todo a coordenadas X/Y.

Soportar dos modos:

```text
ABSOLUTE_LAYOUT
FLOW_LAYOUT
```

Use:

- Absolute para portadas y páginas gráficas.
- Flow para contenido editorial largo.

---

# 37. TIPOGRAFÍA Y ESTILO

El reporte debe verse limpio y editorial.

Defaults sugeridos:

```text
Heading: 18-24pt
Body: 10.5-11.5pt
Line height: 1.35-1.55
Margins: 18-22mm
```

No usar tamaños web.

Trabajar pensando en impresión/PDF.

---

# 38. HEADER Y FOOTER

Configurable:

```text
Logo
Section title
Report name
Page number
Total pages
Divider
```

Variables:

```text
{{page.number}}
{{page.total}}
```

---

# 39. PAGE BREAK CONTROL

Bloques:

```text
keepTogether
breakBefore
breakAfter
avoidBreakInside
```

Crítico para:

- gráficas;
- tablas;
- títulos;
- callouts.

---

# 40. ÍNDICE

Crear:

```text
TABLE_OF_CONTENTS
```

Auto generado desde:

```text
SectionHeadingBlock
includeInToc = true
```

Debe calcular página final durante render.

Puede requerir render en dos pasadas.

---

# 41. GENERACIÓN DEL PDF

Pipeline:

```text
ResultRun
+
ReportTemplateVersion
+
Theme
+
Settings
↓
Resolve bindings
↓
Render React/HTML
↓
Render SVG charts
↓
Playwright PDF
↓
GeneratedReport
```

---

# 42. GeneratedReport

Guardar:

```text
id
resultRunId
reportTemplateVersionId
generatedById
generatedAt
status
fileUrl
sha256
pageCount
```

Nunca regenerar silenciosamente un PDF histórico.

---

# 43. PREVIEW

En editor:

```text
Preview with sample data
Preview with real ResultRun
```

Selector:

```text
Sample
Latest result
Choose result...
```

---

# 44. DATOS DEMO

Crear un `ReportPreviewDataProvider`.

Debe permitir:

```text
fake person
fake scores
fake dates
```

sin necesitar una evaluación real.

---

# 45. TOOLBAR

Topbar:

```text
Back
Template name
Version badge
Autosave indicator

Undo
Redo

Preview
Desktop/A4
Generate PDF

Save
Publish
```

---

# 46. HISTORIAL

Implementar:

```text
undo
redo
```

Frontend.

Y backend:

```text
version snapshots
```

No guardar una fila por cada tecla.

Autosave con debounce.

---

# 47. SHORTCUTS

```text
Ctrl/Cmd + Z      Undo
Ctrl/Cmd + Shift+Z Redo
Ctrl/Cmd + S      Save
Delete            Delete block
Ctrl/Cmd + D      Duplicate
Arrow keys        Nudge
Shift+Arrow       Nudge 10
```

---

# 48. DRAG & DROP

Usar una librería estable como:

```text
dnd-kit
```

para:

- mover bloques;
- reordenar páginas;
- insertar componentes.

No implementar drag/drop manual desde cero.

---

# 49. RICH TEXT

Usar:

```text
TipTap
```

o librería equivalente ya compatible con el proyecto.

Guardar JSON estructurado.

No guardar solo HTML inseguro.

---

# 50. DATA BINDING PICKER

Diseñar un modal:

```text
Seleccionar dato
────────────────────────
Buscar: [____________]

Scales
Composites
Derived metrics
Likert
Aliases
Person
Assessment
```

Cada item:

```text
Visión estratégica
DPO-C014
Composite
Current value: 6
```

---

# 51. DISEÑO DEL BLOQUE SELECCIONADO

Cuando un bloque está seleccionado:

```text
cyan outline
resize handles
block label
```

Ejemplo:

```text
┌ RADAR_CHART ────────────────┐
│                             │
│            △                │
│                             │
└─────────────────────────────┘
```

---

# 52. ESTADOS VACÍOS

Si una gráfica no tiene binding:

```text
Selecciona las métricas que alimentarán esta gráfica
[Configurar datos]
```

No romper preview.

---

# 53. VALIDACIONES DE PLANTILLA

Antes de publicar:

```text
no unresolved variables
no invalid bindings
no broken assets
no pages without valid dimensions
no blocks outside printable bounds
no unknown component types
```

Mostrar:

```text
ERROR
WARNING
INFO
```

---

# 54. DESIGN TOKENS

Crear tokens:

```text
report.font.heading
report.font.body
report.color.primary
report.color.secondary
report.color.accent
report.spacing.*
report.page.margin.*
```

El renderer no debe tener colores dispersos hardcodeados.

---

# 55. PÁGINA ADMINISTRATIVA

Rutas sugeridas:

```text
/admin/report-studio
/admin/report-studio/templates
/admin/report-studio/templates/:id
/admin/report-studio/templates/:id/versions/:versionId
```

---

# 56. LISTADO DE PLANTILLAS

Mostrar:

```text
Name
Code
Current published version
Draft
Last edited
Reports generated
Actions
```

Acciones:

```text
Open
Clone
Preview
Archive
```

---

# 57. DASHBOARD DEL REPORT STUDIO

Cards compactas:

```text
Plantillas publicadas
Borradores
PDF generados
Errores de generación
```

No sobrecargar.

---

# 58. UX DE PUBLICACIÓN

Botón `Publish`.

Modal:

```text
Publicar DPO-PPF v1.0?

Esta versión quedará inmutable.
Las evaluaciones futuras podrán usarla.
Los PDFs históricos no cambiarán.

[Cancelar] [Publicar versión]
```

---

# 59. SEGURIDAD

Permisos:

```text
report_template.read
report_template.create
report_template.edit
report_template.review
report_template.publish
report_template.archive
report.generate
```

---

# 60. NO EXPONER DATOS TÉCNICOS AL USUARIO FINAL

El PDF comercial no debe mostrar:

```text
DPO-S001
DPO-C014
DPO-DM-001
SCALE
COMPOSITE
DERIVED_METRIC
configurationHash
```

salvo que la plantilla sea específicamente técnica.

---

# 61. PRESERVAR REPORTE TÉCNICO

El reporte actual puede mantenerse como:

```text
TECHNICAL_REPORT
```

solo admin/debug.

No eliminarlo.

---

# 62. PRIMERA PLANTILLA OFICIAL

Crear una primera plantilla:

```text
DPO-PPF v1
```

tomando como referencia estructural el PDF del cliente.

Debe contener, al menos:

```text
1 Portada
2 Introducción
3 Índice
4 3 capacidades
5 Cuadrantes
6 8 factores
7 Habilidad financiera
8 Potencial psicofinanciero
9 Balance habilidad/potencial
10 20 precursores
11 Síntesis
12 Glosario
13 Nota final
```

No necesitas copiar literalmente 63 páginas manualmente si el layout fluido puede distribuir el contenido.

---

# 63. COMPONENTES QUE DEBEN QUEDAR FUNCIONANDO EN V1

```text
CoverBlock
RichTextBlock
HeadingBlock
ImageBlock
RadarChartBlock
MultiRadarChartBlock
DecileScaleTableBlock
QuadrantChartBlock
PotentialAbilityMatrixBlock
SummaryMatrixBlock
TableOfContentsBlock
PageBreakBlock
HeaderFooterBlock
```

---

# 64. CRITERIOS VISUALES

El editor debe verse como parte de Crevantia:

- sidebar azul noche/índigo;
- canvas gris neutro;
- página blanca;
- cian como selección activa;
- miel para warnings;
- tipografía limpia;
- paneles densos pero ordenados.

Evitar:

- glassmorphism;
- gradientes innecesarios;
- enormes tarjetas;
- estética genérica de SaaS.

---

# 65. RESPONSIVE

El editor completo está optimizado para desktop.

Tablet:

- permitir preview;
- propiedades en drawer.

Mobile:

- solo preview;
- no edición completa.

Mostrar aviso:

```text
Para editar plantillas, utiliza una pantalla de escritorio.
```

---

# 66. RENDERER UNIFICADO

El mismo componente React debe servir para:

```text
Editor preview
Full preview
PDF render
```

No crear tres implementaciones diferentes.

---

# 67. CHART ENGINE

Crear una librería interna:

```text
report-charts/
├── RadarChart.tsx
├── MultiRadarChart.tsx
├── QuadrantChart.tsx
├── DecileScale.tsx
├── PotentialAbilityMatrix.tsx
└── SummaryMatrix.tsx
```

SVG puro.

No depender de screenshots.

---

# 68. TESTS DE COMPONENTES

Snapshots/visual tests para:

```text
Radar 3
Radar 5
Multi Radar
Decile table
Quadrant
Summary matrix
```

Usar datos 1, 5 y 10 para probar extremos.

---

# 69. PDF VISUAL REGRESSION

Crear fixture:

```text
report-preview-fixture.json
```

Generar PDF y mantener screenshots de páginas clave.

Comparar:

```text
cover
3-capabilities
quadrants
ability
potential
balance
summary
```

---

# 70. PERFORMANCE

Una plantilla de 60+ páginas no debe bloquear el request HTTP.

Generar PDF mediante job/queue.

Estados:

```text
QUEUED
RENDERING
COMPLETED
FAILED
```

Si el proyecto no tiene queue todavía, dejar abstracción preparada.

---

# 71. ASSETS

Subida:

```text
PNG
JPG
SVG
```

Guardar metadata:

```text
width
height
mime
size
sha256
```

No permitir archivos ejecutables.

---

# 72. OUTPUT

Generar:

```text
PDF A4
printBackground: true
preferCSSPageSize: true
```

Soportar hyperlinks.

---

# 73. CONFIGURACIÓN POR PLANTILLA

Cada ReportTemplateVersion debe definir:

```text
pageSize = A4
orientation = portrait
marginTop
marginRight
marginBottom
marginLeft
```

---

# 74. FASES DE IMPLEMENTACIÓN

## Fase 1 — Datos y renderer

Crear modelos, API, JSON schema y renderer.

## Fase 2 — Componentes de reporting

Crear radar, decile table, quadrant, multi-radar, matrix.

## Fase 3 — Primera plantilla DPO-PPF

Montar el documento base.

## Fase 4 — Editor

Crear drag/drop, inspector, páginas, autosave.

## Fase 5 — Preview y PDF

Playwright + SVG.

## Fase 6 — Versionado/publicación

Clone, review, publish, archive.

## Fase 7 — QA

Visual tests + PDF regression.

---

# 75. PRIMER SPRINT

Empieza por:

1. revisar la implementación actual de reportes;
2. crear modelos Prisma;
3. crear migración;
4. crear JSON schema de layout;
5. implementar renderer genérico;
6. implementar A4 page;
7. implementar HeadingBlock;
8. implementar RichTextBlock;
9. implementar ImageBlock;
10. implementar RadarChartBlock;
11. implementar DecileScaleTableBlock;
12. implementar QuadrantChartBlock;
13. crear preview;
14. generar primer PDF con Playwright.

Detente y prueba.

Después continuar con editor visual.

---

# 76. ENTREGABLE FINAL

Generar:

```text
REPORT_STUDIO_IMPLEMENTATION_REPORT.md
```

Debe contener:

- arquitectura;
- modelos;
- endpoints;
- componentes;
- screenshots;
- tests;
- plantilla inicial;
- limitaciones;
- siguientes pasos.

---

# 77. CONDICIÓN DE TERMINADO

Report Studio v1 se considera listo cuando:

```text
Admin crea plantilla
↓
agrega páginas
↓
agrega bloques
↓
vincula métricas
↓
previsualiza con ResultRun real
↓
guarda borrador
↓
publica
↓
genera PDF
↓
el PDF usa logo/settings dinámicos
↓
las gráficas están en SVG
↓
el PDF no muestra códigos técnicos
↓
la versión publicada queda inmutable
```

Y además existe una primera plantilla `DPO-PPF v1` que reproduzca visualmente la estructura del reporte de referencia del cliente.
