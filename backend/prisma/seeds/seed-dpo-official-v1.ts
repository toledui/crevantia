import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  AggregationMethod,
  ConfigurationStatus,
  NormTargetType,
  Prisma,
  PrismaClient,
  ScoringSpecificationStatus,
} from "../../src/generated/prisma/client";
import { configurationHash } from "../../src/modules/scoring/configuration-hash";
import {
  loadOfficialAssessment,
  loadOfficialComposites,
  loadOfficialNorm,
  loadOfficialScales,
  loadOfficialScoring,
  validateOfficialBundle,
} from "./official-dpo-data";

export const OFFICIAL_DPO_IDS = {
  assessment: "assessment-dpo-pro",
  assessmentVersion: "assessment-version-dpo-pro-official-v1",
  scoringKey: "scoring-key-dpo-pro-official",
  scoringKeyVersion: "scoring-key-version-dpo-pro-official-v1",
  normSet: "norm-set-dpo-pro-official",
  normVersion: "norm-version-dpo-pro-official-v1",
  reportMapping: "report-mapping-dpo-pro-official",
  reportMappingVersion: "report-mapping-version-dpo-pro-official-v1",
  activeConfiguration: "active-configuration-dpo-pro-official-v1",
} as const;

const SECTION_NAMES: Record<string, string> = {
  STATISTICAL_CONTROL: "Control estadístico",
  PAIRED_POSITIVE: "Elección pareada positiva",
  PAIRED_NEGATIVE: "Elección pareada negativa",
  LIKERT_RESOURCE_MANAGEMENT: "Gestión de recursos",
};

const SECTION_INSTRUCTIONS: Record<string, string> = {
  STATISTICAL_CONTROL:
    "Completa los datos de control. No forman parte de la puntuación psicométrica.",
  PAIRED_POSITIVE:
    "Elige la afirmación con la que te identificas más; la otra quedará seleccionada como menos.",
  PAIRED_NEGATIVE:
    "Elige la afirmación con la que te identificas más; la otra quedará seleccionada como menos.",
  LIKERT_RESOURCE_MANAGEMENT:
    "Indica qué tan verdadera es cada afirmación para ti.",
};

