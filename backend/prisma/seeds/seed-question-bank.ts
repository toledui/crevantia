import {
  ConfigurationStatus,
  ScoringSpecificationStatus,
  type Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client";
import { loadQuestionBank } from "./dpo-data";
import { DPO_IDS } from "./seed-assessment";

export async function seedQuestionBank(prisma: PrismaClient) {
  const source = loadQuestionBank();
  if (source.pairedQuestions.length !== 168)
    throw new Error("QUESTION_BANK_EXPECTED_168_PAIRS");
  const reactives = source.pairedQuestions.flatMap(
    (question) => question.statements,
  );
  if (
    reactives.length !== 336 ||
    new Set(reactives.map(({ code }) => code)).size !== 336
  )
    throw new Error("QUESTION_BANK_EXPECTED_336_UNIQUE_REACTIVES");
  if (source.likertQuestions.length !== 25)
    throw new Error("QUESTION_BANK_EXPECTED_25_LIKERT");
  const sectionCodes = new Set(
    source.assessment.sections.map(({ code }) => code),
  );
  if (
    source.pairedQuestions.some(
      ({ sectionCode }) => !sectionCodes.has(sectionCode),
    ) ||
    source.likertQuestions.some(
      ({ sectionCode }) => !sectionCodes.has(sectionCode),
    )
  )
    throw new Error("QUESTION_BANK_SECTION_REFERENCE_MISSING");

  await prisma.$transaction(
    async (tx) => {
      const version = await tx.assessmentVersion.findUniqueOrThrow({
        where: { id: DPO_IDS.assessmentVersion },
      });
      if (version.status === ConfigurationStatus.PUBLISHED) {
        console.log(
          "[DPO seed-question-bank] omitido: versión publicada e inmutable",
        );
        return;
      }

      for (const section of source.assessment.sections) {
        await tx.assessmentSection.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: DPO_IDS.assessmentVersion,
              code: section.code,
            },
          },
          update: {
            name: section.name,
            instructions: section.instructions,
            order: section.order,
          },
          create: {
            id: `section-${section.code.toLowerCase()}`,
            assessmentVersionId: DPO_IDS.assessmentVersion,
            code: section.code,
            name: section.name,
            instructions: section.instructions,
            order: section.order,
          },
        });
      }
      for (const field of source.demographicFields) {
        await tx.demographicField.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: DPO_IDS.assessmentVersion,
              code: field.code,
            },
          },
          update: {
            fieldKey: field.key,
            label: field.label,
            type: field.type,
            order: field.order,
            required: field.required,
            config: {
              options: field.options,
              validation: field.validation,
              prefillFromAccount: field.prefillFromAccount,
            } as Prisma.InputJsonValue,
          },
          create: {
            id: field.code,
            assessmentVersionId: DPO_IDS.assessmentVersion,
            code: field.code,
            fieldKey: field.key,
            label: field.label,
            type: field.type,
            order: field.order,
            required: field.required,
            config: {
              options: field.options,
              validation: field.validation,
              prefillFromAccount: field.prefillFromAccount,
            } as Prisma.InputJsonValue,
          },
        });
      }
      const sections = await tx.assessmentSection.findMany({
        where: { assessmentVersionId: DPO_IDS.assessmentVersion },
      });
      const sectionIds = new Map(sections.map(({ code, id }) => [code, id]));
      for (const question of source.pairedQuestions) {
        const sectionId = sectionIds.get(question.sectionCode);
        if (!sectionId)
          throw new Error(
            `QUESTION_BANK_SECTION_NOT_FOUND:${question.sectionCode}`,
          );
        await tx.pairQuestion.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: DPO_IDS.assessmentVersion,
              code: question.code,
            },
          },
          update: {
            sectionId,
            order: question.order,
            required: question.required,
            sourceMetadata: {
              polarity: question.polarity,
              sourceFormQuestionNumber: question.sourceFormQuestionNumber,
            },
          },
          create: {
            id: question.code,
            assessmentVersionId: DPO_IDS.assessmentVersion,
            sectionId,
            code: question.code,
            order: question.order,
            required: question.required,
            status: ConfigurationStatus.DRAFT,
            sourceMetadata: {
              polarity: question.polarity,
              sourceFormQuestionNumber: question.sourceFormQuestionNumber,
            },
          },
        });
        for (const statement of question.statements) {
          await tx.reactive.upsert({
            where: { code: statement.code },
            update: {
              pairQuestionId: question.code,
              position: statement.orderInPair,
              text: statement.text,
            },
            create: {
              id: statement.code,
              pairQuestionId: question.code,
              code: statement.code,
              position: statement.orderInPair,
              text: statement.text,
            },
          });
        }
      }
      for (const optionSet of source.likertOptionSets) {
        const optionSetId = `option-set-${optionSet.code.toLowerCase()}`;
        await tx.likertOptionSet.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: DPO_IDS.assessmentVersion,
              code: optionSet.code,
            },
          },
          update: {},
          create: {
            id: optionSetId,
            assessmentVersionId: DPO_IDS.assessmentVersion,
            code: optionSet.code,
          },
        });
        for (const [index, option] of optionSet.options.entries()) {
          await tx.likertOption.upsert({
            where: { optionSetId_value: { optionSetId, value: option.value } },
            update: { label: option.label, order: index + 1 },
            create: {
              id: `${optionSetId}-${option.value}`,
              optionSetId,
              value: option.value,
              label: option.label,
              order: index + 1,
            },
          });
        }
      }
      const optionSetIds = new Map(
        (
          await tx.likertOptionSet.findMany({
            where: { assessmentVersionId: DPO_IDS.assessmentVersion },
          })
        ).map(({ code, id }) => [code, id]),
      );
      for (const question of source.likertQuestions) {
        const sectionId = sectionIds.get(question.sectionCode);
        const optionSetId = optionSetIds.get(question.optionSetCode);
        if (!sectionId || !optionSetId)
          throw new Error(`LIKERT_REFERENCE_NOT_FOUND:${question.code}`);
        await tx.likertQuestion.upsert({
          where: {
            assessmentVersionId_code: {
              assessmentVersionId: DPO_IDS.assessmentVersion,
              code: question.code,
            },
          },
          update: {
            sectionId,
            optionSetId,
            order: question.order,
            text: question.text,
            required: question.required,
            scoringStatus: ScoringSpecificationStatus.PENDING_SCORING_SPEC,
            sourceMetadata: {
              sourceFormQuestionNumber: question.sourceFormQuestionNumber,
              sourceScoringStatus: question.scoringStatus,
            },
          },
          create: {
            id: question.code,
            assessmentVersionId: DPO_IDS.assessmentVersion,
            sectionId,
            optionSetId,
            code: question.code,
            order: question.order,
            text: question.text,
            required: question.required,
            scoringStatus: ScoringSpecificationStatus.PENDING_SCORING_SPEC,
            sourceMetadata: {
              sourceFormQuestionNumber: question.sourceFormQuestionNumber,
              sourceScoringStatus: question.scoringStatus,
            },
          },
        });
      }
    },
    { timeout: 120_000 },
  );

  console.log(
    `[DPO seed-question-bank] sections=${source.assessment.sections.length} pairs=${source.pairedQuestions.length} reactives=${reactives.length} likert=${source.likertQuestions.length}`,
  );
}
