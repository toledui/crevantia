import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth.types';
import { PrismaService } from '../../database/prisma.service';
import { AssignmentStatus, AssignmentType, AttemptStatus, TestVersionStatus, UserStatus } from '../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { ChangeUserStatusDto, CreateUserAssignmentDto, CreateUserDto, ListUsersDto, UpdateUserDto } from './users.dto';

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
      this.prisma.user.findMany({
        where,
        skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          ...this.userSelect(),
          assignments: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              testId: true,
              type: true,
              status: true,
              createdAt: true,
              test: { select: { id: true, code: true, name: true } },
              attempt: { select: { id: true, status: true } },
            },
          },
          _count: { select: { assignments: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.role.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], select: { id: true, code: true, name: true, description: true, isSystem: true } }),
    ]);
    return { items: items.map((user) => this.serializeUser(user)), total, page: dto.page, limit: dto.limit, roles };
  }

  async getAssignableTests() {
    const tests = await this.prisma.test.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        versions: {
          where: { status: TestVersionStatus.PUBLISHED },
          orderBy: { version: 'desc' },
          select: { id: true, version: true, estimatedMin: true, language: true, status: true },
        },
      },
    });
    return {
      items: tests.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        publishedVersion: t.versions[0] || null,
        versions: t.versions,
      })),
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }
    await this.assertRoleAssignment(actor, dto.roleIds);

    const isManualPassword = dto.passwordMode === 'MANUAL_PASSWORD' && dto.manualPassword?.trim();
    const plainPassword = isManualPassword ? dto.manualPassword!.trim() : randomBytes(36).toString('base64url');
    const passwordHash = await argon2.hash(plainPassword, { type: argon2.argon2id });
    const rawToken = randomBytes(48).toString('base64url');

    // Check optional initial assignment
    let initialTest: { id: string; name: string; publishedVersionId: string } | null = null;
    if (dto.initialAssignment?.testId) {
      const foundTest = await this.prisma.test.findUnique({
        where: { id: dto.initialAssignment.testId },
        include: {
          versions: {
            where: { status: TestVersionStatus.PUBLISHED },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
      if (foundTest && foundTest.versions[0]) {
        initialTest = {
          id: foundTest.id,
          name: foundTest.name,
          publishedVersionId: foundTest.versions[0].id,
        };
      }
    }

    const { user, assignmentId } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
        },
      });

      if (!isManualPassword) {
        await tx.passwordResetToken.create({
          data: {
            userId: created.id,
            tokenHash: this.hash(rawToken),
            expiresAt: new Date(Date.now() + 48 * 60 * 60_000),
          },
        });
      }

      let createdAssignmentId: string | null = null;
      if (initialTest) {
        const assign = await tx.assignment.create({
          data: {
            userId: created.id,
            testId: initialTest.id,
            testVersionId: initialTest.publishedVersionId,
            type: AssignmentType.ADMIN_FREE,
            status: AssignmentStatus.AVAILABLE,
            reason: dto.initialAssignment?.reason?.trim() || 'Asignación inicial al crear usuario',
          },
        });
        createdAssignmentId = assign.id;
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: created.id,
          metadata: {
            email,
            roleIds: dto.roleIds,
            passwordMode: dto.passwordMode || 'INVITE_LINK',
            initialAssignment: !!initialTest,
          },
        },
      });

      return { user: created, assignmentId: createdAssignmentId };
    });

    let invitationStatus: 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    if (isManualPassword) {
      if (dto.sendCredentialsEmail !== false) {
        try {
          await this.mail.sendUserCreatedWithCredentialsEmail(
            user.email,
            user.firstName,
            plainPassword,
            initialTest?.name,
          );
          invitationStatus = 'SENT';
        } catch {
          invitationStatus = 'FAILED';
        }
      }
    } else {
      invitationStatus = await this.deliverInvitation(user.email, user.firstName, rawToken);
    }

    // Send assessment email if assigned and not manual credentials email
    if (initialTest && dto.initialAssignment?.sendEmail !== false && !isManualPassword) {
      try {
        await this.mail.sendDirectAssessmentInvitationEmail(
          user.email,
          user.firstName,
          initialTest.name,
          dto.initialAssignment?.reason?.trim(),
        );
      } catch {
        // Log silently
      }
    }

    return {
      id: user.id,
      email: user.email,
      invitationStatus,
      assignmentId,
      tempPassword: isManualPassword ? plainPassword : null,
      message:
        invitationStatus === 'SENT'
          ? isManualPassword
            ? 'Usuario creado y credenciales enviadas por correo.'
            : 'Usuario creado e invitación enviada por correo.'
          : invitationStatus === 'FAILED'
          ? 'Usuario creado, pero el correo no pudo enviarse (revisa la configuración SMTP).'
          : 'Usuario creado exitosamente.',
    };
  }

  async assignTest(actor: AuthenticatedUser, userId: string, dto: CreateUserAssignmentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('El usuario no existe.');
    if (user.status === UserStatus.DISABLED) throw new BadRequestException('No se puede asignar una prueba a un usuario deshabilitado.');

    const test = await this.prisma.test.findUnique({
      where: { id: dto.testId },
      include: {
        versions: {
          where: dto.testVersionId
            ? { id: dto.testVersionId }
            : { status: TestVersionStatus.PUBLISHED },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!test) throw new NotFoundException('La prueba seleccionada no existe.');
    const version = test.versions[0];
    if (!version) {
      throw new BadRequestException('La prueba no cuenta con una versión publicada para asignarse.');
    }

    const existingAssignment = await this.prisma.assignment.findFirst({
      where: {
        userId: user.id,
        testId: test.id,
        status: { in: [AssignmentStatus.AVAILABLE, AssignmentStatus.IN_PROGRESS] },
      },
    });
    if (existingAssignment) {
      throw new ConflictException(`El usuario ya tiene una asignación activa para la prueba "${test.name}".`);
    }

    const type = dto.type ? (dto.type as AssignmentType) : AssignmentType.ADMIN_FREE;
    const reason = dto.reason?.trim() || 'Asignación manual desde panel de administración';

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assignment.create({
        data: {
          userId: user.id,
          testId: test.id,
          testVersionId: version.id,
          type,
          status: AssignmentStatus.AVAILABLE,
          reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'ASSIGNMENT_CREATED_BY_ADMIN',
          entityType: 'Assignment',
          entityId: created.id,
          metadata: {
            userId: user.id,
            userEmail: user.email,
            testId: test.id,
            testCode: test.code,
            testName: test.name,
            version: version.version,
            type,
            reason,
          },
        },
      });
      return created;
    });

    let emailStatus: 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    if (dto.sendEmail !== false) {
      try {
        await this.mail.sendDirectAssessmentInvitationEmail(
          user.email,
          user.firstName,
          test.name,
          reason,
          dto.customMessage?.trim(),
        );
        emailStatus = 'SENT';
      } catch {
        emailStatus = 'FAILED';
      }
    }

    return {
      assignmentId: assignment.id,
      testName: test.name,
      userEmail: user.email,
      emailStatus,
      message:
        emailStatus === 'SENT'
          ? `Prueba "${test.name}" asignada exitosamente y correo de invitación enviado a ${user.email}.`
          : emailStatus === 'FAILED'
          ? `Prueba "${test.name}" asignada exitosamente, pero el correo no pudo enviarse (revisa la configuración SMTP).`
          : `Prueba "${test.name}" asignada exitosamente al usuario.`,
    };
  }

  async getUserAssignments(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('El usuario no existe.');

    const items = await this.prisma.assignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        test: { select: { id: true, code: true, name: true, description: true } },
        testVersion: { select: { id: true, version: true, language: true, estimatedMin: true } },
        attempt: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            pausedAt: true,
            submittedAt: true,
            completedAt: true,
            lastActivityAt: true,
          },
        },
      },
    });

    return { user, items };
  }

  async resendAssignmentInvitation(actor: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: true,
        test: true,
      },
    });
    if (!assignment) throw new NotFoundException('La asignación no existe.');
    if (assignment.status === AssignmentStatus.EXPIRED || assignment.status === AssignmentStatus.REVOKED) {
      throw new BadRequestException('No se puede enviar invitación para una asignación expirada o revocada.');
    }

    let emailStatus: 'SENT' | 'FAILED' = 'FAILED';
    try {
      await this.mail.sendDirectAssessmentInvitationEmail(
        assignment.user.email,
        assignment.user.firstName,
        assignment.test.name,
        assignment.reason ?? undefined,
      );
      emailStatus = 'SENT';
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'ASSIGNMENT_INVITATION_RESENT',
          entityType: 'Assignment',
          entityId: assignment.id,
          metadata: { userId: assignment.userId, email: assignment.user.email },
        },
      });
    } catch {
      emailStatus = 'FAILED';
    }

    return {
      success: emailStatus === 'SENT',
      emailStatus,
      message:
        emailStatus === 'SENT'
          ? `Invitación para "${assignment.test.name}" reenviada a ${assignment.user.email}.`
          : 'No fue posible enviar el correo. Revisa la configuración de SMTP.',
    };
  }

  async revokeAssignment(actor: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: true,
        test: true,
        attempt: true,
      },
    });
    if (!assignment) throw new NotFoundException('La asignación no existe.');
    if (assignment.status === AssignmentStatus.REVOKED) {
      throw new BadRequestException('Esta asignación ya ha sido revocada previamente.');
    }
    if (assignment.attempt?.status === AttemptStatus.COMPLETED) {
      throw new BadRequestException('No es posible revocar una prueba que ya ha sido completada por el evaluado.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.REVOKED },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'ASSIGNMENT_REVOKED_BY_ADMIN',
          entityType: 'Assignment',
          entityId: assignment.id,
          metadata: {
            userId: assignment.user.id,
            userEmail: assignment.user.email,
            testId: assignment.test.id,
            testCode: assignment.test.code,
            testName: assignment.test.name,
            previousStatus: assignment.status,
          },
        },
      });
    });

    return {
      success: true,
      assignmentId: assignment.id,
      message: `Acceso a la prueba "${assignment.test.name}" revocado exitosamente para ${assignment.user.firstName} ${assignment.user.lastName} (${assignment.user.email}).`,
    };
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
