import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from './encryption.service';
import { UpdateMailSettingsDto } from './mail-settings.dto';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  async publicSettings() {
    const settings = await this.prisma.mailSettings.findUnique({ where: { id: 'smtp' } });
    if (!settings) {
      return { enabled: false, host: '', port: 587, secure: false, username: '', hasPassword: false, fromName: 'Crevantia', fromAddress: '', updatedAt: null };
    }
    return {
      enabled: settings.enabled,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username ?? '',
      hasPassword: Boolean(settings.passwordEncrypted),
      fromName: settings.fromName,
      fromAddress: settings.fromAddress,
      updatedAt: settings.updatedAt,
    };
  }

  async updateSettings(actorId: string, dto: UpdateMailSettingsDto) {
    const existing = await this.prisma.mailSettings.findUnique({ where: { id: 'smtp' } });
    const passwordEncrypted = dto.password ? this.encryption.encrypt(dto.password) : existing?.passwordEncrypted;
    const settings = await this.prisma.mailSettings.upsert({
      where: { id: 'smtp' },
      update: {
        enabled: dto.enabled,
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        username: dto.username?.trim() || null,
        passwordEncrypted,
        fromName: dto.fromName.trim(),
        fromAddress: dto.fromAddress.trim().toLowerCase(),
      },
      create: {
        id: 'smtp',
        enabled: dto.enabled,
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        username: dto.username?.trim() || null,
        passwordEncrypted,
        fromName: dto.fromName.trim(),
        fromAddress: dto.fromAddress.trim().toLowerCase(),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'MAIL_SETTINGS_UPDATED',
        entityType: 'MailSettings',
        entityId: settings.id,
        metadata: { enabled: settings.enabled, host: settings.host, port: settings.port, secure: settings.secure },
      },
    });
    return this.publicSettings();
  }

  async testSettings(actorId: string) {
    const { transporter, fromName, fromAddress } = await this.transporter();
    await transporter.verify();
    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to: fromAddress,
      subject: 'Crevantia · Configuración SMTP correcta',
      text: 'La conexión SMTP y el envío de correo de Crevantia funcionan correctamente.',
      html: '<p>La conexión SMTP y el envío de correo de <strong>Crevantia</strong> funcionan correctamente.</p>',
    });
    await this.prisma.auditLog.create({ data: { actorId, action: 'MAIL_SETTINGS_TESTED', entityType: 'MailSettings', entityId: 'smtp' } });
    return { success: true, message: `Correo de prueba enviado a ${fromAddress}.` };
  }

  async sendVerificationEmail(to: string, firstName: string, token: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/verificar-correo?token=${encodeURIComponent(token)}`;
    await this.send(to, 'Confirma tu cuenta de Crevantia', this.template(
      `Hola, ${this.escape(firstName)}`,
      'Confirma tu correo para activar tu cuenta y acceder a Crevantia.',
      'Confirmar mi cuenta', link,
      'Este enlace caduca en 24 horas y solo puede utilizarse una vez.',
    ));
  }

  async sendPasswordResetEmail(to: string, firstName: string, token: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    await this.send(to, 'Restablece tu contraseña de Crevantia', this.template(
      `Hola, ${this.escape(firstName)}`,
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
      'Restablecer contraseña', link,
      'Este enlace caduca en 60 minutos. Si no solicitaste el cambio, ignora este mensaje.',
    ));
  }

  async sendUserInvitationEmail(to: string, firstName: string, token: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    await this.send(to, 'Tu cuenta de Crevantia está lista', this.template(
      `Hola, ${this.escape(firstName)}`,
      `Se creó una cuenta para ti en Crevantia con el correo <strong>${this.escape(to)}</strong>. Define tu contraseña personal para comenzar.`,
      'Crear mi contraseña', link,
      'Este enlace caduca en 48 horas y solo puede utilizarse una vez. Por seguridad, Crevantia nunca envía contraseñas por correo.',
    ));
  }

  private async send(to: string, subject: string, html: string) {
    const { transporter, fromName, fromAddress } = await this.transporter();
    await transporter.sendMail({ from: { name: fromName, address: fromAddress }, to, subject, html });
  }

  private async transporter(): Promise<{ transporter: Transporter; fromName: string; fromAddress: string }> {
    const settings = await this.prisma.mailSettings.findUnique({ where: { id: 'smtp' } });
    if (!settings?.enabled) throw new ServiceUnavailableException('El servicio de correo aún no está configurado.');
    const password = settings.passwordEncrypted ? this.encryption.decrypt(settings.passwordEncrypted) : undefined;
    return {
      transporter: nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        auth: settings.username ? { user: settings.username, pass: password ?? '' } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
      fromName: settings.fromName,
      fromAddress: settings.fromAddress,
    };
  }

  private template(title: string, message: string, button: string, link: string, footer: string) {
    return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f2ec;font-family:Arial,sans-serif;color:#080b12"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" style="max-width:600px;background:white;border-radius:18px;padding:36px"><tr><td><div style="font-size:26px;font-weight:700;color:#302b78">crevantia</div><h1 style="font-size:28px;margin:32px 0 12px">${title}</h1><p style="color:#606a7b;line-height:1.6">${message}</p><p style="margin:30px 0"><a href="${link}" style="display:inline-block;background:#302b78;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">${button}</a></p><p style="color:#8a93a2;font-size:12px;line-height:1.6">${footer}</p><p style="color:#8a93a2;font-size:11px;word-break:break-all">Si el botón no funciona, abre: ${link}</p></td></tr></table></td></tr></table></body></html>`;
  }

  private escape(value: string) {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return value.replace(/[&<>'"]/g, (character) => entities[character] ?? character);
  }
}
