import {
  ConfigurationStatus,
  NormTargetType,
  type Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client";
import { configurationHash } from "../../src/modules/scoring/configuration-hash";
import { loadNorm, loadScoringKey } from "./dpo-data";
import { DPO_IDS } from "./seed-assessment";

function targetIdentity(
  target: { targetType: string; name: string; code: string },
  scales: Map<string, string>,
  composites: Map<string, string>,
) {
  if (target.targetType === "SCALE") {
    const scaleCode = scales.get(target.name);
    return scaleCode
      ? { type: NormTargetType.SCALE, code: scaleCode }
      : { type: NormTargetType.DERIVED_METRIC, code: `DERIVED:${target.code}` };
  }
  if (target.targetType === "COMPOSITE")
    return {
      type: NormTargetType.COMPOSITE,
      code: composites.get(target.name) ?? `SOURCE_COMPOSITE:${target.code}`,
    };
  if (target.targetType === "LEGACY_STYLE_PROFILE")
    return {
      type: NormTargetType.LEGACY_STYLE_PROFILE,
      code: `PROFILE:${target.code}`,
    };
  return {
    type: NormTargetType.DERIVED_METRIC,
    code: `DERIVED:${target.code}`,
  };
}

export async function seedNorm(prisma: PrismaClient) {
  const source = loadNorm();
  const scoring = loadScoringKey();
  const hash = configurationHash(source);
  const thresholdCount = source.targets.reduce(
    (total, target) => total + target.thresholds.length,
    0,
  );
  if (source.targets.length !== 94 || thresholdCount !== 940)
    throw new Error("NORM_COUNT_MISMATCH");
  const scaleCodes = new Map(
    scoring.scales.map(({ name, code }) => [name, code]),
  );
  const compositeCodes = new Map(
    scoring.composites.map(({ name, code }) => [name, code]),
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.normSet.upsert({
        where: { code: source.normSet.code },
        update: { name: source.normSet.name },
        create: {
          id: DPO_IDS.normSet,
          code: source.normSet.code,
          name: source.normSet.name,
          description:
            "Familia normativa importada de la fuente Global / NORMA 412.",
        },
      });
      const existing = await tx.normVersion.findUnique({
        where: { id: DPO_IDS.normVersion },
      });
      if (
        existing?.status === ConfigurationStatus.PUBLISHED ||
        existing?.status === ConfigurationStatus.ARCHIVED
      ) {
        if (existing.configurationHash !== hash)
          throw new Error("NORM_VERSION_IMMUTABLE_HASH_MISMATCH");
        console.log(
          "[DPO seed-norm] omitido: versión inmutable con el mismo hash",
        );
        return;
      }
      await tx.normVersion.upsert({
        where: { id: DPO_IDS.normVersion },
        update: {
          sourceVersion: source.normSet.version,
          name: source.normSet.name,
          populationLabel: source.normSet.population,
          sampleSize: source.normSet.sampleSize.value,
          lookupMethod: source.normSet.lookupMethod,
          numericMode: "EXCEL_BINARY64",
          roundingMode: "NONE_BEFORE_NORM_LOOKUP",
          configurationHash: hash,
          validationStatus: "IMPORTED_REQUIRES_REVIEW",
          sourceMetadata: {
            qualitySummary: source.normSet.qualitySummary,
            knownWorkbookNotes: source.normSet.knownWorkbookNotes,
          } as Prisma.InputJsonValue,
        },
        create: {
          id: DPO_IDS.normVersion,
          normSetId: DPO_IDS.normSet,
          version: 1,
          sourceVersion: source.normSet.version,
          name: source.normSet.name,
          description:
            "Importación inicial; conserva anomalías de origen sin corregirlas.",
          status: ConfigurationStatus.DRAFT,
          populationLabel: source.normSet.population,
          sampleSize: source.normSet.sampleSize.value,
          lookupMethod: source.normSet.lookupMethod,
          numericMode: "EXCEL_BINARY64",
          roundingMode: "NONE_BEFORE_NORM_LOOKUP",
          notes: source.normSet.knownWorkbookNotes.join("\n"),
          configurationHash: hash,
          validationStatus: "IMPORTED_REQUIRES_REVIEW",
          sourceMetadata: {
            qualitySummary: source.normSet.qualitySummary,
            knownWorkbookNotes: source.normSet.knownWorkbookNotes,
          } as Prisma.InputJsonValue,
        },
      });
      for (const target of source.targets) {
        const identity = targetIdentity(target, scaleCodes, compositeCodes);
        const targetId = `norm-target-${identity.type.toLowerCase()}-${target.code}`;
        await tx.normTarget.deleteMany({
          where: {
            normVersionId: DPO_IDS.normVersion,
            sourceCode: target.code,
            NOT: { targetType: identity.type, targetCode: identity.code },
          },
        });
        await tx.normTarget.upsert({
          where: {
            normVersionId_targetType_targetCode: {
              normVersionId: DPO_IDS.normVersion,
              targetType: identity.type,
              targetCode: identity.code,
            },
          },
          update: {
            sourceCode: target.code,
            name: target.name,
            status: target.status,
            isBlocked: target.status === "BLOCKED",
            validationNotes: target.warnings.length
              ? JSON.stringify(target.warnings)
              : null,
            sourceReference: target.sourceRange,
          },
          create: {
            id: targetId,
            normVersionId: DPO_IDS.normVersion,
            targetType: identity.type,
            targetCode: identity.code,
            sourceCode: target.code,
            name: target.name,
            status: target.status,
            isBlocked: target.status === "BLOCKED",
            validationNotes: target.warnings.length
              ? JSON.stringify(target.warnings)
              : null,
            sourceReference: target.sourceRange,
          },
        });
        for (const threshold of target.thresholds) {
          await tx.normThreshold.upsert({
            where: {
              normTargetId_ordinal: {
                normTargetId: targetId,
                ordinal: threshold.ordinal,
              },
            },
            update: {
              decile: threshold.decil,
              lowerBound: threshold.minRaw,
              sourceMetadata: {
                displayMinRaw: threshold.displayMinRaw,
                sourceRaw: threshold.sourceRaw,
                sourceOutputRaw: threshold.sourceOutputRaw,
                sourceCells: threshold.sourceCells,
              } as Prisma.InputJsonValue,
            },
            create: {
              id: `${targetId}-d${threshold.ordinal}`,
              normTargetId: targetId,
              ordinal: threshold.ordinal,
              decile: threshold.decil,
              lowerBound: threshold.minRaw,
              sourceMetadata: {
                displayMinRaw: threshold.displayMinRaw,
                sourceRaw: threshold.sourceRaw,
                sourceOutputRaw: threshold.sourceOutputRaw,
                sourceCells: threshold.sourceCells,
              } as Prisma.InputJsonValue,
            },
          });
        }
      }
    },
    { timeout: 120_000 },
  );

  console.log(
    `[DPO seed-norm] targets=${source.targets.length} thresholds=${thresholdCount} blocked=${source.targets.filter(({ status }) => status === "BLOCKED").length} hash=${hash.slice(0, 12)}`,
  );
}
