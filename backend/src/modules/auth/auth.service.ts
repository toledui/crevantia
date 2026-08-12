import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth.types';
import { PrismaService } from '../../database/prisma.service';
import { UserStatus } from '../../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { EmailDto, LoginDto, RegisterDto, ResetPasswordDto, TokenDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.termsAccepted || !dto.privacyAccepted) {
      throw new BadRequestException('Debes aceptar los términos y el aviso de privacidad.');
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new BadRequestException('Ya existe una cuenta con este correo.');
    }
    const userRole = await this.prisma.role.findUniqueOrThrow({ where: { code: 'USER' } });
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        status: UserStatus.PENDING_VERIFICATION,
        roles: { create: { roleId: userRole.id } },
        consents: { create: [
          { consentType: 'TERMS', documentVersion: 'demo-v1' },
          { consentType: 'PRIVACY', documentVersion: 'demo-v1' },
        ] },
      },
    });
    const deliveryStatus = await this.deliverVerification(user.id, user.email, user.firstName);
    return { id: user.id, email: user.email, verificationRequired: true, deliveryStatus };
  }

  async verifyEmail(dto: TokenDto) {
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hash(dto.token) },
      include: { user: true },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new BadRequestException('El enlace de verificación no es válido o ya expiró.');
    }
    if (token.user.status === UserStatus.DISABLED) throw new BadRequestException('La cuenta está deshabilitada.');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: token.userId }, data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorId: token.userId, action: 'EMAIL_VERIFIED', entityType: 'User', entityId: token.userId } }),
    ]);
    return { success: true, message: 'Tu correo fue verificado. Ya puedes iniciar sesión.' };
  }

  async resendVerification(dto: EmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (user?.status === UserStatus.PENDING_VERIFICATION) {
      await this.deliverVerification(user.id, user.email, user.firstName);
    }
    return { success: true, message: 'Si la cuenta está pendiente, recibirás un nuevo enlace de verificación.' };
  }

  async forgotPassword(dto: EmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (user && user.status !== UserStatus.DISABLED) {
      await this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      const rawToken = randomBytes(48).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: this.hash(rawToken), expiresAt: new Date(Date.now() + 60 * 60_000) },
      });
      try { await this.mail.sendPasswordResetEmail(user.email, user.firstName, rawToken); } catch { /* Respuesta deliberadamente genérica. */ }
    }
    return { success: true, message: 'Si existe una cuenta con ese correo, recibirás instrucciones para restablecerla.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(dto.token) },
      include: { user: true },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date() || token.user.status === UserStatus.DISABLED) {
      throw new BadRequestException('El enlace de recuperación no es válido o ya expiró.');
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, status: token.user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : token.user.status } }),
      this.prisma.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({ data: { actorId: token.userId, action: 'PASSWORD_RESET', entityType: 'User', entityId: token.userId } }),
    ]);
    return { success: true, message: 'La contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }

  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      if (user) await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }
    if (user.status === UserStatus.LOCKED && user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('La cuenta está bloqueada temporalmente.');
    }
    const lockExpired = user.status === UserStatus.LOCKED && user.lockedUntil && user.lockedUntil <= new Date();
    if (user.status !== UserStatus.ACTIVE && !lockExpired) {
      throw new UnauthorizedException(user.status === UserStatus.PENDING_VERIFICATION ? 'Debes confirmar tu correo antes de iniciar sesión.' : 'La cuenta no está activa.');
    }

    const roles = user.roles.map(({ role }) => role.code);
    await this.prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null } });
    const refreshSecret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshDays * 86_400_000);
    const session = await this.prisma.session.create({ data: { userId: user.id, refreshTokenHash: this.hash(refreshSecret), userAgent, expiresAt } });
    return {
      accessToken: await this.signAccess({ sub: user.id, email: user.email, roles }),
      refreshToken: `${session.id}.${refreshSecret}`,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roles },
    };
  }

  async refresh(rawToken: string | undefined) {
    const [sessionId, suppliedSecret] = rawToken?.split('.') ?? [];
    if (!sessionId || !suppliedSecret) throw new UnauthorizedException('Sesión no válida.');
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: { include: { roles: { include: { role: true } } } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !this.safeEqual(session.refreshTokenHash, this.hash(suppliedSecret))) {
      throw new UnauthorizedException('La sesión expiró o fue revocada.');
    }
    const nextSecret = randomBytes(48).toString('base64url');
    await this.prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: this.hash(nextSecret), lastUsedAt: new Date() } });
    const roles = session.user.roles.map(({ role }) => role.code);
    return { accessToken: await this.signAccess({ sub: session.user.id, email: session.user.email, roles }), refreshToken: `${session.id}.${nextSecret}` };
  }

  async logout(rawToken: string | undefined) {
    const sessionId = rawToken?.split('.')[0];
    if (sessionId) await this.prisma.session.updateMany({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true, status: true, emailVerifiedAt: true, roles: { select: { role: { select: { code: true, name: true } } } } } });
  }

  private async deliverVerification(userId: string, email: string, firstName: string) {
    await this.prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    const rawToken = randomBytes(48).toString('base64url');
    await this.prisma.emailVerificationToken.create({ data: { userId, tokenHash: this.hash(rawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    try { await this.mail.sendVerificationEmail(email, firstName, rawToken); return 'SENT' as const; } catch { return 'FAILED' as const; }
  }

  private get refreshDays() { return Number(this.config.get('REFRESH_TOKEN_DAYS') ?? 7); }
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private safeEqual(expected: string, actual: string) { const a = Buffer.from(expected); const b = Buffer.from(actual); return a.length === b.length && timingSafeEqual(a, b); }
  private signAccess(payload: AuthenticatedUser) { return this.jwt.signAsync(payload, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' }); }
  private async recordFailedLogin(userId: string, current: number) {
    const next = current + 1;
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: next, ...(next >= 5 ? { status: UserStatus.LOCKED, lockedUntil: new Date(Date.now() + 15 * 60_000) } : {}) } });
  }
}

