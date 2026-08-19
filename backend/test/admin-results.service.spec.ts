import { NotFoundException } from '@nestjs/common';
import { ResultsService } from '../src/modules/results/results.service';
import { PrismaService } from '../src/database/prisma.service';
import { ConfigurationStatus, NormTargetType, Prisma, ResultRunStatus } from '../src/generated/prisma/client';

describe('ResultsService (Admin Results & Reports)', () => {
  it('lista resultados de evaluaciones con paginación y dimensiones compuestas', async () => {
    const prisma = {
      resultRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'res-1',
            isOfficial: true,
            status: ResultRunStatus.COMPLETED,
            calculatedAt: new Date(),
            configurationHash: 'hash123',
            engineVersion: '1.0.0',
            reason: null,
            recalculationOfResultRunId: null,
            recalculations: [],
            attempt: {
              id: 'att-1',
              startedAt: new Date(),
              completedAt: new Date(),
              assignment: {
                user: { id: 'u1', email: 'candidato@crevantia.com', firstName: 'María', lastName: 'López' },
                test: { id: 't1', code: 'DPO', name: 'DPO-PRO' },
                testVersion: { id: 'tv1', version: 1 },
              },
            },
            normVersion: {
              id: 'nv1',
              version: 1,
              normSet: { id: 'ns1', code: 'GEN', name: 'Baremo General' },
            },
            values: [
              {
                id: 'v1',
                targetType: NormTargetType.COMPOSITE,
                targetCode: 'DPO_ABUNDANCE_ORIENTATION',
                rawScore: new Prisma.Decimal(28.5),
                displayScore: new Prisma.Decimal(28.5),
                normalizedScore: new Prisma.Decimal(7.2),
                decile: 8,
                status: 'CALCULATED',
              },
            ],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;

    const service = new ResultsService(prisma);
    const result = await service.listAdminResults({ page: 1, limit: 10, type: 'ALL' });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('res-1');
    expect(result.items[0]?.candidate.firstName).toBe('María');
    expect(result.items[0]?.topDimensions[0]?.decile).toBe(8);
    expect(result.items[0]?.norm.normSet.name).toBe('Baremo General');
  });

  it('obtiene el resumen de métricas globales de resultados', async () => {
    const prisma = {
      resultRun: {
        count: jest
          .fn()
          .mockResolvedValueOnce(45) // total
          .mockResolvedValueOnce(40) // official
          .mockResolvedValueOnce(5), // recalculated
      },
    } as unknown as PrismaService;

    const service = new ResultsService(prisma);
    const summary = await service.getAdminResultsSummary();

    expect(summary.totalResults).toBe(45);
    expect(summary.officialResults).toBe(40);
    expect(summary.recalculatedResults).toBe(5);
  });

  it('obtiene el detalle psicométrico completo de un resultado', async () => {
    const prisma = {
      resultRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'res-detail-1',
          status: ResultRunStatus.COMPLETED,
          isOfficial: true,
          calculatedAt: new Date(),
          configurationHash: 'hash-abc',
          engineVersion: '1.0.0',
          values: [],
          attempt: {
            assignment: {
              user: { id: 'u1', firstName: 'Carlos', lastName: 'Sánchez' },
              test: { id: 't1', name: 'DPO-PRO' },
              testVersion: { version: 1 },
            },
          },
          normVersion: { normSet: { name: 'Baremo General' }, targets: [] },
          recalculationOf: null,
          recalculations: [],
        }),
      },
      normVersion: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'nv1', version: 1, status: ConfigurationStatus.PUBLISHED, normSet: { name: 'Baremo General' } },
        ]),
      },
    } as unknown as PrismaService;

    const service = new ResultsService(prisma);
    const detail = await service.getAdminResultDetails('res-detail-1');

    expect(detail.id).toBe('res-detail-1');
    expect(detail.availableNorms.length).toBe(1);
    expect(detail.attempt.assignment.user.firstName).toBe('Carlos');
  });

  it('arroja NotFoundException si el resultado no existe', async () => {
    const prisma = {
      resultRun: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    const service = new ResultsService(prisma);
    await expect(service.getAdminResultDetails('non-existent')).rejects.toBeInstanceOf(NotFoundException);
  });
});
