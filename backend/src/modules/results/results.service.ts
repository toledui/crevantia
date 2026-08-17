import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/auth.types";
import { PrismaService } from "../../database/prisma.service";
import {
  ConfigurationStatus,
  ResultRunStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { configurationHash } from "../scoring/configuration-hash";
import { resolveDecile } from "../scoring/scoring-engine";
import { RecalculateResultDto } from "./results.dto";

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser, id: string) {
    const result = await this.prisma.resultRun.findUnique({
      where: { id },
      include: {
        attempt: { include: { assignment: { select: { userId: true } } } },
        assessmentVersion: {
          select: { id: true, version: true, versionCode: true },
        },
        scoringKeyVersion: {
          select: { id: true, version: true, sourceVersion: true },
        },
        normVersion: {
          include: { normSet: { select: { code: true, name: true } } },
        },
        values: { orderBy: [{ targetType: "asc" }, { targetCode: "asc" }] },
        recalculations: {
          select: {
            id: true,
            normVersionId: true,
            calculatedAt: true,
            reason: true,
          },
        },
      },
    });
    if (!result) throw new NotFoundException("El resultado no existe.");
    this.assertAccess(user, result.attempt.assignment.userId, "result.read");
    return result;
  }

  async audit(user: AuthenticatedUser, id: string) {
    if (!user.permissions.includes("result.audit"))
      throw new ForbiddenException(
        "No tienes permiso para consultar la auditoría psicométrica.",
      );
    const result = await this.prisma.resultRun.findUnique({
      where: { id },
      include: {
        contributions: {
          orderBy: [{ scaleId: "asc" }, { reactiveId: "asc" }],
          include: {
            reactive: {
              select: {
                code: true,
                text: true,
                pairQuestion: { select: { code: true } },
              },
            },
          },
        },
        values: true,
      },
    });
    if (!result) throw new NotFoundException("El resultado no existe.");
    return {
      resultRunId: result.id,
      configurationHash: result.configurationHash,
      engineVersion: result.engineVersion,
      calculatedAt: result.calculatedAt,
      contributions: result.contributions,
      values: result.values,
    };
  }

  async recalculate(
    user: AuthenticatedUser,
    id: string,
    dto: RecalculateResultDto,
  ) {
    if (!user.permissions.includes("result.recalculate"))
      throw new ForbiddenException(
        "No tienes permiso para recalificar resultados.",
      );
    const original = await this.prisma.resultRun.findUnique({
      where: { id },
      include: { values: true, contributions: true },
    });
    if (!original || original.status !== ResultRunStatus.COMPLETED)
      throw new NotFoundException("El resultado original completo no existe.");
    const norm = await this.prisma.normVersion.findUnique({
      where: { id: dto.normVersionId },
      include: {
        targets: { include: { thresholds: { orderBy: { ordinal: "asc" } } } },
      },
    });
    if (!norm || norm.status !== ConfigurationStatus.PUBLISHED)
      throw new BadRequestException(
        "La recalificación requiere una norma publicada.",
      );
    const targets = new Map(
      norm.targets.map((target) => [
        `${target.targetType}:${target.targetCode}`,
        target,
      ]),
    );
    const hash = configurationHash({
      assessmentVersionId: original.assessmentVersionId,
      scoringKeyVersionId: original.scoringKeyVersionId,
      normVersion: { id: norm.id, hash: norm.configurationHash },
      engineVersion: original.engineVersion,
    });
    return this.prisma.$transaction(
      async (tx) => {
        const recalculation = await tx.resultRun.create({
          data: {
            attemptId: original.attemptId,
            assessmentVersionId: original.assessmentVersionId,
            scoringKeyVersionId: original.scoringKeyVersionId,
            normVersionId: norm.id,
            reportMappingVersionId: original.reportMappingVersionId,
            engineVersion: original.engineVersion,
            configurationHash: hash,
            inputHash: original.inputHash,
            status: ResultRunStatus.COMPLETED,
            isOfficial: false,
            recalculationOfResultRunId: original.id,
            reason: dto.reason.trim(),
            requestedById: user.sub,
            diagnostics: asJson({
              recalculation: true,
              originalResultRunId: original.id,
              historicalResultPreserved: true,
            }),
            values: {
              create: original.values.map((value) => {
                const target = targets.get(
                  `${value.targetType}:${value.targetCode}`,
                );
                const decile = target
                  ? resolveDecile(
                      Number(value.rawScore),
                      target.thresholds.map((threshold) => ({
                        decile: threshold.decile,
                        lowerBound: Number(threshold.lowerBound),
                        ordinal: threshold.ordinal,
                      })),
                    )
                  : null;
                return {
                  targetType: value.targetType,
                  targetCode: value.targetCode,
                  rawScore: value.rawScore,
                  displayScore: value.displayScore,
                  normalizedScore: value.normalizedScore,
                  decile,
                  status: target?.status ?? "NORM_NOT_CONFIGURED",
                  metadata: value.metadata ?? undefined,
                };
              }),
            },
            contributions: {
              create: original.contributions.map((contribution) => ({
                reactiveId: contribution.reactiveId,
                selection: contribution.selection,
                scoreIfMore: contribution.scoreIfMore,
                scoreIfLess: contribution.scoreIfLess,
                appliedScore: contribution.appliedScore,
                scaleId: contribution.scaleId,
              })),
            },
          },
          include: { values: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            action: "RESULT_RECALCULATED",
            entityType: "ResultRun",
            entityId: recalculation.id,
            reason: dto.reason.trim(),
            before: asJson({
              resultRunId: original.id,
              normVersionId: original.normVersionId,
            }),
            after: asJson({
              resultRunId: recalculation.id,
              normVersionId: norm.id,
            }),
          },
        });
        return recalculation;
      },
      { timeout: 120_000 },
    );
  }

  private assertAccess(
    user: AuthenticatedUser,
    ownerId: string,
    permission: string,
  ) {
    if (user.sub !== ownerId && !user.permissions.includes(permission))
      throw new ForbiddenException("No puedes consultar este resultado.");
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
