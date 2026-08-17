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
});
