import "dotenv/config";
import * as argon2 from "argon2";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  PrismaClient,
  type Prisma,
  QuestionType,
  TestVersionStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import { seedDpoOfficialV1 } from "./seeds/seed-dpo-official-v1";
import { dpoPermissions } from "./seeds/seed-dpo-permissions";
import { PROVISIONAL_REPORT_TEXT_BLOCKS } from "../src/modules/site-settings/provisional-report-defaults";

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
  "payments.read": "Consultar pagos y transacciones.",
  "payments.manage": "Gestionar y conciliar pagos.",
  "pricing.manage": "Administrar precios, impuestos y catálogo comercial.",
  "coupons.manage": "Crear, activar y administrar cupones de descuento.",
  "payments.refund": "Emitir y procesar reembolsos de compras.",
  "settings.update": "Modificar ajustes generales.",
  "settings.manage": "Administrar ajustes del sistema, pasarelas y finanzas.",
  "mail.settings.manage": "Configurar y probar el servidor de correo.",
  "stripe.settings.manage": "Configurar y probar la pasarela Stripe.",
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
            "settings.manage",
            "mail.settings.manage",
            "stripe.settings.manage",
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
  const password = process.env.ADMIN_PASSWORD ?? "Admin123*!";

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

async function seedCommerce() {
  await prisma.financialSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      currency: "MXN",
      decimalPlaces: 2,
      taxName: "IVA",
      taxRatePercent: 16.0,
      pricesIncludeTax: false,
    },
  });

  await prisma.mailSettings.upsert({
    where: { id: "smtp" },
    update: {},
    create: {
      id: "smtp",
      enabled: false,
      host: "smtp.ejemplo.com",
      port: 587,
      secure: false,
      fromName: "Crevantia",
      fromAddress: "contacto@crevantia.com",
    },
  });

  await prisma.stripeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      enabled: false,
      mode: "test",
      publishableKey: "",
    },
  });

  const test =
    (await prisma.test.findFirst({ where: { code: "DPO" } })) ||
    (await prisma.test.findFirst({ where: { code: "DEMO-TEST" } }));

  const assessment = await prisma.assessment.findFirst({
    where: { code: { in: ["DPO", "DPO_PRO", "DPO-PRO"] } },
  });

  if (test) {
    const defaultFeatures = [
      "1 acceso individual a la evaluación",
      "Aplicación en línea",
      "Resultados procesados automáticamente",
      "Reporte personal en PDF",
      "Acceso posterior desde tu cuenta",
    ];

    const product = await prisma.evaluationProduct.upsert({
      where: { code: "DPO-PRO" },
      update: {
        name: "Evaluación DPO-PRO",
        slug: "dpo-pro",
        testId: test.id,
        assessmentId: assessment?.id ?? null,
        features: defaultFeatures,
      },
      create: {
        code: "DPO-PRO",
        slug: "dpo-pro",
        name: "Evaluación DPO-PRO",
        shortDescription:
          "Evaluación psicométrica integral con baremo estandarizado para líderes y directivos.",
        description:
          "Diagnóstico profundo de competencias y potencial para toma de decisiones, liderazgo y ejecución estratégica.",
        features: defaultFeatures,
        testId: test.id,
        assessmentId: assessment?.id ?? null,
        isActive: true,
        sortOrder: 1,
      },
    });

    const activePrice = await prisma.priceVersion.findFirst({
      where: { productId: product.id, isActive: true },
    });

    if (!activePrice) {
      await prisma.priceVersion.create({
        data: {
          productId: product.id,
          amountCents: 220000,
          currency: "MXN",
          effectiveFrom: new Date("2026-01-01"),
          isActive: true,
        },
      });
    }
  }

  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {},
    create: {
      code: "BIENVENIDA10",
      description: "10% de descuento de bienvenida en tu primera evaluación.",
      discountType: "PERCENTAGE",
      discountValue: 10.0,
      minPurchaseAmountCents: 0,
      maxUsesGlobal: 500,
      maxUsesPerUser: 1,
      isActive: true,
    },
  });
}

async function seedSiteSettings() {
  const logo = Uint8Array.from(await readFile(resolve(__dirname, "../../frontend/public/branding/logo-crevantia.png")));
  const active = await prisma.assessmentActiveConfiguration.findFirst({ select: { normVersionId: true } });
  const targets = active ? await prisma.normTarget.findMany({ where: { normVersionId: active.normVersionId }, orderBy: [{ targetType: "asc" }, { targetCode: "asc" }] }) : [];
  const mappings = targets.map((target) => ({
    targetType: target.targetType,
    targetCode: target.targetCode,
    displayName: target.name,
    section: reportSectionFor(target.targetType),
  }));
  const categories = [
    { label: "Brisa", description: "Intensidad baja dentro de la escala interpretativa.", color: "#55b6c7" },
    { label: "Viento", description: "Intensidad moderada dentro de la escala interpretativa.", color: "#4b8fd3" },
    { label: "Ráfaga", description: "Intensidad alta dentro de la escala interpretativa.", color: "#6a5acd" },
    { label: "Huracán", description: "Intensidad muy alta dentro de la escala interpretativa.", color: "#302b78" },
  ];
  const existing = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  if (!existing) {
    await prisma.siteSettings.create({ data: {
      id: "default", reportDefaultsVersion: 1,
      siteName: "Crevantia", siteDescription: "Plataforma de evaluaciones Crevantia",
      logoData: logo, logoMimeType: "image/png", faviconData: logo, faviconMimeType: "image/png",
      reportLogoData: logo, reportLogoMimeType: "image/png", contactEmail: "contacto@crevantia.com",
      reportBrandName: "PsicoFinanzas", reportPromoTitle: "Prospera©",
      reportPromoText: PROVISIONAL_REPORT_TEXT_BLOCKS[5]?.content ?? null,
      reportPromoUrl: "https://www.psicofinanzas.com",
      reportIntroduction: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(1, 3).map((block) => block.content).join("\n\n"),
      reportInterpretation: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(3, 5).map((block) => block.content).join("\n\n"),
      reportCategories: asJson(categories), reportDisplayMappings: asJson(mappings), reportTextBlocks: asJson(PROVISIONAL_REPORT_TEXT_BLOCKS),
    }});
    return;
  }
  await prisma.siteSettings.update({ where: { id: "default" }, data: {
    ...(!existing.logoData ? { logoData: logo, logoMimeType: "image/png" } : {}),
    ...(!existing.faviconData ? { faviconData: logo, faviconMimeType: "image/png" } : {}),
    ...(!existing.reportLogoData ? { reportLogoData: logo, reportLogoMimeType: "image/png" } : {}),
    ...(!existing.reportCategories ? { reportCategories: asJson(categories) } : {}),
    ...(!existing.reportDisplayMappings ? { reportDisplayMappings: asJson(mappings) } : {}),
    ...(!existing.reportTextBlocks ? { reportTextBlocks: asJson(PROVISIONAL_REPORT_TEXT_BLOCKS) } : {}),
  }});
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function reportSectionFor(targetType: string) {
  if (targetType === "SCALE") return "20 precursores de comportamiento";
  if (targetType === "COMPOSITE") return "Capacidades y dimensiones financieras";
  if (targetType === "DERIVED_METRIC") return "Habilidad y potencial financiero";
  if (targetType.startsWith("LIKERT")) return "Cuadrantes de realización";
  return "Resultados del reporte";
}

async function main() {
  await seedIdentity();
  await seedDemoTest();
  await seedDpoOfficialV1(prisma);
  await seedCommerce();
  await seedSiteSettings();
  console.log("Seed de Crevantia completado.");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
