import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { UpdateReportSettingsDto, UpdateSiteSettingsDto } from './site-settings.dto';
import { PROVISIONAL_REPORT_TEXT_BLOCKS } from './provisional-report-defaults';

const DEFAULT_CATEGORIES = [
  { label: 'Brisa', description: 'Intensidad baja dentro de la escala interpretativa.', color: '#55b6c7' },
  { label: 'Viento', description: 'Intensidad moderada dentro de la escala interpretativa.', color: '#4b8fd3' },
  { label: 'Ráfaga', description: 'Intensidad alta dentro de la escala interpretativa.', color: '#6a5acd' },
  { label: 'Huracán', description: 'Intensidad muy alta dentro de la escala interpretativa.', color: '#302b78' },
];

@Injectable()
export class SiteSettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private serializeSite(settings: Awaited<ReturnType<SiteSettingsService['ensure']>>) {
    const base = {
      version: settings.version, reportDefaultsVersion: settings.reportDefaultsVersion, siteName: settings.siteName, siteDescription: settings.siteDescription,
      logoUrl: settings.logoData ? `/api/v1/public/site-settings/logo?v=${settings.version}` : '/branding/logo-crevantia.png',
      faviconUrl: settings.faviconData ? `/api/v1/public/site-settings/favicon?v=${settings.version}` : '/branding/logo-crevantia.png',
      contactEmail: settings.contactEmail, contactPhone: settings.contactPhone, contactWhatsapp: settings.contactWhatsapp,
      contactAddress: settings.contactAddress, contactHours: settings.contactHours, contactMapUrl: settings.contactMapUrl,
      updatedAt: settings.updatedAt,
    };
    return base;
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
    const settings = await this.ensure();
    return { ...this.serializeSite(settings), headCode: settings.headCode, bodyEndCode: settings.bodyEndCode };
  }
  async getSiteAdmin() { return this.serializeSite(await this.ensure()); }
  async getReportAdmin() { return this.serializeReport(await this.ensure()); }

  async updateSite(actorId: string, dto: UpdateSiteSettingsDto) {
    const before = await this.ensure();
    const updated = await this.prisma.siteSettings.update({ where: { id: 'default' }, data: {
      version: { increment: 1 }, siteName: dto.siteName.trim(), siteDescription: dto.siteDescription.trim(),
      contactEmail: this.clean(dto.contactEmail), contactPhone: this.clean(dto.contactPhone), contactWhatsapp: this.clean(dto.contactWhatsapp),
      contactAddress: this.clean(dto.contactAddress), contactHours: this.clean(dto.contactHours), contactMapUrl: this.clean(dto.contactMapUrl),
    }});
    await this.prisma.auditLog.create({ data: { actorId, action: 'SITE_SETTINGS_UPDATED', entityType: 'SiteSettings', entityId: 'default', before: { version: before.version, siteName: before.siteName }, after: { version: updated.version, siteName: updated.siteName } } });
    return this.serializeSite(updated);
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
    return kind === 'report-logo' ? this.serializeReport(updated) : this.serializeSite(updated);
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
