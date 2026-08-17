import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { configurationHash } from "../scoring/configuration-hash";
import { resolveDecile } from "../scoring/scoring-engine";
import { PrismaService } from "../../database/prisma.service";
import {
  ConfigurationStatus,
  type NormTargetType,
  type Prisma,
} from "../../generated/prisma/client";
import {
  CreateNormTargetDto,
  ImpactPreviewDto,
  ReplaceThresholdsDto,
  UpdateNormTargetDto,
  UpdateNormVersionDto,
} from "./norms.dto";
import { validateNormTargets } from "./norm-validator";

@Injectable()
export class NormsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.normSet.findMany({
      orderBy: { code: "asc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            name: true,
            status: true,
            populationLabel: true,
            sampleSize: true,
            validationStatus: true,
            publishedAt: true,
            updatedAt: true,
            _count: { select: { targets: true } },
          },
        },
      },
    });
    return { items };
  }

  async detail(normSetId: string) {
    const norm = await this.prisma.normSet.findUnique({
      where: { id: normSetId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: { _count: { select: { targets: true, resultRuns: true } } },
        },
      },
    });
    if (!norm) throw new NotFoundException("La norma no existe.");
    return norm;
  }

  async versions(normSetId: string) {
    await this.assertNormSet(normSetId);
    return {
      items: await this.prisma.normVersion.findMany({
        where: { normSetId },
        orderBy: { version: "desc" },
        include: { _count: { select: { targets: true, resultRuns: true } } },
      }),
    };
  }

  async version(versionId: string) {
    const version = await this.prisma.normVersion.findUnique({
      where: { id: versionId },
      include: {
        normSet: true,
        targets: {
          orderBy: [{ targetType: "asc" }, { name: "asc" }],
          include: { thresholds: { orderBy: { ordinal: "asc" } } },
        },
        validationRuns: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { issues: true },
        },
      },
    });
    if (!version)
      throw new NotFoundException("La versión normativa no existe.");
    return version;
  }

  async clone(actorId: string, normSetId: string, sourceVersionId: string) {
    const source = await this.version(sourceVersionId);
    if (source.normSetId !== normSetId)
      throw new BadRequestException("La versión no pertenece a esta norma.");
    const latest = await this.prisma.normVersion.aggregate({
      where: { normSetId },
      _max: { version: true },
    });
    return this.prisma.$transaction(
      async (tx) => {
        const cloned = await tx.normVersion.create({
          data: {
            normSetId,
            version: (latest._max.version ?? 0) + 1,
            name: `${source.name} v${(latest._max.version ?? 0) + 1}`,
            description: source.description,
            status: ConfigurationStatus.DRAFT,
            populationLabel: source.populationLabel,
            sampleSize: source.sampleSize,
            country: source.country,
            ageRange: source.ageRange,
            notes: source.notes,
            lookupMethod: source.lookupMethod,
            numericMode: source.numericMode,
            roundingMode: source.roundingMode,
            createdById: actorId,
            configurationHash: configurationHash({
              clonedFrom: source.id,
              sourceHash: source.configurationHash,
            }),
            sourceMetadata: asJson({
              clonedFromVersionId: source.id,
              sourceVersion: source.version,
            }),
            targets: {
              create: source.targets.map((target) => ({
                targetType: target.targetType,
                targetCode: target.targetCode,
                sourceCode: target.sourceCode,
                name: target.name,
                status: target.status,
                isBlocked: target.isBlocked,
                validationNotes: target.validationNotes,
                sourceReference: target.sourceReference,
                thresholds: {
                  create: target.thresholds.map((threshold) => ({
                    decile: threshold.decile,
                    lowerBound: threshold.lowerBound,
                    ordinal: threshold.ordinal,
                    sourceMetadata: threshold.sourceMetadata ?? undefined,
                  })),
                },
              })),
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "NORM_VERSION_CLONED",
            entityType: "NormVersion",
            entityId: cloned.id,
            before: asJson({ sourceVersionId, sourceVersion: source.version }),
            after: asJson({ version: cloned.version, status: cloned.status }),
          },
        });
        return cloned;
      },
      { timeout: 120_000 },
    );
  }

  async updateVersion(
    actorId: string,
    versionId: string,
    dto: UpdateNormVersionDto,
  ) {
    const current = await this.assertDraft(versionId);
    const updated = await this.prisma.normVersion.update({
      where: { id: versionId },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        populationLabel: dto.populationLabel?.trim() || null,
        sampleSize: dto.sampleSize ?? null,
        country: dto.country?.trim() || null,
        ageRange: dto.ageRange?.trim() || null,
        notes: dto.notes?.trim() || null,
        validationStatus: "CHANGED_REQUIRES_VALIDATION",
      },
    });
    await this.rehash(versionId);
    await this.audit(
      actorId,
      "NORM_VERSION_EDITED",
      versionId,
      current,
      updated,
    );
    return this.version(versionId);
  }

  async createTarget(
    actorId: string,
    versionId: string,
    dto: CreateNormTargetDto,
  ) {
    await this.assertDraft(versionId);
    const created = await this.prisma.normTarget.create({
      data: {
        normVersionId: versionId,
        targetType: dto.targetType,
        targetCode: dto.targetCode.trim(),
        name: dto.name.trim(),
        status: dto.status.trim(),
        isBlocked: dto.isBlocked,
        validationNotes: dto.validationNotes?.trim() || null,
      },
    });
    await this.markChanged(versionId);
    await this.audit(actorId, "NORM_VERSION_EDITED", versionId, null, {
      targetCreated: created.id,
    });
    return created;
  }

  async updateTarget(
    actorId: string,
    targetId: string,
    dto: UpdateNormTargetDto,
  ) {
    const current = await this.targetInDraft(targetId);
    const updated = await this.prisma.normTarget.update({
      where: { id: targetId },
      data: {
        name: dto.name.trim(),
        status: dto.status.trim(),
        isBlocked: dto.isBlocked,
        validationNotes: dto.validationNotes?.trim() || null,
      },
    });
    await this.markChanged(current.normVersionId);
    await this.audit(
      actorId,
      "NORM_VERSION_EDITED",
      current.normVersionId,
      current,
      updated,
    );
    return updated;
  }

  async replaceThresholds(
    actorId: string,
    targetId: string,
    dto: ReplaceThresholdsDto,
  ) {
    const target = await this.targetInDraft(targetId);
    if (
      new Set(dto.thresholds.map(({ ordinal }) => ordinal)).size !==
        dto.thresholds.length ||
      new Set(dto.thresholds.map(({ decile }) => decile)).size !==
        dto.thresholds.length
    )
      throw new BadRequestException("Ordinales y deciles no pueden repetirse.");
    await this.prisma.$transaction(async (tx) => {
      await tx.normThreshold.deleteMany({ where: { normTargetId: targetId } });
      await tx.normThreshold.createMany({
        data: dto.thresholds.map((threshold) => ({
          normTargetId: targetId,
          ordinal: threshold.ordinal,
          decile: threshold.decile,
          lowerBound: threshold.lowerBound,
        })),
      });
      await tx.normVersion.update({
        where: { id: target.normVersionId },
        data: { validationStatus: "CHANGED_REQUIRES_VALIDATION" },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "NORM_VERSION_EDITED",
          entityType: "NormVersion",
          entityId: target.normVersionId,
          before: asJson({ targetId, thresholds: target.thresholds }),
          after: asJson({ targetId, thresholds: dto.thresholds }),
        },
      });
    });
    await this.rehash(target.normVersionId);
    return this.version(target.normVersionId);
  }

  async validate(actorId: string, versionId: string) {
    const version = await this.version(versionId);
    if (
      version.status !== ConfigurationStatus.DRAFT &&
      version.status !== ConfigurationStatus.IN_REVIEW
    )
      throw new BadRequestException(
        "Solo se validan borradores o versiones en revisión.",
      );
    const references = new Set<string>();
    for (const scale of await this.prisma.scale.findMany({
      select: { code: true },
    }))
      references.add(`SCALE:${scale.code}`);
    for (const composite of await this.prisma.composite.findMany({
      select: { code: true },
    }))
      references.add(`COMPOSITE:${composite.code}`);
    const issues = validateNormTargets(
      version.targets.map((target) => ({
        id: target.id,
        targetType: target.targetType,
        targetCode: target.targetCode,
        isBlocked: target.isBlocked,
        thresholds: target.thresholds.map((threshold) => ({
          decile: threshold.decile,
          ordinal: threshold.ordinal,
          lowerBound: Number(threshold.lowerBound),
        })),
      })),
      references,
    );
    const counts = {
      errors: issues.filter(({ severity }) => severity === "ERROR").length,
      warnings: issues.filter(({ severity }) => severity === "WARNING").length,
      info: issues.filter(({ severity }) => severity === "INFO").length,
    };
    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.normValidationRun.create({
        data: {
          normVersionId: versionId,
          hasErrors: counts.errors > 0,
          errorCount: counts.errors,
          warningCount: counts.warnings,
          infoCount: counts.info,
          issues: {
            create: issues.map((issue) => ({
              normTargetId: issue.targetId,
              severity: issue.severity,
              code: issue.code,
              message: issue.message,
              metadata: issue.metadata ? asJson(issue.metadata) : undefined,
            })),
          },
        },
        include: { issues: true },
      });
      await tx.normVersion.update({
        where: { id: versionId },
        data: {
          validationStatus: counts.errors
            ? "ERRORS"
            : counts.warnings
              ? "WARNINGS"
              : "VALID",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "NORM_VERSION_VALIDATED",
          entityType: "NormVersion",
          entityId: versionId,
          after: asJson(counts),
        },
      });
      return created;
    });
    return run;
  }

  async submitReview(actorId: string, versionId: string) {
    await this.assertDraft(versionId);
    const validation = await this.latestSuccessfulValidation(versionId);
    const updated = await this.prisma.normVersion.update({
      where: { id: versionId },
      data: { status: ConfigurationStatus.IN_REVIEW, reviewedById: actorId },
    });
    await this.audit(
      actorId,
      "NORM_VERSION_EDITED",
      versionId,
      { status: ConfigurationStatus.DRAFT },
      { status: updated.status, validationRunId: validation.id },
    );
    return updated;
  }

  async approve(actorId: string, versionId: string) {
    const version = await this.prisma.normVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new NotFoundException("La versión normativa no existe.");
    if (version.status !== ConfigurationStatus.IN_REVIEW)
      throw new BadRequestException(
        "Solo una versión en revisión puede aprobarse.",
      );
    await this.latestSuccessfulValidation(versionId);
    const updated = await this.prisma.normVersion.update({
      where: { id: versionId },
      data: { status: ConfigurationStatus.APPROVED, approvedById: actorId },
    });
    await this.audit(
      actorId,
      "NORM_VERSION_APPROVED",
      versionId,
      { status: version.status },
      { status: updated.status },
    );
    return updated;
  }

  async publish(actorId: string, versionId: string) {
    const version = await this.prisma.normVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new NotFoundException("La versión normativa no existe.");
    if (version.status !== ConfigurationStatus.APPROVED)
      throw new BadRequestException(
        "Solo una norma aprobada puede publicarse.",
      );
    await this.latestSuccessfulValidation(versionId);
    await this.prisma.$transaction(async (tx) => {
      await tx.normVersion.updateMany({
        where: {
          normSetId: version.normSetId,
          status: ConfigurationStatus.PUBLISHED,
          id: { not: versionId },
        },
        data: { status: ConfigurationStatus.ARCHIVED },
      });
      await tx.normVersion.update({
        where: { id: versionId },
        data: {
          status: ConfigurationStatus.PUBLISHED,
          publishedById: actorId,
          publishedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "NORM_VERSION_PUBLISHED",
          entityType: "NormVersion",
          entityId: versionId,
          before: asJson({ status: version.status }),
          after: asJson({
            status: ConfigurationStatus.PUBLISHED,
            configurationHash: version.configurationHash,
          }),
        },
      });
    });
    return this.version(versionId);
  }

  async archive(actorId: string, versionId: string) {
    const version = await this.prisma.normVersion.findUnique({
      where: { id: versionId },
    });
    if (!version)
      throw new NotFoundException("La versión normativa no existe.");
    if (
      version.status !== ConfigurationStatus.PUBLISHED &&
      version.status !== ConfigurationStatus.APPROVED
    )
      throw new BadRequestException(
        "Solo una versión publicada o aprobada puede archivarse.",
      );
    const updated = await this.prisma.normVersion.update({
      where: { id: versionId },
      data: { status: ConfigurationStatus.ARCHIVED },
    });
    await this.audit(
      actorId,
      "NORM_VERSION_ARCHIVED",
      versionId,
      { status: version.status },
      { status: updated.status },
    );
    return updated;
  }

  async compare(versionId: string, otherVersionId: string) {
    const [left, right] = await Promise.all([
      this.version(versionId),
      this.version(otherVersionId),
    ]);
    if (left.normSetId !== right.normSetId)
      throw new BadRequestException(
        "Solo pueden compararse versiones de la misma norma.",
      );
    const rightTargets = new Map(
      right.targets.map((target) => [
        `${target.targetType}:${target.targetCode}`,
        target,
      ]),
    );
    const changes: Array<{
      targetType: NormTargetType;
      targetCode: string;
      name: string;
      kind: string;
      thresholds: Array<{
        decile: number;
        previous: number | null;
        next: number;
      }>;
      blocked?: { previous: boolean; next: boolean };
    }> = [];
    for (const target of left.targets) {
      const other = rightTargets.get(
        `${target.targetType}:${target.targetCode}`,
      );
      if (!other) {
        changes.push({
          targetType: target.targetType,
          targetCode: target.targetCode,
          name: target.name,
          kind: "REMOVED",
          thresholds: [],
        });
        continue;
      }
      const previous = new Map(
        target.thresholds.map((threshold) => [
          threshold.decile,
          Number(threshold.lowerBound),
        ]),
      );
      const thresholdChanges = other.thresholds.flatMap((threshold) =>
        previous.get(threshold.decile) === Number(threshold.lowerBound)
          ? []
          : [
              {
                decile: threshold.decile,
                previous: previous.get(threshold.decile) ?? null,
                next: Number(threshold.lowerBound),
              },
            ],
      );
      if (thresholdChanges.length || target.isBlocked !== other.isBlocked)
        changes.push({
          targetType: target.targetType,
          targetCode: target.targetCode,
          name: target.name,
          kind: "MODIFIED",
          thresholds: thresholdChanges,
          blocked: { previous: target.isBlocked, next: other.isBlocked },
        });
    }
    return {
      left: { id: left.id, version: left.version },
      right: { id: right.id, version: right.version },
      changedTargets: changes.length,
      thresholdChanges: changes.reduce(
        (sum, change) => sum + change.thresholds.length,
        0,
      ),
      changes,
    };
  }

  async impactPreview(versionId: string, dto: ImpactPreviewDto) {
    const candidate = await this.version(versionId);
    const targets = new Map(
      candidate.targets.map((target) => [
        `${target.targetType}:${target.targetCode}`,
        target,
      ]),
    );
    const runs = await this.prisma.resultRun.findMany({
      where: {
        status: "COMPLETED",
        normVersion: { normSetId: candidate.normSetId },
      },
      orderBy: { calculatedAt: "desc" },
      take: dto.limit,
      include: { values: true },
    });
    let unchanged = 0;
    let changedOne = 0;
    let changedMore = 0;
    const affected = new Map<string, number>();
    for (const run of runs)
      for (const value of run.values) {
        const target = targets.get(`${value.targetType}:${value.targetCode}`);
        if (!target || value.decile === null) continue;
        const next = resolveDecile(
          Number(value.rawScore),
          target.thresholds.map((threshold) => ({
            decile: threshold.decile,
            lowerBound: Number(threshold.lowerBound),
            ordinal: threshold.ordinal,
          })),
        );
        const delta = Math.abs(next - value.decile);
        if (delta === 0) unchanged += 1;
        else if (delta === 1) changedOne += 1;
        else changedMore += 1;
        if (delta)
          affected.set(
            value.targetCode,
            (affected.get(value.targetCode) ?? 0) + 1,
          );
      }
    return {
      evaluationsAnalyzed: runs.length,
      resultValues: {
        unchanged,
        changedOneDecile: changedOne,
        changedMoreThanOneDecile: changedMore,
      },
      mostAffectedTargets: [...affected]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)
        .map(([targetCode, changes]) => ({ targetCode, changes })),
      persistedChanges: 0,
    };
  }

  private async assertNormSet(id: string) {
    if (
      !(await this.prisma.normSet.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("La norma no existe.");
  }
  private async assertDraft(id: string) {
    const version = await this.prisma.normVersion.findUnique({ where: { id } });
    if (!version)
      throw new NotFoundException("La versión normativa no existe.");
    if (version.status !== ConfigurationStatus.DRAFT)
      throw new BadRequestException(
        "Una norma publicada o fuera de borrador es inmutable; clónala para editarla.",
      );
    return version;
  }
  private async targetInDraft(id: string) {
    const target = await this.prisma.normTarget.findUnique({
      where: { id },
      include: {
        normVersion: true,
        thresholds: { orderBy: { ordinal: "asc" } },
      },
    });
    if (!target) throw new NotFoundException("El target normativo no existe.");
    if (target.normVersion.status !== ConfigurationStatus.DRAFT)
      throw new BadRequestException(
        "Los thresholds de una norma publicada son inmutables; clona la versión.",
      );
    return target;
  }
  private async latestSuccessfulValidation(versionId: string) {
    const validation = await this.prisma.normValidationRun.findFirst({
      where: { normVersionId: versionId },
      orderBy: { createdAt: "desc" },
    });
    if (!validation || validation.hasErrors)
      throw new BadRequestException(
        "La validación más reciente contiene errores o no existe.",
      );
    return validation;
  }
  private async markChanged(versionId: string) {
    await this.prisma.normVersion.update({
      where: { id: versionId },
      data: { validationStatus: "CHANGED_REQUIRES_VALIDATION" },
    });
    await this.rehash(versionId);
  }
  private async rehash(versionId: string) {
    const version = await this.prisma.normVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        targets: {
          orderBy: [{ targetType: "asc" }, { targetCode: "asc" }],
          include: { thresholds: { orderBy: { ordinal: "asc" } } },
        },
      },
    });
    const hash = configurationHash({
      version: version.version,
      lookupMethod: version.lookupMethod,
      numericMode: version.numericMode,
      roundingMode: version.roundingMode,
      targets: version.targets.map((target) => ({
        targetType: target.targetType,
        targetCode: target.targetCode,
        isBlocked: target.isBlocked,
        thresholds: target.thresholds.map((threshold) => ({
          decile: threshold.decile,
          lowerBound: threshold.lowerBound.toString(),
          ordinal: threshold.ordinal,
        })),
      })),
    });
    await this.prisma.normVersion.update({
      where: { id: versionId },
      data: { configurationHash: hash },
    });
    return hash;
  }
  private async audit(
    actorId: string,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: "NormVersion",
        entityId,
        before: before === null ? undefined : asJson(before),
        after: after === null ? undefined : asJson(after),
      },
    });
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
