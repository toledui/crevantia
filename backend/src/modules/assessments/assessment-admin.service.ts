import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  ConfigurationStatus,
  Prisma,
  ScoringSpecificationStatus,
} from "../../generated/prisma/client";
import { configurationHash } from "../scoring/configuration-hash";
import {
  CloneAssessmentVersionDto,
  CreateAssessmentDto,
  ReplaceAssessmentContentDto,
  UpdateAssessmentDto,
} from "./assessment-admin.dto";

const versionInclude = {
  demographicFields: { orderBy: { order: "asc" as const } },
  sections: {
    orderBy: { order: "asc" as const },
    include: {
      pairQuestions: {
        orderBy: { order: "asc" as const },
        include: { reactives: { orderBy: { position: "asc" as const } } },
      },
      likertQuestions: {
        orderBy: { order: "asc" as const },
        include: {
          optionSet: {
            include: { options: { orderBy: { order: "asc" as const } } },
          },
          scoringRules: { include: { scale: true } },
        },
      },
    },
  },
  scoringKeyVersions: {
    orderBy: { version: "desc" as const },
    include: {
      rules: { include: { scale: true } },
      likertRules: { include: { scale: true } },
      compositeComponents: { include: { composite: true, scale: true } },
      derivedMetricVersions: {
        include: { derivedMetric: true, sourceScale: true },
      },
    },
  },
  _count: {
    select: {
      attempts: true,
      resultRuns: true,
      reportMappingVersions: true,
    },
  },
} satisfies Prisma.AssessmentVersionInclude;

