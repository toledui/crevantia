# Crevantia — Plan técnico para implementar DPO-PRO y su motor de puntuación

## 1. Propósito de este documento

Este documento debe entregarse a Codex como especificación de implementación. Su objetivo es convertir el flujo actual basado en Google Forms, Excel y macros en un motor reproducible dentro del monorepo de Crevantia, sin codificar fórmulas psicométricas directamente en controladores ni depender del archivo Excel en producción.

El paquete contiene cuatro artefactos ejecutables por datos:

- `seed/dpo-pro.question-bank.v1.json`: contenido completo para precargar las cuatro secciones.
- `seed/dpo-pro.scoring-key.v6.json`: polaridad, peso fijo, escala y composiciones.
- `seed/dpo-pro.norm.global-412.v1.json`: corte de puntuaciones a deciles, versionado y observaciones de calidad.
- `tests/dpo-pro.golden-case.excel-example.json`: caso dorado anonimizado para pruebas de regresión.

## 2. Conclusión del análisis

### 2.1 Parte pareada: sí puede implementarse

La lógica de los 168 pares quedó reconstruida con suficiente precisión para comenzar. El libro contiene 336 afirmaciones puntuables distribuidas en 168 pares: 96 pares positivos y 72 negativos. Cada afirmación tiene:

- polaridad positiva o negativa;
- peso fijo entre 1 y 5;
- una de 48 escalas;
- identificadores de origen;
- contribución diferente según resulte elegida como “Más” o como “Menos”.

Las 48 escalas contienen exactamente siete afirmaciones cada una: cuatro positivas y tres negativas.

El motor reconstruido se comparó con el ejemplo incluido en el libro:

- 336 contribuciones de reactivos comparadas;
- 48 sumas de escalas comparadas;
- 33 resultados compuestos actualmente calculados por el libro comparados;
- todas las diferencias numéricas quedaron explicadas: dos límites requieren compatibilidad IEEE-754 y una celda del Excel usa la norma equivocada para `Apego a normas`. El motor propuesto corrige esa referencia y registra la diferencia como defecto conocido de la fuente.

El reporte automatizado se encuentra en `tests/validation-report.json`.

### 2.2 Gestión de recursos: solo puede precargarse, no calificarse todavía

El formulario suministrado contiene 25 afirmaciones Likert con respuestas de 1 a 5. El documento de estructura menciona 31. En los archivos inspeccionados no aparece una matriz completa que indique:

- a qué dimensión pertenece cada afirmación;
- si alguna se invierte;
- qué peso tiene;
- cómo se forman las cinco habilidades financieras;
- qué norma convierte cada resultado a decil.

Codex debe precargar y reproducir esta sección, pero debe impedir que se presente como “calificada” hasta que se incorpore una clave aprobada.

### 2.3 Reportes nuevos: hay correspondencias parciales, no una matriz completa

El reporte PPF utiliza nombres nuevos para ocho factores, cinco habilidades, cinco potenciales y veinte precursores. Algunos resultados tienen correspondencia directa con el libro —por ejemplo, Visión estratégica, Competencia financiera, Autodominio, Satisfacción y el eje de situación financiera—, pero no se entregó una tabla formal que relacione todos los nombres nuevos con las 48 escalas y 35 composiciones del Excel.

No inferir esas relaciones por similitud semántica. Crear los espacios de configuración y dejar las asociaciones en estado `PENDING_CLIENT_CONFIRMATION`.

## 3. Regla exacta de puntuación

### 3.1 Respuesta pareada

Cada pregunta tiene dos afirmaciones `A` y `B`. El participante debe marcar una como `MORE` y la otra como `LESS`.

Persistencia recomendada:

```ts
interface ForcedChoiceAnswer {
  attemptId: string;
  pairQuestionId: string;
  selectedMoreReactiveId: string;
}
```

No es necesario almacenar dos radios redundantes. El reactivo no seleccionado como `MORE` queda automáticamente seleccionado como `LESS`.

### 3.2 Contribución por reactivo

