import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { EncryptionService } from '../mail/encryption.service';
import { MailService } from '../mail/mail.service';
import { SubmitContactFormDto, UpdateReportSettingsDto, UpdateSiteSettingsDto } from './site-settings.dto';
import { PROVISIONAL_REPORT_TEXT_BLOCKS } from './provisional-report-defaults';

const DEFAULT_CATEGORIES = [
  { label: 'Brisa', description: 'Intensidad baja dentro de la escala interpretativa.', color: '#55b6c7' },
  { label: 'Viento', description: 'Intensidad moderada dentro de la escala interpretativa.', color: '#4b8fd3' },
  { label: 'Ráfaga', description: 'Intensidad alta dentro de la escala interpretativa.', color: '#6a5acd' },
  { label: 'Huracán', description: 'Intensidad muy alta dentro de la escala interpretativa.', color: '#302b78' },
];

type ContactFormSettings = {
  contactFormRecipientEmail: string | null;
  contactFormRecipientEmails: unknown;
  contactCaptchaProvider: string | null;
  contactCaptchaSiteKey: string | null;
  contactCaptchaSecretEncrypted: string | null;
};

@Injectable()
export class SiteSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly mail: MailService,
  ) {}

  private async ensure() {
    let settings = await this.prisma.siteSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      const mappings = await this.defaultMappings();
      return this.prisma.siteSettings.create({ data: {
        id: 'default', reportDefaultsVersion: 1, reportBrandName: 'PsicoFinanzas', reportPromoTitle: 'Prospera©',
        reportPromoText: PROVISIONAL_REPORT_TEXT_BLOCKS[5]?.content ?? null,
        reportPromoUrl: 'https://www.psicofinanzas.com',
        reportIntroduction: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(1, 3).map((block) => block.content).join('\n\n'),
        reportInterpretation: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(3, 5).map((block) => block.content).join('\n\n'),
        reportCategories: asJson(DEFAULT_CATEGORIES), reportDisplayMappings: asJson(mappings),
        reportTextBlocks: asJson(PROVISIONAL_REPORT_TEXT_BLOCKS),
      }});
    }
    if (settings.reportDefaultsVersion < 1) {
      const mappings = await this.defaultMappings();
      settings = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: {
        reportDefaultsVersion: 1,
        ...(!settings.reportBrandName ? { reportBrandName: 'PsicoFinanzas' } : {}),
        ...(!settings.reportPromoTitle ? { reportPromoTitle: 'Prospera©' } : {}),
        ...(!settings.reportPromoText ? { reportPromoText: PROVISIONAL_REPORT_TEXT_BLOCKS[5]?.content ?? null } : {}),
        ...(!settings.reportPromoUrl ? { reportPromoUrl: 'https://www.psicofinanzas.com' } : {}),
        ...(!settings.reportIntroduction ? { reportIntroduction: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(1, 3).map((block) => block.content).join('\n\n') } : {}),
        ...(!settings.reportInterpretation ? { reportInterpretation: PROVISIONAL_REPORT_TEXT_BLOCKS.slice(3, 5).map((block) => block.content).join('\n\n') } : {}),
        ...(!settings.reportTextBlocks ? { reportTextBlocks: asJson(PROVISIONAL_REPORT_TEXT_BLOCKS) } : {}),
        ...(!settings.reportDisplayMappings ? { reportDisplayMappings: asJson(mappings) } : {}),
      }});
    }
    return settings;
  }

  private async defaultMappings() {
    const active = await this.prisma.assessmentActiveConfiguration.findFirst({ select: { normVersionId: true } });
    if (!active) return [];
    const targets = await this.prisma.normTarget.findMany({ where: { normVersionId: active.normVersionId }, orderBy: [{ targetType: 'asc' }, { targetCode: 'asc' }] });
    return targets.map((target) => ({ targetType: target.targetType, targetCode: target.targetCode, displayName: target.name, section: reportSectionFor(target.targetType) }));
  }

  private clean(value?: string) { return value?.trim() || null; }

  private contactSettings(settings: object): ContactFormSettings {
    return settings as ContactFormSettings;
  }

  private async withContactSettings<T extends object>(settings: T): Promise<T & ContactFormSettings> {
    const rows = await this.prisma.$queryRaw<ContactFormSettings[]>(Prisma.sql`SELECT contactFormRecipientEmail, contactFormRecipientEmails, contactCaptchaProvider, contactCaptchaSiteKey, contactCaptchaSecretEncrypted FROM SiteSettings WHERE id = 'default'`);
    return Object.assign(settings, rows[0] ?? { contactFormRecipientEmail: null, contactFormRecipientEmails: null, contactCaptchaProvider: null, contactCaptchaSiteKey: null, contactCaptchaSecretEncrypted: null });
  }

  private recipientEmails(settings: Awaited<ReturnType<SiteSettingsService['ensure']>>) {
    const contact = this.contactSettings(settings);
    const values: unknown[] = Array.isArray(contact.contactFormRecipientEmails) ? contact.contactFormRecipientEmails : [];
    const emails = values.filter((value): value is string => typeof value === 'string').map((value) => value.trim().toLowerCase()).filter(Boolean);
    return [...new Set(emails.length ? emails : (contact.contactFormRecipientEmail ? [contact.contactFormRecipientEmail] : []))];
  }

  private serializeSite(settings: Awaited<ReturnType<SiteSettingsService['ensure']>>, includeAdminContactSettings = false) {
    const contact = this.contactSettings(settings);
    const base = {
      version: settings.version, reportDefaultsVersion: settings.reportDefaultsVersion, siteName: settings.siteName, siteDescription: settings.siteDescription,
      logoUrl: settings.logoData ? `/api/v1/public/site-settings/logo?v=${settings.version}` : '/branding/logo-crevantia.png',
      faviconUrl: settings.faviconData ? `/api/v1/public/site-settings/favicon?v=${settings.version}` : '/branding/logo-crevantia.png',
      contactEmail: settings.contactEmail, contactPhone: settings.contactPhone, contactWhatsapp: settings.contactWhatsapp,
      contactAddress: settings.contactAddress, contactHours: settings.contactHours, contactMapUrl: settings.contactMapUrl,
      updatedAt: settings.updatedAt,
    };
    if (!includeAdminContactSettings) {
      return {
        ...base,
        contactCaptcha: contact.contactCaptchaProvider && contact.contactCaptchaSiteKey
          ? { provider: contact.contactCaptchaProvider, siteKey: contact.contactCaptchaSiteKey }
          : null,
      };
    }
    return {
      ...base,
      contactFormRecipientEmails: this.recipientEmails(settings),
      contactCaptchaProvider: contact.contactCaptchaProvider,
      contactCaptchaSiteKey: contact.contactCaptchaSiteKey,
      hasContactCaptchaSecret: Boolean(contact.contactCaptchaSecretEncrypted),
    };
  }

  private serializeReport(settings: Awaited<ReturnType<SiteSettingsService['ensure']>>) {
    const fallbackLogo = settings.logoData ? `/api/v1/public/site-settings/logo?v=${settings.version}` : '/branding/logo-crevantia.png';
    return { version: settings.version, reportDefaultsVersion: settings.reportDefaultsVersion,
      reportLogoUrl: settings.reportLogoData ? `/api/v1/public/site-settings/report-logo?v=${settings.version}` : fallbackLogo,
      reportBrandName: settings.reportBrandName, reportPromoTitle: settings.reportPromoTitle,
      reportPromoText: settings.reportPromoText, reportPromoUrl: settings.reportPromoUrl,
      reportIntroduction: settings.reportIntroduction, reportInterpretation: settings.reportInterpretation,
      reportCategories: settings.reportCategories ?? DEFAULT_CATEGORIES,
      reportDisplayMappings: settings.reportDisplayMappings ?? [], reportTextBlocks: settings.reportTextBlocks ?? [],
      updatedAt: settings.updatedAt };
  }

  async getPublic() {
    const settings = await this.withContactSettings(await this.ensure());
    return { ...this.serializeSite(settings), headCode: settings.headCode, bodyEndCode: settings.bodyEndCode };
  }
  async getSiteAdmin() { return this.serializeSite(await this.withContactSettings(await this.ensure()), true); }
  async getReportAdmin() { return this.serializeReport(await this.ensure()); }

  async updateSite(actorId: string, dto: UpdateSiteSettingsDto) {
    const before = await this.ensure();
    const updated = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: {
      version: { increment: 1 }, siteName: dto.siteName.trim(), siteDescription: dto.siteDescription.trim(),
      contactEmail: this.clean(dto.contactEmail),
      contactPhone: this.clean(dto.contactPhone), contactWhatsapp: this.clean(dto.contactWhatsapp),
      contactAddress: this.clean(dto.contactAddress), contactHours: this.clean(dto.contactHours), contactMapUrl: this.clean(dto.contactMapUrl),
    }});
    const recipients = dto.contactFormRecipientEmails ? dto.contactFormRecipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean) : [];
    const provider = this.clean(dto.contactCaptchaProvider);
    const siteKey = this.clean(dto.contactCaptchaSiteKey);
    const secret = !provider ? null : dto.contactCaptchaSecret !== undefined ? (this.clean(dto.contactCaptchaSecret) ? this.encryption.encrypt(dto.contactCaptchaSecret.trim()) : null) : undefined;
    if (secret === undefined) await this.prisma.$executeRaw(Prisma.sql`UPDATE SiteSettings SET contactFormRecipientEmails = ${JSON.stringify(recipients)}, contactCaptchaProvider = ${provider}, contactCaptchaSiteKey = ${siteKey} WHERE id = 'default'`);
    else await this.prisma.$executeRaw(Prisma.sql`UPDATE SiteSettings SET contactFormRecipientEmails = ${JSON.stringify(recipients)}, contactCaptchaProvider = ${provider}, contactCaptchaSiteKey = ${siteKey}, contactCaptchaSecretEncrypted = ${secret} WHERE id = 'default'`);
    await this.prisma.auditLog.create({ data: { actorId, action: 'SITE_SETTINGS_UPDATED', entityType: 'SiteSettings', entityId: 'default', before: { version: before.version, siteName: before.siteName }, after: { version: updated.version, siteName: updated.siteName } } });
    return this.serializeSite(await this.withContactSettings(updated), true);
  }

  async submitContactForm(dto: SubmitContactFormDto) {
    const settings = await this.withContactSettings(await this.ensure());
    if (dto.website) return { success: true };
    const recipients = this.recipientEmails(settings);
    if (!recipients.length) throw new ServiceUnavailableException('El formulario de contacto no tiene destinatarios configurados.');
    await this.verifyContactCaptcha(settings, dto.captchaToken);
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    const subject = dto.subject?.trim() || 'Consulta desde el sitio web';
    await this.mail.sendContactFormEmail(recipients, { name, email, subject, message: dto.message.trim() });
    return { success: true };
  }

  private async verifyContactCaptcha(settings: Awaited<ReturnType<SiteSettingsService['ensure']>>, token?: string) {
    const contact = this.contactSettings(settings);
    const provider = contact.contactCaptchaProvider;
    if (!provider && !contact.contactCaptchaSiteKey && !contact.contactCaptchaSecretEncrypted) return;
    if (!provider || !contact.contactCaptchaSiteKey || !contact.contactCaptchaSecretEncrypted) throw new ServiceUnavailableException('La protección antispam del formulario está incompleta.');
    if (!token) throw new BadRequestException('Completa la verificación antispam.');
    const secret = this.encryption.decrypt(contact.contactCaptchaSecretEncrypted);
    const endpoint = provider === 'turnstile'
      ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
      : 'https://www.google.com/recaptcha/api/siteverify';
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret, response: token }) });
      const result = await response.json() as { success?: boolean };
      if (!result.success) throw new BadRequestException('No fue posible validar la verificación antispam.');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('No fue posible validar la protección antispam. Intenta nuevamente.');
    }
  }

  async updateReport(actorId: string, dto: UpdateReportSettingsDto) {
    const before = await this.ensure();
    const updated = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: {
      version: { increment: 1 }, reportBrandName: this.clean(dto.reportBrandName), reportPromoTitle: this.clean(dto.reportPromoTitle),
      reportPromoText: this.clean(dto.reportPromoText), reportPromoUrl: this.clean(dto.reportPromoUrl),
      reportIntroduction: this.clean(dto.reportIntroduction), reportInterpretation: this.clean(dto.reportInterpretation),
      reportCategories: asJson(dto.reportCategories), reportDisplayMappings: asJson(dto.reportDisplayMappings), reportTextBlocks: asJson(dto.reportTextBlocks),
    }});
    await this.prisma.auditLog.create({ data: { actorId, action: 'REPORT_SETTINGS_UPDATED', entityType: 'SiteSettings', entityId: 'default', before: { version: before.version, reportBrandName: before.reportBrandName }, after: { version: updated.version, reportBrandName: updated.reportBrandName } } });
    return this.serializeReport(updated);
  }

  async getCustomCode() {
    const settings = await this.ensure();
    return { version: settings.version, headCode: settings.headCode, bodyEndCode: settings.bodyEndCode, updatedAt: settings.updatedAt };
  }

  async updateCustomCode(actorId: string, dto: { headCode?: string; bodyEndCode?: string }) {
    const before = await this.ensure();
    const updated = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: {
      version: { increment: 1 }, headCode: this.clean(dto.headCode), bodyEndCode: this.clean(dto.bodyEndCode),
    }});
    await this.prisma.auditLog.create({ data: { actorId, action: 'CUSTOM_CODE_UPDATED', entityType: 'SiteSettings', entityId: 'default', before: { version: before.version, hasHeadCode: Boolean(before.headCode), hasBodyEndCode: Boolean(before.bodyEndCode) }, after: { version: updated.version, hasHeadCode: Boolean(updated.headCode), hasBodyEndCode: Boolean(updated.bodyEndCode) } } });
    return { version: updated.version, headCode: updated.headCode, bodyEndCode: updated.bodyEndCode, updatedAt: updated.updatedAt };
  }

  async uploadAsset(actorId: string, kind: 'logo' | 'favicon' | 'report-logo', file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecciona un archivo de imagen.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(file.mimetype)) throw new BadRequestException('Formato no permitido. Usa PNG, JPG, WebP o ICO.');
    await this.ensure();
    const updated = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: kind === 'logo'
      ? { logoData: Uint8Array.from(file.buffer), logoMimeType: file.mimetype, version: { increment: 1 } }
      : kind === 'favicon'
        ? { faviconData: Uint8Array.from(file.buffer), faviconMimeType: file.mimetype, version: { increment: 1 } }
        : { reportLogoData: Uint8Array.from(file.buffer), reportLogoMimeType: file.mimetype, version: { increment: 1 } } });
    await this.prisma.auditLog.create({ data: { actorId, action: 'SITE_ASSET_UPDATED', entityType: 'SiteSettings', entityId: 'default', metadata: { kind, mimeType: file.mimetype, bytes: file.size, version: updated.version } } });
    return kind === 'report-logo' ? this.serializeReport(updated) : this.serializeSite(await this.withContactSettings(updated), true);
  }

  async getAsset(kind: 'logo' | 'favicon' | 'report-logo') {
    const settings = await this.ensure();
    const data = kind === 'logo' ? settings.logoData : kind === 'favicon' ? settings.faviconData : settings.reportLogoData;
    const mimeType = kind === 'logo' ? settings.logoMimeType : kind === 'favicon' ? settings.faviconMimeType : settings.reportLogoMimeType;
    if (!data || !mimeType) throw new NotFoundException('No hay un recurso personalizado configurado.');
    return { data: Buffer.from(data), mimeType };
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function reportSectionFor(targetType: string) {
  if (targetType === 'SCALE') return '20 precursores de comportamiento';
  if (targetType === 'COMPOSITE') return 'Capacidades y dimensiones financieras';
  if (targetType === 'DERIVED_METRIC') return 'Habilidad y potencial financiero';
  if (targetType.startsWith('LIKERT')) return 'Cuadrantes de realización';
  return 'Resultados del reporte';
}
