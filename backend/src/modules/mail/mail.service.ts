import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from './encryption.service';
import { TestMailSettingsDto, UpdateMailSettingsDto } from './mail-settings.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

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

  async testSettings(actorId: string, recipientOrDto: string | TestMailSettingsDto) {
    const dto: TestMailSettingsDto = typeof recipientOrDto === 'string' ? { email: recipientOrDto } : recipientOrDto;
    const to = dto.email.trim().toLowerCase();
    try {
      const { transporter, fromName, fromAddress, host, port, secure } = await this.resolveTransporter(dto, false);
      const timestamp = new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'America/Mexico_City',
      }).format(new Date());

      await transporter.sendMail({
        from: { name: fromName, address: fromAddress },
        to,
        subject: 'Crevantia · Prueba real de envío SMTP',
        text: `Prueba real de envío SMTP - Crevantia\n\nEste correo confirma que la conexión, autenticación y entrega SMTP de Crevantia funcionan correctamente.\n\nDetalles de la conexión:\n- Servidor: ${host}\n- Puerto: ${port} (${secure ? 'SSL/TLS directo' : 'STARTTLS / TLS'})\n- Remitente: ${fromName} <${fromAddress}>\n- Destinatario: ${to}\n- Fecha y hora: ${timestamp}`,
        html: this.testEmailTemplate({
          host,
          port,
          secure,
          fromName,
          fromAddress,
          to,
          timestamp,
        }),
      });
    } catch (error) {
      throw this.smtpException(error);
    }
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action: 'MAIL_SETTINGS_TESTED', entityType: 'MailSettings', entityId: 'smtp', metadata: { recipient: to } },
      });
    } catch (error) {
      this.logger.error('El correo SMTP de prueba se envió, pero no fue posible registrar la auditoría.', error);
    }
    return { success: true, message: `Correo de prueba enviado a ${to}. Revisa también la carpeta de spam.` };
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

  async sendPasswordChangedConfirmationEmail(to: string, firstName: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/recuperar-contrasena`;
    await this.send(to, 'Tu contraseña de Crevantia ha sido actualizada', this.template(
      `Hola, ${this.escape(firstName)}`,
      'Te informamos que la contraseña de tu cuenta en Crevantia acaba de ser actualizada correctamente.<br><br>Si realizaste este cambio, puedes ignorar este mensaje.',
      '¿No fuiste tú? Recupera tu cuenta', link,
      'Si no autorizaste este cambio, te sugerimos recuperar tu acceso de inmediato para proteger tu información.',
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

  async sendUserCreatedWithCredentialsEmail(to: string, firstName: string, tempPassword: string, testName?: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/iniciar-sesion`;
    const testNote = testName
      ? `<br><br>Además, se te ha asignado la evaluación psicométrica <strong>${this.escape(testName)}</strong>, lista para responderse en cuanto ingreses.`
      : '';
    await this.send(to, 'Tus credenciales de acceso a Crevantia', this.template(
      `Hola, ${this.escape(firstName)}`,
      `Se ha creado tu cuenta en Crevantia para que puedas realizar tus evaluaciones psicométricas y consultar tus resultados.${testNote}<br><br>Tus credenciales de acceso son:<br><strong>Correo:</strong> ${this.escape(to)}<br><strong>Contraseña temporal:</strong> <code style="background:rgba(48,43,120,0.08);padding:2px 8px;border-radius:4px;font-family:monospace;font-size:14px;color:#1e1b4b;">${this.escape(tempPassword)}</code><br><br>Te recomendamos iniciar sesión y actualizar tu contraseña personal en tu perfil.`,
      'Iniciar sesión en Crevantia', link,
      'Conserva este correo en un lugar seguro para consultar tus credenciales.',
    ));
  }

  async sendDirectAssessmentInvitationEmail(
    to: string,
    firstName: string,
    testName: string,
    reason?: string,
    customMessage?: string,
  ) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/panel`;
    const reasonText = reason ? `<br><br><strong>Motivo / Referencia:</strong> ${this.escape(reason)}` : '';
    const customText = customMessage ? `<br><br><em>"${this.escape(customMessage)}"</em>` : '';
    await this.send(
      to,
      `Tienes una evaluación asignada en Crevantia — ${testName}`,
      this.template(
        `Hola, ${this.escape(firstName)}`,
        `Se te ha asignado la evaluación psicométrica <strong>${this.escape(testName)}</strong> en la plataforma Crevantia.${reasonText}${customText}<br><br>La prueba ya está disponible en tu panel personal sin costo adicional. Puedes iniciarla y completarla cuando dispongas del tiempo adecuado en un entorno tranquilo.`,
        'Ir a mi panel e iniciar evaluación',
        link,
        'Si es tu primera vez o necesitas restablecer tu contraseña, utiliza la opción "¿Olvidaste tu contraseña?" con este mismo correo.',
      ),
    );
  }

  async sendAccountCreatedWithPurchaseEmail(to: string, firstName: string, tempPassword: string) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/iniciar-sesion`;
    await this.send(to, '¡Bienvenido a Crevantia! Acceso a tu cuenta', this.template(
      `Hola, ${this.escape(firstName)}`,
      `Hemos creado tu cuenta en Crevantia para que puedas realizar tus evaluaciones psicométricas y consultar tus resultados.<br><br>Tus datos de acceso son:<br><strong>Correo:</strong> ${this.escape(to)}<br><strong>Contraseña temporal:</strong> <code style="background:rgba(48,43,120,0.08);padding:2px 8px;border-radius:4px;font-family:monospace;font-size:14px;color:#1e1b4b;">${this.escape(tempPassword)}</code><br><br>Te recomendamos iniciar sesión y actualizar tu contraseña personal en cualquier momento.`,
      'Iniciar sesión en Crevantia', link,
      'Conserva este correo en un lugar seguro para consultar tus credenciales.',
    ));
  }

  async sendPurchaseReceiptEmail(
    to: string,
    firstName: string,
    order: { orderNumber: string; productName: string; totalFormatted: string; currency: string },
    pdfBuffer?: Buffer,
  ) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/panel`;
    const attachments = pdfBuffer
      ? [{ filename: `Recibo_${order.orderNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : undefined;

    await this.send(
      to,
      `Confirmación de compra — Orden ${order.orderNumber} — Crevantia`,
      this.template(
        `¡Gracias por tu compra, ${this.escape(firstName)}!`,
        `Tu pago por la evaluación <strong>${this.escape(order.productName)}</strong> ha sido procesado exitosamente por un total de <strong>$${order.totalFormatted} ${order.currency}</strong>.<br><br>Adjunto a este correo encontrarás el recibo oficial en PDF con el desglose de tu compra.<br><br>Tu evaluación ya está disponible en tu panel personal y puedes comenzar a responderla en cualquier momento.`,
        'Ir a mi panel y comenzar evaluación',
        link,
        'Si requieres asistencia técnica o soporte adicional, no dudes en responder a este correo.',
      ),
      attachments,
    );
  }

  async sendAssessmentReportEmail(
    to: string,
    firstName: string,
    assessmentName: string,
    pdfBuffer: Buffer,
    filename: string,
  ) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/panel`;
    await this.send(
      to,
      `Tu reporte de ${assessmentName} está listo`,
      this.template(
        `Hola, ${this.escape(firstName)}`,
        `Tu evaluación <strong>${this.escape(assessmentName)}</strong> ha finalizado correctamente.<br><br>Adjunto encontrarás tu reporte individual en PDF. También puedes descargarlo en cualquier momento o solicitar un nuevo envío desde tu panel personal.`,
        'Ir a mi panel',
        link,
        'Este documento contiene información personal. Te recomendamos conservarlo en un lugar seguro.',
      ),
      [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    );
  }

  async sendPendingPaymentReminderEmail(
    to: string,
    firstName: string,
    order: { orderNumber: string; productName: string; slug: string; totalFormatted: string; currency: string },
  ) {
    const link = `${this.config.getOrThrow<string>('FRONTEND_URL')}/pago/${order.slug}`;
    await this.send(
      to,
      `Tu evaluación te está esperando — Orden ${order.orderNumber} — Crevantia`,
      this.template(
        `Hola, ${this.escape(firstName)}`,
        `Notamos que dejaste pendiente el pago de tu evaluación <strong>${this.escape(order.productName)}</strong> por <strong>$${order.totalFormatted} ${order.currency}</strong>.<br><br>Hemos guardado tu orden con el folio <strong>${order.orderNumber}</strong> para que puedas completarla cuando estés listo.`,
        'Completar mi compra ahora',
        link,
        'Tu evaluación se desbloqueará de forma automática e inmediata tan pronto como se confirme el pago.',
      ),
    );
  }

  async sendContactFormEmail(recipients: string[], contact: { name: string; email: string; subject: string; message: string }) {
    const { transporter, fromName, fromAddress } = await this.transporter();
    const safeName = this.escape(contact.name);
    const safeEmail = this.escape(contact.email);
    const safeSubject = this.escape(contact.subject);
    const safeMessage = this.escape(contact.message).replace(/\n/g, '<br>');
    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to: recipients,
      replyTo: { name: contact.name, address: contact.email },
      subject: `Contacto web · ${contact.subject}`,
      text: `Nombre: ${contact.name}\nCorreo: ${contact.email}\nAsunto: ${contact.subject}\n\n${contact.message}`,
      html: `<div style="font-family:Arial,sans-serif;color:#20252e;line-height:1.6"><h2 style="color:#302b78">Nuevo mensaje desde el sitio web</h2><p><strong>Nombre:</strong> ${safeName}<br><strong>Correo:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a><br><strong>Asunto:</strong> ${safeSubject}</p><hr style="border:0;border-top:1px solid #e5e7eb"><p>${safeMessage}</p></div>`,
    });
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ) {
    const { transporter, fromName, fromAddress } = await this.transporter();
    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to,
      subject,
      html,
      attachments,
    });
  }

  private async transporter(): Promise<{ transporter: Transporter; fromName: string; fromAddress: string; host: string; port: number; secure: boolean }> {
    return this.resolveTransporter(undefined, true);
  }

  private async resolveTransporter(
    overrides?: Partial<TestMailSettingsDto>,
    requireEnabled = false,
  ): Promise<{ transporter: Transporter; fromName: string; fromAddress: string; host: string; port: number; secure: boolean }> {
    const settings = await this.prisma.mailSettings.findUnique({ where: { id: 'smtp' } });
    if (requireEnabled && !settings?.enabled) {
      throw new ServiceUnavailableException('El servicio de correo aún no está configurado o está deshabilitado.');
    }

    const host = (overrides?.host !== undefined ? overrides.host : (settings?.host ?? '')).trim();
    const port = overrides?.port !== undefined ? overrides.port : (settings?.port ?? 587);
    const secure = overrides?.secure !== undefined ? overrides.secure : (settings?.secure ?? false);
    const username = (overrides?.username !== undefined ? overrides.username : (settings?.username ?? ''))?.trim() || null;
    const fromName = (overrides?.fromName !== undefined ? overrides.fromName : (settings?.fromName ?? 'Crevantia')).trim() || 'Crevantia';
    const fromAddress = (overrides?.fromAddress !== undefined ? overrides.fromAddress : (settings?.fromAddress ?? '')).trim().toLowerCase();

    let password: string | undefined;
    if (overrides?.password) {
      password = overrides.password;
    } else if (settings?.passwordEncrypted) {
      password = this.encryption.decrypt(settings.passwordEncrypted);
    }

    if (!host) throw new ServiceUnavailableException('La configuración SMTP está incompleta: falta el servidor.');
    if (!fromAddress) throw new ServiceUnavailableException('La configuración SMTP está incompleta: falta el correo remitente.');
    if (password && !username) {
      throw new ServiceUnavailableException('La configuración SMTP está incompleta: hay una contraseña configurada, pero falta el usuario SMTP.');
    }
    if (username && !password) {
      throw new ServiceUnavailableException('La configuración SMTP está incompleta: falta la contraseña SMTP.');
    }

    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: username ? { user: username, pass: password ?? '' } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
      fromName,
      fromAddress,
      host,
      port,
      secure,
    };
  }

  private smtpException(error: unknown) {
    if (error instanceof ServiceUnavailableException) return error;
    this.logger.error('Error en prueba o envío SMTP:', error);
    const details = error && typeof error === 'object' ? error as { code?: string; responseCode?: number; message?: string } : {};
    const code = details.code ?? '';
    const responseCode = details.responseCode;
    const rawMessage = details.message ?? (error instanceof Error ? error.message : '');

    if (code === 'EAUTH' || responseCode === 535) {
      return new ServiceUnavailableException('El servidor SMTP rechazó la autenticación. Revisa que el usuario y la contraseña sean correctos.');
    }
    if (code === 'EDNS' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return new ServiceUnavailableException('No fue posible encontrar el servidor SMTP. Revisa el nombre del host.');
    }
    if (rawMessage.toLowerCase().includes('wrong version number') || (details as { reason?: string }).reason === 'wrong version number') {
      return new ServiceUnavailableException('Conflicto SSL/TLS: el puerto configurado no usa SSL directo. Desmarca la casilla "SSL/TLS directo" (el cliente usará STARTTLS automáticamente). Marca "SSL/TLS directo" únicamente para el puerto 465.');
    }
    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
      return new ServiceUnavailableException('No fue posible conectar con el servidor SMTP. Revisa host, puerto y la opción SSL/TLS.');
    }
    if (code === 'EENVELOPE' || responseCode === 550 || responseCode === 553 || responseCode === 554) {
      return new ServiceUnavailableException(`El servidor SMTP rechazó el remitente o el destinatario (${rawMessage || 'error de entrega'}).`);
    }
    if (rawMessage.toLowerCase().includes('certificate') || rawMessage.toLowerCase().includes('self signed')) {
      return new ServiceUnavailableException(`Error de certificado SSL/TLS al conectar con el servidor SMTP: ${rawMessage}`);
    }
    return new ServiceUnavailableException(`La prueba SMTP falló: ${rawMessage || 'Revisa las credenciales y la configuración del servidor.'}`);
  }

  private testEmailTemplate(data: {
    host: string;
    port: number;
    secure: boolean;
    fromName: string;
    fromAddress: string;
    to: string;
    timestamp: string;
  }) {
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prueba de conexión SMTP · Crevantia</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f2ec;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(90deg, #302b78 0%, #4338ca 100%);height:6px;"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#302b78;">crevantia</div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 12px;background-color:#ecfdf5;color:#047857;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #a7f3d0;">
                      ✓ Conexión exitosa
                    </span>
                  </td>
                </tr>
              </table>

              <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:24px 0 10px 0;line-height:1.3;">
                Prueba real de envío SMTP
              </h1>
              <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 20px 0;">
                Este correo confirma que el servidor de correo de <strong>Crevantia</strong> está conectado, autenticado y entregando mensajes de forma correcta.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-bottom:12px;">
                      Parámetros de conexión verificados
                    </div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;color:#334155;line-height:1.8;">
                      <tr>
                        <td style="color:#64748b;width:130px;padding:3px 0;">Servidor SMTP:</td>
                        <td style="font-weight:600;color:#0f172a;padding:3px 0;">${this.escape(data.host)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:3px 0;">Puerto y modo:</td>
                        <td style="font-weight:600;color:#0f172a;padding:3px 0;">${data.port} (${data.secure ? 'SSL/TLS directo' : 'STARTTLS / TLS'})</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:3px 0;">Remitente:</td>
                        <td style="font-weight:600;color:#0f172a;padding:3px 0;">${this.escape(data.fromName)} &lt;${this.escape(data.fromAddress)}&gt;</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:3px 0;">Destinatario:</td>
                        <td style="font-weight:600;color:#0f172a;padding:3px 0;">${this.escape(data.to)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:3px 0;">Fecha de emisión:</td>
                        <td style="font-weight:600;color:#0f172a;padding:3px 0;">${this.escape(data.timestamp)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:10px;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#1e40af;">
                  <strong>Próximos pasos:</strong> Ya puedes habilitar el servicio con total confianza para el envío de confirmación de cuentas, recuperación de contraseñas y notificaciones del sistema.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Mensaje de diagnóstico generado automáticamente por el panel de administración de <strong>Crevantia</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private template(title: string, message: string, button: string, link: string, footer: string) {
    return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f2ec;font-family:Arial,sans-serif;color:#080b12"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" style="max-width:600px;background:white;border-radius:18px;padding:36px"><tr><td><div style="font-size:26px;font-weight:700;color:#302b78">crevantia</div><h1 style="font-size:28px;margin:32px 0 12px">${title}</h1><p style="color:#606a7b;line-height:1.6">${message}</p><p style="margin:30px 0"><a href="${link}" style="display:inline-block;background:#302b78;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">${button}</a></p><p style="color:#8a93a2;font-size:12px;line-height:1.6">${footer}</p><p style="color:#8a93a2;font-size:11px;word-break:break-all">Si el botón no funciona, abre: ${link}</p></td></tr></table></td></tr></table></body></html>`;
  }

  private escape(value: string) {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return value.replace(/[&<>'"]/g, (character) => entities[character] ?? character);
  }
}
