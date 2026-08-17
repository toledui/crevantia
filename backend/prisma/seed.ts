import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  PrismaClient,
  QuestionType,
  TestVersionStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import { seedDpo } from "./seeds/seed-dpo";
import { dpoPermissions } from "./seeds/seed-dpo-permissions";

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
    connectionLimit: 5,
  });
}

const prisma = new PrismaClient({ adapter: databaseAdapter() });

const permissions = {
  "admin.access": "Acceder al panel administrativo.",
  "dashboard.read": "Consultar el resumen ejecutivo.",
  "users.read": "Consultar usuarios.",
  "users.create": "Crear usuarios.",
  "users.update": "Editar usuarios.",
  "users.disable": "Deshabilitar usuarios.",
  "assignments.create": "Crear asignaciones de evaluaciones.",
  "attempts.read": "Consultar intentos de evaluación.",
  "attempts.monitor": "Supervisar evaluaciones en curso.",
  "results.read": "Consultar resultados.",
  "reports.download": "Descargar reportes.",
  "payments.read": "Consultar pagos.",
  "settings.update": "Modificar ajustes generales.",
  "mail.settings.manage": "Configurar y probar el servidor de correo.",
  "logs.read": "Consultar registros técnicos y auditoría.",
  "roles.manage": "Crear roles y asignar permisos.",
  "tests.read": "Consultar pruebas, versiones, secciones y reactivos.",
  "tests.manage": "Crear y editar pruebas y versiones en borrador.",
  "tests.import": "Importar contenido de pruebas desde archivos autorizados.",
  "tests.publish": "Publicar y archivar versiones de pruebas.",
  ...dpoPermissions,
} as const;

async function seedIdentity() {
  for (const [code, description] of Object.entries(permissions)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const superadmin = await prisma.role.upsert({
    where: { code: "SUPERADMIN" },
    update: {
      name: "Superadministrador",
      description: "Control total de la plataforma y sus ajustes.",
    },
    create: {
      code: "SUPERADMIN",
      name: "Superadministrador",
      description: "Control total de la plataforma y sus ajustes.",
      isSystem: true,
    },
  });
  const admin = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: {
      name: "Administrador",
      description: "Operación diaria sin acceso a ajustes críticos.",
    },
    create: {
      code: "ADMIN",
      name: "Administrador",
      description: "Operación diaria sin acceso a ajustes críticos.",
      isSystem: true,
    },
  });
  await prisma.role.upsert({
    where: { code: "USER" },
    update: {
      name: "Usuario",
      description: "Acceso al panel personal y sus evaluaciones.",
    },
    create: {
      code: "USER",
      name: "Usuario",
      description: "Acceso al panel personal y sus evaluaciones.",
      isSystem: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: superadmin.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: allPermissions
      .filter(
        (permission) =>
          ![
            "settings.update",
            "mail.settings.manage",
            "roles.manage",
            "tests.publish",
            "scoring.manage",
            "norm.approve",
            "norm.publish",
            "norm.archive",
            "result.recalculate",
            "result.audit",
          ].includes(permission.code),
      )
      .map((permission) => ({ roleId: admin.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const email = (
    process.env.ADMIN_EMAIL ?? "contacto@crevantia.com"
  ).toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password)
    throw new Error("ADMIN_PASSWORD es obligatorio para ejecutar el seed.");

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName: "Equipo",
      lastName: "Crevantia",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      firstName: "Equipo",
      lastName: "Crevantia",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superadmin.id } },
    update: {},
    create: { userId: user.id, roleId: superadmin.id },
  });
}

async function seedDemoTest() {
  const test = await prisma.test.upsert({
    where: { code: "DPO-PRO" },
    update: {},
    create: {
      code: "DPO-PRO",
      slug: "dpo-pro",
      name: "DPO-PRO",
      description:
        "Instrumento demostrativo. Su contenido no está validado científicamente.",
    },
  });

  const existing = await prisma.testVersion.findUnique({
    where: { testId_version: { testId: test.id, version: 1 } },
  });
  if (existing) return;

  await prisma.testVersion.create({
    data: {
      testId: test.id,
      version: 1,
      status: TestVersionStatus.PUBLISHED,
      language: "es-MX",
      estimatedMin: 35,
      publishedAt: new Date(),
      labels: {
        disclaimer: "ENTORNO DE DEMOSTRACIÓN — RESULTADOS NO VÁLIDOS",
        likert: [
          "Falso completamente",
          "Moderadamente falso",
          "Ni falso ni verdadero",
          "Moderadamente verdadero",
          "Verdadero completamente",
        ],
      },
      sections: {
        create: [
          {
            code: "CONTROL",
            title: "Control estadístico",
            order: 1,
            instructions: "Datos demostrativos configurables.",
            questions: {
              create: [
                {
                  code: "DEMO-AGE",
                  type: QuestionType.NUMBER,
                  prompt: "Edad",
                  order: 1,
                  config: { min: 24, max: 65 },
                },
              ],
            },
          },
          {
            code: "POSITIVE-PAIRS",
            title: "Afirmaciones positivas",
            order: 2,
            instructions: "Elige la afirmación que más y menos te representa.",
            questions: {
              create: [
                {
                  code: "DEMO-PAIR-1",
                  type: QuestionType.PAIRED,
                  prompt: "Selecciona una opción en cada columna.",
                  order: 1,
                  statements: {
                    create: [
                      {
                        code: "A",
                        text: "Organizo mis tareas con anticipación.",
                        order: 1,
                      },
                      {
                        code: "B",
                        text: "Me adapto con facilidad a los cambios.",
                        order: 2,
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            code: "LIKERT",
            title: "Escala de opinión",
            order: 3,
            instructions:
              "Indica qué tan verdadera es cada afirmación para ti.",
            questions: {
              create: [
                {
                  code: "DEMO-LIKERT-1",
                  type: QuestionType.LIKERT,
                  prompt:
                    "Puedo mantener la concentración cuando una tarea es extensa.",
                  order: 1,
                  answerOptions: {
                    create: [1, 2, 3, 4, 5].map((value) => ({
                      value: String(value),
                      label: String(value),
                      order: value,
                    })),
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
}

async function main() {
  await seedIdentity();
  await seedDemoTest();
  await seedDpo(prisma);
  console.log("Seed de Crevantia completado.");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