```ts
function scoreReactive(
  polarity: 'POSITIVE' | 'NEGATIVE',
  fixedWeight: Decimal,
  selectedAs: 'MORE' | 'LESS',
): Decimal {
  if (polarity === 'POSITIVE') {
    return selectedAs === 'MORE' ? fixedWeight : new Decimal(0);
  }

  return selectedAs === 'MORE' ? new Decimal(0) : fixedWeight;
}
```

La misma regla puede ser totalmente dirigida por datos usando `scoreIfSelectedMore` y `scoreIfSelectedLess` del JSON, evitando condicionales específicos por pregunta.

### 3.3 Puntaje bruto de escala

```text
rawScaleScore = SUM(contribution of the 7 reactives assigned to the scale)
```

No normalizar, promediar ni convertir todavía.

### 3.4 Puntaje bruto compuesto

```text
rawCompositeScore = arithmetic mean(raw scores of component scales)
```

Regla crítica: **promediar puntajes brutos, no deciles**.

El compuesto `Cuadrantes` es especial y no se promedia:

- eje X: escala `Salud Financiera`, presentada como Situación financiera;
- eje Y: escala `Satisfacción`.

### 3.5 Conversión a decil

La norma está formada por diez límites inferiores. Debe reproducirse la semántica de `LOOKUP` de Excel:

```ts
function resolveDecileExcelBinary64(raw: number, thresholds: NormThreshold[]): number {
  const ordered = [...thresholds].sort((a, b) => a.ordinal - b.ordinal);
  let result: number | null = null;

  for (const threshold of ordered) {
    if (raw >= Number(threshold.minRaw)) {
      result = threshold.decil;
    } else {
      break;
    }
  }

  if (result === null) throw new Error('RAW_BELOW_FIRST_THRESHOLD');
  return result;
}
```

Para la clave heredada `DPO_EXPRESS_V6_PAIR_KEY`, usar un adaptador explícito `EXCEL_BINARY64`: calcular promedios y comparar cortes con `JavaScript Number`, porque Excel usa IEEE-754 y hay límites que cambian de decil en valores como 37/3. Persistir el resultado como `Prisma.Decimal` usando `rawNumber.toString()`. No agregar redondeo manual. Una clave futura puede declarar otro modo numérico, pero debe pasar sus propios casos dorados.

## 4. Arquitectura del monorepo

```text
crevantia/
├── package.json
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .env.example
├── docs/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── assessment-player/
│   │   ├── admin-norms/
│   │   ├── admin-assessments/
│   │   └── reports/
│   └── lib/
└── backend/
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seeds/
    │       └── data/
    └── src/
        ├── modules/
        │   ├── assessments/
        │   ├── attempts/
        │   ├── scoring/
        │   ├── norms/
        │   ├── reports/
        │   ├── users/
        │   └── audit/
        └── common/
```

Copiar los JSON de este paquete a `backend/prisma/seeds/data/`.

## 5. Modelo de datos mínimo

### 5.1 Contenido versionado

- `Assessment`
- `AssessmentVersion`
- `AssessmentSection`
- `DemographicField`
- `PairQuestion`
- `Reactive`
- `LikertQuestion`
- `OptionSet`
- `Option`

Una `AssessmentVersion` publicada es inmutable. Aunque el cliente indique que las preguntas no cambiarán, esto protege resultados históricos y permite corregir una versión futura sin alterar intentos ya concluidos.

### 5.2 Clave de puntuación

- `ScoringKeyVersion`
- `ReactiveScoringRule`
- `Scale`
- `ScaleReactive`
- `Composite`
- `CompositeComponent`

`ReactiveScoringRule` debe guardar explícitamente:

- polaridad;
- peso fijo;
- score al elegirse como `MORE`;
- score al quedar como `LESS`;
- escala asignada.

No guardar estos datos únicamente en código TypeScript.

### 5.3 Normas reemplazables

- `NormSet`
- `NormSetVersion`
- `NormTarget`
- `NormThreshold`

Campos recomendados para `NormSetVersion`:

```text
id
normSetId
version
status: DRAFT | IN_REVIEW | PUBLISHED | ARCHIVED
populationCode
populationLabel
sampleSize
sourceDocument
validFrom
validTo
createdById
reviewedById
publishedById
createdAt
publishedAt
rowVersion
```

