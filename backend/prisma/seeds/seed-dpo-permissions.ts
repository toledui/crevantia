import { PrismaClient } from "../../src/generated/prisma/client";

export const dpoPermissions = {
  "assessment.read": "Consultar evaluaciones y sus versiones.",
  "assessment.manage": "Administrar evaluaciones y contenido.",
  "scoring.read": "Consultar configuración de puntuación.",
  "scoring.manage": "Administrar claves de puntuación.",
  "norm.read": "Consultar normas y baremos.",
  "norm.create": "Crear y clonar versiones de normas.",
  "norm.edit": "Editar versiones de normas en borrador.",
  "norm.review": "Enviar y revisar normas.",
  "norm.approve": "Aprobar normas revisadas.",
  "norm.publish": "Publicar nuevas versiones normativas.",
  "norm.archive": "Archivar versiones normativas.",
  "result.read": "Consultar resultados detallados.",
  "result.recalculate": "Crear recalificaciones sin sobrescribir resultados.",
  "result.audit": "Consultar trazabilidad por reactivo.",
} as const;

export const restrictedAdminDpoPermissions = new Set([
  "scoring.manage",
  "norm.approve",
  "norm.publish",
  "norm.archive",
  "result.recalculate",
  "result.audit",
]);

export async function seedDpoPermissions(prisma: PrismaClient) {
  for (const [code, description] of Object.entries(dpoPermissions)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  const [superadmin, admin, permissions] = await Promise.all([
    prisma.role.findUnique({ where: { code: "SUPERADMIN" } }),
    prisma.role.findUnique({ where: { code: "ADMIN" } }),
    prisma.permission.findMany({
      where: { code: { in: Object.keys(dpoPermissions) } },
    }),
  ]);

  if (!superadmin || !admin) {
    throw new Error(
      "Los roles SUPERADMIN y ADMIN deben existir antes de ejecutar el seed DPO.",
    );
  }

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: superadmin.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: permissions
      .filter(
        (permission) => !restrictedAdminDpoPermissions.has(permission.code),
      )
      .map((permission) => ({
        roleId: admin.id,
        permissionId: permission.id,
      })),
    skipDuplicates: true,
  });

  const [superadminGrants, adminGrants] = await Promise.all([
    prisma.rolePermission.count({
      where: {
        roleId: superadmin.id,
        permission: { code: { in: Object.keys(dpoPermissions) } },
      },
    }),
    prisma.rolePermission.count({
      where: {
        roleId: admin.id,
        permission: { code: { in: Object.keys(dpoPermissions) } },
      },
    }),
  ]);

  console.log("[DPO permission report]", {
    permissions: permissions.length,
    superadminGrants,
    adminGrants,
  });
}
