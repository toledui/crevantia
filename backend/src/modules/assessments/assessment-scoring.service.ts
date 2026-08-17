import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/auth.types";
import { PrismaService } from "../../database/prisma.service";
import {
  AttemptStatus,
  ConfigurationStatus,
  ResultRunStatus,
} from "../../generated/prisma/client";
import { configurationHash } from "../scoring/configuration-hash";
import {
  calculateAssessment,
  DPO_ENGINE_VERSION,
  type CompositeDefinition,
  type NormDefinition,
  type ScoringRule,
} from "../scoring/scoring-engine";

@Injectable()
export class AssessmentScoringService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (
      attempt.forcedChoiceAnswers.length !==
      attempt.assessmentVersion.pairQuestions.length
    )
      throw new BadRequestException(
        `Faltan ${attempt.assessmentVersion.pairQuestions.length - attempt.forcedChoiceAnswers.length} preguntas pareadas obligatorias.`,
      );
    if (
      attempt.likertAnswers.length !==
      attempt.assessmentVersion.likertQuestions.length
    )
      throw new BadRequestException(
        `Faltan ${attempt.assessmentVersion.likertQuestions.length - attempt.likertAnswers.length} preguntas Likert obligatorias.`,
      );
    if (
      attempt.demographicAnswers.length !==
      attempt.assessmentVersion.demographicFields.length
    )
      throw new BadRequestException(
        `Faltan ${attempt.assessmentVersion.demographicFields.length - attempt.demographicAnswers.length} datos estadísticos obligatorios.`,
      );

    const scoringVersion = attempt.scoringKeyVersionId
      ? await this.prisma.scoringKeyVersion.findUnique({
          where: { id: attempt.scoringKeyVersionId },
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
      : await this.prisma.normVersion.findFirst({
          where: { status: ConfigurationStatus.PUBLISHED },
          orderBy: { publishedAt: "desc" },
        });
    if (!normVersion || normVersion.status !== ConfigurationStatus.PUBLISHED)
      throw new BadRequestException(
        "No existe una norma publicada disponible.",
      );

    const [rulesData, componentsData, normTargets] = await Promise.all([
      this.prisma.reactiveScoringRule.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        include: {
          reactive: { include: { pairQuestion: { select: { code: true } } } },
          scale: { select: { code: true } },
        },
      }),
      this.prisma.compositeComponent.findMany({
        where: { scoringKeyVersionId: scoringVersion.id },
        orderBy: [{ compositeId: "asc" }, { order: "asc" }],
        include: { composite: true, scale: { select: { code: true } } },
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
      composites: [...grouped.values()],
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

    try {
      return await this.prisma.$transaction(
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
              engineVersion: DPO_ENGINE_VERSION,
              configurationHash: configHash,
              inputHash,
              status: ResultRunStatus.COMPLETED,
              isOfficial: true,
              diagnostics: {
                numericMode: scoringVersion.numericMode,
                roundingMode: normVersion.roundingMode,
                likertScoringStatus: "PENDING_SCORING_SPEC",
              },
              values: {
                create: [
                  ...calculation.scales,
                  ...calculation.composites,
                  ...calculation.derivedMetrics,
                ].map((value) => ({
                  targetType: value.targetType,
                  targetCode: value.targetCode,
                  rawScore: value.rawScore,
                  displayScore: value.displayScore,
                  decile: value.decile,
                  status: value.status,
                  metadata:
                    value.targetType === "DERIVED_METRIC"
                      ? { calculation: "EXPLICIT_AXIS" }
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
  }
}
