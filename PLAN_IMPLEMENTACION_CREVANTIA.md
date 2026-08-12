# Crevantia
## Plan maestro de implementación para Codex

> Documento de arranque técnico y funcional para construir la plataforma web de pruebas psicométricas Crevantia.
>
> **Stack obligatorio:** Node.js, Next.js, NestJS, Prisma ORM y MySQL.
>
> **Estructura obligatoria:** monorepo con una carpeta raíz y dos aplicaciones principales: `frontend/` y `backend/`.

---

# 1. Objetivo del proyecto

Construir una plataforma web especializada en:

- Registro y autenticación de usuarios.
- Comercialización de una prueba psicométrica mediante Stripe.
- Asignación manual de evaluaciones por administradores.
- Aplicación en línea de cuestionarios extensos.
- Guardado automático y reanudación del avance.
- Calificación automática basada en reglas, matrices, normas y fórmulas proporcionadas por el cliente.
- Generación de dos reportes PDF personalizados.
- Descarga y envío de reportes.
- Administración de usuarios, pruebas, evaluaciones, pagos, normas, matrices, reportes y configuración.
- Registro de actividad, incidencias técnicas y auditoría.

La primera prueba se identificará provisionalmente como **DPO-PRO** y medirá precursores psicoemocionales del desempeño.

---

# 2. Principios de implementación

Codex debe seguir estos principios durante todo el desarrollo:

1. **No codificar reglas psicométricas dentro de controladores o componentes visuales.**
   Toda lógica de puntuación debe vivir en un motor desacoplado, versionado y testeable.

2. **No asumir reglas que el cliente todavía no ha entregado.**
   Crear estructuras configurables y marcar claramente los campos pendientes.

3. **Una compra libera una aplicación de la prueba.**
   La aplicación puede pausarse y reanudarse, pero una vez enviada definitivamente no puede modificarse ni volver a utilizarse.

4. **Toda respuesta debe guardarse automáticamente.**
   El frontend debe usar persistencia local temporal y sincronización con el backend.

5. **Las operaciones críticas deben ser idempotentes.**
   Especialmente webhooks de Stripe, calificación, generación de PDF, envío de correos y asignación de pruebas.

6. **Los resultados deben ser reproducibles.**
   Cada resultado debe conservar la versión exacta de la prueba, norma, matriz y motor de calificación utilizados.

7. **La información psicométrica y personal debe tratarse como información sensible.**
   Implementar mínimos privilegios, auditoría, protección de archivos y políticas de retención configurables.

8. **El diseño debe respetar la identidad de Crevantia.**
   Evitar interfaces SaaS genéricas. El reproductor debe priorizar lectura, concentración y accesibilidad.

---

# 3. Identidad visual

## 3.1 Marca

- Nombre comercial: **Crevantia**.
- No mostrar públicamente el nombre personal ni el teléfono del propietario.
- El contacto público se realizará mediante un correo que el cliente definirá posteriormente.

## 3.2 Paleta

```txt
Azul noche:            #080B12
Índigo transformación: #302B78
Cian avance:           #00C2E8
Miel logro:            #D6A94F
Marfil:                 #F4F2EC
Gris azulado:          #9CA6B8
```

## 3.3 Lineamientos de interfaz

- Dashboard administrativo oscuro y editorial.
- Formularios de acceso sobrios y profesionales.
- Reproductor de evaluación con fondo blanco, marfil o gris muy claro.
- Alto contraste y tipografía cómoda para lectura prolongada.
- Botones y opciones de respuesta con áreas táctiles amplias.
- Progreso visible sin generar presión innecesaria.
- Evitar glassmorphism excesivo, gradientes genéricos e ilustraciones 3D.

---

# 4. Arquitectura del monorepo

La raíz del proyecto debe tener únicamente configuración compartida, documentación y las dos aplicaciones principales.

```txt
crevantia/
├── frontend/                    # Next.js
├── backend/                     # NestJS
├── docs/                        # Documentación técnica y funcional
├── deploy/                      # Plantillas de systemd y Nginx
├── scripts/                     # Utilidades de desarrollo y despliegue
├── .github/
│   └── workflows/               # CI
├── .editorconfig
├── .gitignore
├── .nvmrc
├── package.json                 # Scripts raíz
├── package-lock.json
├── README.md
└── PLAN_IMPLEMENTACION_CREVANTIA.md
```

## 4.1 Gestor de paquetes

Usar **npm workspaces**.

```yaml
workspaces:
  - frontend
  - backend
```

## 4.2 Versiones recomendadas

Usar versiones LTS o estables vigentes al iniciar el desarrollo:

- Node.js LTS.
- TypeScript estricto.
- Next.js con App Router.
- NestJS.
- Prisma ORM.
- MySQL 8.

No fijar versiones en este documento sin comprobar las versiones estables disponibles al momento de inicializar el repositorio.

---

# 5. Estructura del frontend