Campos para `NormTarget`:

```text
id
normSetVersionId
targetType: SCALE | COMPOSITE | STYLE_PROFILE
targetCode
status
```

Campos para `NormThreshold`:

```text
id
normTargetId
ordinal 1..10
minRaw Decimal
decile Int
```

Restricciones:

- `UNIQUE(normTargetId, ordinal)`;
- `UNIQUE(normTargetId, decile)` para una versión aprobada;
- diez cortes por objetivo;
- límites no decrecientes;
- deciles exactamente 1..10;
- primer límite normalmente 0, pero configurable;
- publicación bloqueada si falla validación estructural.

### 5.4 Intentos y resultados reproducibles

- `AssessmentAssignment`
- `AssessmentAttempt`
- `PairAnswer`
- `LikertAnswer`
- `ResultRun`
- `ReactiveResult`
- `ScaleResult`
- `CompositeResult`
- `ReportArtifact`

Al finalizar, `AssessmentAttempt` debe fijar:

- `assessmentVersionId`;
- `scoringKeyVersionId`;
- `normSetVersionId`;
- hash de respuestas;
- fecha de cierre.

`ResultRun` debe guardar:

- versión del motor;
- hash de entrada;
- fecha;
- estado;
- JSON de diagnóstico;
- si es el resultado oficial o una recalificación comparativa.

Nunca sobrescribir un resultado histórico cuando cambie una norma. Crear otro `ResultRun`.

## 6. Flujo administrativo para editar o reemplazar la norma

### 6.1 No editar una norma publicada en sitio

Flujo:

1. El superadministrador abre una norma publicada.
2. Elige **Crear nueva versión**.
3. El sistema clona objetivos y cortes a un borrador.
4. Se editan valores manualmente o se importa CSV/JSON.
5. Se ejecutan validaciones.
6. Se compara el impacto contra casos dorados y, opcionalmente, intentos anonimizados.
7. Un usuario autorizado revisa y publica.
8. La nueva versión se vuelve seleccionable para evaluaciones futuras.
9. La versión anterior permanece disponible para reproducir reportes históricos.

### 6.2 Pantallas del administrador

- listado de normas y versiones;
- detalle con población, muestra, vigencia y estado;
- editor tabular de diez cortes por escala/competencia;
- importación y exportación JSON/CSV;
- comparación entre dos versiones;
- vista de advertencias por cortes duplicados;
- prueba de un puntaje bruto y decil resultante;
- impacto del cambio sobre casos dorados;
- historial y auditoría.

### 6.3 Selección de norma

Preparar la arquitectura para elegir norma según reglas futuras:

- producto/prueba;
- versión de la prueba;
- población;
- país;
- edad;
- rol o nivel laboral;
- fecha de aplicación.

En la primera versión solo activar `GLOBAL_412` después de aprobación.

## 7. Servicios del backend

### 7.1 `AssessmentSeedService`

- lee `dpo-pro.question-bank.v1.json`;
- valida códigos únicos y conteos;
- crea una versión borrador;
- precarga secciones, campos, pares y Likert;
- vuelve a ejecutarse de forma idempotente.

### 7.2 `ScoringKeySeedService`

- lee `dpo-pro.scoring-key.v6.json`;
- enlaza reactivos por código estable;
- valida 168 pares, 336 reactivos y 48 escalas;
- valida siete reactivos por escala, cuatro positivos y tres negativos;
- crea las 35 composiciones;
- publica solo tras ejecutar el caso dorado.

### 7.3 `NormSeedService`

- lee `dpo-pro.norm.global-412.v1.json`;
- importa una versión `DRAFT`;
- conserva advertencias;
- no publica automáticamente los objetivos bloqueados;
- exige revisión explícita.

### 7.4 `AttemptScoringService`

Responsabilidades:

1. verificar que el intento esté completo;
2. validar exactamente una selección `MORE` por par;
3. calcular 336 contribuciones;
4. sumar 48 escalas;
5. calcular composiciones;
6. resolver deciles con la versión de norma fijada;
7. guardar un `ResultRun` transaccional;
8. emitir evento `assessment.scored`;
9. encolar generación de reportes.