export async function seedDpoOfficialV1(prisma: PrismaClient) {
  const validation = validateOfficialBundle();
  const assessment = loadOfficialAssessment();
  const scoring = loadOfficialScoring();
  const scales = loadOfficialScales();
  const composites = loadOfficialComposites();
  const norm = loadOfficialNorm();
  const assessmentHash = configurationHash(assessment);
  const scoringHash = configurationHash({ scoring, scales, composites });
  const normHash = configurationHash(norm);
  const reportHash = configurationHash(composites.reportAliases);
  const latestAssessmentVersion = await prisma.assessmentVersion.aggregate({
    where: { assessmentId: OFFICIAL_DPO_IDS.assessment },
    _max: { version: true },
  });

  const [existingAssessment, existingScoring, existingNorm] = await Promise.all(
    [
      prisma.assessmentVersion.findUnique({
        where: { id: OFFICIAL_DPO_IDS.assessmentVersion },
      }),
      prisma.scoringKeyVersion.findUnique({
        where: { id: OFFICIAL_DPO_IDS.scoringKeyVersion },
      }),
      prisma.normVersion.findUnique({
        where: { id: OFFICIAL_DPO_IDS.normVersion },
      }),
    ],
  );
  const published = [existingAssessment, existingScoring, existingNorm].filter(
    (item) => item?.status === ConfigurationStatus.PUBLISHED,
  );
  if (published.length) {
    if (published.length !== 3)
      throw new Error("DPO_OFFICIAL_PARTIALLY_PUBLISHED");
    if (
      existingAssessment?.configurationHash !== assessmentHash ||
      existingScoring?.configurationHash !== scoringHash ||
      existingNorm?.configurationHash !== normHash
    )
      throw new Error("DPO_OFFICIAL_PUBLISHED_IMMUTABLE_HASH_MISMATCH");
    await activate(prisma, reportHash);
    return validation;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.assessment.upsert({
        where: { id: OFFICIAL_DPO_IDS.assessment },
        update: { name: assessment.assessment.name, isActive: true },
        create: {
          id: OFFICIAL_DPO_IDS.assessment,
          code: "DPO_PRO",
          name: assessment.assessment.name,
          description:
            "Evaluación DPO-PRO oficial dirigida por configuración versionada.",
          isActive: true,
        },
      });
      await tx.normSet.upsert({
        where: { code: norm.normSet.code },
        update: { name: norm.normSet.name },
        create: {
          id: OFFICIAL_DPO_IDS.normSet,
          code: norm.normSet.code,
          name: norm.normSet.name,
          description: norm.normSet.sourceTitle,
        },
      });
      await tx.assessmentVersion.upsert({
        where: { id: OFFICIAL_DPO_IDS.assessmentVersion },
        update: {
          defaultNormSetId: OFFICIAL_DPO_IDS.normSet,
          status: ConfigurationStatus.DRAFT,
          sourceMetadata: assessment.assessment.source as Prisma.InputJsonValue,
          configurationHash: assessmentHash,
        },
        create: {
          id: OFFICIAL_DPO_IDS.assessmentVersion,
          assessmentId: OFFICIAL_DPO_IDS.assessment,
          defaultNormSetId: OFFICIAL_DPO_IDS.normSet,
          version: (latestAssessmentVersion._max.version ?? 0) + 1,
          versionCode: "DPO-PRO-v1.0.0",
          language: assessment.assessment.language,
          status: ConfigurationStatus.DRAFT,
          intro: "Evaluación DPO-PRO oficial v1.0.0.",
          estimatedMinutes: 45,
          sourceMetadata: assessment.assessment.source as Prisma.InputJsonValue,
          configurationHash: assessmentHash,
        },
      });

      for (const section of assessment.assessment.sections) {
        await tx.assessmentSection.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
              code: section.code,
            },
          },
          update: {
            name: SECTION_NAMES[section.code] ?? section.code,
            instructions: SECTION_INSTRUCTIONS[section.code],
            order: section.order,
          },
          create: {
            id: `official-section-${section.code.toLowerCase()}`,
            assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
            code: section.code,
            name: SECTION_NAMES[section.code] ?? section.code,
            instructions: SECTION_INSTRUCTIONS[section.code],
            order: section.order,
          },
        });
      }
      for (const field of assessment.statisticalControlQuestions) {
        await tx.demographicField.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
              code: field.code,
            },
          },
          update: {
            fieldKey: field.code.toLowerCase(),
            label: field.text,
            type: controlFieldType(field.code, field.inputType),
            order: field.order,
            required: field.required,
            config: {
              options: field.options,
              sourceRequirement: field.sourceRequirement,
              includeInScoring: false,
            },
          },
          create: {
            id: field.code,
            assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
            code: field.code,
            fieldKey: field.code.toLowerCase(),
            label: field.text,
            type: controlFieldType(field.code, field.inputType),
            order: field.order,
            required: field.required,
            config: {
              options: field.options,
              sourceRequirement: field.sourceRequirement,
              includeInScoring: false,
            },
          },
        });
      }
      const sections = new Map(
        (
          await tx.assessmentSection.findMany({
            where: { assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion },
          })
        ).map((item) => [item.code, item.id]),
      );
      for (const pair of assessment.pairQuestions) {
        const sectionId = sections.get(pair.sectionCode);
        if (!sectionId)
          throw new Error(`DPO_SECTION_MISSING:${pair.sectionCode}`);
        await tx.pairQuestion.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
              code: pair.code,
            },
          },
          update: {
            sectionId,
            order: pair.order,
            required: pair.required,
            status: ConfigurationStatus.DRAFT,
            sourceMetadata: { polarityGroup: pair.polarityGroup },
          },
          create: {
            id: officialPairId(pair.code),
            assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
            sectionId,
            code: pair.code,
            order: pair.order,
            required: pair.required,
            status: ConfigurationStatus.DRAFT,
            sourceMetadata: { polarityGroup: pair.polarityGroup },
          },
        });
      }
      for (const reactive of assessment.reactives) {
        const pair = assessment.pairQuestions.find(
          ({ code }) => code === reactive.pairCode,
        );
        if (!pair) throw new Error(`DPO_PAIR_MISSING:${reactive.pairCode}`);
        await tx.reactive.upsert({
          where: { id: officialReactiveId(reactive.code) },
          update: {
            pairQuestionId: officialPairId(reactive.pairCode),
            position: pair.reactiveCodes.indexOf(reactive.code) + 1,
            code: reactive.code,
            text: reactive.text,
          },
          create: {
            id: officialReactiveId(reactive.code),
            pairQuestionId: officialPairId(reactive.pairCode),
            position: pair.reactiveCodes.indexOf(reactive.code) + 1,
            code: reactive.code,
            text: reactive.text,
          },
        });
      }

      const optionSetId = "official-likert-option-set-1-5";
      await tx.likertOptionSet.upsert({
        where: { id: optionSetId },
        update: { code: "DPO-LIKERT-1-5" },
        create: {
          id: optionSetId,
          assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
          code: "DPO-LIKERT-1-5",
        },
      });
      const options = assessment.likertQuestions[0]?.options ?? [];
      for (const [index, option] of options.entries()) {
        await tx.likertOption.upsert({
          where: { optionSetId_value: { optionSetId, value: option.value } },
          update: { label: option.label, order: index + 1 },
          create: {
            id: `official-likert-option-${option.value}`,
            optionSetId,
            value: option.value,
            label: option.label,
            order: index + 1,
          },
        });
      }
      const likertSectionId = sections.get("LIKERT_RESOURCE_MANAGEMENT");
      if (!likertSectionId) throw new Error("DPO_LIKERT_SECTION_MISSING");
      for (const question of assessment.likertQuestions) {
        await tx.likertQuestion.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
              code: question.code,
            },
          },
          update: {
            sectionId: likertSectionId,
            optionSetId,
            order: question.order,
            text: question.text,
            required: question.required,
            scoringStatus: ScoringSpecificationStatus.CONFIGURED,
            sourceMetadata: {
              dimensionCode: question.dimensionCode,
              direction: question.direction,
            },
          },
          create: {
            id: officialLikertQuestionId(question.code),
            assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
            sectionId: likertSectionId,
            optionSetId,
            code: question.code,
            order: question.order,
            text: question.text,
            required: question.required,
            scoringStatus: ScoringSpecificationStatus.CONFIGURED,
            sourceMetadata: {
              dimensionCode: question.dimensionCode,
              direction: question.direction,
            },
          },
        });
      }

      await tx.scoringKey.upsert({
        where: { code: scoring.scoringKey.code },
        update: { name: "Clave oficial DPO-PRO" },
        create: {
          id: OFFICIAL_DPO_IDS.scoringKey,
          code: scoring.scoringKey.code,
          name: "Clave oficial DPO-PRO",
          description: "Clave oficial v1.0.0 completamente dirigida por datos.",
        },
      });
      await tx.scoringKeyVersion.upsert({
        where: { id: OFFICIAL_DPO_IDS.scoringKeyVersion },
        update: {
          sourceVersion: scoring.scoringKey.version,
          status: ConfigurationStatus.DRAFT,
          numericMode: "EXCEL_BINARY64",
          engineCompatibility: "dpo-engine-v2",
          configurationHash: scoringHash,
        },
        create: {
          id: OFFICIAL_DPO_IDS.scoringKeyVersion,
          scoringKeyId: OFFICIAL_DPO_IDS.scoringKey,
          assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
          version: 1,
          sourceVersion: scoring.scoringKey.version,
          status: ConfigurationStatus.DRAFT,
          numericMode: "EXCEL_BINARY64",
          engineCompatibility: "dpo-engine-v2",
          configurationHash: scoringHash,
        },
      });
      for (const scale of scales.scales) {
        await tx.scale.upsert({
          where: { code: scale.code },
          update: { name: scale.name, kind: "PAIRED" },
          create: {
            id: scale.code,
            code: scale.code,
            name: scale.name,
            kind: "PAIRED",
          },
        });
      }
      const dimensionNames = new Map(
        assessment.likertQuestions.map((item) => [
          item.dimensionCode,
          item.dimensionName,
        ]),
      );
      for (const [dimensionCode, dimensionName] of dimensionNames) {
        const code = `LIKERT-${dimensionCode}`;
        await tx.scale.upsert({
          where: { code },
          update: { name: dimensionName, kind: "LIKERT_DIMENSION" },
          create: {
            id: code,
            code,
            name: dimensionName,
            kind: "LIKERT_DIMENSION",
          },
        });
      }
      for (const rule of scoring.reactiveScoringRules) {
        await tx.reactiveScoringRule.upsert({
          where: {
            scoringKeyVersionId_reactiveId: {
              scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
              reactiveId: officialReactiveId(rule.reactiveCode),
            },
          },
          update: {
            scaleId: rule.scaleCode,
            polarity: rule.polarity,
            fixedWeight: rule.fixedWeight,
            scoreIfMore: rule.scoreIfMore,
            scoreIfLess: rule.scoreIfLess,
          },
          create: {
            id: `official-rule-${rule.reactiveCode}`,
            scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
            reactiveId: officialReactiveId(rule.reactiveCode),
            scaleId: rule.scaleCode,
            polarity: rule.polarity,
            fixedWeight: rule.fixedWeight,
            scoreIfMore: rule.scoreIfMore,
            scoreIfLess: rule.scoreIfLess,
          },
        });
      }
      for (const question of assessment.likertQuestions) {
        await tx.likertScoringRule.upsert({
          where: {
            scoringKeyVersionId_likertQuestionId: {
              scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
              likertQuestionId: officialLikertQuestionId(question.code),
            },
          },
          update: {
            scaleId: `LIKERT-${question.dimensionCode}`,
            weight: question.weight,
            reverse: false,
          },
          create: {
            id: `official-likert-rule-${question.code}`,
            scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
            likertQuestionId: officialLikertQuestionId(question.code),
            scaleId: `LIKERT-${question.dimensionCode}`,
            weight: question.weight,
            reverse: false,
          },
        });
      }
      for (const composite of composites.normedComposites) {
        await tx.composite.upsert({
          where: { code: composite.code },
          update: {
            name: composite.name,
            aggregationMethod: AggregationMethod.ARITHMETIC_MEAN,
          },
          create: {
            id: composite.code,
            code: composite.code,
            name: composite.name,
            aggregationMethod: AggregationMethod.ARITHMETIC_MEAN,
          },
        });
        for (const [
          index,
          scaleCode,
        ] of composite.componentScaleCodes.entries()) {
          await tx.compositeComponent.upsert({
            where: {
              scoringKeyVersionId_compositeId_scaleId: {
                scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
                compositeId: composite.code,
                scaleId: scaleCode,
              },
            },
            update: {
              order: index + 1,
              weight: 1,
              aggregationMethod: AggregationMethod.ARITHMETIC_MEAN,
            },
            create: {
              id: `official-component-${composite.code}-${scaleCode}`,
              scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
              compositeId: composite.code,
              scaleId: scaleCode,
              order: index + 1,
              weight: 1,
              aggregationMethod: AggregationMethod.ARITHMETIC_MEAN,
            },
          });
        }
      }
      for (const metric of composites.derivedDecileMeanMetrics) {
        await tx.derivedMetric.upsert({
          where: { code: metric.code },
          update: { name: metric.name },
          create: { id: metric.code, code: metric.code, name: metric.name },
        });
        await tx.derivedMetricVersion.upsert({
          where: {
            scoringKeyVersionId_derivedMetricId: {
              scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
              derivedMetricId: metric.code,
            },
          },
          update: {
            calculationType: AggregationMethod.DECILE_MEAN,
            status: ConfigurationStatus.DRAFT,
            declarativeConfig: {
              group: metric.group,
              sources: metric.componentScaleCodes.map((targetCode) => ({
                targetType: "SCALE",
                targetCode,
                valueType: "DECILE",
                weight: 1,
              })),
            },
          },
          create: {
            id: `official-derived-version-${metric.code}`,
            derivedMetricId: metric.code,
            scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
            version: 1,
            calculationType: AggregationMethod.DECILE_MEAN,
            status: ConfigurationStatus.DRAFT,
            declarativeConfig: {
              group: metric.group,
              sources: metric.componentScaleCodes.map((targetCode) => ({
                targetType: "SCALE",
                targetCode,
                valueType: "DECILE",
                weight: 1,
              })),
            },
          },
        });
      }

      await tx.normVersion.upsert({
        where: { id: OFFICIAL_DPO_IDS.normVersion },
        update: {
          name: norm.normSet.name,
          status: ConfigurationStatus.DRAFT,
          sourceVersion: norm.normSet.version,
          lookupMethod: norm.normSet.lookupMethod,
          numericMode: norm.normSet.numericMode,
          roundingMode: norm.normSet.roundingMode,
          configurationHash: normHash,
          validationStatus: "PASS",
          sourceMetadata: asJson({
            source: norm.normSet.source,
            sourceTablesNotActive: norm.sourceTablesNotActive,
          }),
        },
        create: {
          id: OFFICIAL_DPO_IDS.normVersion,
          normSetId: OFFICIAL_DPO_IDS.normSet,
          version: 1,
          sourceVersion: norm.normSet.version,
          name: norm.normSet.name,
          description: norm.normSet.sourceTitle,
          status: ConfigurationStatus.DRAFT,
          populationLabel: "NORMA 480 elección pareada / NORMA 80 Likert",
          sampleSize: 480,
          lookupMethod: norm.normSet.lookupMethod,
          numericMode: norm.normSet.numericMode,
          roundingMode: norm.normSet.roundingMode,
          configurationHash: normHash,
          validationStatus: "PASS",
          sourceMetadata: asJson({
            source: norm.normSet.source,
            sourceTablesNotActive: norm.sourceTablesNotActive,
          }),
        },
      });
      for (const target of norm.activeTargets) {
        const targetType = normTargetType(target.targetType);
        const targetId = `official-norm-target-${target.targetCode.toLowerCase()}`;
        await tx.normTarget.upsert({
          where: {
            normVersionId_targetType_targetCode: {
              normVersionId: OFFICIAL_DPO_IDS.normVersion,
              targetType,
              targetCode: target.targetCode,
            },
          },
          update: {
            name: target.targetName,
            status: "ACTIVE",
            isBlocked: false,
            sourceReference: norm.normSet.sourceTitle,
          },
          create: {
            id: targetId,
            normVersionId: OFFICIAL_DPO_IDS.normVersion,
            targetType,
            targetCode: target.targetCode,
            name: target.targetName,
            status: "ACTIVE",
            isBlocked: false,
            sourceReference: norm.normSet.sourceTitle,
          },
        });
        for (const [index, threshold] of target.thresholds.entries()) {
          await tx.normThreshold.upsert({
            where: {
              normTargetId_ordinal: {
                normTargetId: targetId,
                ordinal: index + 1,
              },
            },
            update: {
              decile: threshold.decile,
              lowerBound: threshold.lowerBound,
            },
            create: {
              id: `${targetId}-d${threshold.decile}`,
              normTargetId: targetId,
              decile: threshold.decile,
              ordinal: index + 1,
              lowerBound: threshold.lowerBound,
            },
          });
        }
      }

      await tx.reportMapping.upsert({
        where: { code: "DPO-PRO-OFFICIAL-REPORT" },
        update: { name: "Mapeo oficial de resultados DPO-PRO" },
        create: {
          id: OFFICIAL_DPO_IDS.reportMapping,
          code: "DPO-PRO-OFFICIAL-REPORT",
          name: "Mapeo oficial de resultados DPO-PRO",
        },
      });
      await tx.reportMappingVersion.upsert({
        where: { id: OFFICIAL_DPO_IDS.reportMappingVersion },
        update: {
          status: ConfigurationStatus.DRAFT,
          mappingStatus: "CONFIGURED",
          configuration: asJson({ aliases: composites.reportAliases }),
          configurationHash: reportHash,
        },
        create: {
          id: OFFICIAL_DPO_IDS.reportMappingVersion,
          reportMappingId: OFFICIAL_DPO_IDS.reportMapping,
          assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
          version: 1,
          status: ConfigurationStatus.DRAFT,
          mappingStatus: "CONFIGURED",
          configuration: asJson({ aliases: composites.reportAliases }),
          configurationHash: reportHash,
        },
      });

      const publishedAt = new Date();
      await tx.pairQuestion.updateMany({
        where: { assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion },
        data: { status: ConfigurationStatus.PUBLISHED },
      });
      await tx.derivedMetricVersion.updateMany({
        where: { scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion },
        data: { status: ConfigurationStatus.PUBLISHED },
      });
      await tx.assessmentVersion.update({
        where: { id: OFFICIAL_DPO_IDS.assessmentVersion },
        data: { status: ConfigurationStatus.PUBLISHED, publishedAt },
      });
      await tx.scoringKeyVersion.update({
        where: { id: OFFICIAL_DPO_IDS.scoringKeyVersion },
        data: { status: ConfigurationStatus.PUBLISHED, publishedAt },
      });
      await tx.normVersion.update({
        where: { id: OFFICIAL_DPO_IDS.normVersion },
        data: { status: ConfigurationStatus.PUBLISHED, publishedAt },
      });
      await tx.reportMappingVersion.update({
        where: { id: OFFICIAL_DPO_IDS.reportMappingVersion },
        data: { status: ConfigurationStatus.PUBLISHED },
      });
      await tx.assessmentActiveConfiguration.upsert({
        where: { assessmentId: OFFICIAL_DPO_IDS.assessment },
        update: {
          assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
          scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
          normVersionId: OFFICIAL_DPO_IDS.normVersion,
          reportMappingVersionId: OFFICIAL_DPO_IDS.reportMappingVersion,
          activatedAt: publishedAt,
        },
        create: {
          id: OFFICIAL_DPO_IDS.activeConfiguration,
          assessmentId: OFFICIAL_DPO_IDS.assessment,
          assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
          scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
          normVersionId: OFFICIAL_DPO_IDS.normVersion,
          reportMappingVersionId: OFFICIAL_DPO_IDS.reportMappingVersion,
          activatedAt: publishedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "DPO_OFFICIAL_V1_PUBLISHED",
          entityType: "AssessmentVersion",
          entityId: OFFICIAL_DPO_IDS.assessmentVersion,
          after: {
            assessmentHash,
            scoringHash,
            normHash,
            reportHash,
            counts: validation.counts,
          },
        },
      });
    },
    { timeout: 300_000 },
  );
  return validation;
}

