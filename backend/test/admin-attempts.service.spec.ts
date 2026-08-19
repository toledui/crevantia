import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentsService } from '../src/modules/assessments/assessments.service';
import { PrismaService } from '../src/database/prisma.service';
import { AttemptStatus } from '../src/generated/prisma/client';
import type { AuthenticatedUser } from '../src/common/auth.types';

describe('AssessmentsService (Admin Attempts Monitoring)', () => {
  const actor: AuthenticatedUser = {
    sub: 'admin-1',
    email: 'admin@crevantia.com',
    roles: ['SUPERADMIN'],
    permissions: ['admin.access', 'attempts.read', 'attempts.manage'],
  };

  it('lista intentos con paginación y cálculo de respuestas', async () => {
    const prisma = {
      attempt: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attempt-1',
            status: AttemptStatus.IN_PROGRESS,
            startedAt: new Date(),
            pausedAt: null,
            submittedAt: null,
            completedAt: null,
            lastActivityAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            assignment: {
              user: { id: 'u1', email: 'user@example.com', firstName: 'Juan', lastName: 'Pérez' },
              test: { id: 't1', code: 'DPO', name: 'DPO-PRO' },
              testVersion: { id: 'tv1', version: 1, estimatedMin: 45 },
            },
            resultRuns: [],
            _count: {
              responses: 5,
              pairResponses: 10,
              demographicAnswers: 2,
              forcedChoiceAnswers: 0,
              likertAnswers: 0,
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;

    const service = new AssessmentsService(prisma);
    const result = await service.listAdminAttempts({ page: 1, limit: 10, status: 'ALL' });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('attempt-1');
    expect(result.items[0]?.candidate.email).toBe('user@example.com');
    expect(result.items[0]?.totalAnswers).toBe(17);
    expect(result.items[0]?.test.name).toBe('DPO-PRO');
  });

  it('obtiene el resumen global de métricas de intentos', async () => {
    const prisma = {
      attempt: {
        count: jest
          .fn()
          .mockResolvedValueOnce(50) // total
          .mockResolvedValueOnce(12) // inProgress
          .mockResolvedValueOnce(3)  // paused
          .mockResolvedValueOnce(35) // completed
          .mockResolvedValueOnce(5), // attentionCount
      },
    } as unknown as PrismaService;

    const service = new AssessmentsService(prisma);
    const summary = await service.getAdminAttemptsSummary();

    expect(summary.total).toBe(50);
    expect(summary.inProgress).toBe(12);
    expect(summary.paused).toBe(3);
    expect(summary.completed).toBe(35);
    expect(summary.attentionRequired).toBe(5);
  });

  it('permite reactivar/reabrir un intento pausado o estancado', async () => {
    const prisma = {
      attempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'attempt-paused',
          status: AttemptStatus.PAUSED,
          assignment: {
            user: { email: 'candidato@test.com' },
            test: { name: 'DPO-PRO' },
          },
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback({
          attempt: {
            update: jest.fn().mockResolvedValue({
              id: 'attempt-paused',
              status: AttemptStatus.IN_PROGRESS,
              pausedAt: null,
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-reopen-1' }),
          },
        });
      }),
    } as unknown as PrismaService;

    const service = new AssessmentsService(prisma);
    const result = await service.reopenAdminAttempt(actor, 'attempt-paused', 'Candidato reanudó examen');

    expect(result.success).toBe(true);
    expect(result.attempt.status).toBe(AttemptStatus.IN_PROGRESS);
  });

  it('rechaza reabrir un intento que ya fue completado', async () => {
    const prisma = {
      attempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'attempt-completed',
          status: AttemptStatus.COMPLETED,
          assignment: {
            user: { email: 'candidato@test.com' },
            test: { name: 'DPO-PRO' },
          },
        }),
      },
    } as unknown as PrismaService;

    const service = new AssessmentsService(prisma);
    await expect(service.reopenAdminAttempt(actor, 'attempt-completed')).rejects.toBeInstanceOf(BadRequestException);
  });
});
