import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { UserStatus } from '../src/generated/prisma/client';
import { AuthService } from '../src/modules/auth/auth.service';
import { EncryptionService } from '../src/modules/mail/encryption.service';
import { MailService } from '../src/modules/mail/mail.service';

describe('AuthService email flows', () => {
  const user = {
    id: 'user-1',
    email: 'persona@example.com',
    firstName: 'Persona',
    lastName: 'Ejemplo',
    status: UserStatus.PENDING_VERIFICATION,
  };

  function setup() {
    type CreatedUserInput = { data: { email: string; status: UserStatus } };
    type VerificationTokenInput = { data: { userId: string; tokenHash: string; expiresAt: Date } };
    type ResetTokenInput = { data: { userId: string; tokenHash: string; expiresAt: Date } };
    type ResetTokenUpdateInput = { where: { userId: string; usedAt: null }; data: { usedAt: Date } };
    const createUser = jest.fn<Promise<typeof user>, [CreatedUserInput]>().mockResolvedValue(user);
    const createVerificationToken = jest.fn<Promise<{ id: string }>, [VerificationTokenInput]>().mockResolvedValue({ id: 'verification-1' });
    const updateResetTokens = jest.fn<Promise<{ count: number }>, [ResetTokenUpdateInput]>().mockResolvedValue({ count: 0 });
    const createResetToken = jest.fn<Promise<{ id: string }>, [ResetTokenInput]>().mockResolvedValue({ id: 'reset-1' });
    const prisma = {
      user: {
        findUnique: jest.fn(),
        create: createUser,
      },
      role: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'role-user' }) },
      emailVerificationToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: createVerificationToken,
      },
      passwordResetToken: {
        updateMany: updateResetTokens,
        create: createResetToken,
      },
    };
    const mail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      prisma as never,
      {} as JwtService,
      {} as ConfigService,
      mail as unknown as MailService,
    );
    return { service, prisma, mail };
  }

  it('creates a pending account and sends its confirmation email', async () => {
    const { service, prisma, mail } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.register({
      firstName: ' Persona ',
      lastName: ' Ejemplo ',
      email: ' Persona@Example.com ',
      password: 'Password123',
      termsAccepted: true,
      privacyAccepted: true,
    });

    const createUserInput = prisma.user.create.mock.calls[0]?.[0];
    const verificationInput = prisma.emailVerificationToken.create.mock.calls[0]?.[0];
    expect(createUserInput?.data.email).toBe('persona@example.com');
    expect(createUserInput?.data.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(verificationInput?.data.userId).toBe(user.id);
    expect(verificationInput?.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verificationInput?.data.expiresAt).toBeInstanceOf(Date);
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      user.email,
      user.firstName,
      expect.any(String),
    );
    expect(result).toMatchObject({ verificationRequired: true, deliveryStatus: 'SENT' });
  });

  it('creates a one-hour token and sends the password recovery email', async () => {
    const { service, prisma, mail } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...user, status: UserStatus.ACTIVE });

    const before = Date.now();
    const result = await service.forgotPassword({ email: ' Persona@Example.com ' });
    const resetCreateInput = prisma.passwordResetToken.create.mock.calls[0]?.[0];
    const resetUpdateInput = prisma.passwordResetToken.updateMany.mock.calls[0]?.[0];
    const expiresAt = resetCreateInput?.data.expiresAt;

    expect(resetUpdateInput?.where).toEqual({ userId: user.id, usedAt: null });
    expect(resetUpdateInput?.data.usedAt).toBeInstanceOf(Date);
    expect(expiresAt?.getTime()).toBeGreaterThanOrEqual(before + 60 * 60_000);
    expect(expiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60_000);
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      user.firstName,
      expect.any(String),
    );
    expect(result.success).toBe(true);
  });
});

