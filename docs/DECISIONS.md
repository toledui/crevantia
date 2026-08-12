# Decisiones técnicas iniciales

Fecha: 2026-08-05

## Arquitectura

- Monorepo con `npm workspaces` y dos aplicaciones: `frontend/` y `backend/`.
- Frontend con Next.js 16, App Router, React y TypeScript estricto.
- Backend con NestJS 11, API REST versionada bajo `/api/v1` y TypeScript estricto.
- Persistencia con MySQL 8 y Prisma ORM 7.
- Ejecución nativa: Node.js, MySQL y el proveedor de correo se instalan directamente en el sistema operativo. Docker no forma parte del desarrollo ni del despliegue.
- En VPS, Next.js y NestJS se administran mediante `systemd`; Nginx funciona como proxy inverso y MySQL como servicio nativo.

## Identidad y seguridad

- RBAC granular con roles, permisos y tablas puente explícitas.
- Contraseñas con Argon2id.
- Access token breve devuelto al cliente y refresh token rotatorio en cookie HttpOnly.
- Las sesiones almacenan únicamente el hash del refresh token y pueden revocarse.
- CORS se restringe a `FRONTEND_URL`; Helmet, validación global y rate limiting se habilitan desde el arranque.
- Los secretos reales viven únicamente en archivos `.env` ignorados.

## Dominio y persistencia

- Las versiones publicadas de una prueba son inmutables por regla de aplicación.
- Preguntas estadísticas, pareadas y Likert comparten una entidad versionada con relaciones específicas.
- Compra, asignación e intento son conceptos separados.
- Los datos psicométricos del seed son demostrativos y no contienen fórmulas ni interpretaciones reales.
- IDs CUID para evitar dependencias de generación específicas del motor SQL.

## Interfaz

- Se conservan la paleta, el contraste y el carácter editorial de los prototipos de `diseno1/`.
- El acceso usa composición dividida; el panel administrativo es oscuro con superficie editorial clara.
- El reproductor tendrá una superficie clara y controles táctiles de al menos 44 px.

## Alcance del arranque

- Este primer corte implementa bootstrap, esquema inicial, seed, salud del backend, autenticación y pantallas base.
- Stripe, correo real, motor psicométrico y generación de PDF quedan detrás de contratos futuros hasta contar con insumos y credenciales.
