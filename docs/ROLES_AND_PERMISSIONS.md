# Roles y permisos

La administración de accesos está disponible en `/admin/configuracion/roles`.

## Modelo

- Los permisos representan acciones implementadas por el sistema, por ejemplo `users.read` o `mail.settings.manage`.
- Los roles agrupan uno o más permisos.
- Un usuario puede tener varios roles; sus permisos efectivos son la unión de todos ellos.
- Los permisos efectivos se incluyen en el access token y se actualizan al renovar la sesión.

## Roles del sistema

- `SUPERADMIN`: conserva todos los permisos y no puede editarse ni eliminarse.
- `ADMIN`: puede editar sus permisos, pero no puede eliminarse.
- `USER`: puede editar sus permisos, pero no puede eliminarse.

Los roles personalizados pueden crearse y eliminarse. No se permite eliminar un rol personalizado mientras tenga usuarios asignados.

## Incorporar módulos nuevos

Cada módulo debe declarar permisos estables en `backend/prisma/seed.ts`, proteger sus endpoints con `@Permissions(...)` y ejecutar `npm run db:seed` después del despliegue. Los permisos aparecen automáticamente en el editor de roles.

Los códigos de permiso no se crean manualmente desde el panel: únicamente deben existir cuando hay una acción real en el backend que los aplica.