@Injectable()
export class AssessmentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.assessment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            versionCode: true,
            status: true,
            language: true,
            estimatedMinutes: true,
            updatedAt: true,
            _count: {
              select: {
                sections: true,
                pairQuestions: true,
                likertQuestions: true,
                attempts: true,
              },
            },
          },
        },
      },
    });
    return { items };
  }

  async detail(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: "desc" }, include: versionInclude },
      },
    });
    if (!assessment) throw new NotFoundException("La evaluación no existe.");
    return {
      ...assessment,
      versions: assessment.versions.map((version) =>
        this.presentVersion(version),
      ),
    };
  }

  async scales() {
    return {
      items: await this.prisma.scale.findMany({
        orderBy: [{ name: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true, description: true },
      }),
    };
  }

  async create(actorId: string, dto: CreateAssessmentDto) {
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.assessment.findUnique({ where: { code } }))
      throw new ConflictException("Ya existe una evaluación con ese código.");
    return this.prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          code,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
        },
      });
      const version = await tx.assessmentVersion.create({
        data: {
          assessmentId: assessment.id,
          version: 1,
          versionCode: `${code}_V1`,
          status: ConfigurationStatus.DRAFT,
          configurationHash: configurationHash({ sections: [] }),
        },
      });
      const scoringKey = await tx.scoringKey.create({
        data: {
          code: `${code}_SCORING`,
          name: `Puntuación de ${dto.name.trim()}`,
        },
      });
      await tx.scoringKeyVersion.create({
        data: {
          scoringKeyId: scoringKey.id,
          assessmentVersionId: version.id,
          version: 1,
          status: ConfigurationStatus.DRAFT,
          configurationHash: configurationHash({ rules: [] }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "ASSESSMENT_CREATED",
          entityType: "Assessment",
          entityId: assessment.id,
          after: { code, versionId: version.id },
        },
      });
      return assessment;
    });
  }

  async update(actorId: string, id: string, dto: UpdateAssessmentDto) {
    await this.assertAssessment(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assessment.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isActive: dto.isActive,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "ASSESSMENT_UPDATED",
          entityType: "Assessment",
          entityId: id,
          after: { name: updated.name, isActive: updated.isActive },
        },
      });
      return updated;
    });
  }

  async cloneVersion(
    actorId: string,
    assessmentId: string,
    dto: CloneAssessmentVersionDto,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!assessment) throw new NotFoundException("La evaluación no existe.");
    const sourceId = dto.sourceVersionId ?? assessment.versions[0]?.id;
    const source = sourceId
      ? await this.prisma.assessmentVersion.findFirst({
          where: { id: sourceId, assessmentId },
          include: versionInclude,
        })
      : null;
    const deletionAudits = await this.prisma.auditLog.findMany({
      where: {
        action: "ASSESSMENT_VERSION_DELETED",
        entityType: "AssessmentVersion",
      },
      select: { after: true },
    });
    const highestDeletedVersion = deletionAudits.reduce(
      (highest, audit) =>
        Math.max(
          highest,
          deletedVersionNumber(audit.after, assessmentId) ?? 0,
        ),
      0,
    );
    const nextVersion =
      Math.max(assessment.versions[0]?.version ?? 0, highestDeletedVersion) + 1;

    return this.prisma.$transaction(
      async (tx) => {
        const created = await tx.assessmentVersion.create({
          data: {
            assessmentId,
            version: nextVersion,
            versionCode: `${assessment.code}_V${nextVersion}`,
            language: dto.language ?? source?.language ?? "es-MX",
            defaultNormSetId: source?.defaultNormSetId,
            intro: source?.intro,
            estimatedMinutes: dto.estimatedMinutes ?? source?.estimatedMinutes,
            sourceMetadata: source?.sourceMetadata ?? undefined,
            status: ConfigurationStatus.DRAFT,
            configurationHash: configurationHash({
              clonedFrom: source?.id ?? null,
            }),
          },
        });

        if (source) await this.cloneContent(tx, source, created.id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: "ASSESSMENT_VERSION_CLONED",
            entityType: "AssessmentVersion",
            entityId: created.id,
            after: {
              assessmentId,
              version: nextVersion,
              clonedFrom: source?.id,
            },
          },
        });
        return created;
      },
      { timeout: 120_000 },
    );
  }

  async replaceContent(
    actorId: string,
    versionId: string,
    dto: ReplaceAssessmentContentDto,
  ) {
    this.validateDocument(dto);
    const current = await this.prisma.assessmentVersion.findUnique({
      where: { id: versionId },
      include: {
        scoringKeyVersions: true,
        _count: { select: { attempts: true } },
      },
    });
    if (!current) throw new NotFoundException("La versión no existe.");
    if (current.status !== ConfigurationStatus.DRAFT)
      throw new BadRequestException(
        "Solo las versiones en borrador pueden editarse.",
      );
    if (current._count.attempts)
      throw new BadRequestException(
        "La versión ya tiene intentos y debe clonarse antes de editarla.",
      );
    if (current.updatedAt.toISOString() !== dto.expectedUpdatedAt)
      throw new ConflictException(
        "El borrador cambió en otra sesión; recarga antes de guardar.",
      );
    const scoringVersion = current.scoringKeyVersions.find(
      ({ status }) => status === ConfigurationStatus.DRAFT,
    );
    if (!scoringVersion)
      throw new BadRequestException(
        "La clave de puntuación está publicada. Clona esta versión para editarla.",
      );
    if (
      dto.normSetId &&
      !(await this.prisma.normSet.findUnique({
        where: { id: dto.normSetId },
        select: { id: true },
      }))
    )
      throw new BadRequestException(
        "La familia normativa seleccionada no existe.",
      );

    const scaleCodes = [
      ...new Set(
        [
          ...dto.sections.flatMap((section) =>
            section.questions.flatMap((question) => [
              ...question.reactives.flatMap((reactive) =>
                reactive.scoring ? [reactive.scoring.scaleCode] : [],
              ),
              ...(question.scoring ? [question.scoring.scaleCode] : []),
            ]),
          ),
          ...(dto.composites?.flatMap((composite) =>
            composite.components.map((component) => component.scaleCode),
          ) ?? []),
          ...(dto.derivedMetrics?.flatMap((metric) =>
            metric.sourceScaleCode ? [metric.sourceScaleCode] : [],
          ) ?? []),
        ].map(normalizeCode),
      ),
    ];
    await this.prisma.$transaction(
      async (tx) => {
        for (const scale of dto.scales ?? [])
          await tx.scale.upsert({
            where: { code: normalizeCode(scale.code) },
            create: {
              code: normalizeCode(scale.code),
              name: scale.name.trim(),
              description: scale.description?.trim() || null,
            },
            update: {
              name: scale.name.trim(),
              description: scale.description?.trim() || null,
            },
          });
        const scales = await tx.scale.findMany({
          where: { code: { in: scaleCodes } },
          select: { id: true, code: true },
        });
        const scaleByCode = new Map(
          scales.map((scale) => [scale.code, scale.id]),
        );
        const missingScale = scaleCodes.find((code) => !scaleByCode.has(code));
        if (missingScale)
          throw new BadRequestException(`La escala ${missingScale} no existe.`);

        await tx.likertScoringRule.deleteMany({
          where: { scoringKeyVersionId: scoringVersion.id },
        });
        await tx.reactiveScoringRule.deleteMany({
          where: { scoringKeyVersionId: scoringVersion.id },
        });
        await tx.likertQuestion.deleteMany({
          where: { assessmentVersionId: versionId },
        });
        await tx.likertOptionSet.deleteMany({
          where: { assessmentVersionId: versionId },
        });
        await tx.pairQuestion.deleteMany({
          where: { assessmentVersionId: versionId },
        });
        await tx.assessmentSection.deleteMany({
          where: { assessmentVersionId: versionId },
        });
        await tx.demographicField.deleteMany({
          where: { assessmentVersionId: versionId },
        });

        for (const field of dto.demographics) {
          await tx.demographicField.create({
            data: {
              assessmentVersionId: versionId,
              code: normalizeCode(field.code),
              fieldKey: field.fieldKey.trim(),
              label: field.label.trim(),
              type: field.type.trim(),
              order: field.order,
              required: field.required,
              config: asJson(field.config),
            },
          });
        }

        let globalQuestionOrder = 0;
        const optionSetByCode = new Map<string, string>();
        for (const sectionInput of [...dto.sections].sort(byOrder)) {
          const section = await tx.assessmentSection.create({
            data: {
              assessmentVersionId: versionId,
              code: normalizeCode(sectionInput.code),
              name: sectionInput.name.trim(),
              instructions: sectionInput.instructions?.trim() || null,
              order: sectionInput.order,
            },
          });
          for (const question of [...sectionInput.questions].sort(byOrder)) {
            globalQuestionOrder += 1;
            if (question.type === "PAIR") {
              const pair = await tx.pairQuestion.create({
                data: {
                  assessmentVersionId: versionId,
                  sectionId: section.id,
                  code: normalizeCode(question.code),
                  order: globalQuestionOrder,
                  required: question.required,
                  status: ConfigurationStatus.DRAFT,
                },
              });
              for (const reactiveInput of [...question.reactives].sort(
                byPosition,
              )) {
                const reactive = await tx.reactive.create({
                  data: {
                    pairQuestionId: pair.id,
                    code: normalizeCode(reactiveInput.code),
                    position: reactiveInput.position,
                    text: reactiveInput.text.trim(),
                  },
                });
                if (reactiveInput.scoring) {
                  await tx.reactiveScoringRule.create({
                    data: {
                      scoringKeyVersionId: scoringVersion.id,
                      reactiveId: reactive.id,
                      scaleId: scaleByCode.get(
                        reactiveInput.scoring.scaleCode,
                      )!,
                      polarity: reactiveInput.scoring.polarity,
                      fixedWeight: reactiveInput.scoring.fixedWeight,
                      scoreIfMore: reactiveInput.scoring.scoreIfMore,
                      scoreIfLess: reactiveInput.scoring.scoreIfLess,
                    },
                  });
                }
              }
            } else {
              const optionSetCode = normalizeCode(
                question.optionSetCode ?? `${question.code}_OPTIONS`,
              );
              let optionSetId = optionSetByCode.get(optionSetCode);
              if (!optionSetId) {
                const optionSet = await tx.likertOptionSet.create({
                  data: {
                    assessmentVersionId: versionId,
                    code: optionSetCode,
                    options: {
                      create: [...question.options]
                        .sort(byOrder)
                        .map((option) => ({
                          value: option.value,
                          label: option.label.trim(),
                          order: option.order,
                        })),
                    },
                  },
                });
                optionSetId = optionSet.id;
                optionSetByCode.set(optionSetCode, optionSet.id);
              }
              const likert = await tx.likertQuestion.create({
                data: {
                  assessmentVersionId: versionId,
                  sectionId: section.id,
                  optionSetId,
                  code: normalizeCode(question.code),
                  order: globalQuestionOrder,
                  text: question.text?.trim() ?? "",
                  required: question.required,
                  scoringStatus: question.scoring
                    ? ScoringSpecificationStatus.CONFIGURED
                    : (question.scoringStatus ??
                      ScoringSpecificationStatus.PENDING_SCORING_SPEC),
                },
              });
              if (question.scoring)
                await tx.likertScoringRule.create({
                  data: {
                    scoringKeyVersionId: scoringVersion.id,
                    likertQuestionId: likert.id,
                    scaleId: scaleByCode.get(
                      normalizeCode(question.scoring.scaleCode),
                    )!,
                    weight: question.scoring.weight,
                    reverse: question.scoring.reverse,
                    scoreMap: asJson(question.scoring.scoreMap),
                  },
                });
            }
          }
        }

        if (dto.composites) {
          await tx.compositeComponent.deleteMany({
            where: { scoringKeyVersionId: scoringVersion.id },
          });
          for (const compositeInput of dto.composites) {
            const composite = await tx.composite.upsert({
              where: { code: normalizeCode(compositeInput.code) },
              create: {
                code: normalizeCode(compositeInput.code),
                name: compositeInput.name.trim(),
                description: compositeInput.description?.trim() || null,
                aggregationMethod: compositeInput.aggregationMethod,
              },
              update: {
                name: compositeInput.name.trim(),
                description: compositeInput.description?.trim() || null,
                aggregationMethod: compositeInput.aggregationMethod,
              },
            });
            await tx.compositeComponent.createMany({
              data: compositeInput.components.map((component) => ({
                scoringKeyVersionId: scoringVersion.id,
                compositeId: composite.id,
                scaleId: scaleByCode.get(normalizeCode(component.scaleCode))!,
                weight: component.weight,
                order: component.order,
                aggregationMethod: compositeInput.aggregationMethod,
              })),
            });
          }
        }

        if (dto.derivedMetrics) {
          await tx.derivedMetricVersion.deleteMany({
            where: { scoringKeyVersionId: scoringVersion.id },
          });
          for (const metricInput of dto.derivedMetrics) {
            const metric = await tx.derivedMetric.upsert({
              where: { code: normalizeCode(metricInput.code) },
              create: {
                code: normalizeCode(metricInput.code),
                name: metricInput.name.trim(),
              },
              update: { name: metricInput.name.trim() },
            });
            const latest = await tx.derivedMetricVersion.aggregate({
              where: { derivedMetricId: metric.id },
              _max: { version: true },
            });
            await tx.derivedMetricVersion.create({
              data: {
                derivedMetricId: metric.id,
                scoringKeyVersionId: scoringVersion.id,
                version: (latest._max.version ?? 0) + 1,
                calculationType: metricInput.calculationType,
                sourceScaleId: metricInput.sourceScaleCode
                  ? scaleByCode.get(normalizeCode(metricInput.sourceScaleCode))
                  : null,
                declarativeConfig: asJson(metricInput.declarativeConfig),
                status: ConfigurationStatus.DRAFT,
              },
            });
          }
        }

        const assessmentHash = configurationHash({
          language: dto.language,
          normSetId: dto.normSetId,
          intro: dto.intro,
          estimatedMinutes: dto.estimatedMinutes,
          demographics: dto.demographics,
          sections: dto.sections,
        });
        const scoringHash = configurationHash({
          rules: dto.sections.flatMap((section) =>
            section.questions.flatMap((question) =>
              question.reactives.map((reactive) => ({
                reactiveCode: reactive.code,
                ...reactive.scoring,
              })),
            ),
          ),
          likert: dto.sections.flatMap((section) =>
            section.questions
              .filter((question) => question.type === "LIKERT")
              .map((question) => ({
                code: question.code,
                ...question.scoring,
              })),
          ),
          composites: dto.composites,
          derivedMetrics: dto.derivedMetrics,
        });
        await tx.assessmentVersion.update({
          where: { id: versionId },
          data: {
            language: dto.language,
            defaultNormSetId: dto.normSetId ?? null,
            intro: dto.intro?.trim() || null,
            estimatedMinutes: dto.estimatedMinutes ?? null,
            configurationHash: assessmentHash,
          },
        });
        await tx.scoringKeyVersion.update({
          where: { id: scoringVersion.id },
          data: { configurationHash: scoringHash },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "ASSESSMENT_VERSION_CONTENT_REPLACED",
            entityType: "AssessmentVersion",
            entityId: versionId,
            after: {
              sections: dto.sections.length,
              questions: dto.sections.reduce(
                (sum, section) => sum + section.questions.length,
                0,
              ),
              hash: assessmentHash,
            },
          },
        });
      },
      { timeout: 120_000 },
    );
    return this.versionDetail(versionId);
  }

  async validate(versionId: string) {
    const version = await this.getVersion(versionId);
    return this.validation(version);
  }

  async publish(actorId: string, versionId: string) {
    const version = await this.getVersion(versionId);
    if (version.status !== ConfigurationStatus.DRAFT)
      throw new BadRequestException("Solo un borrador puede publicarse.");
    const validation = this.validation(version);
    if (validation.errors.length)
      throw new BadRequestException(validation.errors[0]);
    const scoring = version.scoringKeyVersions.find(
      ({ status }) => status === ConfigurationStatus.DRAFT,
    );
    if (!scoring)
      throw new BadRequestException(
        "No existe una clave de puntuación en borrador.",
      );
    await this.prisma.$transaction([
      this.prisma.assessmentVersion.update({
        where: { id: versionId },
        data: {
          status: ConfigurationStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      }),
      this.prisma.scoringKeyVersion.update({
        where: { id: scoring.id },
        data: {
          status: ConfigurationStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      }),
      this.prisma.derivedMetricVersion.updateMany({
        where: { scoringKeyVersionId: scoring.id },
        data: { status: ConfigurationStatus.PUBLISHED },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: "ASSESSMENT_VERSION_PUBLISHED",
          entityType: "AssessmentVersion",
          entityId: versionId,
          after: {
            warnings: validation.warnings,
            scoringKeyVersionId: scoring.id,
          },
        },
      }),
    ]);
    return { success: true, ...validation };
  }

  async archive(actorId: string, versionId: string) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: versionId },
      include: {
        attempts: {
          where: {
            status: {
              in: ["CREATED", "IN_PROGRESS", "PAUSED", "SUBMITTED", "SCORING"],
            },
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!version) throw new NotFoundException("La versión no existe.");
    if (version.attempts.length)
      throw new BadRequestException(
        "No se puede archivar mientras existan intentos activos.",
      );
    await this.prisma.$transaction([
      this.prisma.assessmentVersion.update({
        where: { id: versionId },
        data: { status: ConfigurationStatus.ARCHIVED },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId,
          action: "ASSESSMENT_VERSION_ARCHIVED",
          entityType: "AssessmentVersion",
          entityId: versionId,
        },
      }),
    ]);
    return { success: true };
  }

  async deleteDraft(actorId: string, versionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.assessmentVersion.findUnique({
        where: { id: versionId },
        include: {
          scoringKeyVersions: {
            select: {
              status: true,
              publishedAt: true,
              _count: { select: { attempts: true, resultRuns: true } },
            },
          },
          _count: {
            select: {
              attempts: true,
              resultRuns: true,
              reportMappingVersions: true,
            },
          },
        },
      });
      if (!version) throw new NotFoundException("La versión no existe.");
      if (
        version.status !== ConfigurationStatus.DRAFT ||
        version.publishedAt ||
        version.scoringKeyVersions.some(
          (scoring) =>
            scoring.status !== ConfigurationStatus.DRAFT ||
            Boolean(scoring.publishedAt) ||
            scoring._count.attempts > 0 ||
            scoring._count.resultRuns > 0,
        )
      )
        throw new BadRequestException(
          "Solo puede eliminarse un borrador que nunca haya sido publicado.",
        );
      if (version._count.attempts || version._count.resultRuns)
        throw new BadRequestException(
          "No se puede eliminar una versión con intentos o resultados.",
        );
      if (version._count.reportMappingVersions)
        throw new BadRequestException(
          "No se puede eliminar una versión vinculada a configuraciones de reporte.",
        );
      const versionCount = await tx.assessmentVersion.count({
        where: { assessmentId: version.assessmentId },
      });
      if (versionCount <= 1)
        throw new BadRequestException(
          "No se puede eliminar la única versión de la evaluación.",
        );

      await tx.scoringKeyVersion.deleteMany({
        where: { assessmentVersionId: versionId },
      });
      await tx.assessmentVersion.delete({ where: { id: versionId } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "ASSESSMENT_VERSION_DELETED",
          entityType: "AssessmentVersion",
          entityId: versionId,
          before: {
            assessmentId: version.assessmentId,
            version: version.version,
            versionCode: version.versionCode,
            status: version.status,
          },
          after: {
            assessmentId: version.assessmentId,
            version: version.version,
            versionCode: version.versionCode,
            deleted: true,
          },
        },
      });
      return {
        success: true,
        deletedVersion: version.version,
        deletedVersionCode: version.versionCode,
      };
    });
  }

  private async versionDetail(versionId: string) {
    const version = await this.getVersion(versionId);
    return this.presentVersion(version);
  }

  private async getVersion(versionId: string) {
    const version = await this.prisma.assessmentVersion.findUnique({
      where: { id: versionId },
      include: versionInclude,
    });
    if (!version) throw new NotFoundException("La versión no existe.");
    return version;
  }

  private presentVersion(
    version: Awaited<ReturnType<AssessmentAdminService["getVersion"]>>,
  ) {
    const scoringVersion = version.scoringKeyVersions[0] ?? null;
    const ruleByReactive = new Map(
      scoringVersion?.rules.map((rule) => [rule.reactiveId, rule]) ?? [],
    );
    return {
      id: version.id,
      version: version.version,
      versionCode: version.versionCode,
      language: version.language,
      normSetId: version.defaultNormSetId,
      status: version.status,
      intro: version.intro,
      estimatedMinutes: version.estimatedMinutes,
      configurationHash: version.configurationHash,
      publishedAt: version.publishedAt,
      updatedAt: version.updatedAt,
      counts: version._count,
      editable:
        version.status === ConfigurationStatus.DRAFT &&
        version._count.attempts === 0 &&
        scoringVersion?.status === ConfigurationStatus.DRAFT,
      scoringVersion: scoringVersion
        ? {
            id: scoringVersion.id,
            version: scoringVersion.version,
            status: scoringVersion.status,
          }
        : null,
      psychometrics: scoringVersion
        ? {
            composites: presentComposites(scoringVersion.compositeComponents),
            derivedMetrics: scoringVersion.derivedMetricVersions.map(
              (metric) => ({
                id: metric.derivedMetric.id,
                code: metric.derivedMetric.code,
                name: metric.derivedMetric.name,
                calculationType: metric.calculationType,
                sourceScaleCode: metric.sourceScale?.code ?? null,
                declarativeConfig: metric.declarativeConfig,
              }),
            ),
          }
        : { composites: [], derivedMetrics: [] },
      demographics: version.demographicFields,
      sections: version.sections.map((section) => ({
        id: section.id,
        code: section.code,
        name: section.name,
        instructions: section.instructions,
        order: section.order,
        questions: [
          ...section.pairQuestions.map((question) => ({
            id: question.id,
            type: "PAIR" as const,
            code: question.code,
            order: question.order,
            required: question.required,
            reactives: question.reactives.map((reactive) => {
              const rule = ruleByReactive.get(reactive.id);
              return {
                id: reactive.id,
                code: reactive.code,
                text: reactive.text,
                position: reactive.position,
                scoring: rule
                  ? {
                      scaleCode: rule.scale.code,
                      scaleName: rule.scale.name,
                      polarity: rule.polarity,
                      fixedWeight: Number(rule.fixedWeight),
                      scoreIfMore: Number(rule.scoreIfMore),
                      scoreIfLess: Number(rule.scoreIfLess),
                    }
                  : null,
              };
            }),
          })),
          ...section.likertQuestions.map((question) => ({
            id: question.id,
            type: "LIKERT" as const,
            code: question.code,
            order: question.order,
            required: question.required,
            text: question.text,
            scoringStatus: question.scoringStatus,
            optionSetCode: question.optionSet.code,
            options: question.optionSet.options,
            scoring: question.scoringRules[0]
              ? {
                  scaleCode: question.scoringRules[0].scale.code,
                  scaleName: question.scoringRules[0].scale.name,
                  weight: Number(question.scoringRules[0].weight),
                  reverse: question.scoringRules[0].reverse,
                  scoreMap: question.scoringRules[0].scoreMap,
                }
              : null,
          })),
        ].sort((left, right) => left.order - right.order),
      })),
    };
  }

  private validation(
    version: Awaited<ReturnType<AssessmentAdminService["getVersion"]>>,
  ) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const scoring = version.scoringKeyVersions[0];
    const ruled = new Set(scoring?.rules.map((rule) => rule.reactiveId) ?? []);
    if (!version.sections.length)
      errors.push("La versión no contiene secciones.");
    if (
      version.sections.some(
        (section) =>
          !section.pairQuestions.length &&
          !section.likertQuestions.length &&
          !(section.order === 1 && version.demographicFields.length > 0),
      )
    )
      errors.push("Todas las secciones deben contener al menos una pregunta.");
    for (const pair of version.sections.flatMap(
      (section) => section.pairQuestions,
    )) {
      if (pair.reactives.length !== 2)
        errors.push(`${pair.code} debe tener exactamente dos afirmaciones.`);
      for (const reactive of pair.reactives)
        if (!ruled.has(reactive.id))
          errors.push(`${reactive.code} no tiene regla de puntuación.`);
    }
    for (const likert of version.sections.flatMap(
      (section) => section.likertQuestions,
    )) {
      if (likert.optionSet.options.length < 2)
        errors.push(`${likert.code} requiere al menos dos opciones.`);
      if (
        likert.scoringStatus === ScoringSpecificationStatus.PENDING_SCORING_SPEC
      )
        warnings.push(
          `${likert.code} está pendiente de especificación de puntuación.`,
        );
      if (
        likert.scoringStatus === ScoringSpecificationStatus.CONFIGURED &&
        !likert.scoringRules.length
      )
        errors.push(
          `${likert.code} está configurada pero no tiene regla Likert.`,
        );
    }
    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      coverage: {
        reactives: version.sections.reduce(
          (sum, section) =>
            sum +
            section.pairQuestions.reduce(
              (count, pair) => count + pair.reactives.length,
              0,
            ),
          0,
        ),
        rules: scoring?.rules.length ?? 0,
      },
    };
  }

  private validateDocument(dto: ReplaceAssessmentContentDto) {
    if (dto.scales)
      unique(
        dto.scales.map((scale) => normalizeCode(scale.code)),
        "Las escalas",
      );
    if (dto.composites) {
      unique(
        dto.composites.map((composite) => normalizeCode(composite.code)),
        "Los composites",
      );
      for (const composite of dto.composites) {
        unique(
          composite.components.map((component) => component.order),
          `El orden de ${composite.code}`,
        );
        unique(
          composite.components.map((component) =>
            normalizeCode(component.scaleCode),
          ),
          `Las escalas de ${composite.code}`,
        );
      }
    }
    if (dto.derivedMetrics)
      unique(
        dto.derivedMetrics.map((metric) => normalizeCode(metric.code)),
        "Las métricas derivadas",
      );
    unique(
      dto.sections.map((section) => normalizeCode(section.code)),
      "Los códigos de sección",
    );
    unique(
      dto.sections.map((section) => section.order),
      "El orden de secciones",
    );
    unique(
      dto.demographics.map((field) => normalizeCode(field.code)),
      "Los campos demográficos",
    );
    unique(
      dto.demographics.map((field) => field.order),
      "El orden demográfico",
    );
    const questionCodes = dto.sections.flatMap((section) =>
      section.questions.map((question) => normalizeCode(question.code)),
    );
    unique(questionCodes, "Los códigos de pregunta");
    const reactiveCodes = dto.sections.flatMap((section) =>
      section.questions.flatMap((question) =>
        question.reactives.map((reactive) => normalizeCode(reactive.code)),
      ),
    );
    unique(reactiveCodes, "Los códigos de afirmación");
    const optionSets = new Map<string, string>();
    for (const question of dto.sections.flatMap(
      (section) => section.questions,
    )) {
      if (question.type !== "LIKERT") continue;
      const code = normalizeCode(
        question.optionSetCode ?? `${question.code}_OPTIONS`,
      );
      const signature = JSON.stringify([...question.options].sort(byOrder));
      const existing = optionSets.get(code);
      if (existing && existing !== signature)
        throw new BadRequestException(
          `Las preguntas que usan ${code} deben compartir exactamente las mismas opciones.`,
        );
      optionSets.set(code, signature);
    }
    for (const section of dto.sections) {
      unique(
        section.questions.map((question) => question.order),
        `El orden de ${section.name}`,
      );
      for (const question of section.questions) {
        if (question.type === "PAIR" && question.reactives.length !== 2)
          throw new BadRequestException(
            `${question.code} debe contener exactamente dos afirmaciones.`,
          );
        if (question.type === "PAIR" && question.options.length)
          throw new BadRequestException(
            `${question.code} no admite opciones Likert.`,
          );
        if (question.type === "LIKERT" && !question.text?.trim())
          throw new BadRequestException(`${question.code} requiere texto.`);
        if (question.type === "LIKERT" && question.options.length < 2)
          throw new BadRequestException(
            `${question.code} requiere al menos dos opciones.`,
          );
        if (question.type === "LIKERT" && question.reactives.length)
          throw new BadRequestException(
            `${question.code} no admite afirmaciones pareadas.`,
          );
        if (
          question.type === "LIKERT" &&
          question.scoringStatus === ScoringSpecificationStatus.CONFIGURED &&
          !question.scoring
        )
          throw new BadRequestException(
            `${question.code} requiere una regla de puntuación Likert.`,
          );
      }
    }
  }

  private async cloneContent(
    tx: Prisma.TransactionClient,
    source: Awaited<ReturnType<AssessmentAdminService["getVersion"]>>,
    targetVersionId: string,
  ) {
    for (const field of source.demographicFields)
      await tx.demographicField.create({
        data: {
          assessmentVersionId: targetVersionId,
          code: field.code,
          fieldKey: field.fieldKey,
          label: field.label,
          type: field.type,
          order: field.order,
          required: field.required,
          config: field.config ?? undefined,
        },
      });

    const sectionMap = new Map<string, string>();
    for (const section of source.sections) {
      const cloned = await tx.assessmentSection.create({
        data: {
          assessmentVersionId: targetVersionId,
          code: section.code,
          name: section.name,
          instructions: section.instructions,
          order: section.order,
        },
      });
      sectionMap.set(section.id, cloned.id);
    }
    const reactiveMap = new Map<string, string>();
    const likertMap = new Map<string, string>();
    const optionSetMap = new Map<string, string>();
    for (const section of source.sections) {
      for (const pair of section.pairQuestions) {
        const clonedPair = await tx.pairQuestion.create({
          data: {
            assessmentVersionId: targetVersionId,
            sectionId: sectionMap.get(section.id)!,
            code: pair.code,
            order: pair.order,
            required: pair.required,
            status: ConfigurationStatus.DRAFT,
          },
        });
        for (const reactive of pair.reactives) {
          const cloned = await tx.reactive.create({
            data: {
              pairQuestionId: clonedPair.id,
              code: reactive.code,
              position: reactive.position,
              text: reactive.text,
            },
          });
          reactiveMap.set(reactive.id, cloned.id);
        }
      }
      for (const likert of section.likertQuestions) {
        let optionSetId = optionSetMap.get(likert.optionSet.id);
        if (!optionSetId) {
          const optionSet = await tx.likertOptionSet.create({
            data: {
              assessmentVersionId: targetVersionId,
              code: likert.optionSet.code,
              options: {
                create: likert.optionSet.options.map((option) => ({
                  value: option.value,
                  label: option.label,
                  order: option.order,
                })),
              },
            },
          });
          optionSetId = optionSet.id;
          optionSetMap.set(likert.optionSet.id, optionSet.id);
        }
        const clonedLikert = await tx.likertQuestion.create({
          data: {
            assessmentVersionId: targetVersionId,
            sectionId: sectionMap.get(section.id)!,
            optionSetId,
            code: likert.code,
            order: likert.order,
            text: likert.text,
            required: likert.required,
            scoringStatus: likert.scoringStatus,
          },
        });
        likertMap.set(likert.id, clonedLikert.id);
      }
    }

    const sourceScoring = source.scoringKeyVersions[0];
    if (!sourceScoring) return;
    const max = await tx.scoringKeyVersion.aggregate({
      where: { scoringKeyId: sourceScoring.scoringKeyId },
      _max: { version: true },
    });
    const scoring = await tx.scoringKeyVersion.create({
      data: {
        scoringKeyId: sourceScoring.scoringKeyId,
        assessmentVersionId: targetVersionId,
        version: (max._max.version ?? 0) + 1,
        sourceVersion: sourceScoring.sourceVersion,
        status: ConfigurationStatus.DRAFT,
        numericMode: sourceScoring.numericMode,
        engineCompatibility: sourceScoring.engineCompatibility,
        configurationHash: sourceScoring.configurationHash,
      },
    });
    await tx.reactiveScoringRule.createMany({
      data: sourceScoring.rules
        .filter((rule) => reactiveMap.has(rule.reactiveId))
        .map((rule) => ({
          scoringKeyVersionId: scoring.id,
          reactiveId: reactiveMap.get(rule.reactiveId)!,
          scaleId: rule.scaleId,
          polarity: rule.polarity,
          fixedWeight: rule.fixedWeight,
          scoreIfMore: rule.scoreIfMore,
          scoreIfLess: rule.scoreIfLess,
          sourceMetadata: rule.sourceMetadata ?? undefined,
        })),
    });
    await tx.likertScoringRule.createMany({
      data: sourceScoring.likertRules
        .filter((rule) => likertMap.has(rule.likertQuestionId))
        .map((rule) => ({
          scoringKeyVersionId: scoring.id,
          likertQuestionId: likertMap.get(rule.likertQuestionId)!,
          scaleId: rule.scaleId,
          weight: rule.weight,
          reverse: rule.reverse,
          scoreMap: rule.scoreMap ?? undefined,
        })),
    });
    await tx.compositeComponent.createMany({
      data: sourceScoring.compositeComponents.map((component) => ({
        scoringKeyVersionId: scoring.id,
        compositeId: component.compositeId,
        scaleId: component.scaleId,
        weight: component.weight,
        order: component.order,
        aggregationMethod: component.aggregationMethod,
        metadata: component.metadata ?? undefined,
      })),
    });
    for (const metric of sourceScoring.derivedMetricVersions) {
      const latest = await tx.derivedMetricVersion.aggregate({
        where: { derivedMetricId: metric.derivedMetricId },
        _max: { version: true },
      });
      await tx.derivedMetricVersion.create({
        data: {
          derivedMetricId: metric.derivedMetricId,
          scoringKeyVersionId: scoring.id,
          version: (latest._max.version ?? 0) + 1,
          calculationType: metric.calculationType,
          sourceScaleId: metric.sourceScaleId,
          declarativeConfig: metric.declarativeConfig ?? undefined,
          status: ConfigurationStatus.DRAFT,
        },
      });
    }
  }

  private async assertAssessment(id: string) {
    if (
      !(await this.prisma.assessment.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("La evaluación no existe.");
  }
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function deletedVersionNumber(value: unknown, assessmentId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return record.assessmentId === assessmentId &&
    typeof record.version === "number" &&
    Number.isInteger(record.version)
    ? record.version
    : null;
}

function unique(values: Array<string | number>, label: string) {
  if (new Set(values).size !== values.length)
    throw new BadRequestException(`${label} contiene duplicados.`);
}

function byOrder(left: { order: number }, right: { order: number }) {
  return left.order - right.order;
}

function byPosition(left: { position: number }, right: { position: number }) {
  return left.position - right.position;
}

function asJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  return value
    ? (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue)
    : undefined;
}

function presentComposites(
  components: Array<{
    compositeId: string;
    aggregationMethod: string;
    weight: unknown;
    order: number;
    composite: {
      id: string;
      code: string;
      name: string;
      description: string | null;
      aggregationMethod: string;
    };
    scale: { code: string; name: string };
  }>,
) {
  const grouped = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      description: string | null;
      aggregationMethod: string;
      components: Array<{
        scaleCode: string;
        scaleName: string;
        weight: number;
        order: number;
      }>;
    }
  >();
  for (const component of components) {
    const current = grouped.get(component.compositeId) ?? {
      id: component.composite.id,
      code: component.composite.code,
      name: component.composite.name,
      description: component.composite.description,
      aggregationMethod: component.aggregationMethod,
      components: [],
    };
    current.components.push({
      scaleCode: component.scale.code,
      scaleName: component.scale.name,
      weight: Number(component.weight),
      order: component.order,
    });
    grouped.set(component.compositeId, current);
  }
  return [...grouped.values()].map((composite) => ({
    ...composite,
    components: composite.components.sort(
      (left, right) => left.order - right.order,
    ),
  }));
}
