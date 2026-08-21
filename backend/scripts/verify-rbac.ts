import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  deprecatedPermissionCodes,
  permissionCatalog,
  restrictedAdminPermissions,
  type PermissionCode,
} from "../prisma/seeds/permission-catalog";

function databaseAdapter() {
  const url = new URL(
    process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/crevantia",
  );
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 2,
  });
}

const prisma = new PrismaClient({ adapter: databaseAdapter() });

async function main() {
  const catalogCodes = Object.keys(permissionCatalog) as PermissionCode[];
  const [roles, permissions, deprecated] = await Promise.all([
    prisma.role.findMany({
      where: { code: { in: ["SUPERADMIN", "ADMIN", "USER"] } },
      include: { permissions: { include: { permission: true } } },
    }),
    prisma.permission.findMany({ where: { code: { in: catalogCodes } } }),
    prisma.permission.findMany({
      where: { code: { in: [...deprecatedPermissionCodes] } },
      select: { code: true },
    }),
  ]);

  const byCode = new Map(roles.map((role) => [role.code, role]));
  const missingRoles = ["SUPERADMIN", "ADMIN", "USER"].filter(
    (code) => !byCode.has(code),
  );
  const nonSystemRoles = roles.filter((role) => !role.isSystem).map((role) => role.code);
  const storedCodes = new Set(permissions.map(({ code }) => code));
  const missingPermissions = catalogCodes.filter((code) => !storedCodes.has(code));
  const grants = (roleCode: string) =>
    new Set(
      byCode
        .get(roleCode)
        ?.permissions.map(({ permission }) => permission.code) ?? [],
    );
  const superadminGrants = grants("SUPERADMIN");
  const adminGrants = grants("ADMIN");
  const userGrants = grants("USER");
  const missingSuperadminGrants = catalogCodes.filter(
    (code) => !superadminGrants.has(code),
  );
  const forbiddenAdminGrants = [...restrictedAdminPermissions].filter((code) =>
    adminGrants.has(code),
  );

  const problems = {
    missingRoles,
    nonSystemRoles,
    missingPermissions,
    deprecatedPermissions: deprecated.map(({ code }) => code),
    missingSuperadminGrants,
    forbiddenAdminGrants,
    userAdministrativeGrants: [...userGrants],
  };
  const failures = Object.values(problems).flat();

  console.log("[RBAC verification]", {
    catalogPermissions: catalogCodes.length,
    superadminGrants: superadminGrants.size,
    adminGrants: adminGrants.size,
    userGrants: userGrants.size,
    problems,
  });

  if (failures.length) throw new Error("La configuración RBAC no coincide con el catálogo oficial.");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