```txt
frontend/
├── public/
│   ├── brand/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── pruebas/
│   │   │   ├── aviso-de-privacidad/
│   │   │   ├── terminos/
│   │   │   └── contacto/
│   │   ├── (auth)/
│   │   │   ├── iniciar-sesion/
│   │   │   ├── registro/
│   │   │   ├── recuperar-contrasena/
│   │   │   ├── restablecer-contrasena/
│   │   │   └── verificar-correo/
│   │   ├── (user)/
│   │   │   ├── panel/
│   │   │   ├── mis-pruebas/
│   │   │   ├── evaluaciones/[attemptId]/
│   │   │   ├── reportes/
│   │   │   ├── compras/
│   │   │   └── perfil/
│   │   ├── (admin)/admin/
│   │   │   ├── page.tsx
│   │   │   ├── usuarios/
│   │   │   ├── pruebas/
│   │   │   ├── evaluaciones/
│   │   │   ├── resultados/
│   │   │   ├── reportes/
│   │   │   ├── pagos/
│   │   │   ├── normas/
│   │   │   ├── matrices/
│   │   │   ├── roles/
│   │   │   ├── notificaciones/
│   │   │   ├── auditoria/
│   │   │   ├── registros-tecnicos/
│   │   │   └── configuracion/
│   │   ├── checkout/
│   │   ├── pago/exitoso/
│   │   ├── pago/cancelado/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── forms/
│   │   ├── charts/
│   │   ├── admin/
│   │   ├── evaluation-player/
│   │   └── reports/
│   ├── features/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── tests/
│   │   ├── attempts/
│   │   ├── payments/
│   │   ├── reports/
│   │   └── admin/
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── validation/
│   │   ├── formatting/
│   │   └── storage/
│   ├── hooks/
│   ├── types/
│   └── middleware.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

# 6. Estructura del backend

```txt
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── pipes/
│   │   ├── validation/
│   │   ├── constants/
│   │   └── utils/
│   ├── config/
│   ├── database/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── permissions/
│   │   ├── tests/
│   │   ├── test-versions/
│   │   ├── sections/
│   │   ├── questions/
│   │   ├── answer-options/
│   │   ├── assignments/
│   │   ├── attempts/
│   │   ├── responses/
│   │   ├── scoring/
│   │   ├── norms/
│   │   ├── matrices/
│   │   ├── results/
│   │   ├── reports/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── stripe/
│   │   ├── notifications/
│   │   ├── mail/
│   │   ├── files/
│   │   ├── audit/
│   │   ├── logs/
│   │   ├── settings/
│   │   ├── health/
│   │   └── imports/
│   ├── jobs/
│   └── templates/
│       ├── email/
│       └── pdf/
├── test/
│   ├── integration/
│   └── e2e/
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

# 7. Roles y permisos

## 7.1 Roles iniciales

### Superadministrador

Acceso total, incluyendo:

- Configuración sensible.
- Credenciales de Stripe y correo.
- Roles y permisos.
- Registros técnicos.
- Auditoría.
- Activación o desactivación de normas y versiones.

### Administrador

Puede:

- Consultar y administrar usuarios.
- Crear usuarios manualmente.
- Asignar evaluaciones.
- Consultar progreso.
- Descargar reportes.
- Consultar pagos.
- Revisar resultados.
- Consultar actividad.

No debe ver secretos completos ni modificar permisos del superadministrador.

### Usuario o evaluado

Puede:

- Administrar su perfil.
- Comprar pruebas.
- Consultar pruebas compradas o asignadas.
- Iniciar y continuar una evaluación.
- Descargar reportes propios.
- Consultar su historial de compras.

## 7.2 Modelo de autorización

Implementar RBAC con permisos granulares.

Ejemplos:

```txt
users.read
users.create
users.update
users.disable
assignments.create
attempts.read
attempts.monitor
results.read
reports.download
payments.read
settings.update
logs.read
roles.manage
```

---

# 8. Registro y autenticación

## 8.1 Datos recomendados para registro

Solicitar únicamente lo necesario:

- Nombre.
- Apellidos.
- Correo electrónico.
- Contraseña.
- Confirmación de contraseña.
- Aceptación de términos de uso.
- Aceptación del aviso de privacidad.

No solicitar durante el registro datos estadísticos o psicométricos que pertenecen a la primera sección de la prueba.

Campos opcionales posteriores:

- Teléfono.
- País.
- Zona horaria.

## 8.2 Funciones

- Registro.
- Verificación de correo.
- Inicio de sesión.
- Cierre de sesión.
- Recuperación de contraseña.
- Restablecimiento mediante token de un solo uso.
- Cambio de contraseña.
- Revocación de sesiones.
- Bloqueo temporal por intentos fallidos.

## 8.3 Autenticación recomendada

- Access token de corta duración.
- Refresh token rotatorio almacenado en cookie `HttpOnly`, `Secure` y `SameSite=Lax`.
- Hash de contraseña con Argon2id.
- Tabla de sesiones y refresh tokens revocables.
- No guardar tokens de autenticación en `localStorage`.

---

# 9. Catálogo y compra de pruebas

## 9.1 Producto inicial

- Nombre provisional: DPO-PRO.
- Idioma: español.
- Público objetivo: personas de 24 a 65 años.
- Tiempo estimado: 30 a 40 minutos.
- Precio esperado: entre $1,800 y $2,700 MXN, IVA incluido.
- Precio definitivo pendiente.
- Posible precio equivalente en USD.

## 9.2 Reglas comerciales iniciales

- Un pago confirmado genera un derecho de uso.
- El derecho de uso crea una asignación o licencia individual.
- El usuario puede pausar y reanudar mientras la aplicación permanezca activa.
- Al enviar la prueba definitivamente, el derecho se considera consumido.
- No hay cancelación después de confirmar el pago.
- No hay reembolso una vez entregado el reporte.
- Estas reglas deberán mostrarse antes del pago y quedar versionadas con la orden.

## 9.3 Estados de orden

