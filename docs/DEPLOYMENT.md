# Despliegue en VPS sin Docker

Este procedimiento usa servicios instalados directamente en Ubuntu/Debian:

- Node.js 24 LTS y npm.
- MySQL 8.
- Nginx.
- `systemd` para administrar frontend y backend.
- Certbot para TLS.

Los ejemplos asumen:

- Código en `/var/www/crevantia`.
- Usuario de sistema `crevantia`.
- Dominio `crevantia.example.com`; reemplázalo por el dominio real.
- Frontend en `127.0.0.1:3000` y backend en `127.0.0.1:4000`.

## 1. Preparar el servidor

Actualiza el sistema e instala MySQL, Nginx y herramientas básicas usando el gestor de paquetes de la distribución. Instala Node.js 24 desde una fuente oficial compatible con tu distribución; npm se instala junto con Node.js:

```bash
node --version
npm --version
```

Crea un usuario sin acceso administrativo habitual:

```bash
sudo adduser --system --group --home /var/www/crevantia crevantia
sudo mkdir -p /var/www/crevantia
sudo chown -R crevantia:crevantia /var/www/crevantia
```

Configura el firewall para permitir únicamente SSH, HTTP y HTTPS. Los puertos 3000, 4000 y 3306 no deben exponerse públicamente.

## 2. Preparar MySQL

Abre MySQL como administrador y crea una cuenta exclusiva:

```sql
CREATE DATABASE crevantia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'crevantia_app'@'127.0.0.1'
  IDENTIFIED BY 'REEMPLAZAR_CON_PASSWORD_ALEATORIO_LARGO';

GRANT ALL PRIVILEGES ON crevantia.*
  TO 'crevantia_app'@'127.0.0.1';

FLUSH PRIVILEGES;
```

No uses `root` desde la aplicación. MySQL debe escuchar solamente en loopback cuando no haya una razón explícita para acceso remoto.

## 3. Instalar el código

Como usuario de despliegue, coloca el repositorio en `/var/www/crevantia`. Después:

```bash
cd /var/www/crevantia
npm ci
```

## 4. Variables de producción

Crea `/var/www/crevantia/backend/.env` con permisos `600`:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=mysql://crevantia_app:PASSWORD_URL_ENCODED@127.0.0.1:3306/crevantia
FRONTEND_URL=https://crevantia.example.com
JWT_ACCESS_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
JWT_REFRESH_SECRET=OTRO_SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
ENCRYPTION_KEY=TERCER_SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=7
MAIL_PROVIDER=smtp
MAIL_FROM_NAME=Crevantia
MAIL_FROM_ADDRESS=no-reply@crevantia.example.com
SMTP_HOST=127.0.0.1
SMTP_PORT=587
STORAGE_DRIVER=local
STORAGE_BUCKET=/var/lib/crevantia/private
ADMIN_EMAIL=contacto@crevantia.com
ADMIN_PASSWORD=PASSWORD_INICIAL_ALEATORIO
```

Genera secretos con una herramienta criptográficamente segura, por ejemplo `openssl rand -hex 32`. Codifica caracteres especiales del password MySQL para una URL.

Crea `/var/www/crevantia/frontend/.env.local` antes de compilar:

```env
NEXT_PUBLIC_APP_URL=https://crevantia.example.com
NEXT_PUBLIC_API_URL=/api/v1
BACKEND_INTERNAL_URL=http://127.0.0.1:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Protege los archivos:

```bash
sudo chown crevantia:crevantia backend/.env frontend/.env.local
sudo chmod 600 backend/.env frontend/.env.local
```

## 5. Migrar y compilar

```bash
cd /var/www/crevantia
npm run db:generate
npm run db:status
npm run db:deploy
npm run build
```

En el primer despliegue únicamente, ejecuta:

```bash
npm run db:seed
```

El seed crea roles, permisos, el administrador inicial y datos demostrativos. Cambia la contraseña administrativa después del primer acceso. En despliegues posteriores no uses el seed como sustituto de una migración.

`npm run db:deploy` ejecuta `prisma migrate deploy`: aplica solamente los archivos SQL versionados y nunca genera migraciones nuevas en producción.

## 6. Servicios systemd

Copia y adapta las plantillas de `deploy/systemd/`. Primero encuentra la ruta real de npm:

```bash
command -v npm
```

Si no es `/usr/bin/npm`, cambia `ExecStart` en ambas unidades.

```bash
sudo cp deploy/systemd/crevantia-backend.service /etc/systemd/system/
sudo cp deploy/systemd/crevantia-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now crevantia-backend crevantia-frontend
sudo systemctl status crevantia-backend
sudo systemctl status crevantia-frontend
```

Logs:

```bash
journalctl -u crevantia-backend -f
journalctl -u crevantia-frontend -f
```

## 7. Nginx

Copia la plantilla y reemplaza el dominio:

```bash
sudo cp deploy/nginx/crevantia.conf /etc/nginx/sites-available/crevantia
sudo ln -s /etc/nginx/sites-available/crevantia /etc/nginx/sites-enabled/crevantia
sudo nginx -t
sudo systemctl reload nginx
```

La ruta `/api/` se envía al backend y el resto al frontend. Nginx es el único servicio web expuesto.

## 8. HTTPS

Después de apuntar el DNS al VPS:

```bash
sudo certbot --nginx -d crevantia.example.com
sudo systemctl status certbot.timer
```

Verifica que HTTP redirija a HTTPS y que la cookie de refresh tenga `Secure`.

## 9. Comprobación posterior

```bash
curl --fail https://crevantia.example.com/api/v1/health
systemctl is-active crevantia-backend crevantia-frontend nginx mysql
npm run db:status
```

Prueba login, cierre de sesión y acceso administrativo desde el navegador.

## 10. Actualizaciones

Antes de cada actualización realiza respaldo de MySQL. Después:

```bash
cd /var/www/crevantia
git pull --ff-only
npm ci
npm run db:generate
npm run db:deploy
npm run build
sudo systemctl restart crevantia-backend crevantia-frontend
curl --fail https://crevantia.example.com/api/v1/health
```

Nunca ejecutes `prisma migrate dev` ni `prisma db push` en producción.

## 11. Respaldo y recuperación

Programa respaldos con `mysqldump --single-transaction`, cifra el archivo y cópialo a una ubicación externa al VPS. Prueba periódicamente una restauración en un ambiente aislado.

Conserva también los archivos privados generados por la aplicación. Un respaldo de base de datos sin los reportes privados no constituye una recuperación completa.

## 12. Rollback

Las migraciones Prisma son progresivas. No reviertas una migración aplicada eliminando registros de `_prisma_migrations`.

Si una versión falla:

1. Conserva el respaldo previo.
2. Restaura el código anterior.
3. Reinicia ambos servicios.
4. Si la migración fue destructiva y no admite compatibilidad hacia atrás, restaura MySQL desde el respaldo en una ventana controlada.

Para reducir riesgo, los cambios de esquema deben ser compatibles hacia atrás y dividir eliminaciones o renombres en varios despliegues.
