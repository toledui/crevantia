import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
        select: {
          id: true, code: true, name: true, description: true, isSystem: true, createdAt: true,
          permissions: { select: { permissionId: true } },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.permission.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, description: true } }),
    ]);

    return {
      roles: roles.map((role) => ({ ...role, permissionIds: role.permissions.map(({ permissionId }) => permissionId), permissions: undefined, userCount: role._count.users, _count: undefined })),
      permissions,
    };
  }

  async create(actorId: string, dto: CreateRoleDto) {
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.role.findUnique({ where: { code }, select: { id: true } })) throw new ConflictException('Ya existe un rol con ese código.');
    await this.assertPermissions(dto.permissionIds);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { code, name: dto.name.trim(), description: dto.description?.trim() || null } });
      if (dto.permissionIds.length) await tx.rolePermission.createMany({ data: dto.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })) });
      await tx.auditLog.create({ data: { actorId, action: 'ROLE_CREATED', entityType: 'Role', entityId: role.id, metadata: { code, permissionIds: dto.permissionIds } } });
      return role;
    });
  }

  async update(actorId: string, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, code: true, isSystem: true } });
    if (!role) throw new NotFoundException('El rol no existe.');
    if (role.code === 'SUPERADMIN') throw new BadRequestException('Los permisos del superadministrador están protegidos.');
    await this.assertPermissions(dto.permissionIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { name: dto.name.trim(), description: dto.description?.trim() || null } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (dto.permissionIds.length) await tx.rolePermission.createMany({ data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })) });
      await tx.auditLog.create({ data: { actorId, action: 'ROLE_UPDATED', entityType: 'Role', entityId: id, metadata: { code: role.code, permissionIds: dto.permissionIds } } });
      return { success: true };
    });
  }

  async remove(actorId: string, id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, code: true, isSystem: true, _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('El rol no existe.');
    if (role.isSystem) throw new BadRequestException('Los roles del sistema no se pueden eliminar.');
    if (role._count.users) throw new BadRequestException('No puedes eliminar un rol que tiene usuarios asignados.');

    await this.prisma.$transaction([
      this.prisma.auditLog.create({ data: { actorId, action: 'ROLE_DELETED', entityType: 'Role', entityId: id, metadata: { code: role.code } } }),
      this.prisma.role.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  private async assertPermissions(permissionIds: string[]) {
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== permissionIds.length) throw new BadRequestException('Uno o más permisos no existen.');
  }
}