Debe ser una función pura en su núcleo. La capa que consulta Prisma y guarda resultados debe envolver al motor, no mezclarse con él.

## 8. API sugerida

```text
GET    /api/v1/attempts/:id/player
PUT    /api/v1/attempts/:id/demographics
PUT    /api/v1/attempts/:id/pairs/:pairCode
PUT    /api/v1/attempts/:id/likert/:questionCode
POST   /api/v1/attempts/:id/pause
POST   /api/v1/attempts/:id/finalize
GET    /api/v1/attempts/:id/results

GET    /api/v1/admin/norms
POST   /api/v1/admin/norms
POST   /api/v1/admin/norms/:id/versions/:versionId/clone
PUT    /api/v1/admin/norms/:id/versions/:versionId/targets/:targetId
POST   /api/v1/admin/norms/:id/versions/:versionId/validate
POST   /api/v1/admin/norms/:id/versions/:versionId/publish
POST   /api/v1/admin/norms/:id/versions/:versionId/impact-preview

POST   /api/v1/admin/assessments/dpo-pro/seed
POST   /api/v1/admin/scoring-keys/dpo-pro/validate-golden-case
```

## 9. Reproductor de la evaluación

Implementar cuatro etapas:

1. control estadístico;
2. pares positivos;
3. pares negativos;
4. Gestión de recursos.

Reglas UX:

- una pregunta visible a la vez;
- fondo blanco, marfil o gris claro;
- guardado automático;
- progreso por sección y general;
- bloqueo de avance si falta respuesta;
- reanudación desde la última pregunta;
- confirmación final;
- no mostrar pesos, escalas ni resultados parciales;
- no permitir modificar después del cierre;
- accesibilidad por teclado;
- en pares, impedir que ambas afirmaciones queden como `MORE` o ambas como `LESS`.

## 10. Plan de implementación para Codex

### Fase 0 — Ingesta y pruebas antes de UI

1. Crear el monorepo con `frontend` y `backend`.
2. Configurar pnpm workspaces, TypeScript estricto, ESLint y Prettier.
3. Levantar MySQL con Docker Compose.
4. Definir el esquema Prisma versionado.
5. Copiar los cuatro JSON al backend.
6. Implementar validadores Zod para cada JSON.
7. Crear los servicios de seed idempotentes.
8. Implementar el motor puro.
9. Ejecutar el caso dorado y bloquear el avance si existe cualquier diferencia.

**Criterio de salida:** `tests/validation-report.json` equivalente en PASS dentro del proyecto.

### Fase 1 — Autenticación y asignación

