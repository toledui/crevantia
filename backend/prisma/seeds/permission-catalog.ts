import { dpoPermissions, restrictedAdminDpoPermissions } from "./seed-dpo-permissions";

/**
 * Catálogo único de capacidades configurables desde el editor de roles.
 * Todo permiso aplicado por un controlador o servicio debe declararse aquí.
 */
export const permissionCatalog = {
  "admin.access": "Acceder al panel administrativo.",
  "dashboard.read": "Consultar el resumen ejecutivo.",
  "users.read": "Consultar usuarios.",
  "users.create": "Crear usuarios.",
  "users.update": "Editar usuarios.",
  "users.disable": "Activar y deshabilitar usuarios.",
  "assignments.create": "Crear, reenviar y revocar asignaciones de evaluaciones.",
  "attempts.read": "Consultar intentos de evaluación.",
  "attempts.monitor": "Finalizar intentos de otros usuarios durante la supervisión.",
  "attempts.manage": "Reabrir intentos pausados o interrumpidos.",
  "payments.read": "Consultar pedidos, pagos y transacciones.",
  "pricing.manage": "Administrar productos, precios, impuestos y catálogo comercial.",
  "coupons.manage": "Crear, activar y administrar cupones de descuento.",
  "payments.refund": "Emitir y procesar reembolsos de compras.",
  "settings.update": "Modificar identidad, contacto, reportes, finanzas y documentos legales.",
  "settings.manage": "Administrar código personalizado y otros ajustes críticos del sistema.",
  "mail.settings.manage": "Configurar y probar el servidor de correo.",
  "stripe.settings.manage": "Configurar y probar la pasarela Stripe.",
  "roles.manage": "Crear roles y asignar permisos sin exceder los accesos propios.",
  "system.health.read": "Consultar el estado técnico del servidor.",
  "report_studio.manage": "Diseñar, versionar, publicar y generar plantillas de Report Studio.",
  "tests.read": "Consultar pruebas, versiones, secciones y reactivos.",
  "tests.manage": "Crear y editar pruebas y versiones en borrador.",
  "tests.import": "Importar contenido de pruebas desde archivos autorizados.",
  "tests.publish": "Publicar y archivar versiones de pruebas.",
  ...dpoPermissions,
} as const;

export type PermissionCode = keyof typeof permissionCatalog;

/** Permisos que el rol ADMIN no recibe de forma predeterminada. */
export const restrictedAdminPermissions = new Set<PermissionCode>([
  "settings.update",
  "settings.manage",
  "mail.settings.manage",
  "stripe.settings.manage",
  "roles.manage",
  "report_studio.manage",
  "tests.publish",
  "system.health.read",
  ...([...restrictedAdminDpoPermissions] as PermissionCode[]),
]);

/** Códigos históricos sin una acción configurable vigente. */
export const deprecatedPermissionCodes = [
  "results.read",
  "reports.download",
  "payments.manage",
  "logs.read",
] as const;
