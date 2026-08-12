# Correo SMTP y seguridad de cuentas

## Configurar SMTP

1. Inicia sesión como superadministrador.
2. Abre **Configuración → Servidor de correo SMTP**.
3. Captura host, puerto, usuario, contraseña y remitente.
4. Guarda la configuración.
5. Usa **Probar conexión y envío**.

La prueba valida conexión, TLS y autenticación, y después envía un mensaje al correo configurado como remitente. Esto es más completo que comprobar únicamente la conexión.

Configuraciones habituales:

- Puerto `587`: deja **SSL/TLS directo** desactivado; el cliente negociará STARTTLS cuando el servidor lo soporte.
- Puerto `465`: activa **SSL/TLS directo**.
- Relay interno sin autenticación: deja usuario y contraseña vacíos solamente si el servidor lo permite.

No desactives la validación de certificados TLS en producción.

## Protección de credenciales

- La contraseña SMTP se cifra en MySQL mediante AES-256-GCM.
- `ENCRYPTION_KEY` vive en `backend/.env`, no en la base ni en el repositorio.
- El API nunca devuelve la contraseña cifrada ni descifrada.
- El formulario solo indica si existe una contraseña guardada.
- Cambiar `ENCRYPTION_KEY` sin recifrar previamente hará ilegible la contraseña SMTP existente.
- Los cambios y pruebas SMTP producen registros de auditoría.

## Confirmación de cuenta

1. El registro crea la cuenta en `PENDING_VERIFICATION`.
2. Se genera un token aleatorio válido durante 24 horas.
3. MySQL conserva únicamente el hash SHA-256 del token.
4. El correo contiene el enlace `/verificar-correo?token=...`.
5. Al utilizarlo, el token se consume y la cuenta pasa a `ACTIVE`.
6. Un token usado o vencido no puede reutilizarse.

Mientras SMTP esté deshabilitado, la cuenta se crea pero el usuario deberá solicitar un nuevo enlace después de configurar el servidor.

## Recuperación de contraseña

1. `/recuperar-contrasena` solicita el correo.
2. La respuesta pública es idéntica exista o no la cuenta.
3. El enlace de recuperación dura 60 minutos y es de un solo uso.
4. Al cambiar la contraseña se revocan todas las sesiones abiertas.
5. La contraseña nueva se almacena con Argon2id.

## Endpoints

```txt
POST  /api/v1/auth/verify-email
POST  /api/v1/auth/resend-verification
POST  /api/v1/auth/forgot-password
POST  /api/v1/auth/reset-password
GET   /api/v1/admin/settings/mail
PATCH /api/v1/admin/settings/mail
POST  /api/v1/admin/settings/mail/test
```

Los tres endpoints administrativos requieren el rol `SUPERADMIN`.

