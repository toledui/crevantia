# Administración de usuarios

El CRUD administrativo está disponible en `/admin/usuarios`.

## Funciones

- Buscar y filtrar cuentas por estado.
- Crear usuarios y asignarles uno o más roles.
- Editar nombre, apellidos, correo y roles.
- Activar o deshabilitar cuentas.
- Reenviar invitaciones.
- Revocar sesiones cuando cambian los accesos o el estado.

La eliminación es lógica: una cuenta se deshabilita para conservar auditoría, asignaciones y resultados relacionados.

## Invitaciones

Las contraseñas nunca se envían por correo. Al crear una cuenta se genera una contraseña interna aleatoria que nadie conoce y un enlace de un solo uso para que la persona establezca su contraseña. El enlace caduca en 48 horas.

Si SMTP no está configurado, la cuenta queda creada y el administrador puede reenviar la invitación posteriormente desde la tabla de usuarios.

## Protecciones

- Un administrador no puede deshabilitar su propia cuenta.
- Siempre debe permanecer al menos un superadministrador activo.
- Solo quien tenga `roles.manage` puede cambiar roles de una cuenta existente.
- Un administrador no puede conceder permisos que él mismo no posee.
