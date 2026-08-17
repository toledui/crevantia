import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth.types';
import { PrismaService } from '../../database/prisma.service';
import { UserStatus } from '../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { ChangeUserStatusDto, CreateUserDto, ListUsersDto, UpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  async list(dto: ListUsersDto) {
    const search = dto.search?.trim();
    const where = {
      ...(dto.status && dto.status !== 'ALL' ? { status: dto.status as UserStatus } : {}),
      ...(search ? { OR: [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ] } : {}),
    };
    const skip = (dto.page - 1) * dto.limit;
    const [items, total, roles] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: dto.limit, orderBy: { createdAt: 'desc' }, select: this.userSelect() }),
      this.prisma.user.count({ where }),
      this.prisma.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], select: { id: true, code: true, name: true, description: true, isSystem: true } }),
    ]);
    return { items: items.map((user) => this.serializeUser(user)), total, page: dto.page, limit: dto.limit, roles };
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException('Ya existe una cuenta con ese correo.');
    await this.assertRoleAssignment(actor, dto.roleIds);
    const rawToken = randomBytes(48).toString('base64url');
    const temporaryPassword = randomBytes(48).toString('base64url');

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash: await argon2.hash(temporaryPassword, { type: argon2.argon2id }),
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
        },
      });
      await tx.passwordResetToken.create({ data: { userId: created.id, tokenHash: this.hash(rawToken), expiresAt: new Date(Date.now() + 48 * 60 * 60_000) } });
      await tx.auditLog.create({ data: { actorId: actor.sub, action: 'USER_CREATED', entityType: 'User', entityId: created.id, metadata: { email, roleIds: dto.roleIds, invited: true } } });
      return created;
    });

    const invitationStatus = await this.deliverInvitation(user.email, user.firstName, rawToken);
    return { id: user.id, email: user.email, invitationStatus };
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!existing) throw new NotFoundException('El usuario no existe.');
    const email = dto.email.trim().toLowerCase();
    const duplicate = await this.prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException('Ya existe una cuenta con ese correo.');
    const currentRoles = existing.roles.map(({ roleId }) => roleId).sort();
    const nextRoles = [...dto.roleIds].sort();
    const rolesChanged = currentRoles.join(',') !== nextRoles.join(',');
    if (rolesChanged) {
      if (!actor.permissions.includes('roles.manage')) throw new ForbiddenException('Necesitas permiso para administrar roles.');
      await this.assertRoleAssignment(actor, dto.roleIds);
      const superadmin = await this.prisma.role.findUnique({ where: { code: 'SUPERADMIN' }, select: { id: true } });
      if (superadmin && currentRoles.includes(superadmin.id) && !nextRoles.includes(superadmin.id)) {
        const activeSuperadmins = await this.prisma.user.count({ where: { status: UserStatus.ACTIVE, roles: { some: { roleId: superadmin.id } } } });
        if (activeSuperadmins <= 1) throw new BadRequestException('Debe existir al menos un superadministrador activo.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { email, firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), ...(existing.email !== email ? { emailVerifiedAt: new Date() } : {}) } });
      if (rolesChanged) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) });
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({ data: { actorId: actor.sub, action: 'USER_UPDATED', entityType: 'User', entityId: id, metadata: { email, roleIds: dto.roleIds, rolesChanged } } });
    });
    return { success: true };
  }

  async changeStatus(actor: AuthenticatedUser, id: string, dto: ChangeUserStatusDto) {
    if (actor.sub === id && dto.status === 'DISABLED') throw new BadRequestException('No puedes deshabilitar tu propia cuenta.');
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundException('El usuario no existe.');
    if (dto.status === 'DISABLED' && user.roles.some(({ role }) => role.code === 'SUPERADMIN')) {
      const activeSuperadmins = await this.prisma.user.count({ where: { status: UserStatus.ACTIVE, roles: { some: { role: { code: 'SUPERADMIN' } } } } });
      if (activeSuperadmins <= 1) throw new BadRequestException('Debe existir al menos un superadministrador activo.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status: dto.status, ...(dto.status === 'ACTIVE' ? { failedLoginAttempts: 0, lockedUntil: null } : {}) } }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorId: actor.sub, action: dto.status === 'ACTIVE' ? 'USER_ENABLED' : 'USER_DISABLED', entityType: 'User', entityId: id } }),
    ]);
    return { success: true };
  }

  async resendInvitation(actor: AuthenticatedUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('El usuario no existe.');
    if (user.status === UserStatus.DISABLED) throw new BadRequestException('Activa la cuenta antes de enviar una invitación.');
    const rawToken = randomBytes(48).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.create({ data: { userId: id, tokenHash: this.hash(rawToken), expiresAt: new Date(Date.now() + 48 * 60 * 60_000) } }),
      this.prisma.auditLog.create({ data: { actorId: actor.sub, action: 'USER_INVITATION_RESENT', entityType: 'User', entityId: id } }),
    ]);
    const invitationStatus = await this.deliverInvitation(user.email, user.firstName, rawToken);
    return { success: invitationStatus === 'SENT', invitationStatus, message: invitationStatus === 'SENT' ? 'Invitación enviada.' : 'La invitación quedó preparada, pero el correo no pudo enviarse.' };
  }

  private async assertRoleAssignment(actor: AuthenticatedUser, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds } }, include: { permissions: { include: { permission: true } } } });
    if (roles.length !== roleIds.length) throw new BadRequestException('Uno o más roles no existen.');
    if (actor.roles.includes('SUPERADMIN')) return;
    if (roles.some(({ code }) => code === 'SUPERADMIN')) throw new ForbiddenException('Solo un superadministrador puede asignar ese rol.');
    const unauthorized = roles.flatMap(({ permissions }) => permissions).some(({ permission }) => !actor.permissions.includes(permission.code));
    if (unauthorized) throw new ForbiddenException('No puedes conceder permisos que no tienes.');
  }

  private async deliverInvitation(email: string, firstName: string, rawToken: string) {
    try { await this.mail.sendUserInvitationEmail(email, firstName, rawToken); return 'SENT' as const; }
    catch { return 'FAILED' as const; }
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private userSelect() {
    return { id: true, email: true, firstName: true, lastName: true, status: true, emailVerifiedAt: true, createdAt: true, updatedAt: true, roles: { select: { role: { select: { id: true, code: true, name: true } } } } } as const;
  }
  private serializeUser(user: { roles: Array<{ role: { id: string; code: string; name: string } }> } & Record<string, unknown>) {
    return { ...user, roles: user.roles.map(({ role }) => role) };
  }
}