```txt
DRAFT
PENDING_PAYMENT
PAID
PAYMENT_FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

## 9.4 Estados de pago

```txt
REQUIRES_PAYMENT_METHOD
REQUIRES_ACTION
PROCESSING
SUCCEEDED
FAILED
CANCELLED
REFUNDED
```

---

# 10. Integración con Stripe

## 10.1 Flujo

1. El frontend solicita una sesión de checkout.
2. El backend crea la orden interna en estado `PENDING_PAYMENT`.
3. El backend crea la sesión de Stripe con metadatos internos.
4. Stripe confirma mediante webhook.
5. El backend valida la firma del webhook.
6. El evento se guarda antes de procesarlo.
7. El procesamiento debe ser idempotente.
8. Al confirmarse el pago:
   - Marcar orden como pagada.
   - Crear asignación o entitlement.
   - Notificar al usuario.
   - Registrar auditoría.

## 10.2 Eventos mínimos

- `checkout.session.completed`.
- `payment_intent.succeeded`.
- `payment_intent.payment_failed`.
- `charge.refunded`.

## 10.3 Requisitos

- Tabla de eventos de Stripe con ID único.
- Nunca confiar solo en la URL de éxito del navegador.
- Guardar moneda, subtotal, impuestos, total y referencia de Stripe.
- No almacenar información de tarjeta.
- Crear modo prueba y modo producción mediante variables de entorno.

---

# 11. Asignaciones y derechos de uso

Distinguir claramente:

- **Compra:** operación comercial.
- **Asignación:** derecho otorgado a una persona para realizar una prueba.
- **Intento o aplicación:** ejecución concreta del cuestionario.

## 11.1 Tipos de asignación

```txt
PURCHASE
ADMIN_FREE
PROMOTIONAL
SUPPORT_REPLACEMENT
```

## 11.2 Estados de asignación

```txt
PENDING
AVAILABLE
IN_PROGRESS
COMPLETED
EXPIRED
REVOKED
```

## 11.3 Reglas

- Una asignación inicial permite un solo intento definitivo.
- Puede existir un único intento abierto por asignación.
- El administrador puede revocar una asignación no consumida.
- Una reposición excepcional debe crear una nueva asignación con motivo y auditoría.
- La fecha de vencimiento debe ser configurable; el cliente aún no la define.

---

# 12. Prueba DPO-PRO

## 12.1 Estructura

La prueba contiene cuatro secciones:

1. **Control estadístico.**
2. **Preguntas de naturaleza positiva.**
3. **Preguntas de naturaleza negativa.**
4. **Preguntas de opción múltiple con escala Likert.**

Todas las preguntas son obligatorias.

## 12.2 Sección 1: control estadístico

- Campos y preguntas pendientes de importar desde el archivo del cliente.
- Deben modelarse como reactivos configurables, no como columnas fijas de la tabla `users`.
- Permitir diferentes tipos de respuesta:
  - Texto corto.
  - Número.
  - Fecha.
  - Selección única.
  - Selección múltiple.
  - Catálogo.

## 12.3 Secciones 2 y 3: afirmaciones pareadas

Cada bloque presenta dos afirmaciones.

El evaluado debe indicar:

- Con cuál se identifica **más**.
- Con cuál se identifica **menos**.

Reglas de interfaz:

- No permitir seleccionar la misma afirmación como “más” y “menos”.
- Ambas selecciones son obligatorias.
- El par se guarda como una unidad atómica.
- El backend valida integridad aunque el frontend ya lo haga.

Modelo conceptual de respuesta:

```json
{
  "pairQuestionId": "uuid",
  "mostStatementId": "uuid",
  "leastStatementId": "uuid"
}
```

## 12.4 Sección 4: escala Likert

Escala indicada por el cliente:

```txt
1 = Falso completamente
2 = Moderadamente falso
3 = Ni falso ni verdadero
4 = Moderadamente verdadero
5 = Verdadero completamente
```

El brief también contiene una redacción preliminar alternativa para la escala. La aplicación debe permitir configurar etiquetas por versión de prueba para no codificarlas de forma fija.

---

# 13. Versionado de pruebas

Nunca editar en producción una prueba ya utilizada.

Modelo:

- `Test`: entidad comercial y lógica general.
- `TestVersion`: versión inmutable de contenido.
- `Section`: sección perteneciente a una versión.
- `Question`: reactivo versionado.
- `Statement`: afirmaciones de preguntas pareadas.
- `AnswerOption`: opciones configurables.

Estados de una versión:

```txt
DRAFT
VALIDATING
PUBLISHED
ARCHIVED
```

Reglas:

- Solo una versión publicada puede asignarse por defecto.
- Una versión publicada no se modifica.
- Los cambios crean una nueva versión.
- Cada intento conserva `testVersionId`.
- La publicación requiere validaciones automáticas.

---

# 14. Importación de preguntas y reglas

El cliente proporcionará archivos Excel con:

- Preguntas.
- Orden.
- Pareo de afirmaciones.
- Fórmulas.
- Ponderaciones.
- Matrices.
- Normas.
- Rangos.
- Deciles.

## 14.1 Estrategia de importación

Crear un módulo `imports` con flujo de dos etapas:

1. **Validación previa.**
   - Leer archivo.
   - Validar columnas.
   - Detectar duplicados.
   - Detectar referencias rotas.
   - Mostrar errores por fila.
   - No escribir todavía en tablas productivas.

2. **Confirmación de importación.**
   - Crear borrador versionado.
   - Ejecutar transacción.
   - Guardar archivo fuente y hash.
   - Registrar usuario, fecha y resultado.

## 14.2 No interpretar macros directamente en producción

Las macros deben analizarse y traducirse a reglas explícitas del motor. No ejecutar archivos Excel ni VBA en el servidor productivo.

---

# 15. Reproductor de evaluación

## 15.1 Objetivos de experiencia

- Lectura ligera.
- Pocas distracciones.
- Fondo blanco, marfil o gris claro.
- Progreso claro.
- Mensaje persistente de guardado.
- Navegación accesible.
- Uso cómodo en computadora, tableta y móvil.

## 15.2 Pantallas

1. Introducción general.
2. Instrucciones de la sección 1.
3. Preguntas de control estadístico.
4. Transición e instrucciones de la sección 2.
5. Preguntas pareadas positivas.
6. Transición e instrucciones de la sección 3.
7. Preguntas pareadas negativas.
8. Transición e instrucciones de la sección 4.
9. Preguntas Likert.
10. Revisión final.
11. Confirmación de envío definitivo.
12. Procesamiento de resultados.
13. Confirmación y disponibilidad del reporte.

## 15.3 Estados del intento

```txt
CREATED
IN_PROGRESS
PAUSED
SUBMITTED
SCORING
SCORED
REPORT_GENERATING
COMPLETED
FAILED
INVALIDATED
```

## 15.4 Guardado automático

- Guardar al seleccionar una respuesta.
- Aplicar debounce solo cuando corresponda.
- Enviar un identificador de operación para idempotencia.
- Mostrar `Guardando`, `Guardado` o `Sin conexión`.
- Mantener una copia local cifrada o minimizada para recuperación temporal.
- Sincronizar al recuperar conexión.
- No permitir que una respuesta antigua sobrescriba una más reciente.
- Usar `version` u `updatedAt` para control de concurrencia.

## 15.5 Navegación

- Permitir anterior y siguiente dentro de la sección.
- Permitir marcar para revisión.
- Mostrar preguntas respondidas y pendientes.
- No permitir enviar con preguntas obligatorias pendientes.
- Confirmar antes del envío definitivo.
- Después de `SUBMITTED`, bloquear cualquier modificación.

## 15.6 Accesibilidad

- Navegación completa por teclado.
- Estados de foco visibles.
- Etiquetas asociadas a controles.
- Mensajes anunciados mediante `aria-live`.
- Contraste WCAG AA.
- No depender solo del color.
- Tamaño táctil mínimo recomendado de 44 px.

---

# 16. Motor de calificación

## 16.1 Objetivo

Traducir la lógica actual de Excel y macros a un motor interno reproducible, auditable y probado.

## 16.2 Arquitectura

Crear una interfaz base:

```ts
interface ScoringEngine {
  validateInput(context: ScoringContext): Promise<ValidationResult>;
  calculate(context: ScoringContext): Promise<ScoringOutput>;
}
```

Implementar adaptadores por prueba y versión:

```txt
scoring/
├── domain/
├── engines/
│   └── dpo-pro/
│       ├── v1/
│       │   ├── engine.ts
│       │   ├── validators.ts
│       │   ├── formulas.ts
│       │   ├── mappings.ts
│       │   └── fixtures/
├── services/
└── tests/
```

## 16.3 Salida del motor

La salida debe contener, según los archivos finales:

- Puntuaciones crudas.
- Puntuaciones transformadas.
- Escalas.
- Factores.
- Dimensiones.
- Categorías.
- Deciles.
- Valores para gráficas.
- Identificadores de textos de interpretación.
- Alertas o inconsistencias.
- Versión del motor.
- Norma utilizada.
- Matriz utilizada.

## 16.4 Reglas de ejecución

- Ejecutar únicamente sobre un intento enviado definitivamente.
- Crear un snapshot inmutable de respuestas.
- Usar transacción para persistir resultados.
- Ser idempotente.
- Si falla, registrar error técnico sin perder respuestas.
- Permitir reintento administrativo controlado.
- Nunca recalcular silenciosamente resultados históricos con reglas nuevas.

## 16.5 Validación científica y funcional

Crear pruebas automatizadas usando al menos tres casos completos proporcionados por el cliente.

Cada fixture debe contener:

```txt
- Versión de prueba.
- Respuestas de entrada.
- Resultado esperado por escala.
- Resultado esperado final.
- Tolerancias, si existen decimales.
- Fuente de validación.
```

No marcar el motor como aprobado hasta que los casos coincidan con la hoja molde o resultado esperado del cliente.

---

# 17. Normas, matrices e interpretaciones

## 17.1 Entidades

- Norma.
- Versión de norma.
- Matriz.
- Versión de matriz.
- Escala.
- Dimensión.
- Factor.
- Rango.
- Decil.
- Categoría de interpretación.
- Texto de interpretación.

## 17.2 Datos mínimos

- Nombre.
- Código.
- Versión.
- Descripción.
- Fecha de vigencia.
- Estado.
- Valores mínimos y máximos.
- Regla de aplicación.
- Fuente.
- Hash del archivo importado.

## 17.3 Versionado

Las normas y matrices utilizadas por resultados existentes no deben eliminarse. Solo pueden archivarse.

---

# 18. Resultados y reportes PDF

## 18.1 Reportes iniciales

### Reporte 1

Mide precursores emocionales de comportamientos generadores de abundancia.

### Reporte 2

Mide precursores emocionales del comportamiento financiero, incluyendo:

- Ingresos.
- Gastos.
- Ahorro.
- Deuda.
- Inversión.

## 18.2 Estado actual de los insumos

Pendiente de recibir:

- Estructura definitiva.
- Textos.
- Ejemplos visuales.
- Orden de secciones.
- Avisos legales.
- Interpretaciones completas.

Por lo tanto, Codex debe crear primero un sistema de plantillas y una plantilla demostrativa, sin inventar contenido psicológico definitivo.

## 18.3 Estrategia técnica

- Generar HTML con plantilla versionada.
- Renderizar PDF en backend con Chromium mediante Playwright o Puppeteer.
- Guardar PDF en almacenamiento privado.
- Entregar mediante URL firmada de corta duración o endpoint autorizado.
- Guardar checksum SHA-256.
- Registrar fecha, versión de plantilla y motor.

## 18.4 Estados del reporte

```txt
PENDING
GENERATING
READY
FAILED
REVOKED
```

## 18.5 Acceso

- El usuario puede descargar únicamente sus propios reportes.
- Administradores autorizados pueden descargar reportes desde el panel.
- Enviar correo cuando el reporte esté disponible.
- No adjuntar automáticamente archivos pesados si el proveedor o política no lo permite; preferir enlace seguro.

---

# 19. Correos automáticos

Eventos mínimos:

- Registro de cuenta.
- Verificación de correo.
- Recuperación de contraseña.
- Confirmación de compra.
- Confirmación de pago.
- Asignación manual.
- Enlace para iniciar la prueba.
- Recordatorio de evaluación pendiente, si se habilita.
- Confirmación de envío definitivo.
- Reporte disponible.
- Fallo administrativo relevante.

## 19.1 Proveedor

El cliente aún no cuenta con SMTP o proveedor transaccional. Implementar una abstracción de correo compatible con proveedores como Resend, Postmark, Amazon SES o SMTP.

No acoplar plantillas al proveedor.

## 19.2 Cola de trabajos

Para producción, usar una cola persistente para:

- Correos.
- PDFs.
- Calificación.
- Procesamiento de webhooks.

Si se usa BullMQ, Redis será una dependencia adicional de infraestructura. Aunque el stack principal solicitado es MySQL, Redis es aceptable como servicio auxiliar para colas y no como base de datos principal.

---

# 20. Modelo de datos inicial

El esquema final debe ajustarse al Excel y las reglas reales, pero debe partir de estas entidades.

## 20.1 Identidad y seguridad

```txt
User
Role
Permission
UserRole
RolePermission
Session
PasswordResetToken
EmailVerificationToken
ConsentAcceptance
```

## 20.2 Catálogo de pruebas

```txt
Test
TestVersion
Section
Question
Statement
AnswerOption
InstructionBlock
```

## 20.3 Venta y asignación

```txt
Product
ProductPrice
Order
OrderItem
Payment
StripeEvent
Assignment
```

## 20.4 Aplicación

```txt
Attempt
AttemptSection
Response
PairResponse
ResponseRevision
AttemptEvent
```

## 20.5 Calificación

```txt
ScoringRun
RawScore
ScaleResult
DimensionResult
FactorResult
Norm
NormVersion
Matrix
MatrixVersion
Interpretation
```

## 20.6 Reportes

```txt
ReportTemplate
ReportTemplateVersion
GeneratedReport
StoredFile
```

## 20.7 Operación

```txt
Notification
EmailDelivery
AuditLog
TechnicalLog
SystemSetting
ImportJob
BackgroundJob
```

---

# 21. Reglas importantes del esquema Prisma

- IDs UUID o CUID2.
- Fechas almacenadas en UTC.
- Índices para correo, estados, fechas y claves foráneas.
- Restricciones únicas para idempotencia.
- Soft delete solo donde tenga sentido.
- Resultados, pagos y auditoría no deben borrarse físicamente mediante operaciones normales.
- Usar campos JSON únicamente para snapshots o estructuras variables justificadas; no convertir todo el modelo en JSON.
- Cifrar secretos y datos altamente sensibles a nivel de aplicación cuando corresponda.

Ejemplos de restricciones:

```txt
User.email UNIQUE
StripeEvent.stripeEventId UNIQUE
Payment.providerPaymentId UNIQUE
Attempt.assignmentId + estado abierto controlado
Response.attemptId + questionId UNIQUE
ScoringRun.attemptId + engineVersion UNIQUE
GeneratedReport.resultId + templateVersionId UNIQUE
```

---

# 22. API REST inicial

Versionar la API bajo `/api/v1`.

## 22.1 Auth

```txt
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me
```

## 22.2 Usuario

```txt
GET    /api/v1/me
PATCH  /api/v1/me
GET    /api/v1/me/assignments
GET    /api/v1/me/attempts
GET    /api/v1/me/reports
GET    /api/v1/me/orders
```

## 22.3 Catálogo y checkout

```txt
GET    /api/v1/products
GET    /api/v1/products/:slug
POST   /api/v1/checkout/session
GET    /api/v1/orders/:id
POST   /api/v1/webhooks/stripe
```

## 22.4 Evaluación

```txt
POST   /api/v1/assignments/:assignmentId/start
GET    /api/v1/attempts/:attemptId
GET    /api/v1/attempts/:attemptId/player
PUT    /api/v1/attempts/:attemptId/responses/:questionId
PUT    /api/v1/attempts/:attemptId/pair-responses/:questionId
POST   /api/v1/attempts/:attemptId/flag/:questionId
DELETE /api/v1/attempts/:attemptId/flag/:questionId
POST   /api/v1/attempts/:attemptId/pause
POST   /api/v1/attempts/:attemptId/submit
GET    /api/v1/attempts/:attemptId/status
```

## 22.5 Reportes

```txt
GET    /api/v1/reports/:reportId
GET    /api/v1/reports/:reportId/download
```

## 22.6 Administración

```txt
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/users/:id
PATCH  /api/v1/admin/users/:id
POST   /api/v1/admin/users/:id/disable

