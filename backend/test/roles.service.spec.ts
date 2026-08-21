import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../src/common/auth.types';
import type { PrismaService } from '../src/database/prisma.service';
import { RolesService } from '../src/modules/roles/roles.service';

const superadmin: AuthenticatedUser = {
  sub: 'super-1',
  email: 'super@example.com',
  roles: ['SUPERADMIN'],
  permissions: [],
};

describe('RolesService', () => {
  it('reserva los códigos de superadministración', async () => {
    const service = new RolesService({} as PrismaService);
    await expect(service.create(superadmin, {
      code: 'SUPER_ADMIN',
      name: 'Alias inseguro',
      permissionIds: [],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('impide que un gestor conceda permisos que no posee', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(null) },
      permission: {
        findMany: jest.fn().mockResolvedValue([{ id: 'critical-1', code: 'settings.manage' }]),
      },
    } as unknown as PrismaService;
    const actor: AuthenticatedUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['roles.manage'],
    };

    const service = new RolesService(prisma);
    await expect(service.create(actor, {
      code: 'SOPORTE',
      name: 'Soporte',
      permissionIds: ['critical-1'],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protege también un alias heredado de superadministración', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'legacy', code: 'SUPER_ADMIN', isSystem: false }) },
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect(service.update(superadmin, 'legacy', {
      name: 'No editable',
      permissionIds: [],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
