import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/auth.types";
import { PrismaService } from "../../database/prisma.service";
import {
  AssignmentStatus,
  AttemptStatus,
  type Prisma,
} from "../../generated/prisma/client";
import { SaveAttemptAnswerDto, SaveDemographicsDto } from "./assessments.dto";

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async myAssignments(user: AuthenticatedUser) {
    const items = await this.prisma.assignment.findMany({
      where: {
        userId: user.sub,
        status: { notIn: [AssignmentStatus.REVOKED, AssignmentStatus.EXPIRED] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        test: { select: { code: true, name: true, description: true } },
        testVersion: { select: { version: true, estimatedMin: true } },
        attempt: {
          include: {
            resultRuns: {
              where: { isOfficial: true },
              orderBy: { calculatedAt: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    return { items };
  }

  async startAssignment(user: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { attempt: true },
    });
    if (!assignment) throw new NotFoundException("La asignación no existe.");
    if (assignment.userId !== user.sub)
      throw new ForbiddenException("No puedes iniciar esta asignación.");
    if (
      assignment.status === AssignmentStatus.REVOKED ||
      assignment.status === AssignmentStatus.EXPIRED ||
      assignment.status === AssignmentStatus.COMPLETED
    )
      throw new BadRequestException("La asignación ya no puede iniciarse.");
    if (assignment.attempt) return assignment.attempt;
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.attempt.create({
        data: {
          assignmentId,
          testVersionId: assignment.testVersionId,
          status: AttemptStatus.CREATED,
        },
      });
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.IN_PROGRESS },
      });
      return attempt;
    });
  }

  async version(assessmentId: string, versionId: string) {
    const version = await this.prisma.assessmentVersion.findFirst({
      where: { id: versionId, assessmentId },
      include: {
        assessment: { select: { id: true, code: true, name: true } },
        demographicFields: { orderBy: { order: "asc" } },
        sections: {
          orderBy: { order: "asc" },
          include: {
            pairQuestions: {
              orderBy: { order: "asc" },
              include: {
                reactives: {
                  orderBy: { position: "asc" },
                  select: { id: true, code: true, position: true, text: true },
                },
              },
            },
            likertQuestions: {
              orderBy: { order: "asc" },
              include: {
                optionSet: {
                  include: { options: { orderBy: { order: "asc" } } },
                },
              },
            },
          },
        },
      },
    });
    if (!version)
      throw new NotFoundException("La versión de evaluación no existe.");
    return version;
  }

  async player(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.ownedAttempt(user, attemptId);
    const assessmentVersionId =
      attempt.assessmentVersionId ??
      (await this.pinAssessmentVersion(
        attempt.id,
        attempt.testVersion.test.code,
      ));
    if (
      attempt.status === AttemptStatus.CREATED ||
      attempt.status === AttemptStatus.PAUSED
    )
      await this.prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.IN_PROGRESS,
          startedAt: attempt.startedAt ?? new Date(),
          pausedAt: null,
          lastActivityAt: new Date(),
        },
      });
    const version = await this.prisma.assessmentVersion.findUniqueOrThrow({
      where: { id: assessmentVersionId },
      include: {
        demographicFields: { orderBy: { order: "asc" } },
        sections: {
          orderBy: { order: "asc" },
          include: {
            pairQuestions: {
              orderBy: { order: "asc" },
              include: {
                reactives: {
                  orderBy: { position: "asc" },
                  select: { id: true, text: true },
                },
              },
            },
            likertQuestions: {
              orderBy: { order: "asc" },
              include: {
                optionSet: {
                  include: {
                    options: {
                      orderBy: { order: "asc" },
                      select: { value: true, label: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const [pairAnswers, likertAnswers, demographicAnswers] = await Promise.all([
      this.prisma.forcedChoiceAnswer.findMany({
        where: { attemptId },
        select: {
          pairQuestionId: true,
          selectedMoreReactiveId: true,
          version: true,
        },
      }),
      this.prisma.likertAnswer.findMany({
        where: { attemptId },
        select: { likertQuestionId: true, value: true, version: true },
      }),
      this.prisma.demographicAnswer.findMany({
        where: { attemptId },
        select: { demographicFieldId: true, value: true, version: true },
      }),
    ]);
    const pairMap = new Map(
      pairAnswers.map((answer) => [answer.pairQuestionId, answer]),
    );
    const likertMap = new Map(
      likertAnswers.map((answer) => [answer.likertQuestionId, answer]),
    );
    const demographicMap = new Map(
      demographicAnswers.map((answer) => [answer.demographicFieldId, answer]),
    );
    const required =
      version.sections.reduce(
        (total, section) =>
          total + section.pairQuestions.length + section.likertQuestions.length,
        0,
      ) + version.demographicFields.length;
    const answered =
      pairAnswers.length + likertAnswers.length + demographicAnswers.length;
    return {
      attempt: {
        id: attemptId,
        status: attempt.status,
        assessmentVersionId,
        currentProgress: {
          answered,
          required,
          percent: required ? Math.round((answered * 100) / required) : 0,
        },
      },
      intro: version.intro,
      demographics: version.demographicFields.map((field) => ({
        id: field.id,
        code: field.code,
        key: field.fieldKey,
        label: field.label,
        type: field.type,
        required: field.required,
        config: field.config,
        answer: demographicMap.get(field.id) ?? null,
      })),
      sections: version.sections.map((section) => ({
        id: section.id,
        code: section.code,
        name: section.name,
        instructions: section.instructions,
        questions: [
          ...section.pairQuestions.map((question) => ({
            id: question.id,
            code: question.code,
            order: question.order,
            required: question.required,
            type: "FORCED_CHOICE_PAIR",
            reactives: question.reactives,
            answer: pairMap.get(question.id) ?? null,
          })),
          ...section.likertQuestions.map((question) => ({
            id: question.id,
            code: question.code,
            order: question.order,
            required: question.required,
            type: "LIKERT_5",
            text: question.text,
            scoringStatus: question.scoringStatus,
            options: question.optionSet.options,
            answer: likertMap.get(question.id) ?? null,
          })),
        ].sort((left, right) => left.order - right.order),
      })),
    };
  }

  async saveAnswer(
    user: AuthenticatedUser,
    attemptId: string,
    questionId: string,
    dto: SaveAttemptAnswerDto,
  ) {
    const attempt = await this.ownedAttempt(user, attemptId);
    this.assertEditableAttempt(attempt.status);
    const assessmentVersionId =
      attempt.assessmentVersionId ??
      (await this.pinAssessmentVersion(
        attempt.id,
        attempt.testVersion.test.code,
      ));
    const duplicate =
      (await this.prisma.forcedChoiceAnswer.findUnique({
        where: { operationId: dto.operationId },
      })) ??
      (await this.prisma.likertAnswer.findUnique({
        where: { operationId: dto.operationId },
      }));
    if (duplicate) return duplicate;
    if (dto.selectedMoreReactiveId) {
      const question = await this.prisma.pairQuestion.findFirst({
        where: {
          assessmentVersionId,
          OR: [{ id: questionId }, { code: questionId }],
        },
        include: { reactives: { select: { id: true } } },
      });
      if (!question)
        throw new NotFoundException("La pregunta pareada no existe.");
      if (
        !question.reactives.some(({ id }) => id === dto.selectedMoreReactiveId)
      )
        throw new BadRequestException(
          "El reactivo MORE no pertenece a este par.",
        );
      const current = await this.prisma.forcedChoiceAnswer.findUnique({
        where: {
          attemptId_pairQuestionId: { attemptId, pairQuestionId: question.id },
        },
      });
      if (
        current &&
        dto.version !== undefined &&
        current.version !== dto.version
      )
        throw new ConflictException(
          "La respuesta cambió en otra sesión; recarga el intento.",
        );
      const answer = await this.prisma.forcedChoiceAnswer.upsert({
        where: {
          attemptId_pairQuestionId: { attemptId, pairQuestionId: question.id },
        },
        update: {
          selectedMoreReactiveId: dto.selectedMoreReactiveId,
          operationId: dto.operationId,
          version: { increment: 1 },
        },
        create: {
          attemptId,
          pairQuestionId: question.id,
          selectedMoreReactiveId: dto.selectedMoreReactiveId,
          operationId: dto.operationId,
        },
      });
      await this.touch(attemptId);
      return answer;
    }
    if (dto.value === undefined)
      throw new BadRequestException("La respuesta no contiene un valor.");
    const question = await this.prisma.likertQuestion.findFirst({
      where: {
        assessmentVersionId,
        OR: [{ id: questionId }, { code: questionId }],
      },
      include: { optionSet: { include: { options: true } } },
    });
    if (!question) throw new NotFoundException("La pregunta Likert no existe.");
    if (!question.optionSet.options.some(({ value }) => value === dto.value))
      throw new BadRequestException("La opción Likert no es válida.");
    const current = await this.prisma.likertAnswer.findUnique({
      where: {
        attemptId_likertQuestionId: {
          attemptId,
          likertQuestionId: question.id,
        },
      },
    });
    if (current && dto.version !== undefined && current.version !== dto.version)
      throw new ConflictException(
        "La respuesta cambió en otra sesión; recarga el intento.",
      );
    const answer = await this.prisma.likertAnswer.upsert({
      where: {
        attemptId_likertQuestionId: {
          attemptId,
          likertQuestionId: question.id,
        },
      },
      update: {
        value: dto.value,
        operationId: dto.operationId,
        version: { increment: 1 },
      },
      create: {
        attemptId,
        likertQuestionId: question.id,
        value: dto.value,
        operationId: dto.operationId,
      },
    });
    await this.touch(attemptId);
    return answer;
  }

  async saveDemographics(
    user: AuthenticatedUser,
    attemptId: string,
    dto: SaveDemographicsDto,
  ) {
    const attempt = await this.ownedAttempt(user, attemptId);
    this.assertEditableAttempt(attempt.status);
    const assessmentVersionId =
      attempt.assessmentVersionId ??
      (await this.pinAssessmentVersion(
        attempt.id,
        attempt.testVersion.test.code,
      ));
    const fields = await this.prisma.demographicField.findMany({
      where: { assessmentVersionId },
    });
    const byCode = new Map(
      fields.flatMap(
        (field) =>
          [
            [field.code, field],
            [field.fieldKey, field],
          ] as const,
      ),
    );
    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(dto.answers)) {
        const field = byCode.get(key);
        if (!field)
          throw new BadRequestException(
            `Campo demográfico desconocido: ${key}`,
          );
        if (
          field.required &&
          (value === null || value === undefined || value === "")
        )
          throw new BadRequestException(`${field.label} es obligatorio.`);
        const operationId = `${dto.operationId}:${field.code}`.slice(0, 100);
        await tx.demographicAnswer.upsert({
          where: {
            attemptId_demographicFieldId: {
              attemptId,
              demographicFieldId: field.id,
            },
          },
          update: {
            value: asJson(value),
            operationId,
            version: { increment: 1 },
          },
          create: {
            attemptId,
            demographicFieldId: field.id,
            value: asJson(value),
            operationId,
          },
        });
      }
      await tx.attempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.IN_PROGRESS, lastActivityAt: new Date() },
      });
    });
    return { success: true };
  }

  async pause(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.ownedAttempt(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS)
      throw new BadRequestException(
        "Solo un intento en progreso puede pausarse.",
      );
    return this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.PAUSED,
        pausedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  private async ownedAttempt(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        assignment: { select: { userId: true } },
        testVersion: { include: { test: { select: { code: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException("El intento no existe.");
    if (
      attempt.assignment.userId !== user.sub &&
      !user.permissions.includes("attempts.read")
    )
      throw new ForbiddenException("No puedes consultar este intento.");
    return attempt;
  }

  private async pinAssessmentVersion(attemptId: string, testCode: string) {
    const normalized = testCode.replaceAll("-", "_");
    const assessment = await this.prisma.assessment.findFirst({
      where: {
        code: { in: [testCode, normalized, "DPO_PRO"] },
        isActive: true,
      },
      include: {
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    let version = assessment?.versions[0] ?? null;
    if (!version && assessment) {
      version = await this.prisma.assessmentVersion.findFirst({
        where: {
          assessmentId: assessment.id,
          status: "DRAFT",
          scoringKeyVersions: { some: { status: "PUBLISHED" } },
        },
        orderBy: { version: "desc" },
      });
    }
    if (!version)
      throw new BadRequestException(
        "No existe una versión de evaluación disponible para este intento.",
      );
    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: { assessmentVersionId: version.id },
    });
    return version.id;
  }

  private assertEditableAttempt(status: AttemptStatus) {
    if (
      status !== AttemptStatus.CREATED &&
      status !== AttemptStatus.IN_PROGRESS &&
      status !== AttemptStatus.PAUSED
    )
      throw new BadRequestException("El intento ya no admite cambios.");
  }
  private async touch(attemptId: string) {
    const attempt = await this.prisma.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { startedAt: true },
    });
    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.IN_PROGRESS,
        startedAt: attempt.startedAt ?? new Date(),
        pausedAt: null,
        lastActivityAt: new Date(),
      },
    });
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