GET    /api/v1/admin/tests
POST   /api/v1/admin/tests
POST   /api/v1/admin/tests/:id/versions
POST   /api/v1/admin/test-versions/:id/publish

GET    /api/v1/admin/assignments
POST   /api/v1/admin/assignments
POST   /api/v1/admin/assignments/:id/revoke

GET    /api/v1/admin/attempts
GET    /api/v1/admin/attempts/:id
POST   /api/v1/admin/attempts/:id/retry-scoring

GET    /api/v1/admin/results
GET    /api/v1/admin/reports
POST   /api/v1/admin/reports/:id/regenerate

GET    /api/v1/admin/orders
GET    /api/v1/admin/payments

GET    /api/v1/admin/norms
POST   /api/v1/admin/norms
GET    /api/v1/admin/matrices
POST   /api/v1/admin/matrices

POST   /api/v1/admin/imports/questions/validate
POST   /api/v1/admin/imports/questions/commit
POST   /api/v1/admin/imports/scoring/validate
POST   /api/v1/admin/imports/scoring/commit

GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/technical-logs
GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings
```

---

# 23. Dashboard administrativo

## 23.1 Resumen ejecutivo

Mostrar:

- Evaluaciones activas.
- Usuarios registrados.
- Evaluaciones finalizadas.
- Reportes generados.
- Ingresos del periodo.
- Tasa de finalización.
- Evaluaciones sin iniciar.
- Evaluaciones pausadas.
- Pagos con incidencia.
- Errores de PDF o calificación.

## 23.2 Bandeja operativa

Priorizar:

- Intentos sin actividad.
- Intentos con error de sincronización.
- Calificaciones fallidas.
- Reportes fallidos.
- Pagos pendientes de conciliación.
- Normas próximas a revisión.

## 23.3 Gestión

- Usuarios.
- Pruebas y versiones.
- Reactivos.
- Asignaciones.
- Intentos.
- Resultados.
- Reportes.
- Pagos.
- Normas.
- Matrices.
- Roles.
- Configuración.
- Auditoría.
- Registros técnicos.

---

# 24. Seguridad y privacidad

## 24.1 Medidas obligatorias

- HTTPS en producción.
- Helmet y cabeceras de seguridad.
- CORS con lista explícita.
- Rate limiting.
- Validación estricta de DTOs.
- Sanitización de entradas.
- Protección CSRF según estrategia de cookies.
- Cookies seguras.
- Contraseñas con Argon2id.
- MFA opcional para administradores en una fase posterior.
- Cifrado de secretos.
- URLs firmadas para archivos.
- Control de acceso por recurso.
- Auditoría de accesos a reportes.
- Backups cifrados.
- No exponer stack traces al cliente.

## 24.2 Consentimientos

Versionar y registrar:

- Aviso de privacidad aceptado.
- Términos de uso aceptados.
- Consentimiento para tratamiento de datos.
- Descargo sobre interpretación psicométrica.

Guardar:

- Versión del texto.
- Fecha y hora.
- Usuario.
- IP resumida o tratada conforme a la política legal.
- User agent cuando sea necesario para auditoría.

Los textos legales están pendientes y deben ser proporcionados o validados por un profesional competente.

---

# 25. Archivos y almacenamiento

En desarrollo puede utilizarse almacenamiento local.

En producción crear una interfaz compatible con:

- S3.
- Cloudflare R2.
- MinIO.
- Almacenamiento local privado del VPS como opción inicial.

Tipos de archivo:

- Fuentes de importación.
- Reportes PDF.
- Logos y recursos de plantilla.
- Evidencias de validación.

Nunca colocar reportes privados dentro de una carpeta pública del frontend.

---

# 26. Observabilidad y auditoría

## 26.1 Logs técnicos

Usar logs estructurados JSON con:

- `requestId`.
- Usuario, cuando corresponda.
- Módulo.
- Evento.
- Severidad.
- Duración.
- Código de error.

No registrar:

- Contraseñas.
- Tokens.
- Secretos.
- Respuestas completas del usuario en logs ordinarios.

## 26.2 Auditoría funcional

Registrar acciones críticas:

- Inicios de sesión administrativos.
- Creación o desactivación de usuarios.
- Asignaciones.
- Cambios de roles.
- Publicación de versiones.
- Importaciones.
- Reintentos de calificación.
- Descarga administrativa de reportes.
- Cambios de configuración.
- Reembolsos o ajustes de pago.

---

# 27. Pruebas automatizadas

## 27.1 Backend

- Unitarias para servicios y motor de calificación.
- Integración para Prisma y MySQL.
- E2E para autenticación, compra, asignación y evaluación.
- Pruebas de idempotencia de webhooks.
- Pruebas de permisos.
- Pruebas de generación de PDF.

## 27.2 Frontend

- Componentes críticos.
- Validación de formularios.
- Reproductor de pares.
- Reproductor Likert.
- Guardado automático.
- Navegación y revisión.
- Accesibilidad básica.

## 27.3 Flujos E2E prioritarios

1. Registro → verificación → login.
2. Compra en modo Stripe test → asignación liberada.
3. Asignación manual → correo → inicio de prueba.
4. Guardado → cierre → reanudación.
5. Respuesta de preguntas pareadas.
6. Envío con pregunta pendiente bloqueado.
7. Envío completo → calificación → PDF.
8. Usuario descarga su reporte.
9. Administrador descarga reporte.
10. Webhook duplicado no duplica asignación.

---

# 28. Entorno local

Los servicios se instalarán y ejecutarán directamente en el sistema operativo, sin Docker:

```txt
Node.js y npm
MySQL 8 como servicio nativo
SMTP local o proveedor transaccional configurable
Redis nativo opcional para colas futuras
```

El frontend y backend se levantan conjuntamente desde la raíz con `npm run dev`.

## 28.1 Variables de entorno

Crear `.env.example` separados.

Backend:

```txt
NODE_ENV=
PORT=
DATABASE_URL=
FRONTEND_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MAIL_PROVIDER=
MAIL_FROM_NAME=
MAIL_FROM_ADDRESS=
STORAGE_DRIVER=
STORAGE_BUCKET=
REDIS_URL=
```

Frontend:

```txt
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Nunca subir secretos reales al repositorio.

