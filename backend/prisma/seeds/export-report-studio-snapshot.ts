import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, ReportStudioStatus } from "../../src/generated/prisma/client";

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
    connectionLimit: 3,
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter: adapter() });
  try {
    const version = await prisma.reportTemplateVersion.findFirst({
      where: {
        status: ReportStudioStatus.PUBLISHED,
        template: { code: "DPO-PPF" },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { template: true, theme: true },
    });
    if (!version) throw new Error("REPORT_STUDIO_PUBLISHED_VERSION_NOT_FOUND");

    const serializedLayout = JSON.stringify(version.layoutJson);
    const assetIds = [
      ...serializedLayout.matchAll(/\/report-studio\/assets\/([a-zA-Z0-9_-]+)/g),
    ].map((match) => match[1]!);
    const assets = assetIds.length
      ? await prisma.reportAsset.findMany({
          where: { id: { in: [...new Set(assetIds)] } },
        })
      : [];
    const classificationSets = await prisma.reportClassificationSet.findMany({
      include: { ranges: { orderBy: { sortOrder: "asc" } } },
      orderBy: { code: "asc" },
    });

    const snapshot = {
      schemaVersion: "1.0.0",
      sourceVersion: version.version,
      seedVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      template: {
        code: version.template.code,
        name: version.template.name,
        description: version.template.description,
      },
      theme: version.theme
        ? {
            code: version.theme.code,
            name: version.theme.name,
            configJson: version.theme.configJson,
          }
        : null,
      layoutJson: version.layoutJson,
      bindingConfigJson: version.bindingConfigJson,
      pendingBindings: version.pendingBindings,
      classificationSets: classificationSets.map((set) => ({
        code: set.code,
        name: set.name,
        description: set.description,
        ranges: set.ranges.map((range) => ({
          minValue: range.minValue,
          maxValue: range.maxValue,
          label: range.label,
          color: range.color,
          sortOrder: range.sortOrder,
        })),
      })),
      assets: assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
        dataBase64: Buffer.from(asset.data).toString("base64"),
      })),
    };

    const target = resolve(
      process.cwd(),
      "prisma/seeds/data/report-studio-dpo-ppf.initial-v1.json",
    );
    await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(
      `Snapshot Report Studio ${version.version} exportado con ${assets.length} recurso(s): ${target}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
