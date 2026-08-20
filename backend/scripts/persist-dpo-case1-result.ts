import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import {
  loadOfficialAssessment,
  loadOfficialComposites,
  loadOfficialNorm,
  loadOfficialScoring,
} from "../prisma/seeds/official-dpo-data";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma, ResultRunStatus } from "../src/generated/prisma/client";
import { configurationHash } from "../src/modules/scoring/configuration-hash";
import {
  calculateAssessment,
  DPO_ENGINE_VERSION,
  type CompositeDefinition,
  type DerivedMetricDefinition,
  type LikertScoringDefinition,
  type NormDefinition,
  type ReportAliasDefinition,
  type ScoringRule,
} from "../src/modules/scoring/scoring-engine";

const SOURCE_RESULT_RUN_ID = "cmt1rf4yz005khsi91ojbrcm3";
const CASE_WORKBOOK_SHA256 =
  "2c11a66f897312fdd29581d7caa1ac4e4cea69b3b0df1d70052a2368e2a59db4";
const REASON =
  "Reproducción técnica Caso de Prueba 1: Excel verificado 168/168; DPO-P039 = DPO-R077 MORE";

interface PairedFixture {
  answers: Array<{
    pairCode: string;
    selectedMoreReactiveCode: string;
  }>;
}

process.loadEnvFile(join(__dirname, "..", ".env"));
const apply = process.argv.includes("--apply");
const prisma = new PrismaService(new ConfigService());