---

# 29. Despliegue en VPS

## 29.1 Arquitectura sugerida

```txt
Nginx
├── crevantia.com              -> Next.js
├── api.crevantia.com          -> NestJS
└── /files privados            -> backend / almacenamiento

PM2 o systemd
├── frontend
├── backend
└── workers

MySQL 8
Redis opcional
```

El despliegue productivo será nativo, sin Docker, administrado mediante `systemd` y Nginx.

## 29.2 Requisitos

- SSL con Let's Encrypt.
- Firewall.
- Usuario de despliegue sin acceso root habitual.
- Variables de entorno fuera del repositorio.
- Migraciones Prisma controladas.
- Backups automáticos de MySQL.
- Backups de reportes y archivos.
- Rotación de logs.
- Endpoint `/health`.
- Procedimiento de rollback.

El cliente aún no cuenta con dominio ni VPS.

---

# 30. Fases de implementación

## Fase 0. Descubrimiento y validación de insumos

### Objetivos

- Revisar Excel, macros, cuestionarios y casos de validación.
- Confirmar reglas de uso, vencimiento y precio.
- Definir campos de control estadístico.
- Confirmar contenido de reportes.

### Entregables

- Inventario de archivos.
- Mapa de reglas.
- Diccionario de datos inicial.
- Lista de dudas bloqueantes.
- Casos de prueba aceptados.

