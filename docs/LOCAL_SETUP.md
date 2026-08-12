# Instalación local sin Docker

## 1. Instalar servicios

Instala directamente en el sistema operativo:

- Node.js 24 LTS o una versión compatible superior a 20.9.
- npm 11, incluido con Node.js.
- MySQL 8.

En PowerShell:

```powershell
node --version
npm --version
```

MySQL debe aparecer como servicio iniciado en Windows. Puede comprobarse desde `services.msc` o con la herramienta proporcionada por su instalador.

## 2. Crear la base local

Desde MySQL:

```sql
CREATE DATABASE IF NOT EXISTS crevantia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

La configuración actual solicitada usa `root` sin contraseña solamente en desarrollo local. Para cualquier ambiente compartido se debe crear un usuario exclusivo.

## 3. Configurar variables

Copia los ejemplos si los archivos locales no existen:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Para la instancia local indicada, la conexión es:

```env
DATABASE_URL=mysql://root:@127.0.0.1:3306/crevantia
```

No subas `backend/.env` ni `frontend/.env.local` al repositorio.

## 4. Instalar y preparar la base

Desde la raíz:

```powershell
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

En una base que ya tiene la migración, `npm run db:migrate` detectará que está actualizada. El seed es idempotente.

## 5. Iniciar las aplicaciones

```powershell
npm run dev
```

El comando raíz inicia simultáneamente Next.js en el puerto 3000 y NestJS en el 4000. MySQL continúa ejecutándose como servicio nativo independiente.

## 6. Comprobar

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/v1/health
```

Después abre `http://localhost:3000`.

## Flujo de cambios de base de datos

1. Modifica `backend/prisma/schema.prisma`.
2. Ejecuta `npm run db:migrate -- --name descripcion_breve`.
3. Revisa el SQL nuevo en `backend/prisma/migrations/`.
4. Ejecuta `npm run db:generate` y las validaciones.
5. Versiona el esquema y la migración en el mismo cambio.
