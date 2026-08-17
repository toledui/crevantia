import {
  AggregationMethod,
  ConfigurationStatus,
  ScoringPolarity,
  type Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client";
import { configurationHash } from "../../src/modules/scoring/configuration-hash";
import { loadQuestionBank, loadScoringKey } from "./dpo-data";
import { DPO_IDS } from "./seed-assessment";

function aggregation(value: string) {
  return value === "TWO_AXIS"
    ? AggregationMethod.TWO_AXIS
    : AggregationMethod.ARITHMETIC_MEAN;
}

export async function seedScoringKey(prisma: PrismaClient) {
  const source = loadScoringKey();
  const questions = loadQuestionBank();
  const hash = configurationHash(source);
  const sourceReactiveCodes = new Set(
    questions.pairedQuestions.flatMap(({ statements }) =>
      statements.map(({ code }) => code),
    ),
  );
  if (
    source.reactives.length !== 336 ||
    source.scales.length !== 48 ||
    source.composites.length !== 35
  )
    throw new Error("SCORING_KEY_COUNT_MISMATCH");
  if (
    source.reactives.some(
      ({ code, pairCode, scaleCode }) =>
        !sourceReactiveCodes.has(code) ||
        !questions.pairedQuestions.some(({ code }) => code === pairCode) ||
        !source.scales.some(({ code }) => code === scaleCode),
    )
  )
    throw new Error("SCORING_KEY_REFERENCE_MISSING");
  for (const scale of source.scales) {
    const rules = source.reactives.filter(
      ({ scaleCode }) => scaleCode === scale.code,
    );
    if (
      rules.length !== 7 ||
      rules.filter(({ polarity }) => polarity === "POSITIVE").length !== 4 ||
      rules.filter(({ polarity }) => polarity === "NEGATIVE").length !== 3
    )
      throw new Error(`SCORING_SCALE_INVALID:${scale.code}`);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.scoringKey.upsert({
        where: { code: source.scoringKey.code },
        update: { name: source.scoringKey.name },
        create: {
          id: DPO_IDS.scoringKey,
          code: source.scoringKey.code,
          name: source.scoringKey.name,
          description: "Clave pareada independiente y versionada.",
        },
      });
      const existing = await tx.scoringKeyVersion.findUnique({
        where: { id: DPO_IDS.scoringKeyVersion },
      });
      if (existing?.status === ConfigurationStatus.PUBLISHED) {
        if (existing.configurationHash !== hash)
          throw new Error("SCORING_KEY_PUBLISHED_IMMUTABLE_HASH_MISMATCH");
        console.log(
          "[DPO seed-scoring-key] omitido: clave publicada con el mismo hash",
        );
        return;
      }
      await tx.scoringKeyVersion.upsert({
        where: { id: DPO_IDS.scoringKeyVersion },
        update: {
          sourceVersion: source.scoringKey.version,
          numericMode: "EXCEL_BINARY64",
          engineCompatibility: "dpo-engine-v1",
          configurationHash: hash,
          status: ConfigurationStatus.PUBLISHED,
          publishedAt: new Date(),
        },
        create: {
          id: DPO_IDS.scoringKeyVersion,
          scoringKeyId: DPO_IDS.scoringKey,
          assessmentVersionId: DPO_IDS.assessmentVersion,
          version: 1,
          sourceVersion: source.scoringKey.version,
          status: ConfigurationStatus.PUBLISHED,
          numericMode: "EXCEL_BINARY64",
          engineCompatibility: "dpo-engine-v1",
          configurationHash: hash,
          publishedAt: new Date(),
        },
      });
      for (const scale of source.scales) {
        await tx.scale.upsert({
          where: { code: scale.code },
          update: { name: scale.name },
          create: { id: scale.code, code: scale.code, name: scale.name },
        });
      }
      for (const rule of source.reactives) {
        await tx.reactiveScoringRule.upsert({
          where: {
            scoringKeyVersionId_reactiveId: {
              scoringKeyVersionId: DPO_IDS.scoringKeyVersion,
              reactiveId: rule.code,
            },
          },
          update: {
            scaleId: rule.scaleCode,
            polarity: rule.polarity as ScoringPolarity,
            fixedWeight: rule.fixedWeight,
            scoreIfMore: rule.scoreIfSelectedMore,
            scoreIfLess: rule.scoreIfSelectedLess,
            sourceMetadata: rule.sourceReferences as Prisma.InputJsonValue,
          },
          create: {
            id: `rule-${rule.code}`,
            scoringKeyVersionId: DPO_IDS.scoringKeyVersion,
            reactiveId: rule.code,
            scaleId: rule.scaleCode,
            polarity: rule.polarity as ScoringPolarity,
            fixedWeight: rule.fixedWeight,
            scoreIfMore: rule.scoreIfSelectedMore,
            scoreIfLess: rule.scoreIfSelectedLess,
            sourceMetadata: rule.sourceReferences as Prisma.InputJsonValue,
          },
        });
      }
      for (const composite of source.composites) {
        const method = aggregation(composite.aggregation);
        await tx.composite.upsert({
          where: { code: composite.code },
          update: {
            name: composite.name,
            description: composite.specialNotes,
            aggregationMethod: method,
          },
          create: {
            id: composite.code,
            code: composite.code,
            name: composite.name,
            description: composite.specialNotes,
            aggregationMethod: method,
          },
        });
        for (const [
          index,
          scaleCode,
        ] of composite.componentScaleCodes.entries()) {
          if (!source.scales.some(({ code }) => code === scaleCode))
            throw new Error(
              `COMPOSITE_SCALE_NOT_FOUND:${composite.code}:${scaleCode}`,
            );
          await tx.compositeComponent.upsert({
            where: {
              scoringKeyVersionId_compositeId_scaleId: {
                scoringKeyVersionId: DPO_IDS.scoringKeyVersion,
                compositeId: composite.code,
                scaleId: scaleCode,
              },
            },
            update: {
              order: index + 1,
              weight: 1,
              aggregationMethod: method,
              metadata: composite.specialNotes
                ? { specialNotes: composite.specialNotes }
                : undefined,
            },
            create: {
              id: `component-${composite.code}-${scaleCode}`,
              scoringKeyVersionId: DPO_IDS.scoringKeyVersion,
              compositeId: composite.code,
              scaleId: scaleCode,
              order: index + 1,
              weight: 1,
              aggregationMethod: method,
              metadata: composite.specialNotes
                ? { specialNotes: composite.specialNotes }
                : undefined,
            },
          });
        }
      }
      await tx.reportMapping.upsert({
        where: { code: "DPO_PPF" },
        update: { name: "Mapeo de reporte PPF" },
        create: {
          id: DPO_IDS.reportMapping,
          code: "DPO_PPF",
          name: "Mapeo de reporte PPF",
        },
      });
      await tx.reportMappingVersion.upsert({
        where: { id: DPO_IDS.reportMappingVersion },
        update: {
          mappingStatus: "PENDING_CLIENT_CONFIRMATION",
          configuration: {
            reportMappingStatus: source.reportMappingStatus,
            legacyStyleProfiles: source.legacyStyleProfiles,
          } as Prisma.InputJsonValue,
        },
        create: {
          id: DPO_IDS.reportMappingVersion,
          reportMappingId: DPO_IDS.reportMapping,
          assessmentVersionId: DPO_IDS.assessmentVersion,
          version: 1,
          status: ConfigurationStatus.DRAFT,
          mappingStatus: "PENDING_CLIENT_CONFIRMATION",
          configuration: {
            reportMappingStatus: source.reportMappingStatus,
            legacyStyleProfiles: source.legacyStyleProfiles,
          } as Prisma.InputJsonValue,
          configurationHash: configurationHash({
            reportMappingStatus: source.reportMappingStatus,
            legacyStyleProfiles: source.legacyStyleProfiles,
          }),
        },
      });
      const imported = await tx.auditLog.findFirst({
        where: {
          action: "SCORING_KEY_IMPORTED",
          entityId: DPO_IDS.scoringKeyVersion,
        },
      });
      if (!imported)
        await tx.auditLog.create({
          data: {
            action: "SCORING_KEY_IMPORTED",
            entityType: "ScoringKeyVersion",
            entityId: DPO_IDS.scoringKeyVersion,
            after: { hash, reactives: 336, scales: 48, composites: 35 },
          },
        });
    },
    { timeout: 120_000 },
  );

  console.log(
    `[DPO seed-scoring-key] rules=${source.reactives.length} scales=${source.scales.length} composites=${source.composites.length} hash=${hash.slice(0, 12)}`,
  );
}
