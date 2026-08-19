import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthenticatedUser } from '../src/common/auth.types';
import type { PrismaService } from '../src/database/prisma.service';
import type { MailService } from '../src/modules/mail/mail.service';

jest.mock('../src/database/prisma.service', () => ({ PrismaService: class PrismaService {} }));
jest.mock('../src/modules/mail/mail.service', () => ({ MailService: class MailService {} }));

import { UsersService } from '../src/modules/users/users.service';

const actor: AuthenticatedUser = { sub: 'admin-1', email: 'admin@example.com', roles: ['SUPERADMIN'], permissions: ['users.create', 'users.disable', 'roles.manage'] };

describe('UsersService', () => {
  it('impide que un administrador deshabilite su propia cuenta', async () => {
    const service = new UsersService({} as PrismaService, {} as MailService);
    await expect(service.changeStatus(actor, actor.sub, { status: 'DISABLED' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza correos duplicados antes de crear una invitación', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) } } as unknown as PrismaService;
    const service = new UsersService(prisma, {} as MailService);
    await expect(service.create(actor, { firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', roleIds: ['role-1'] })).rejects.toBeInstanceOf(ConflictException);
  });

  it('protege al último superadministrador activo', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'super-1', roles: [{ role: { code: 'SUPERADMIN' } }] }),
        count: jest.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaService;
    const service = new UsersService(prisma, {} as MailService);
    await expect(service.changeStatus(actor, 'super-1', { status: 'DISABLED' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite crear usuario con contraseña manual y enviar credenciales por correo', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([{ id: 'role-1', code: 'USER' }]),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'new-user-1',
              email: 'nuevo@example.com',
              firstName: 'Carlos',
              lastName: 'Ruiz',
              roles: [{ role: { code: 'USER', name: 'Usuario' } }],
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
          },
        });
      }),
    } as unknown as PrismaService;

    const mailService = {
      sendUserCreatedWithCredentialsEmail: jest.fn().mockResolvedValue({ status: 'SENT' }),
    } as unknown as MailService;

    const service = new UsersService(prisma, mailService);
    const result = await service.create(actor, {
      firstName: 'Carlos',
      lastName: 'Ruiz',
      email: 'nuevo@example.com',
      roleIds: ['role-1'],
      passwordMode: 'MANUAL_PASSWORD',
      manualPassword: 'Password123!',
      sendCredentialsEmail: true,
    });

    expect(result.invitationStatus).toBe('SENT');
    expect(result.tempPassword).toBe('Password123!');
    expect(mailService.sendUserCreatedWithCredentialsEmail).toHaveBeenCalledWith(
      'nuevo@example.com',
      'Carlos',
      'Password123!',
      undefined,
    );
  });

  it('permite vincular una prueba a un usuario y enviar correo de invitación con enlace directo', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-456',
          email: 'evaluado@example.com',
          firstName: 'Laura',
          lastName: 'Gómez',
          status: 'ACTIVE',
        }),
      },
      assignment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      test: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'test-dpo',
          name: 'DPO-PRO Evaluación de Personalidad',
          versions: [
            { id: 'version-1', version: 1, status: 'PUBLISHED', estimatedMin: 45 },
          ],
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback({
          assignment: {
            create: jest.fn().mockResolvedValue({
              id: 'assign-789',
              userId: 'user-456',
              testId: 'test-dpo',
              testVersionId: 'version-1',
              type: 'ADMIN_FREE',
              status: 'AVAILABLE',
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
          },
        });
      }),
    } as unknown as PrismaService;

    const mailService = {
      sendDirectAssessmentInvitationEmail: jest.fn().mockResolvedValue({ status: 'SENT' }),
    } as unknown as MailService;

    const service = new UsersService(prisma, mailService);
    const result = await service.assignTest(actor, 'user-456', {
      testId: 'test-dpo',
      type: 'ADMIN_FREE',
      reason: 'Candidato a puesto gerencial',
      sendEmail: true,
      customMessage: 'Por favor responde esta prueba antes del viernes.',
    });

    expect(result.assignmentId).toBe('assign-789');
    expect(result.emailStatus).toBe('SENT');
    expect(mailService.sendDirectAssessmentInvitationEmail).toHaveBeenCalledWith(
      'evaluado@example.com',
      'Laura',
      'DPO-PRO Evaluación de Personalidad',
      'Candidato a puesto gerencial',
      'Por favor responde esta prueba antes del viernes.',
    );
  });

  it('rechaza asignar una prueba que el usuario ya tiene activa', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-456',
          status: 'ACTIVE',
        }),
      },
      test: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'test-dpo',
          name: 'DPO-PRO',
          versions: [{ id: 'version-1', status: 'PUBLISHED' }],
        }),
      },
      assignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-active-assignment' }),
      },
    } as unknown as PrismaService;

    const service = new UsersService(prisma, {} as MailService);
    await expect(
      service.assignTest(actor, 'user-456', { testId: 'test-dpo' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite reenviar la invitación de una prueba asignada', async () => {
    const prisma = {
      assignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assign-789',
          status: 'AVAILABLE',
          user: { email: 'evaluado@example.com', firstName: 'Laura', lastName: 'Gómez' },
          test: { name: 'DPO-PRO' },
          testVersion: { estimatedMin: 45 },
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-3' }),
      },
    } as unknown as PrismaService;

    const mailService = {
      sendDirectAssessmentInvitationEmail: jest.fn().mockResolvedValue({ status: 'SENT' }),
    } as unknown as MailService;

    const service = new UsersService(prisma, mailService);
    const result = await service.resendAssignmentInvitation(actor, 'assign-789');

    expect(result.emailStatus).toBe('SENT');
    expect(mailService.sendDirectAssessmentInvitationEmail).toHaveBeenCalled();
  });

  it('permite revocar/quitar el acceso a una evaluación de un usuario', async () => {
    const prisma = {
      assignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assign-789',
          status: 'AVAILABLE',
          user: { id: 'user-456', email: 'evaluado@example.com', firstName: 'Laura', lastName: 'Gómez' },
          test: { id: 'test-dpo', code: 'DPO', name: 'DPO-PRO' },
          attempt: null,
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback({
          assignment: {
            update: jest.fn().mockResolvedValue({ id: 'assign-789', status: 'REVOKED' }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({ id: 'audit-revoke-1' }),
          },
        });
      }),
    } as unknown as PrismaService;

    const service = new UsersService(prisma, {} as MailService);
    const result = await service.revokeAssignment(actor, 'assign-789');

    expect(result.success).toBe(true);
    expect(result.assignmentId).toBe('assign-789');
  });

  it('rechaza revocar una asignación ya completada', async () => {
    const prisma = {
      assignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assign-789',
          status: 'COMPLETED',
          user: { id: 'user-456', email: 'evaluado@example.com', firstName: 'Laura', lastName: 'Gómez' },
          test: { id: 'test-dpo', code: 'DPO', name: 'DPO-PRO' },
          attempt: { status: 'COMPLETED' },
        }),
      },
    } as unknown as PrismaService;

    const service = new UsersService(prisma, {} as MailService);
    await expect(service.revokeAssignment(actor, 'assign-789')).rejects.toBeInstanceOf(BadRequestException);
  });
});