async function main() {
  await prisma.$connect();
  const source = await prisma.resultRun.findUnique({
    where: { id: SOURCE_RESULT_RUN_ID },
    include: {
      attempt: {
        include: {
          likertAnswers: {
            include: { likertQuestion: { select: { code: true } } },
          },
        },
      },
      assessmentVersion: true,
      scoringKeyVersion: true,
      normVersion: true,
      reportMappingVersion: true,
    },
  });
  if (!source || source.status !== ResultRunStatus.COMPLETED)
    throw new Error("El ResultRun histórico completo no existe.");
  if (source.recalculationOfResultRunId)
    throw new Error("La fuente debe ser el ResultRun original.");

  const fixture = JSON.parse(
    readFileSync(
      join(__dirname, "..", "test", "fixtures", "dpo-pro-case-1-paired.json"),
      "utf8",
    ),
  ) as PairedFixture;
  if (fixture.answers.length !== 168)
    throw new Error(`El fixture contiene ${fixture.answers.length} pares.`);

  const assessment = loadOfficialAssessment();
  const scoring = loadOfficialScoring();
  const composites = loadOfficialComposites();
  const norm = loadOfficialNorm();
  assertOfficialVersions(assessment, scoring, norm);

  const pairByReactive = new Map(
    assessment.reactives.map(({ code, pairCode }) => [code, pairCode]),
  );
  const rules: ScoringRule[] = scoring.reactiveScoringRules.map((rule) => ({
    reactiveCode: rule.reactiveCode,
    pairCode: pairByReactive.get(rule.reactiveCode) ?? "",
    scaleCode: rule.scaleCode,
    scoreIfMore: rule.scoreIfMore,
    scoreIfLess: rule.scoreIfLess,
  }));
  const compositeDefinitions: CompositeDefinition[] =
    composites.normedComposites.map((composite) => ({
      code: composite.code,
      aggregationMethod: "ARITHMETIC_MEAN",
      components: composite.componentScaleCodes.map((scaleCode, index) => ({
        scaleCode,
        weight: 1,
        order: index + 1,
      })),
    }));
  const derivedMetricDefinitions: DerivedMetricDefinition[] =
    composites.derivedDecileMeanMetrics.map((metric) => ({
      code: metric.code,
      calculationType: "DECILE_MEAN",
      sources: metric.componentScaleCodes.map((targetCode) => ({
        targetType: "SCALE",
        targetCode,
        valueType: "DECILE",
        weight: 1,
      })),
    }));
  const aliases: ReportAliasDefinition[] = composites.reportAliases.map(
    (alias) => ({
      code: `REPORT_ALIAS:${alias.alias}`,
      label: alias.alias,
      sourceType: alias.sourceType,
      sourceCode: alias.sourceCode,
    }),
  );
  const likertRules: LikertScoringDefinition[] = assessment.likertQuestions.map(
    (question) => ({
      questionCode: question.code,
      scaleCode: `LIKERT-${question.dimensionCode}`,
      weight: question.weight,
      reverse: false,
      minValue: 1,
      maxValue: 5,
    }),
  );
  const norms: NormDefinition[] = norm.activeTargets.map((target) => ({
    targetType: target.targetType,
    targetCode: target.targetCode,
    status: "ACTIVE",
    thresholds: target.thresholds.map((threshold, index) => ({
      decile: threshold.decile,
      lowerBound: threshold.lowerBound,
      ordinal: index + 1,
    })),
  }));
  const likertAnswers = source.attempt.likertAnswers.map((answer) => ({
    questionCode: answer.likertQuestion.code,
    value: answer.value,
  }));
  if (likertAnswers.length !== 25)
    throw new Error(
      `El intento histórico contiene ${likertAnswers.length} respuestas Likert.`,
    );

  const calculation = calculateAssessment({
    answers: fixture.answers,
    rules,
    likertAnswers,
    likertRules,
    composites: compositeDefinitions,
    derivedMetricDefinitions,
    reportAliases: aliases,
    norms,
  });
  assertExpectedValues(calculation);

  const configHash = configurationHash({
    assessmentVersion: {
      id: source.assessmentVersionId,
      hash: source.assessmentVersion.configurationHash,
    },
    scoringKeyVersion: {
      id: source.scoringKeyVersionId,
      hash: source.scoringKeyVersion.configurationHash,
    },
    normVersion: {
      id: source.normVersionId,
      hash: source.normVersion.configurationHash,
    },
    engineVersion: DPO_ENGINE_VERSION,
  });
  const inputHash = configurationHash({
    answers: [...fixture.answers].sort((left, right) =>
      left.pairCode.localeCompare(right.pairCode),
    ),
    likert: source.attempt.likertAnswers
      .map(({ likertQuestionId, value }) => ({ likertQuestionId, value }))
      .sort((left, right) =>
        left.likertQuestionId.localeCompare(right.likertQuestionId),
      ),
  });
  const summary = criticalSummary(calculation);
  if (!apply) {
    console.log(
      JSON.stringify({ mode: "DRY_RUN", inputHash, summary }, null, 2),
    );
    console.log("Ejecuta con --apply para crear el ResultRun técnico.");
    return;
  }

  const existing = await prisma.resultRun.findFirst({
    where: {
      recalculationOfResultRunId: source.id,
      inputHash,
      reason: REASON,
      status: ResultRunStatus.COMPLETED,
    },
    include: { values: true },
  });
  if (existing) {
    console.log(
      JSON.stringify(
        { mode: "ALREADY_EXISTS", id: existing.id, summary },
        null,
        2,
      ),
    );
    return;
  }

  const reactiveCodes = calculation.contributions.map(
    ({ reactiveCode }) => reactiveCode,
  );
  const reactiveIds = new Map(
    (
      await prisma.reactive.findMany({
        where: { code: { in: reactiveCodes } },
        select: { id: true, code: true },
      })
    ).map(({ id, code }) => [code, id]),
  );
  if (reactiveIds.size !== 336)
    throw new Error(
      `Solo se localizaron ${reactiveIds.size}/336 reactivos en MySQL.`,
    );

  const values = [
    ...calculation.scales,
    ...calculation.composites,
    ...calculation.derivedMetrics,
    ...calculation.likertDimensions,
    ...(calculation.likertTotal ? [calculation.likertTotal] : []),
    ...calculation.aliases,
  ];
  const created = await prisma.$transaction(
    async (tx) => {
      const result = await tx.resultRun.create({
        data: {
          attemptId: source.attemptId,
          assessmentVersionId: source.assessmentVersionId,
          scoringKeyVersionId: source.scoringKeyVersionId,
          normVersionId: source.normVersionId,
          reportMappingVersionId: source.reportMappingVersionId,
          engineVersion: DPO_ENGINE_VERSION,
          configurationHash: configHash,
          inputHash,
          status: ResultRunStatus.COMPLETED,
          isOfficial: false,
          recalculationOfResultRunId: source.id,
          reason: REASON,
          diagnostics: asJson({
            technicalReproduction: true,
            sourceWorkbook: "Caso de prueba 1 DPO-PRO.xlsx",
            sourceWorkbookSha256: CASE_WORKBOOK_SHA256,
            pairsCompared: 168,
            pairMismatches: 0,
            answerOverride: {
              pairCode: "DPO-P039",
              historicalSelectedMore: "DPO-R078",
              technicalSelectedMore: "DPO-R077",
            },
            historicalAttemptAndResultRunsPreserved: true,
            likertSource: "HISTORICAL_ATTEMPT_ANSWERS",
          }),
          values: {
            create: values.map((value) => ({
              targetType: value.targetType,
              targetCode: value.targetCode,
              rawScore: value.rawScore,
              displayScore: value.displayScore,
              normalizedScore: value.normalizedScore,
              decile: value.decile,
              status: value.status,
              metadata:
                value.targetType === "DERIVED_METRIC"
                  ? {
                      calculation:
                        value.status === "CALCULATED_DECILE_MEAN"
                          ? "DECILE_MEAN"
                          : "EXPLICIT_AXIS",
                    }
                  : undefined,
            })),
          },
          contributions: {
            create: calculation.contributions.map((contribution) => ({
              reactiveId:
                reactiveIds.get(contribution.reactiveCode) ??
                contribution.reactiveCode,
              selection: contribution.selection,
              scoreIfMore: contribution.scoreIfMore,
              scoreIfLess: contribution.scoreIfLess,
              appliedScore: contribution.appliedScore,
              scaleId: contribution.scaleCode,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          action: "TECHNICAL_CASE_REPRODUCED",
          entityType: "ResultRun",
          entityId: result.id,
          reason: REASON,
          before: asJson({ resultRunId: source.id, preserved: true }),
          after: asJson({ resultRunId: result.id, inputHash }),
        },
      });
      return result;
    },
    { timeout: 120_000 },
  );
  console.log(
    JSON.stringify({ mode: "CREATED", id: created.id, summary }, null, 2),
  );
}

function assertOfficialVersions(
  assessment: ReturnType<typeof loadOfficialAssessment>,
  scoring: ReturnType<typeof loadOfficialScoring>,
  norm: ReturnType<typeof loadOfficialNorm>,
) {
  if (
    assessment.assessment.code !== "DPO-PRO" ||
    assessment.assessment.version !== "1.0.0"
  )
    throw new Error("AssessmentVersion inesperada.");
  if (
    scoring.scoringKey.code !== "DPO-PRO-SCORING" ||
    scoring.scoringKey.version !== "1.0.0"
  )
    throw new Error("ScoringKeyVersion inesperada.");
  if (
    norm.normSet.code !== "DPO-PRO-OFFICIAL" ||
    norm.normSet.version !== "1.0.0"
  )
    throw new Error("NormVersion inesperada.");
}

function criticalSummary(calculation: ReturnType<typeof calculateAssessment>) {
  const wanted = new Set([
    "DPO-S001",
    "DPO-S043",
    "DPO-C011",
    "DPO-C013",
    "DPO-C014",
    "DPO-C015",
    "DPO-C016",
    "DPO-C026",
    "DPO-C031",
  ]);
  return [...calculation.scales, ...calculation.composites]
    .filter(({ targetCode }) => wanted.has(targetCode))
    .map(({ targetCode, rawScore, decile }) => ({
      targetCode,
      rawScore,
      decile,
    }))
    .sort((left, right) => left.targetCode.localeCompare(right.targetCode));
}

function assertExpectedValues(
  calculation: ReturnType<typeof calculateAssessment>,
) {
  const values = new Map(
    criticalSummary(calculation).map((value) => [value.targetCode, value]),
  );
  const expected: Array<[string, number, number]> = [
    ["DPO-S001", 19, 10],
    ["DPO-S043", 13, 8],
    ["DPO-C011", 11.666666666666666, 7],
    ["DPO-C013", 11.666666666666666, 4],
    ["DPO-C014", 10.333333333333334, 6],
    ["DPO-C015", 9.333333333333334, 4],
    ["DPO-C016", 14, 8],
    ["DPO-C026", 15.666666666666666, 10],
    ["DPO-C031", 12.666666666666666, 7],
  ];
  for (const [code, rawScore, decile] of expected) {
    const actual = values.get(code);
    if (
      !actual ||
      Math.abs(actual.rawScore - rawScore) > 1e-12 ||
      actual.decile !== decile
    )
      throw new Error(
        `Resultado inesperado para ${code}: ${JSON.stringify(actual)}`,
      );
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
