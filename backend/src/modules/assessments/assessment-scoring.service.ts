import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/auth.types";
import { PrismaService } from "../../database/prisma.service";
import {
  AttemptStatus,
  ConfigurationStatus,
  Prisma,
  ResultRunStatus,
} from "../../generated/prisma/client";
import { configurationHash } from "../scoring/configuration-hash";
import {
  calculateAssessment,
  DPO_ENGINE_VERSION,
  type CompositeDefinition,
  type DerivedMetricDefinition,
  type LikertScoringDefinition,
  type NormDefinition,
  type ReportAliasDefinition,
  type ScoringRule,
} from "../scoring/scoring-engine";
import { AssessmentReportsService } from "../reports/assessment-reports.service";

@Injectable()
export class AssessmentScoringService {
  private readonly logger = new Logger(AssessmentScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly reports?: AssessmentReportsService,
  ) {}

  async finalize(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        assignment: { select: { userId: true } },
        assessmentVersion: {
          include: {
            pairQuestions: { where: { required: true }, select: { id: true } },
            likertQuestions: {
              where: { required: true },
              select: { id: true },
            },
            demographicFields: {
              where: { required: true },
              select: { id: true },
            },
          },
        },
        forcedChoiceAnswers: {
          include: {
            pairQuestion: { select: { code: true } },
            selectedMoreReactive: { select: { code: true } },
          },
        },
        likertAnswers: true,
        demographicAnswers: true,
      },
    });
    if (!attempt) throw new NotFoundException("El intento no existe.");
    if (
      attempt.assignment.userId !== user.sub &&
      !user.permissions.includes("attempts.monitor")
    )
      throw new ForbiddenException("No puedes finalizar este intento.");
    if (attempt.status !== AttemptStatus.IN_PROGRESS)
      throw new BadRequestException(
        "El intento debe estar en progreso para finalizarse.",
      );
    if (
      !attempt.assessmentVersion ||
      attempt.assessmentVersion.status === ConfigurationStatus.ARCHIVED ||
      attempt.assessmentVersion.status === ConfigurationStatus.BLOCKED
    )
      throw new BadRequestException("La versión de evaluación no es válida.");
    const answeredPairs = new Set(
      attempt.forcedChoiceAnswers.map((answer) => answer.pairQuestionId),
    );
    const missingPairs = attempt.assessmentVersion.pairQuestions.filter(
      ({ id }) => !answeredPairs.has(id),
    );
    if (missingPairs.length)
      throw new BadRequestException(
        `Faltan ${missingPairs.length} preguntas pareadas obligatorias.`,
      );
    const answeredLikert = new Set(
      attempt.likertAnswers.map((answer) => answer.likertQuestionId),
    );
    const missingLikert = attempt.assessmentVersion.likertQuestions.filter(
      ({ id }) => !answeredLikert.has(id),
    );
    if (missingLikert.length)
      throw new BadRequestException(
        `Faltan ${missingLikert.length} preguntas Likert obligatorias.`,
      );
    const answeredDemographics = new Set(
      attempt.demographicAnswers.map((answer) => answer.demographicFieldId),
    );
    const missingDemographics =
      attempt.assessmentVersion.demographicFields.filter(
        ({ id }) => !answeredDemographics.has(id),
      );
    if (missingDemographics.length)
      throw new BadRequestException(
        `Faltan ${missingDemographics.length} datos estadísticos obligatorios.`,
      );

    const activeConfiguration =
      await this.prisma.assessmentActiveConfiguration.findUnique({
        where: { assessmentId: attempt.assessmentVersion.assessmentId },
      });
    const scoringVersion = attempt.scoringKeyVersionId
      ? await this.prisma.scoringKeyVersion.findUnique({
          where: { id: attempt.scoringKeyVersionId },
        })
      : activeConfiguration?.assessmentVersionId ===
          attempt.assessmentVersion.id
        ? await this.prisma.scoringKeyVersion.findUnique({
            where: { id: activeConfiguration.scoringKeyVersionId },
          })
        : await this.prisma.scoringKeyVersion.findFirst({
            where: {
              assessmentVersionId: attempt.assessmentVersion.id,
              status: ConfigurationStatus.PUBLISHED,
            },
            orderBy: { version: "desc" },
          });
    if (
      !scoringVersion ||
      scoringVersion.status !== ConfigurationStatus.PUBLISHED
    )
      throw new BadRequestException(
        "No existe una clave de puntuación publicada para esta evaluación.",
      );
    const normVersion = attempt.normVersionId
      ? await this.prisma.normVersion.findUnique({
          where: { id: attempt.normVersionId },
        })
      : activeConfiguration?.assessmentVersionId ===
          attempt.assessmentVersion.id
        ? await this.prisma.normVersion.findUnique({
            where: { id: activeConfiguration.normVersionId },
          })
        : await this.prisma.normVersion.findFirst({
            where: {
              status: ConfigurationStatus.PUBLISHED,
              normSetId:
                attempt.assessmentVersion.defaultNormSetId ?? undefined,
            },
            orderBy: { publishedAt: "desc" },
          });
    if (!normVersion || normVersion.status !== ConfigurationStatus.PUBLISHED)
      throw new BadRequestException(
        "No existe una norma publicada disponible.",
      );

    const reportMappingVersion = activeConfiguration?.reportMappingVersionId
      ? await this.prisma.reportMappingVersion.findUnique({
          where: { id: activeConfiguration.reportMappingVersionId },
        })
      : await this.prisma.reportMappingVersion.findFirst({
          where: {
            assessmentVersionId: attempt.assessmentVersion.id,
            status: ConfigurationStatus.PUBLISHED,
          },
          orderBy: { version: "desc" },
        });
    const [
      rulesData,
      likertRulesData,
      componentsData,
      derivedMetricData,
      normTargets,
    ] = await Promise.all([
      this.prisma.reactiveScoringRule.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        include: {
          reactive: { include: { pairQuestion: { select: { code: true } } } },
          scale: { select: { code: true } },
        },
      }),
      this.prisma.likertScoringRule.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        include: {
          likertQuestion: {
            include: { optionSet: { include: { options: true } } },
          },
          scale: { select: { code: true } },
        },
      }),
      this.prisma.compositeComponent.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        orderBy: [{ compositeId: "asc" }, { order: "asc" }],
        include: { composite: true, scale: { select: { code: true } } },
      }),
      this.prisma.derivedMetricVersion.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        include: { derivedMetric: true, sourceScale: true },
      }),
      this.prisma.normTarget.findMany({
        where: { normVersionId: normVersion.id },
        include: { thresholds: { orderBy: { ordinal: "asc" } } },
      }),
    ]);
    const rules: ScoringRule[] = rulesData.map((rule) => ({
      reactiveCode: rule.reactive.code,
      pairCode: rule.reactive.pairQuestion.code,
      scaleCode: rule.scale.code,
      scoreIfMore: Number(rule.scoreIfMore),
      scoreIfLess: Number(rule.scoreIfLess),
    }));
    const grouped = new Map<string, CompositeDefinition>();
    for (const component of componentsData) {
      const current =
        grouped.get(component.composite.code) ??
        ({
          code: component.composite.code,
          aggregationMethod: component.aggregationMethod,
          components: [],
        } as CompositeDefinition);
      current.components.push({
        scaleCode: component.scale.code,
        weight: Number(component.weight),
        order: component.order,
      });
      grouped.set(component.composite.code, current);
    }
    const likertRules: LikertScoringDefinition[] = likertRulesData.map(
      (rule) => {
        const values = rule.likertQuestion.optionSet.options.map(
          (option) => option.value,
        );
        return {
          questionCode: rule.likertQuestion.code,
          scaleCode: rule.scale.code,
          weight: Number(rule.weight),
          reverse: rule.reverse,
          minValue: Math.min(...values),
          maxValue: Math.max(...values),
          scoreMap: jsonNumberMap(rule.scoreMap),
        };
      },
    );
    const derivedMetricDefinitions: DerivedMetricDefinition[] =
      derivedMetricData.map((metric) => ({
        code: metric.derivedMetric.code,
        calculationType: derivedCalculationType(metric.calculationType),
        sourceScaleCode: metric.sourceScale?.code ?? null,
        sources: derivedSources(metric.declarativeConfig),
      }));
    const aliases = reportAliases(reportMappingVersion?.configuration);
    const norms: NormDefinition[] = normTargets.map((target) => ({
      targetType: target.targetType,
      targetCode: target.targetCode,
      status: target.status,
      isBlocked: target.isBlocked,
      thresholds: target.thresholds.map((threshold) => ({
        decile: threshold.decile,
        lowerBound: Number(threshold.lowerBound),
        ordinal: threshold.ordinal,
      })),
    }));
    const answers = attempt.forcedChoiceAnswers.map((answer) => ({
      pairCode: answer.pairQuestion.code,
      selectedMoreReactiveCode: answer.selectedMoreReactive.code,
    }));
    const calculation = calculateAssessment({
      answers,
      rules,
      likertAnswers: attempt.likertAnswers.map((answer) => ({
        questionCode:
          likertRulesData.find(
            (rule) => rule.likertQuestionId === answer.likertQuestionId,
          )?.likertQuestion.code ?? answer.likertQuestionId,
        value: answer.value,
      })),
      likertRules,
      composites: [...grouped.values()],
      derivedMetricDefinitions,
      reportAliases: aliases,
      norms,
    });
    const configHash = configurationHash({
      assessmentVersion: {
        id: attempt.assessmentVersion.id,
        hash: attempt.assessmentVersion.configurationHash,
      },
      scoringKeyVersion: {
        id: scoringVersion.id,
        hash: scoringVersion.configurationHash,
      },
      normVersion: { id: normVersion.id, hash: normVersion.configurationHash },
      engineVersion: DPO_ENGINE_VERSION,
    });
    const inputHash = configurationHash({
      answers: [...answers].sort((left, right) =>
        left.pairCode.localeCompare(right.pairCode),
      ),
      likert: attempt.likertAnswers
        .map(({ likertQuestionId, value }) => ({ likertQuestionId, value }))
        .sort((left, right) =>
          left.likertQuestionId.localeCompare(right.likertQuestionId),
        ),
    });
    const reactiveIds = new Map(
      rulesData.map((rule) => [rule.reactive.code, rule.reactiveId]),
    );

    let completedRun;
    try {
      completedRun = await this.prisma.$transaction(
        async (tx) => {
          await tx.attempt.update({
            where: { id: attemptId },
            data: {
              status: AttemptStatus.SUBMITTED,
              submittedAt: new Date(),
              assessmentVersionId: attempt.assessmentVersion?.id,
              scoringKeyVersionId: scoringVersion.id,
              normVersionId: normVersion.id,
            },
          });
          await tx.attempt.update({
            where: { id: attemptId },
            data: { status: AttemptStatus.SCORING },
          });
          const run = await tx.resultRun.create({
            data: {
              attemptId,
              assessmentVersionId: attempt.assessmentVersion?.id ?? "",
              scoringKeyVersionId: scoringVersion.id,
              normVersionId: normVersion.id,
              reportMappingVersionId: reportMappingVersion?.id,
              engineVersion: DPO_ENGINE_VERSION,
              configurationHash: configHash,
              inputHash,
              status: ResultRunStatus.COMPLETED,
              isOfficial: true,
              diagnostics: asJson({
                numericMode: scoringVersion.numericMode,
                roundingMode: normVersion.roundingMode,
                likertScoringStatus: likertRules.length
                  ? "CONFIGURED"
                  : "PENDING_SCORING_SPEC",
                likertContributions: calculation.likertContributions,
                likertDimensions: calculation.likertDimensions.length,
                reportAliases: calculation.aliases.length,
              }),
              values: {
                create: [
                  ...calculation.scales,
                  ...calculation.composites,
                  ...calculation.derivedMetrics,
                  ...calculation.likertDimensions,
                  ...(calculation.likertTotal ? [calculation.likertTotal] : []),
                  ...calculation.aliases,
                ].map((value) => ({
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
            include: { values: true },
          });
          await tx.attempt.update({
            where: { id: attemptId },
            data: {
              status: AttemptStatus.COMPLETED,
              completedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });
          await tx.assignment.update({
            where: { id: attempt.assignmentId },
            data: { status: "COMPLETED" },
          });
          return run;
        },
        { timeout: 120_000 },
      );
    } catch (error) {
      await this.prisma.attempt
        .update({
          where: { id: attemptId },
          data: {
            status: AttemptStatus.SCORING_ERROR,
            lastActivityAt: new Date(),
          },
        })
        .catch(() => undefined);
      throw error;
    }
    await this.reports?.generateAndEmail(completedRun.id).catch((error: unknown) => {
      this.logger.error(
        `El resultado ${completedRun.id} quedó completo, pero no fue posible generar o enviar su reporte: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return completedRun;
  }
}

function jsonNumberMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  return entries.length ? Object.fromEntries(entries) : null;
}

function derivedCalculationType(
  value: string,
): DerivedMetricDefinition["calculationType"] {
  if (
    value === "SUM" ||
    value === "ARITHMETIC_MEAN" ||
    value === "WEIGHTED_MEAN" ||
    value === "DIRECT_SCALE" ||
    value === "DECILE_MEAN" ||
    value === "CUSTOM_DECLARATIVE"
  )
    return value;
  throw new BadRequestException(
    `El tipo de métrica derivada ${value} no está soportado.`,
  );
}

function derivedSources(value: unknown): DerivedMetricDefinition["sources"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const sources = (value as Record<string, unknown>).sources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const source = entry as Record<string, unknown>;
    if (
      (source.targetType !== "SCALE" && source.targetType !== "COMPOSITE") ||
      typeof source.targetCode !== "string"
    )
      return [];
    return [
      {
        targetType: source.targetType,
        targetCode: source.targetCode,
        valueType: source.valueType === "DECILE" ? "DECILE" : "RAW",
        weight:
          typeof source.weight === "number" && Number.isFinite(source.weight)
            ? source.weight
            : 1,
      },
    ];
  });
}

function reportAliases(value: unknown): ReportAliasDefinition[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const aliases = (value as Record<string, unknown>).aliases;
  if (!Array.isArray(aliases)) return [];
  return aliases.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const alias = entry as Record<string, unknown>;
    if (
      typeof alias.alias !== "string" ||
      (alias.sourceType !== "SCALE" && alias.sourceType !== "COMPOSITE") ||
      typeof alias.sourceCode !== "string"
    )
      return [];
    return [
      {
        code: `REPORT_ALIAS:${alias.alias}`,
        label: alias.alias,
        sourceType: alias.sourceType,
        sourceCode: alias.sourceCode,
      },
    ];
  });
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
