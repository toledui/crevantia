import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient, ReportStudioStatus } from '../../src/generated/prisma/client';

const bundleRoot = resolve(
  process.cwd(),
  '..',
  'CREVANTIA_REPORT_STUDIO_BUNDLE_V1',
  'CREVANTIA_REPORT_STUDIO_BUNDLE_V1',
);

async function json<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(bundleRoot, relativePath), 'utf8')) as T;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  }) });

  try {
    const [themeSeed, classifications, catalog, presets, bindings, templateSeed] = await Promise.all([
      json<{ theme: { code: string; name: string } & Record<string, unknown> }>('seed/report-theme-crevantia-v1.json'),
      json<{ sets: Array<{ code: string; name: string; source?: string; ranges: Array<{ min: number; max: number; label: string; color?: string }> }> }>('seed/report-classifications-v1.json'),
      json<Record<string, unknown>>('seed/report-component-catalog-v1.json'),
      json<Record<string, unknown>>('seed/report-presets-v1.json'),
      json<{ bindingPresets: Array<{ status?: string } & Record<string, unknown>> }>('seed/report-bindings-v1.json'),
      json<{ reportTemplate: { code: string; name: string; version: string; status: string } & Record<string, unknown>; pages: unknown[] }>('seed/report-template-dpo-ppf-v1.json'),
    ]);

    const theme = await prisma.reportTheme.upsert({
      where: { code: themeSeed.theme.code },
      update: { name: themeSeed.theme.name, configJson: asJson(themeSeed.theme) },
      create: { code: themeSeed.theme.code, name: themeSeed.theme.name, configJson: asJson(themeSeed.theme) },
    });

    for (const item of classifications.sets) {
      const set = await prisma.reportClassificationSet.upsert({
        where: { code: item.code },
        update: { name: item.name, description: item.source ?? null },
        create: { code: item.code, name: item.name, description: item.source ?? null },
      });
      await prisma.reportClassificationRange.deleteMany({ where: { reportClassificationSetId: set.id } });
      await prisma.reportClassificationRange.createMany({ data: item.ranges.map((range, index) => ({
        reportClassificationSetId: set.id,
        minValue: range.min,
        maxValue: range.max,
        label: range.label,
        color: range.color ?? null,
        sortOrder: index,
      })) });
    }

    const template = await prisma.reportTemplate.upsert({
      where: { code: templateSeed.reportTemplate.code },
      update: { name: templateSeed.reportTemplate.name },
      create: {
        code: templateSeed.reportTemplate.code,
        name: templateSeed.reportTemplate.name,
        description: 'Plantilla editorial DPO-PPF importada desde Report Studio Bundle V1.',
        status: ReportStudioStatus.DRAFT,
      },
    });
    const pendingBindings = bindings.bindingPresets.reduce((count, item) => {
      if (item.status === 'CONFIGURABLE_NEEDS_FINAL_MAPPING_REVIEW') return count + 1;
      const groups = Array.isArray(item.groups) ? item.groups as Array<{ status?: string }> : [];
      return count + groups.filter((group) => group.status === 'CONFIGURABLE_NEEDS_FINAL_MAPPING_REVIEW').length;
    }, 0);
    const layout = { schemaVersion: '1.0.0', document: templateSeed.reportTemplate, pages: templateSeed.pages, catalog, presets };
    const hash = createHash('sha256').update(JSON.stringify({ layout, bindings })).digest('hex');
    await prisma.reportTemplateVersion.upsert({
      where: { reportTemplateId_version: { reportTemplateId: template.id, version: templateSeed.reportTemplate.version } },
      update: {
        status: ReportStudioStatus.DRAFT,
        themeId: theme.id,
        layoutJson: asJson(layout),
        bindingConfigJson: asJson(bindings),
        pendingBindings,
        configurationHash: hash,
      },
      create: {
        reportTemplateId: template.id,
        version: templateSeed.reportTemplate.version,
        status: ReportStudioStatus.DRAFT,
        themeId: theme.id,
        layoutJson: asJson(layout),
        bindingConfigJson: asJson(bindings),
        pendingBindings,
        configurationHash: hash,
      },
    });
    const [dpoTest, dpoAssessment] = await Promise.all([
      prisma.test.findFirst({ where: { code: { in: ['DPO', 'DPO_PRO', 'DPO-PRO'] } }, orderBy: { createdAt: 'asc' } }),
      prisma.assessment.findUnique({ where: { code: 'DPO_PRO' } }),
    ]);
    if (dpoTest) {
      await prisma.testReportTemplate.upsert({
        where: { testId_reportTemplateId_language_audience: { testId: dpoTest.id, reportTemplateId: template.id, language: 'es-MX', audience: 'INDIVIDUAL' } },
        update: { assessmentId: dpoAssessment?.id ?? null, isDefault: true, isActive: true },
        create: { testId: dpoTest.id, assessmentId: dpoAssessment?.id ?? null, reportTemplateId: template.id, language: 'es-MX', audience: 'INDIVIDUAL', isDefault: true, isActive: true },
      });
    }
    console.log(`Report Studio listo: ${template.code} ${templateSeed.reportTemplate.version} (${pendingBindings} grupos de bindings pendientes).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
