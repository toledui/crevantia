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
  type NormTargetType,
  ResultRunStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { configurationHash } from "../scoring/configuration-hash";
import { resolveDecile } from "../scoring/scoring-engine";
import { RecalculateResultDto } from "./results.dto";
import { ListAdminResultsDto } from "./admin-results.dto";

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser, id: string, exact = false) {
    const requestedResult = await this.findResultRun(id);
    if (!requestedResult)
      throw new NotFoundException("El resultado no existe.");
    this.assertAccess(
      user,
      requestedResult.attempt.assignment.userId,
      "result.read",
    );

    const originalResultRunId =
      requestedResult.recalculationOfResultRunId ?? requestedResult.id;
    const resultHistory = await this.prisma.resultRun.findMany({
      where: {
        status: ResultRunStatus.COMPLETED,
        OR: [
          { id: originalResultRunId },
          { recalculationOfResultRunId: originalResultRunId },
        ],
      },
      orderBy: [{ calculatedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        isOfficial: true,
        recalculationOfResultRunId: true,
        calculatedAt: true,
        reason: true,
        configurationHash: true,
        normVersion: {
          select: {
            version: true,
            normSet: { select: { code: true, name: true } },
          },
        },
      },
    });
    const latestResultRunId = resultHistory.at(-1)?.id ?? requestedResult.id;
    const result =
      !exact && latestResultRunId !== requestedResult.id
        ? await this.findResultRun(latestResultRunId)
        : requestedResult;
    if (!result) throw new NotFoundException("El resultado no existe.");

    const targetCodes = result.values.map(({ targetCode }) => targetCode);
    const [scales, composites, derivedMetrics] = await Promise.all([
      this.prisma.scale.findMany({
        where: { code: { in: targetCodes } },
        select: { code: true, name: true },
      }),
      this.prisma.composite.findMany({
        where: { code: { in: targetCodes } },
        select: { code: true, name: true },
      }),
      this.prisma.derivedMetric.findMany({
        where: { code: { in: targetCodes } },
        select: { code: true, name: true },
      }),
    ]);
    const names = new Map(
      [...scales, ...composites, ...derivedMetrics].map(({ code, name }) => [
        code,
        name,
      ]),
    );
    names.set("LIKERT-TOTAL", "Total de Gestión de recursos");
    return {
      ...result,
      requestedResultRunId: id,
      displayedResultRunId: result.id,
      isLatestResultRun: result.id === latestResultRunId,
      resultHistory,
      values: result.values.map((value) => ({
        ...value,
        targetName: names.get(value.targetCode) ?? value.targetCode,
      })),
    };
  }

  private findResultRun(id: string) {
    return this.prisma.resultRun.findUnique({
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
          orderBy: { calculatedAt: "desc" },
          select: {
            id: true,
            normVersionId: true,
            calculatedAt: true,
            reason: true,
          },
        },
      },
    });
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
      include: {
        values: true,
        contributions: true,
        scoringKeyVersion: {
          include: {
            derivedMetricVersions: { include: { derivedMetric: true } },
          },
        },
        reportMappingVersion: true,
      },
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
    const decileMeanCodes = new Set(
      original.scoringKeyVersion.derivedMetricVersions
        .filter((metric) => metric.calculationType === "DECILE_MEAN")
        .map((metric) => metric.derivedMetric.code),
    );
    const recalculatedValues: Prisma.ResultValueCreateWithoutResultRunInput[] =
      original.values
        .filter(
          (value) =>
            value.targetType !== "REPORT_ALIAS" &&
            !decileMeanCodes.has(value.targetCode),
        )
        .map((value) => recalculateNormedValue(value, targets));
    const byTarget = new Map(
      recalculatedValues.map((value) => [
        `${value.targetType}:${value.targetCode}`,
        value,
      ]),
    );
    for (const metric of original.scoringKeyVersion.derivedMetricVersions) {
      if (metric.calculationType !== "DECILE_MEAN") continue;
      const sources = decileMeanSources(metric.declarativeConfig);
      const values = sources.map((source) => {
        const value = byTarget.get(`${source.targetType}:${source.targetCode}`);
        if (value?.decile == null)
          throw new BadRequestException(
            `La nueva norma no permite recalcular ${metric.derivedMetric.code}: falta el decil de ${source.targetType}:${source.targetCode}.`,
          );
        return { value: value.decile, weight: source.weight };
      });
      if (!values.length)
        throw new BadRequestException(
          `La métrica ${metric.derivedMetric.code} no tiene fuentes declaradas.`,
        );
      const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
      const score =
        values.reduce((sum, value) => sum + value.value * value.weight, 0) /
        totalWeight;
      const derived: Prisma.ResultValueCreateWithoutResultRunInput = {
        targetType: "DERIVED_METRIC",
        targetCode: metric.derivedMetric.code,
        rawScore: score,
        displayScore: Number(score.toFixed(10)),
        normalizedScore: score,
        decile: Number.isInteger(score) ? score : null,
        status: "CALCULATED_DECILE_MEAN",
        metadata: asJson({ calculation: "DECILE_MEAN" }),
      };
      recalculatedValues.push(derived);
      byTarget.set(`DERIVED_METRIC:${derived.targetCode}`, derived);
    }
    for (const alias of reportAliases(
      original.reportMappingVersion?.configuration,
    )) {
      const source = byTarget.get(`${alias.sourceType}:${alias.sourceCode}`);
      if (!source)
        throw new BadRequestException(
          `No se puede reconstruir el alias ${alias.alias}: falta ${alias.sourceType}:${alias.sourceCode}.`,
        );
      recalculatedValues.push({
        ...source,
        targetType: "REPORT_ALIAS",
        targetCode: `REPORT_ALIAS:${alias.alias}`,
        status: "DIRECT_ALIAS",
      });
    }
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
              create: recalculatedValues,
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

  async listAdminResults(dto: ListAdminResultsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 25;
    const skip = (page - 1) * limit;
    const search = dto.search?.trim();

    const where: Prisma.ResultRunWhereInput = {
      status: ResultRunStatus.COMPLETED,
      ...(dto.type === "OFFICIAL"
        ? { isOfficial: true }
        : dto.type === "RECALCULATED"
          ? { isOfficial: false }
          : {}),
      ...(search
        ? {
            OR: [
              {
                attempt: {
                  assignment: { user: { firstName: { contains: search } } },
                },
              },
              {
                attempt: {
                  assignment: { user: { lastName: { contains: search } } },
                },
              },
              {
                attempt: {
                  assignment: { user: { email: { contains: search } } },
                },
              },
              { normVersion: { normSet: { name: { contains: search } } } },
              { id: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.resultRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { calculatedAt: "desc" },
        include: {
          attempt: {
            include: {
              assignment: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                  test: { select: { id: true, code: true, name: true } },
                  testVersion: { select: { id: true, version: true } },
                },
              },
            },
          },
          normVersion: {
            include: {
              normSet: { select: { id: true, code: true, name: true } },
            },
          },
          values: {
            where: { targetType: "COMPOSITE" },
            orderBy: { targetCode: "asc" },
          },
          recalculations: {
            select: { id: true, calculatedAt: true, reason: true },
          },
        },
      }),
      this.prisma.resultRun.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        isOfficial: item.isOfficial,
        status: item.status,
        calculatedAt: item.calculatedAt,
        configurationHash: item.configurationHash,
        engineVersion: item.engineVersion,
        reason: item.reason,
        recalculationOfResultRunId: item.recalculationOfResultRunId,
        recalculationsCount: item.recalculations.length,
        candidate: {
          id: item.attempt.assignment.user.id,
          email: item.attempt.assignment.user.email,
          firstName: item.attempt.assignment.user.firstName,
          lastName: item.attempt.assignment.user.lastName,
        },
        test: {
          id: item.attempt.assignment.test.id,
          code: item.attempt.assignment.test.code,
          name: item.attempt.assignment.test.name,
          version: item.attempt.assignment.testVersion.version,
        },
        norm: {
          id: item.normVersion.id,
          version: item.normVersion.version,
          normSet: {
            id: item.normVersion.normSet.id,
            code: item.normVersion.normSet.code,
            name: item.normVersion.normSet.name,
          },
        },
        attempt: {
          id: item.attempt.id,
          startedAt: item.attempt.startedAt,
          completedAt: item.attempt.completedAt,
        },
        topDimensions: item.values.map((v) => ({
          id: v.id,
          targetType: v.targetType,
          targetCode: v.targetCode,
          rawScore: v.rawScore.toString(),
          displayScore: v.displayScore?.toString() ?? null,
          normalizedScore: v.normalizedScore?.toString() ?? null,
          decile: v.decile,
          status: v.status,
        })),
      })),
      total,
      page,
      limit,
    };
  }

  async getAdminResultsSummary() {
    const [totalResults, officialResults, recalculatedResults] =
      await Promise.all([
        this.prisma.resultRun.count({
          where: { status: ResultRunStatus.COMPLETED },
        }),
        this.prisma.resultRun.count({
          where: { status: ResultRunStatus.COMPLETED, isOfficial: true },
        }),
        this.prisma.resultRun.count({
          where: { status: ResultRunStatus.COMPLETED, isOfficial: false },
        }),
      ]);

    return {
      totalResults,
      officialResults,
      recalculatedResults,
    };
  }

  async getAdminResultDetails(id: string) {
    const result = await this.prisma.resultRun.findUnique({
      where: { id },
      include: {
        attempt: {
          include: {
            assignment: {
              include: {
                user: true,
                test: true,
                testVersion: true,
              },
            },
          },
        },
        assessmentVersion: {
          select: { id: true, version: true, versionCode: true },
        },
        scoringKeyVersion: {
          select: { id: true, version: true, sourceVersion: true },
        },
        normVersion: {
          include: {
            normSet: true,
            targets: {
              include: {
                thresholds: { orderBy: { ordinal: "asc" } },
              },
            },
          },
        },
        values: {
          orderBy: [{ targetType: "asc" }, { targetCode: "asc" }],
        },
        recalculationOf: {
          include: {
            normVersion: { include: { normSet: true } },
          },
        },
        recalculations: {
          include: {
            normVersion: { include: { normSet: true } },
          },
          orderBy: { calculatedAt: "desc" },
        },
      },
    });

    if (!result)
      throw new NotFoundException("El resultado psicométrico no existe.");

    // Fetch published norm versions for potential recalculation
    const availableNorms = await this.prisma.normVersion.findMany({
      where: { status: ConfigurationStatus.PUBLISHED },
      include: { normSet: { select: { id: true, code: true, name: true } } },
      orderBy: [{ normSet: { name: "asc" } }, { version: "desc" }],
    });

    return {
      ...result,
      availableNorms,
    };
  }

  async getAvailableNorms() {
    return this.prisma.normVersion.findMany({
      where: { status: ConfigurationStatus.PUBLISHED },
      include: { normSet: { select: { id: true, code: true, name: true } } },
      orderBy: [{ normSet: { name: "asc" } }, { version: "desc" }],
    });
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

type NormTargetWithThresholds = {
  status: string;
  thresholds: Array<{
    decile: number;
    lowerBound: Prisma.Decimal;
    ordinal: number;
  }>;
};

function recalculateNormedValue(
  value: {
    targetType: NormTargetType;
    targetCode: string;
    rawScore: Prisma.Decimal;
    displayScore: Prisma.Decimal | null;
    metadata: Prisma.JsonValue | null;
  },
  targets: ReadonlyMap<string, NormTargetWithThresholds>,
): Prisma.ResultValueCreateWithoutResultRunInput {
  const target = targets.get(`${value.targetType}:${value.targetCode}`);
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
    normalizedScore: decile,
    decile,
    status: target?.status ?? "NORM_NOT_CONFIGURED",
    metadata: value.metadata ?? undefined,
  };
}

function decileMeanSources(value: unknown) {
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
        weight:
          typeof source.weight === "number" && Number.isFinite(source.weight)
            ? source.weight
            : 1,
      },
    ];
  });
}

function reportAliases(value: unknown) {
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
        alias: alias.alias,
        sourceType: alias.sourceType,
        sourceCode: alias.sourceCode,
      },
    ];
  });
}
