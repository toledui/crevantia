import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { configurationHash } from "../src/modules/scoring/configuration-hash";

const ATTEMPT_ID = "cmt1m1bzo0001gwi90mueejnv";
const PAIR_CODE = "DPO-P039";
const PREVIOUS_MORE_CODE = "DPO-R078";
const CORRECT_MORE_CODE = "DPO-R077";
const ALIGNED_RESULT_RUN_ID = "cmt1tynwv0000toi9l876q2cn";
const REASON =
  "Corrección manual Caso de Prueba 1: DPO-P039 debía registrar DPO-R077 como MORE";

process.loadEnvFile(join(__dirname, "..", ".env"));
const apply = process.argv.includes("--apply");
const prisma = new PrismaService(new ConfigService());

async function main() {
  await prisma.$connect();
  const current = await loadAnswer();
  if (!current) throw new Error("No existe la respuesta DPO-P039 del intento.");

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "DRY_RUN",
          attemptId: ATTEMPT_ID,
          pairCode: PAIR_CODE,
          currentMore: current.selectedMoreReactive.code,
          correctedMore: CORRECT_MORE_CODE,
          currentVersion: current.version,
        },
        null,
        2,
      ),
    );
    console.log("Ejecuta con --apply para guardar la corrección.");
    return;
  }

  let mode = "ALREADY_CORRECT";
  if (current.selectedMoreReactive.code !== CORRECT_MORE_CODE) {
    if (current.selectedMoreReactive.code !== PREVIOUS_MORE_CODE)
      throw new Error(
        `Se esperaba ${PREVIOUS_MORE_CODE}, pero está guardado ${current.selectedMoreReactive.code}.`,
      );

    const target = await prisma.reactive.findFirst({
      where: {
        code: CORRECT_MORE_CODE,
        pairQuestionId: current.pairQuestionId,
      },
      select: { id: true },
    });
    if (!target)
      throw new Error(`${CORRECT_MORE_CODE} no pertenece a ${PAIR_CODE}.`);

    await prisma.$transaction(async (tx) => {
      const changed = await tx.forcedChoiceAnswer.updateMany({
        where: {
          id: current.id,
          version: current.version,
          selectedMoreReactiveId: current.selectedMoreReactiveId,
        },
        data: {
          selectedMoreReactiveId: target.id,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new Error(
          "La respuesta cambió concurrentemente; no se modificó.",
        );

      await tx.auditLog.create({
        data: {
          action: "MANUAL_RESPONSE_CORRECTED",
          entityType: "ForcedChoiceAnswer",
          entityId: current.id,
          reason: REASON,
          before: asJson({
            attemptId: ATTEMPT_ID,
            pairCode: PAIR_CODE,
            selectedMoreReactiveCode: PREVIOUS_MORE_CODE,
            version: current.version,
          }),
          after: asJson({
            attemptId: ATTEMPT_ID,
            pairCode: PAIR_CODE,
            selectedMoreReactiveCode: CORRECT_MORE_CODE,
            version: current.version + 1,
            alignedResultRunId: ALIGNED_RESULT_RUN_ID,
          }),
        },
      });
    });
    mode = "CORRECTED";
  }

  const verification = await verifyAlignment();
  console.log(JSON.stringify({ mode, ...verification }, null, 2));
}

function loadAnswer() {
  return prisma.forcedChoiceAnswer.findFirst({
    where: { attemptId: ATTEMPT_ID, pairQuestion: { code: PAIR_CODE } },
    include: {
      pairQuestion: { select: { code: true } },
      selectedMoreReactive: { select: { code: true } },
    },
  });
}

async function verifyAlignment() {
  const [answer, attempt, result] = await Promise.all([
    loadAnswer(),
    prisma.attempt.findUniqueOrThrow({
      where: { id: ATTEMPT_ID },
      include: {
        forcedChoiceAnswers: {
          include: {
            pairQuestion: { select: { code: true } },
            selectedMoreReactive: { select: { code: true } },
          },
        },
        likertAnswers: true,
      },
    }),
    prisma.resultRun.findUniqueOrThrow({
      where: { id: ALIGNED_RESULT_RUN_ID },
      include: { values: true },
    }),
  ]);
  if (!answer || answer.selectedMoreReactive.code !== CORRECT_MORE_CODE)
    throw new Error("La corrección de DPO-P039 no quedó almacenada.");
  if (attempt.forcedChoiceAnswers.length !== 168)
    throw new Error(
      `El intento contiene ${attempt.forcedChoiceAnswers.length}/168 pares.`,
    );

  const inputHash = configurationHash({
    answers: attempt.forcedChoiceAnswers
      .map((item) => ({
        pairCode: item.pairQuestion.code,
        selectedMoreReactiveCode: item.selectedMoreReactive.code,
      }))
      .sort((left, right) => left.pairCode.localeCompare(right.pairCode)),
    likert: attempt.likertAnswers
      .map(({ likertQuestionId, value }) => ({ likertQuestionId, value }))
      .sort((left, right) =>
        left.likertQuestionId.localeCompare(right.likertQuestionId),
      ),
  });
  if (inputHash !== result.inputHash)
    throw new Error(
      `El intento (${inputHash}) no coincide con el resultado (${result.inputHash}).`,
    );

  const criticalCodes = [
    "DPO-S001",
    "DPO-S043",
    "DPO-C011",
    "DPO-C013",
    "DPO-C014",
    "DPO-C015",
    "DPO-C016",
    "DPO-C026",
    "DPO-C031",
    "LIKERT-TOTAL",
  ];
  return {
    attemptId: ATTEMPT_ID,
    pairCode: PAIR_CODE,
    selectedMoreReactiveCode: answer.selectedMoreReactive.code,
    answerVersion: answer.version,
    answersCompared: attempt.forcedChoiceAnswers.length,
    inputHash,
    alignedResultRunId: result.id,
    values: result.values
      .filter(({ targetCode }) => criticalCodes.includes(targetCode))
      .map(({ targetCode, displayScore, decile }) => ({
        targetCode,
        score: Number(displayScore),
        decile,
      }))
      .sort((left, right) => left.targetCode.localeCompare(right.targetCode)),
  };
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