### No avanzar a producción del motor sin completar esta fase.

---

## Fase 1. Bootstrap del monorepo

### Tareas

- Crear repositorio.
- Configurar npm workspaces.
- Inicializar Next.js.
- Inicializar NestJS.
- Configurar TypeScript estricto.
- Configurar ESLint y Prettier.
- Documentar la instalación nativa de Node.js y MySQL.
- Configurar Prisma y primera migración.
- Crear CI de lint, typecheck y tests.
- Crear README y convenciones.

### Criterio de aceptación

Un desarrollador puede clonar, ejecutar una sola instalación y levantar frontend, backend y MySQL siguiendo el README.

---

## Fase 2. Identidad, autenticación y autorización

### Tareas

- Implementar UI de login y registro.
- Registro y verificación de correo.
- Login, refresh y logout.
- Recuperación de contraseña.
- Sesiones revocables.
- Roles y permisos.
- Layout público, usuario y administrador.
- Seed de superadministrador.

### Criterio de aceptación

Los tres roles acceden únicamente a las rutas y acciones autorizadas.

---

## Fase 3. Catálogo, órdenes y Stripe

### Tareas

- Productos y precios.
- Página de detalle.
- Orden interna.
- Stripe Checkout.
- Webhooks idempotentes.
- Historial de pagos.
- Liberación automática de asignación.
- Correos de compra y pago.