describe('MailService SMTP settings', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the enabled SMTP configuration saved in Settings', async () => {
    type SentMessage = {
      from: { name: string; address: string };
      to: string;
      subject: string;
      html: string;
    };
    const sendMail = jest.fn<Promise<{ messageId: string }>, [SentMessage]>().mockResolvedValue({ messageId: 'message-1' });
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const prisma = {
      mailSettings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'smtp',
          enabled: true,
          host: 'smtp.settings.example',
          port: 465,
          secure: true,
          username: 'smtp-user',
          passwordEncrypted: 'encrypted-password',
          fromName: 'Crevantia Settings',
          fromAddress: 'no-reply@settings.example',
        }),
      },
    };
    const encryption = { decrypt: jest.fn().mockReturnValue('smtp-password') };
    const config = { getOrThrow: jest.fn().mockReturnValue('https://crevantia.example') };
    const service = new MailService(
      prisma as never,
      encryption as unknown as EncryptionService,
      config as unknown as ConfigService,
    );

    await service.sendVerificationEmail('persona@example.com', 'Persona', 'raw-token');

    expect(prisma.mailSettings.findUnique).toHaveBeenCalledWith({ where: { id: 'smtp' } });
    expect(encryption.decrypt).toHaveBeenCalledWith('encrypted-password');
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.settings.example',
      port: 465,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    }));
    const sentMessage = sendMail.mock.calls[0]?.[0];
    expect(sentMessage?.from).toEqual({ name: 'Crevantia Settings', address: 'no-reply@settings.example' });
    expect(sentMessage?.to).toBe('persona@example.com');
    expect(sentMessage?.subject).toBe('Confirma tu cuenta de Crevantia');
    expect(sentMessage?.html).toContain('https://crevantia.example/verificar-correo?token=raw-token');
  });

  it('sends a real SMTP test to the requested recipient', async () => {
    type TestMessage = { to: string; subject: string };
    const sendMail = jest.fn<Promise<{ messageId: string }>, [TestMessage]>().mockResolvedValue({ messageId: 'test-message' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      mailSettings: { findUnique: jest.fn().mockResolvedValue({
        id: 'smtp', enabled: true, host: 'smtp.settings.example', port: 587, secure: false,
        username: 'smtp-user', passwordEncrypted: 'encrypted-password', fromName: 'Crevantia', fromAddress: 'no-reply@settings.example',
      }) },
      auditLog: { create: createAudit },
    };
    const service = new MailService(
      prisma as never,
      { decrypt: () => 'smtp-password' } as unknown as EncryptionService,
      {} as ConfigService,
    );

    const result = await service.testSettings('admin-1', ' Test@Example.com ');

    expect(sendMail.mock.calls[0]?.[0].to).toBe('test@example.com');
    expect(sendMail.mock.calls[0]?.[0].subject).toBe('Crevantia · Prueba real de envío SMTP');
    expect(createAudit).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('reports an incomplete saved SMTP identity before connecting', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport');
    const service = new MailService(
      { mailSettings: { findUnique: jest.fn().mockResolvedValue({
        enabled: true, host: 'sandbox.smtp.mailtrap.io', port: 465, secure: true,
        username: null, passwordEncrypted: 'encrypted-password', fromName: 'Crevantia', fromAddress: 'no-reply@example.com',
      }) } } as never,
      { decrypt: () => 'smtp-password' } as unknown as EncryptionService,
      {} as ConfigService,
    );

    await expect(service.testSettings('admin-1', 'test@example.com')).rejects.toThrow('falta el usuario SMTP');
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('returns a useful service error instead of 500 when SMTP rejects authentication', async () => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('Authentication failed'), { code: 'EAUTH', responseCode: 535 }));
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const service = new MailService(
      { mailSettings: { findUnique: jest.fn().mockResolvedValue({
        enabled: true, host: 'sandbox.smtp.mailtrap.io', port: 587, secure: false,
        username: 'smtp-user', passwordEncrypted: 'encrypted-password', fromName: 'Crevantia', fromAddress: 'no-reply@example.com',
      }) } } as never,
      { decrypt: () => 'smtp-password' } as unknown as EncryptionService,
      {} as ConfigService,
    );

    try {
      await service.testSettings('admin-1', 'test@example.com');
      throw new Error('La prueba debía rechazar la autenticación.');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      expect(exception.message).toContain('rechazó la autenticación');
    }
  });

  it('allows testing SMTP with real-time form parameters even if disabled in database', async () => {
    type TestMessage = { to: string; subject: string };
    const sendMail = jest.fn<Promise<{ messageId: string }>, [TestMessage]>().mockResolvedValue({ messageId: 'test-msg-2' });
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-2' });
    const prisma = {
      mailSettings: { findUnique: jest.fn().mockResolvedValue({
        id: 'smtp', enabled: false, host: 'old.host.example', port: 25, secure: false,
        username: null, passwordEncrypted: null, fromName: 'Crevantia', fromAddress: 'old@example.com',
      }) },
      auditLog: { create: createAudit },
    };
    const service = new MailService(
      prisma as never,
      { decrypt: () => 'override-password' } as unknown as EncryptionService,
      {} as ConfigService,
    );

    const result = await service.testSettings('admin-1', {
      email: 'live-test@example.com',
      host: 'smtp.new-provider.example',
      port: 465,
      secure: true,
      username: 'new-user',
      password: 'new-password',
      fromName: 'New Sender',
      fromAddress: 'sender@new-provider.example',
    });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.new-provider.example',
      port: 465,
      secure: true,
      auth: { user: 'new-user', pass: 'new-password' },
    }));
    expect(sendMail.mock.calls[0]?.[0].to).toBe('live-test@example.com');
    expect(result.success).toBe(true);
  });
});