async function activate(prisma: PrismaClient, reportHash: string) {
  const mapping = await prisma.reportMappingVersion.findUnique({
    where: { id: OFFICIAL_DPO_IDS.reportMappingVersion },
  });
  if (
    !mapping ||
    mapping.configurationHash !== reportHash ||
    mapping.status !== ConfigurationStatus.PUBLISHED
  )
    throw new Error("DPO_OFFICIAL_REPORT_MAPPING_INVALID");
  await prisma.assessmentActiveConfiguration.upsert({
    where: { assessmentId: OFFICIAL_DPO_IDS.assessment },
    update: {
      assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
      scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
      normVersionId: OFFICIAL_DPO_IDS.normVersion,
      reportMappingVersionId: OFFICIAL_DPO_IDS.reportMappingVersion,
      activatedAt: new Date(),
    },
    create: {
      id: OFFICIAL_DPO_IDS.activeConfiguration,
      assessmentId: OFFICIAL_DPO_IDS.assessment,
      assessmentVersionId: OFFICIAL_DPO_IDS.assessmentVersion,
      scoringKeyVersionId: OFFICIAL_DPO_IDS.scoringKeyVersion,
      normVersionId: OFFICIAL_DPO_IDS.normVersion,
      reportMappingVersionId: OFFICIAL_DPO_IDS.reportMappingVersion,
    },
  });
}

