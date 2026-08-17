import {
  ConfigurationStatus,
  type Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client";
import { configurationHash } from "../../src/modules/scoring/configuration-hash";
import { loadQuestionBank } from "./dpo-data";

export const DPO_IDS = {
  assessment: "assessment-dpo-pro",
  assessmentVersion: "assessment-version-dpo-pro-v1",
  scoringKey: "scoring-key-dpo-express-v6",
  scoringKeyVersion: "scoring-key-version-dpo-express-v6-1",
  normSet: "norm-set-global-412",
  normVersion: "norm-version-global-412-v1",
  reportMapping: "report-mapping-dpo-ppf",
  reportMappingVersion: "report-mapping-version-dpo-ppf-v1",
} as const;

export async function seedAssessment(prisma: PrismaClient) {
  const source = loadQuestionBank();
  const versionHash = configurationHash(source);

  await prisma.$transaction(
    async (tx) => {
      await tx.assessment.upsert({
        where: { code: source.assessment.code },
        update: { name: source.assessment.workingName, isActive: true },
        create: {
          id: DPO_IDS.assessment,
          code: source.assessment.code,
          name: source.assessment.workingName,
          description:
            "Evaluación DPO-PRO dirigida por configuración versionada.",
        },
      });
      const existing = await tx.assessmentVersion.findUnique({
        where: { id: DPO_IDS.assessmentVersion },
      });
      if (
        existing?.status === ConfigurationStatus.PUBLISHED &&
        existing.configurationHash !== versionHash
      ) {
        throw new Error("ASSESSMENT_VERSION_PUBLISHED_IMMUTABLE");
      }
      await tx.assessmentVersion.upsert({
        where: { id: DPO_IDS.assessmentVersion },
        update:
          existing?.status === ConfigurationStatus.PUBLISHED
            ? {}
            : {
                intro: source.assessment.intro,
                estimatedMinutes:
                  source.assessment.estimatedMinutesFromBrief.maximum,
                sourceMetadata: {
                  schemaVersion: source.schemaVersion,
                  counts: source.assessment.counts,
                  discrepancies: source.assessment.sourceDiscrepancies,
                } as Prisma.InputJsonValue,
                configurationHash: versionHash,
              },
        create: {
          id: DPO_IDS.assessmentVersion,
          assessmentId: DPO_IDS.assessment,
          version: 1,
          versionCode: source.assessment.versionCode,
          language: source.assessment.language,
          status: ConfigurationStatus.DRAFT,
          intro: source.assessment.intro,
          estimatedMinutes: source.assessment.estimatedMinutesFromBrief.maximum,
          sourceMetadata: {
            schemaVersion: source.schemaVersion,
            counts: source.assessment.counts,
            discrepancies: source.assessment.sourceDiscrepancies,
          } as Prisma.InputJsonValue,
          configurationHash: versionHash,
        },
      });
    },
    { timeout: 120_000 },
  );

  console.log(
    `[DPO seed-assessment] assessmentVersions=1 hash=${versionHash.slice(0, 12)}`,
  );
  return DPO_IDS.assessmentVersion;
}
