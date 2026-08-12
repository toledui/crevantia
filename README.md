# Crevantia

Monorepo de la plataforma Crevantia. Se ejecuta directamente con Node.js y MySQL; Docker no forma parte de la arquitectura.

> El contenido psicométrico incluido es ficticio. No contiene fórmulas, normas ni interpretaciones validadas.

## Requisitos

- Node.js 20.9 o superior; se recomienda Node.js 24 LTS.
- npm 11 (incluido con Node.js).
- MySQL 8 instalado y ejecutándose como servicio del sistema operativo.
- Base de datos `crevantia` accesible en `127.0.0.1:3306`.

## Inicio rápido

Desde la raíz del proyecto:

```bash
npm install
npm run db:generate
npm run db:migrate -- --name nombre_del_cambio
npm run db:seed
npm run dev
```

El script raíz inicia ambos workspaces en paralelo usando únicamente Node.js y npm.

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- Salud: http://localhost:4000/api/v1/health

La preparación completa de MySQL y las variables locales está en [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Migraciones y ORM

El ORM es **Prisma ORM 7** con el adaptador oficial para MySQL/MariaDB.

- Fuente del modelo: `backend/prisma/schema.prisma`.
- Migraciones SQL: `backend/prisma/migrations/`.
- Datos iniciales idempotentes: `backend/prisma/seed.ts`.
- Desarrollo: `npm run db:migrate -- --name nombre_del_cambio`.
- Producción: `npm run db:deploy`.
- Estado: `npm run db:status`.

No debe usarse `prisma db push` en producción porque omite el historial de migraciones.

## Scripts principales

- `npm run dev`: frontend y backend en desarrollo.
- `npm run build`: compila todo el monorepo.
- `npm run start:frontend`: inicia el frontend compilado.
- `npm run start:backend`: inicia el backend compilado.
- `npm run lint`: validación estática.
- `npm run typecheck`: comprobación estricta de TypeScript.
- `npm test`: pruebas automatizadas.
- `npm run db:generate`: genera Prisma Client.
- `npm run db:migrate -- --name cambio`: crea y aplica una migración de desarrollo.
- `npm run db:deploy`: aplica migraciones existentes en producción.
- `npm run db:seed`: crea datos iniciales y demostrativos.

## Despliegue

El procedimiento para Ubuntu/Debian con Node.js, MySQL, Nginx, `systemd` y Certbot está en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Consulta también [decisiones técnicas](docs/DECISIONS.md), [pendientes del cliente](docs/PENDING_CLIENT_INPUTS.md) y [glosario](docs/DOMAIN_GLOSSARY.md).

La configuración SMTP y los flujos de confirmación/recuperación están documentados en [docs/EMAIL_AND_AUTH.md](docs/EMAIL_AND_AUTH.md).