function normTargetType(value: string) {
  if (value === "SCALE") return NormTargetType.SCALE;
  if (value === "COMPOSITE") return NormTargetType.COMPOSITE;
  if (value === "LIKERT_DIMENSION") return NormTargetType.LIKERT_DIMENSION;
  if (value === "LIKERT_TOTAL") return NormTargetType.LIKERT_TOTAL;
  throw new Error(`DPO_NORM_TARGET_TYPE_UNSUPPORTED:${value}`);
}

function controlFieldType(code: string, inputType: string) {
  if (code === "DPO-CTRL-13") return "INTEGER";
  if (inputType === "Correo") return "EMAIL";
  if (inputType === "Teléfono") return "PHONE";
  if (inputType === "Combo") return "SINGLE_CHOICE";
  return "TEXT";
}

const officialPairId = (code: string) => `official-pair-${code}`;
const officialReactiveId = (code: string) => `official-reactive-${code}`;
const officialLikertQuestionId = (code: string) =>
  `official-likert-question-${code}`;

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function adapter() {
  const url = new URL(
    process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/crevantia",
  );
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  });
}

if (require.main === module) {
  const prisma = new PrismaClient({ adapter: adapter() });
  seedDpoOfficialV1(prisma)
    .then((result) => console.log("[DPO official v1 seed]", result))
    .finally(async () => prisma.$disconnect())
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
