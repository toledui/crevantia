import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../src/database/prisma.service";
import {
  AssignmentStatus,
  AssignmentType,
  AttemptStatus,
  ConfigurationStatus,
  UserStatus,
} from "../../src/generated/prisma/client";
import { AssessmentsService } from "../../src/modules/assessments/assessments.service";
import { AssessmentScoringService } from "../../src/modules/assessments/assessment-scoring.service";
import { ResultsService } from "../../src/modules/results/results.service";
import { OFFICIAL_DPO_IDS } from "./seed-dpo-official-v1";

const ids = {
  user: "e2e-dpo-official-v1-user",
  assignment: "e2e-dpo-official-v1-assignment",
  attempt: "e2e-dpo-official-v1-attempt",
};

async function main() {
  const prisma = new PrismaService(
    new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
  );
  await prisma.onModuleInit();
  try {
    await cleanup(prisma);
    const active = await prisma.assessmentActiveConfiguration.findUnique({
      where: { assessmentId: OFFICIAL_DPO_IDS.assessment },
    });
    if (!active) throw new Error("DPO_OFFICIAL_ACTIVE_CONFIGURATION_MISSING");
    const [version, scoring, norm, mapping] = await Promise.all([
      prisma.assessmentVersion.findUnique({
        where: { id: active.assessmentVersionId },
        include: {
          demographicFields: true,
          pairQuestions: { include: { reactives: true } },
          likertQuestions: true,
        },
      }),
      prisma.scoringKeyVersion.findUnique({
        where: { id: active.scoringKeyVersionId },
        include: {
          rules: true,
          likertRules: true,
          compositeComponents: true,
          derivedMetricVersions: true,
        },
      }),
      prisma.normVersion.findUnique({
        where: { id: active.normVersionId },
        include: { targets: { include: { thresholds: true } } },
      }),
      active.reportMappingVersionId
        ? prisma.reportMappingVersion.findUnique({
            where: { id: active.reportMappingVersionId },
          })
        : null,
    ]);
    if (!version || version.status !== ConfigurationStatus.PUBLISHED)
      throw new Error("DPO_OFFICIAL_ASSESSMENT_NOT_PUBLISHED");
    if (!scoring || scoring.status !== ConfigurationStatus.PUBLISHED)
      throw new Error("DPO_OFFICIAL_SCORING_NOT_PUBLISHED");
    if (!norm || norm.status !== ConfigurationStatus.PUBLISHED)
      throw new Error("DPO_OFFICIAL_NORM_NOT_PUBLISHED");
    assert(version.demographicFields.length === 17, "DB_CONTROL_COUNT");
    assert(version.pairQuestions.length === 168, "DB_PAIR_COUNT");
    assert(
      version.pairQuestions.flatMap((item) => item.reactives).length === 336,
      "DB_REACTIVE_COUNT",
    );
    assert(version.likertQuestions.length === 25, "DB_LIKERT_COUNT");
    assert(scoring.rules.length === 336, "DB_RULE_COUNT");
    assert(scoring.likertRules.length === 25, "DB_LIKERT_RULE_COUNT");
    assert(
      new Set(scoring.compositeComponents.map((item) => item.compositeId))
        .size === 33,
      "DB_COMPOSITE_COUNT",
    );
    assert(scoring.derivedMetricVersions.length === 21, "DB_DERIVED_COUNT");
    assert(norm.targets.length === 87, "DB_NORM_TARGET_COUNT");
    assert(
      norm.targets.flatMap((item) => item.thresholds).length === 870,
      "DB_THRESHOLD_COUNT",
    );
    const aliases = mapping?.configuration as { aliases?: unknown[] } | null;
    assert(
      mapping?.status === ConfigurationStatus.PUBLISHED,
      "DB_REPORT_MAPPING_NOT_PUBLISHED",
    );
    assert(aliases?.aliases?.length === 12, "DB_REPORT_ALIAS_COUNT");

    const testVersion = await prisma.testVersion.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
    });
    if (!testVersion) throw new Error("DPO_E2E_TEST_VERSION_MISSING");
    await prisma.user.create({
      data: {
        id: ids.user,
        email: "e2e-dpo-official-v1@crevantia.invalid",
        passwordHash: "not-used-by-e2e",
        firstName: "E2E",
        lastName: "DPO",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.assignment.create({
      data: {
        id: ids.assignment,
        userId: ids.user,
        testId: testVersion.testId,
        testVersionId: testVersion.id,
        type: AssignmentType.ADMIN_FREE,
        status: AssignmentStatus.IN_PROGRESS,
        reason: "Verificación automática DPO-PRO official v1",
      },
    });
    await prisma.attempt.create({
      data: {
        id: ids.attempt,
        assignmentId: ids.assignment,
        testVersionId: testVersion.id,
        assessmentVersionId: active.assessmentVersionId,
        scoringKeyVersionId: active.scoringKeyVersionId,
        normVersionId: active.normVersionId,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
    await prisma.demographicAnswer.createMany({
      data: version.demographicFields.map((field) => ({
        attemptId: ids.attempt,
        demographicFieldId: field.id,
        value: field.type === "INTEGER" ? 35 : `E2E ${field.code}`,
        operationId: `e2e-demographic-${field.code}`,
      })),
    });
    await prisma.forcedChoiceAnswer.createMany({
      data: version.pairQuestions.map((pair, index) => ({
        attemptId: ids.attempt,
        pairQuestionId: pair.id,
        selectedMoreReactiveId: pair.reactives[index % 2]!.id,
        operationId: `e2e-pair-${pair.code}`,
      })),
    });
    await prisma.likertAnswer.createMany({
      data: version.likertQuestions.map((question) => ({
        attemptId: ids.attempt,
        likertQuestionId: question.id,
        value: 4,
        operationId: `e2e-likert-${question.code}`,
      })),
    });

    const user = {
      sub: ids.user,
      email: "e2e-dpo-official-v1@crevantia.invalid",
      roles: ["USER"],
      permissions: [],
    };
    const player = await new AssessmentsService(prisma).player(
      user,
      ids.attempt,
    );
    const exposed = JSON.stringify(player);
    for (const forbidden of [
      "scoreIfMore",
      "scoreIfLess",
      "fixedWeight",
      "scaleCode",
      "normThresholds",
      "componentScaleCodes",
    ])
      assert(!exposed.includes(forbidden), `PLAYER_EXPOSES_${forbidden}`);

    const run = await new AssessmentScoringService(prisma).finalize(
      user,
      ids.attempt,
    );
    const result = await prisma.resultRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { values: true, contributions: true },
    });
    const count = (type: string) =>
      result.values.filter((item) => item.targetType === type).length;
    assert(result.contributions.length === 336, "E2E_CONTRIBUTION_COUNT");
    assert(count("SCALE") === 48, "E2E_SCALE_COUNT");
    assert(count("COMPOSITE") === 33, "E2E_COMPOSITE_COUNT");
    assert(count("DERIVED_METRIC") === 21, "E2E_DERIVED_COUNT");
    assert(count("LIKERT_DIMENSION") === 5, "E2E_LIKERT_DIMENSION_COUNT");
    assert(count("LIKERT_TOTAL") === 1, "E2E_LIKERT_TOTAL_COUNT");
    assert(count("REPORT_ALIAS") === 12, "E2E_ALIAS_COUNT");
    const recalculation = await new ResultsService(prisma).recalculate(
      { ...user, permissions: ["result.recalculate"] },
      result.id,
      {
        normVersionId: active.normVersionId,
        reason: "Verificación automática de recálculo DPO-PRO official v1",
      },
    );
    const recalculatedCount = (type: string) =>
      recalculation.values.filter((item) => item.targetType === type).length;
    assert(!recalculation.isOfficial, "E2E_RECALCULATION_MUST_NOT_BE_OFFICIAL");
    assert(
      recalculation.values.length === 120,
      "E2E_RECALCULATION_VALUE_COUNT",
    );
    assert(
      recalculatedCount("DERIVED_METRIC") === 21,
      "E2E_RECALCULATION_DERIVED_COUNT",
    );
    assert(
      recalculatedCount("REPORT_ALIAS") === 12,
      "E2E_RECALCULATION_ALIAS_COUNT",
    );
    console.log("[DPO official v1 DB/E2E] PASS", {
      resultRunId: result.id,
      recalculationResultRunId: recalculation.id,
      values: result.values.length,
      contributions: result.contributions.length,
      active,
    });
  } finally {
    await cleanup(prisma);
    await prisma.onModuleDestroy();
  }
}

function assert(condition: boolean, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

async function cleanup(prisma: PrismaService) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: ids.attempt },
  });
  if (attempt) {
    await prisma.resultRun.deleteMany({
      where: {
        attemptId: ids.attempt,
        recalculationOfResultRunId: { not: null },
      },
    });
    await prisma.resultRun.deleteMany({ where: { attemptId: ids.attempt } });
    await prisma.demographicAnswer.deleteMany({
      where: { attemptId: ids.attempt },
    });
    await prisma.forcedChoiceAnswer.deleteMany({
      where: { attemptId: ids.attempt },
    });
    await prisma.likertAnswer.deleteMany({ where: { attemptId: ids.attempt } });
    await prisma.attempt.delete({ where: { id: ids.attempt } });
  }
  await prisma.assignment.deleteMany({ where: { id: ids.assignment } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