1. Registro y acceso.
2. Roles `SUPER_ADMIN`, `ADMIN`, `EVALUATED_USER`.
3. Asignación de una versión de prueba.
4. Creación de intento único.
5. Estado `NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `SUBMITTED`, `SCORING`, `COMPLETED`, `FAILED`.

### Fase 2 — Reproductor

1. Control estadístico.
2. Componente de par forzado.
3. Componente Likert.
4. autosave con control de concurrencia;
5. reanudación;
6. revisión y cierre.

### Fase 3 — Motor y resultados internos

1. Finalización transaccional.
2. Cálculo pareado.
3. resultados de 48 escalas;
4. resultados compuestos;
5. deciles;
6. cuadrantes;
7. auditoría completa.

La sección Likert debe guardarse, pero su resultado debe aparecer como `PENDING_SCORING_SPEC`.

### Fase 4 — Administración de normas

1. listado y versionado;
2. editor de cortes;
3. importación/exportación;
4. validaciones;
5. comparación de versiones;
6. publicación con permisos y auditoría.

### Fase 5 — Integración de reportes

1. crear un DTO neutral de resultados;
2. implementar las dos plantillas PDF;
3. enlazar únicamente resultados con mapeo confirmado;
4. dejar placeholders para ocho factores, cinco habilidades/potenciales y veinte precursores;
5. completar después de recibir la matriz oficial.

### Fase 6 — Pagos, correo y producción

1. Stripe;
2. liberación de evaluación;
3. correos;
4. cola para PDF;
5. almacenamiento seguro;
6. despliegue en VPS;
7. backups y observabilidad.

## 11. Pruebas obligatorias

### 11.1 Unitarias

- positivo seleccionado como Más;
- positivo seleccionado como Menos;
- negativo seleccionado como Más;
- negativo seleccionado como Menos;
- par inválido con dos Más;
- par inválido sin respuesta;
- suma de escala;
- promedio de tres y cuatro escalas;
- resolución de decil exacto en límite;
- resolución entre límites;
- cortes duplicados con semántica LOOKUP;
- compatibilidad `EXCEL_BINARY64` sin redondeo manual y persistencia decimal del resultado.

### 11.2 Integración

- seed idempotente;
- intento completo;
- pausa/reanudación;
- finalización bloqueada por respuesta faltante;
- resultado fija versiones;
- nueva norma no altera resultado histórico;
- recalificación crea otro `ResultRun`.

### 11.3 Regresión

Cargar `dpo-pro.golden-case.excel-example.json` y comprobar:

- 336 contribuciones;
- 48 puntajes brutos de escala;
- deciles de escala;
- puntajes y deciles compuestos;
- cuadrante;
- perfiles heredados, si se decide conservarlos.

## 12. Calidad y seguridad

- cifrar transporte con HTTPS;
- no incluir pesos ni escalas en endpoints del reproductor;
- separar contenido público de clave de puntuación;
- restringir normas y clave a superadministradores;
- auditar importaciones, cambios y publicaciones;
- evitar logs con respuestas completas o resultados personales;
- usar IDs opacos;
- firmar o hashear el paquete de respuestas final;
- política de retención y borrado;
- consentimiento y aviso de privacidad antes de iniciar;
- respaldos cifrados.

## 13. Hallazgos que Codex no debe “corregir” por cuenta propia

1. Existen cortes normativos duplicados en 14 objetivos. Con `LOOKUP`, el decil posterior gana en el mismo punto. Conservar el dato importado y mostrar advertencia hasta que el responsable psicométrico confirme el ajuste.
2. `Puntuación!K674` usa por error la norma de `Creatividad Aplicada` para calcular `Apego a normas`. La aplicación debe usar la norma propia de Apego; en el caso de ejemplo el resultado corregido es decil 9, mientras el Excel muestra 10.
3. `Puntuación!K565` apunta a un bloque duplicado de Perseverancia. No cambia el resultado porque las tablas son iguales, pero no copiar esa referencia accidental.
4. `Búsqueda de Significado Psicoproductivo` y `Cuadrantes` tienen un valor final inválido donde debería existir el decil 10. Mantenerlos bloqueados.
5. El libro contiene una norma `xxxGerencial` aparentemente idéntica a `Global`. No crearla como norma distinta sin confirmación.
6. Existe una tabla separada de `Situación Financiera`, pero las fórmulas actuales de cuadrantes usan `Salud Financiera`.
7. El “Potencia percentil” de los perfiles heredados está roto en el ejemplo.
8. No inventar seis preguntas Likert ni su puntuación.
9. No inferir el mapeo de los nombres del nuevo reporte únicamente porque se parezcan a escalas antiguas.

## 14. Decisiones que debe confirmar el cliente

Ver `docs/PENDIENTES_PARA_VALIDACION_DEL_CLIENTE.md`. Ninguna de esas decisiones impide construir autenticación, reproductor, base de datos, seed de preguntas o el motor pareado; sí impiden declarar como definitivos la sección Likert y todos los indicadores del reporte PPF.

## 15. Definición de terminado del motor pareado

El módulo se considera terminado cuando:

- carga exactamente el banco entregado;
- el usuario no puede omitir pares;
- la respuesta se guarda y reanuda;
- el caso dorado pasa sin diferencias;
- cada resultado conserva versiones de prueba, clave y norma;
- la norma se puede reemplazar mediante una nueva versión sin modificar resultados históricos;
- existen logs de auditoría;
- la API no expone la clave;
- el PDF consume un DTO de resultados y no recalcula fórmulas.