### Criterio de aceptación

Un pago de prueba confirmado crea exactamente una asignación disponible.

---

## Fase 4. Administración de pruebas e importación

### Tareas

- Entidades de prueba y versión.
- Secciones e instrucciones.
- Preguntas de control.
- Preguntas pareadas.
- Preguntas Likert.
- Importación y validación de Excel.
- Publicación y archivado de versiones.

### Criterio de aceptación

El administrador puede importar una versión en borrador, validar errores y publicarla sin modificar versiones anteriores.

---

## Fase 5. Asignaciones y panel del usuario

### Tareas

- Asignación automática por compra.
- Asignación manual gratuita.
- Enlace de invitación.
- Listado de pruebas disponibles.
- Estados de asignación.
- Inicio de intento.

### Criterio de aceptación

El usuario ve una evaluación comprada o asignada y puede iniciar un único intento.

---

## Fase 6. Reproductor de evaluación

### Tareas

- Introducciones y transiciones.
- Sección de control estadístico.
- Reproductor de pares más/menos.
- Reproductor Likert.
- Guardado automático.
- Reanudación.
- Marcado para revisión.
- Validación de obligatorias.
- Envío definitivo.
- Responsive y accesibilidad.

### Criterio de aceptación

El usuario puede completar, pausar y reanudar la prueba sin perder respuestas; no puede enviarla incompleta ni modificarla después del envío.

---

## Fase 7. Motor de calificación

### Tareas

- Documentar reglas de Excel.
- Crear motor DPO-PRO v1.
- Importar normas y matrices.
- Crear snapshots.
- Persistir resultados.
- Implementar reintentos.
- Implementar fixtures y pruebas.

### Criterio de aceptación

Los casos de validación coinciden con los resultados esperados entregados por el cliente.

---

## Fase 8. Reportes PDF

### Tareas

- Sistema de plantillas.
- Reporte 1.
- Reporte 2.
- Gráficas.
- Generación asíncrona.
- Almacenamiento privado.
- Descarga autorizada.
- Correo de disponibilidad.

### Criterio de aceptación

Cada prueba completada genera los reportes correctos con la versión de resultados correspondiente.

---

## Fase 9. Dashboard administrativo

### Tareas

- KPIs.
- Usuarios.
- Evaluaciones.
- Progreso.
- Resultados.
- Reportes.
- Pagos.
- Normas y matrices.
- Configuración.
- Auditoría.
- Errores técnicos.

### Criterio de aceptación

El administrador puede supervisar y operar la plataforma sin acceder directamente a la base de datos.

---

## Fase 10. Calidad, seguridad y despliegue

### Tareas

- Pruebas E2E.
- Revisión de permisos.
- Revisión de privacidad.
- Pruebas de carga razonables.
- Backups.
- Nginx y SSL.
- Observabilidad.
- Documentación.
- Manual técnico.
- Manual de uso.

### Criterio de aceptación

La plataforma pasa checklist funcional, seguridad básica, respaldo y restauración antes de producción.

---

# 31. Orden de trabajo recomendado para Codex

Codex debe comenzar exactamente en este orden:

1. Crear estructura del monorepo.
2. Configurar scripts raíz.
3. Configurar la conexión con MySQL instalado en el sistema operativo.
4. Inicializar Prisma.
5. Crear entidades de identidad, roles y sesiones.
6. Implementar autenticación backend.
7. Implementar pantallas de login y registro.
8. Crear layouts de usuario y administrador.
9. Crear catálogo de productos y órdenes.
10. Integrar Stripe en modo prueba.
11. Crear modelo versionado de pruebas.
12. Crear seed demostrativo de DPO-PRO con datos ficticios.
13. Crear asignaciones e intentos.
14. Implementar reproductor con preguntas ficticias.
15. Implementar guardado automático.
16. Crear contratos del motor de calificación con implementación simulada.
17. Crear plantilla PDF demostrativa.
18. Construir dashboard administrativo.
19. Sustituir datos ficticios por importaciones reales cuando el cliente entregue los archivos finales.

