import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  Prisma,
  PrismaClient,
  ReportStudioStatus,
} from "../../src/generated/prisma/client";

interface ReportStudioSnapshot {
  schemaVersion: string;
  sourceVersion: string;
  seedVersion: string;
  template: { code: string; name: string; description?: string | null };
  theme: { code: string; name: string; configJson: unknown } | null;
  layoutJson: unknown;
  bindingConfigJson: unknown;
  pendingBindings: number;
  classificationSets: Array<{
    code: string;
    name: string;
    description?: string | null;
    ranges: Array<{
      minValue: number;
      maxValue: number;
      label: string;
      color?: string | null;
      sortOrder: number;
    }>;
  }>;
  assets: Array<{
    id: string;
    name: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
    dataBase64: string;
  }>;
}

const snapshotPath = resolve(
  __dirname,
  "data/report-studio-dpo-ppf.initial-v1.json",
);

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadSnapshot() {
  return JSON.parse(
    await readFile(snapshotPath, "utf8"),
  ) as ReportStudioSnapshot;
}

export async function seedReportStudioV1(prisma: PrismaClient) {
  const snapshot = await loadSnapshot();
  if (!snapshot.theme) throw new Error("REPORT_STUDIO_SEED_THEME_MISSING");

  const theme = await prisma.reportTheme.upsert({
    where: { code: snapshot.theme.code },
    update: {
      name: snapshot.theme.name,
      configJson: asJson(snapshot.theme.configJson),
    },
    create: {
      code: snapshot.theme.code,
      name: snapshot.theme.name,
      configJson: asJson(snapshot.theme.configJson),
    },
  });

  for (const item of snapshot.classificationSets) {
    const set = await prisma.reportClassificationSet.upsert({
      where: { code: item.code },
      update: { name: item.name, description: item.description ?? null },
      create: {
        code: item.code,
        name: item.name,
        description: item.description ?? null,
      },
    });
    await prisma.reportClassificationRange.deleteMany({
      where: { reportClassificationSetId: set.id },
    });
    if (item.ranges.length) {
      await prisma.reportClassificationRange.createMany({
        data: item.ranges.map((range) => ({
          reportClassificationSetId: set.id,
          minValue: range.minValue,
          maxValue: range.maxValue,
          label: range.label,
          color: range.color ?? null,
          sortOrder: range.sortOrder,
        })),
      });
    }
  }

  for (const asset of snapshot.assets) {
    const data = Buffer.from(asset.dataBase64, "base64");
    await prisma.reportAsset.upsert({
      where: { id: asset.id },
      update: {
        themeId: theme.id,
        name: asset.name,
        mimeType: asset.mimeType,
        data,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
      },
      create: {
        id: asset.id,
        themeId: theme.id,
        name: asset.name,
        mimeType: asset.mimeType,
        data,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
      },
    });
  }

  const template = await prisma.reportTemplate.upsert({
    where: { code: snapshot.template.code },
    update: {
      name: snapshot.template.name,
      description: snapshot.template.description ?? null,
    },
    create: {
      code: snapshot.template.code,
      name: snapshot.template.name,
      description: snapshot.template.description ?? null,
      status: ReportStudioStatus.DRAFT,
    },
  });

  const configurationHash = createHash("sha256")
    .update(
      JSON.stringify({
        layout: snapshot.layoutJson,
        bindings: snapshot.bindingConfigJson,
      }),
    )
    .digest("hex");
  const currentPublished = await prisma.reportTemplateVersion.findFirst({
    where: {
      reportTemplateId: template.id,
      status: ReportStudioStatus.PUBLISHED,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  const seedVersion = await prisma.reportTemplateVersion.findUnique({
    where: {
      reportTemplateId_version: {
        reportTemplateId: template.id,
        version: snapshot.seedVersion,
      },
    },
  });

  let publishedVersion = currentPublished;
  if (
    !currentPublished &&
    (!seedVersion || seedVersion.status === ReportStudioStatus.DRAFT)
  ) {
    const data = {
      status: ReportStudioStatus.PUBLISHED,
      themeId: theme.id,
      layoutJson: asJson(snapshot.layoutJson),
      bindingConfigJson: asJson(snapshot.bindingConfigJson),
      pendingBindings: snapshot.pendingBindings,
      configurationHash,
      publishedAt: new Date(),
    };
    publishedVersion = seedVersion
      ? await prisma.reportTemplateVersion.update({
          where: { id: seedVersion.id },
          data,
        })
      : await prisma.reportTemplateVersion.create({
          data: {
            reportTemplateId: template.id,
            version: snapshot.seedVersion,
            ...data,
          },
        });
  }

  if (!publishedVersion) {
    throw new Error(
      `REPORT_STUDIO_SEED_CANNOT_PUBLISH:${template.code}:${snapshot.seedVersion}`,
    );
  }

  await prisma.reportTemplate.update({
    where: { id: template.id },
    data: { status: ReportStudioStatus.PUBLISHED },
  });

  const [dpoTest, dpoAssessment] = await Promise.all([
    prisma.test.findFirst({
      where: { code: { in: ["DPO", "DPO_PRO", "DPO-PRO"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assessment.findUnique({ where: { code: "DPO_PRO" } }),
  ]);
  if (dpoTest) {
    await prisma.testReportTemplate.upsert({
      where: {
        testId_reportTemplateId_language_audience: {
          testId: dpoTest.id,
          reportTemplateId: template.id,
          language: "es-MX",
          audience: "INDIVIDUAL",
        },
      },
      update: {
        assessmentId: dpoAssessment?.id ?? null,
        isDefault: true,
        isActive: true,
      },
      create: {
        testId: dpoTest.id,
        assessmentId: dpoAssessment?.id ?? null,
        reportTemplateId: template.id,
        language: "es-MX",
        audience: "INDIVIDUAL",
        isDefault: true,
        isActive: true,
      },
    });
  }

  return {
    template: template.code,
    seededFrom: snapshot.sourceVersion,
    publishedVersion: publishedVersion.version,
    assets: snapshot.assets.length,
    linkedTest: dpoTest?.code ?? null,
  };
}

function adapter() {
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

if (require.main === module) {
  const prisma = new PrismaClient({ adapter: adapter() });
  seedReportStudioV1(prisma)
    .then((result) => console.log("[Report Studio seed]", result))
    .finally(async () => prisma.$disconnect())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