---

# 32. Primer sprint sugerido

## Meta

Entregar una base navegable y técnicamente sólida, todavía sin lógica psicométrica real.

## Historias

### Historia 1. Monorepo ejecutable

- `npm install` funciona en raíz.
- `npm run dev` levanta frontend y backend.
- MySQL se ejecuta como servicio nativo del sistema operativo.

### Historia 2. Autenticación

- Registro.
- Login.
- Logout.
- Refresh.
- Recuperación de contraseña mediante una abstracción SMTP configurable.

### Historia 3. Roles

- Superadministrador.
- Administrador.
- Usuario.
- Guards y rutas protegidas.

### Historia 4. UI base

- Login.
- Registro.
- Panel del usuario.
- Dashboard administrativo inicial.

### Historia 5. Modelo de prueba

- Test.
- TestVersion.
- Section.
- Question.
- Statement.
- AnswerOption.
- Seed ficticio.

### Historia 6. Calidad

- Lint.
- Typecheck.
- Pruebas unitarias mínimas.
- CI.
- README.

## Resultado del sprint

Una persona puede crear cuenta, iniciar sesión y acceder a un panel según su rol. El administrador puede consultar una prueba DPO-PRO ficticia versionada.

---

# 33. Convenciones de desarrollo

- TypeScript estricto.
- Evitar `any` salvo justificación documentada.
- DTOs explícitos.
- Validación en frontend y backend.
- Servicios pequeños y cohesionados.
- Controladores delgados.
- Repositorios o servicios de persistencia desacoplados cuando agreguen valor.
- No mezclar contratos API con modelos Prisma directamente.
- Respuestas API consistentes.
- Errores con código interno estable.
- Fechas ISO 8601 en API.
- Commits convencionales.
- Migraciones pequeñas y revisables.

Ejemplo de error:

```json
{
  "statusCode": 409,
  "code": "ATTEMPT_ALREADY_SUBMITTED",
  "message": "La evaluación ya fue enviada definitivamente.",
  "requestId": "uuid"
}
```

---

# 34. Datos de demostración permitidos

Mientras se reciben reglas y contenidos finales, usar únicamente datos ficticios claramente marcados:

- Preguntas de muestra.
- Resultados de muestra.
- Gráficas de muestra.
- Textos de interpretación de muestra.

No presentar datos ficticios como validados científicamente.

Agregar un indicador visible en entornos no productivos:

```txt
ENTORNO DE DEMOSTRACIÓN — RESULTADOS NO VÁLIDOS
```

---

# 35. Decisiones pendientes del cliente

No bloquear el bootstrap, pero crear tickets para resolver:

- Nombre definitivo de la prueba.
- Precio definitivo.
- Precio y regla de conversión a USD.
- Vigencia de una asignación.
- Campos exactos de control estadístico.
- Correo público de contacto.
- Proveedor de correo.
- Cuenta de Stripe.
- Dominio.
- VPS.
- Textos legales.
- Consentimientos.
- Política de privacidad y retención.
- Estructura final de ambos reportes.
- Interpretaciones finales.
- Reglas completas del motor.
- Etiquetas definitivas de escalas.

---

# 36. Definición de terminado global

Una función se considera terminada solo cuando:

- Tiene validación frontend y backend.
- Respeta permisos.
- Tiene manejo de errores.
- Tiene prueba automatizada proporcional a su riesgo.
- Está documentada.
- Funciona en responsive cuando tiene interfaz.
- Tiene estados de carga, vacío y error.
- Registra auditoría si es una acción crítica.
- No expone datos sensibles.
- Pasa lint y typecheck.
- Está incluida en el flujo E2E correspondiente.

---

# 37. Entregables técnicos finales

- Monorepo completo.
- Frontend Next.js.
- Backend NestJS.
- Base de datos MySQL con migraciones Prisma.
- Integración Stripe.
- Sistema de correo.
- Reproductor de evaluación.
- Guardado automático.
- Motor de calificación DPO-PRO validado.
- Normas y matrices versionadas.
- Dos reportes PDF.
- Dashboard administrativo.
- Panel de usuario.
- Roles y permisos.
- Auditoría y registros técnicos.
- Código fuente en repositorio privado.
- `.env.example` sin secretos.
- Configuración de ejecución nativa para desarrollo y producción.
- Pipeline CI.
- Scripts de despliegue o documentación equivalente.
- Manual técnico.
- Manual de despliegue.
- Documento de respaldo y restauración.

---

# 38. Instrucción final para Codex

Implementa este proyecto por fases, empezando por el bootstrap del monorepo y el primer sprint.

Antes de escribir código:

1. Lee este documento completo.
2. Crea un archivo `docs/DECISIONS.md` con las decisiones técnicas iniciales.
3. Crea `docs/PENDING_CLIENT_INPUTS.md` con todos los insumos pendientes.
4. Crea `docs/DOMAIN_GLOSSARY.md` con términos como prueba, versión, asignación, intento, respuesta, calificación, norma, matriz, resultado y reporte.
5. Genera el árbol inicial del repositorio.
6. Implementa únicamente datos ficticios para la lógica psicométrica hasta recibir los archivos oficiales.

No inventes fórmulas, interpretaciones, normas ni conclusiones psicológicas.

Prioriza integridad de datos, trazabilidad, seguridad, versionado y capacidad de prueba por encima de la velocidad de implementación.
