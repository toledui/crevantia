import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { Prisma, ReportStudioStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateReportTemplateDto, GenerateReportDto, UpdateBindingDto, UpdateReportVersionDto, UpdateTemplateLinkDto } from './report-studio.dto';

type JsonObject = Record<string, unknown>;
type RenderSession = { expiresAt: number; payload: JsonObject };

@Injectable()
export class ReportStudioService {
  private readonly sessions = new Map<string, RenderSession>();

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  listTemplates() {
    return this.prisma.reportTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        testLinks: { where: { isActive: true }, include: { test: { select: { id: true, code: true, name: true } }, assessment: { select: { id: true, code: true, name: true } } } },
        versions: { orderBy: { createdAt: 'desc' }, select: { id: true, version: true, status: true, pendingBindings: true, updatedAt: true, publishedAt: true } },
      },
    });
  }

  async catalog() {
    const [tests, assessments, themes] = await Promise.all([
      this.prisma.test.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      this.prisma.assessment.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
      this.prisma.reportTheme.findMany({ orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
    ]);
    return { tests, assessments, themes };
  }

  async createTemplate(actorId: string, dto: CreateReportTemplateDto) {
    const code = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '-');
    const [test, assessment, source, theme] = await Promise.all([
      this.prisma.test.findUnique({ where: { id: dto.testId }, select: { id: true } }),
      dto.assessmentId ? this.prisma.assessment.findUnique({ where: { id: dto.assessmentId }, select: { id: true } }) : null,
      dto.cloneFromVersionId ? this.loadVersion(dto.cloneFromVersionId) : null,
      dto.themeId ? this.prisma.reportTheme.findUnique({ where: { id: dto.themeId } }) : this.prisma.reportTheme.findFirst({ orderBy: { createdAt: 'asc' } }),
    ]);
    if (!test) throw new NotFoundException('La prueba seleccionada no existe.');
    if (dto.assessmentId && !assessment) throw new NotFoundException('La evaluación seleccionada no existe.');
    if (!code) throw new BadRequestException('El código del reporte no es válido.');
    const duplicate = await this.prisma.reportTemplate.findUnique({ where: { code }, select: { id: true } });
    if (duplicate) throw new ConflictException('Ya existe un reporte con ese código.');

    const layout = source ? structuredClone(object(source.layoutJson)) : blankLayout(dto.pageSize ?? 'LETTER', dto.name.trim());
    if (source && dto.pageSize) array<JsonObject>(layout.pages).forEach((page) => { page.pageSize = dto.pageSize; });
    const bindings = source ? object(source.bindingConfigJson) : { schemaVersion: '1.0.0', bindingPresets: [] };
    const configurationHash = hash({ layout, bindings });
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.reportTemplate.create({ data: { code, name: dto.name.trim(), description: dto.description?.trim() || null } });
      const version = await tx.reportTemplateVersion.create({ data: {
        reportTemplateId: template.id,
        version: '1.0.0',
        status: ReportStudioStatus.DRAFT,
        themeId: source?.themeId ?? theme?.id ?? null,
        layoutJson: asJson(layout),
        bindingConfigJson: asJson(bindings),
        pendingBindings: countPendingBindings(bindings),
        configurationHash,
        createdById: actorId,
      } });
      await tx.testReportTemplate.updateMany({ where: { testId: dto.testId, assessmentId: dto.assessmentId || null, language: dto.language?.trim() || 'es-MX', audience: dto.audience?.trim().toUpperCase() || 'INDIVIDUAL', isDefault: true }, data: { isDefault: false } });
      await tx.testReportTemplate.create({ data: {
        testId: dto.testId,
        assessmentId: dto.assessmentId || null,
        reportTemplateId: template.id,
        language: dto.language?.trim() || 'es-MX',
        audience: dto.audience?.trim().toUpperCase() || 'INDIVIDUAL',
        isDefault: true,
      } });
      await tx.auditLog.create({ data: { actorId, action: 'REPORT_TEMPLATE_CREATED', entityType: 'ReportTemplate', entityId: template.id, metadata: { code, testId: dto.testId, assessmentId: dto.assessmentId ?? null, clonedFrom: dto.cloneFromVersionId ?? null } } });
      return { ...template, versions: [version] };
    });
  }

  async updateTemplateLink(actorId: string, templateId: string, dto: UpdateTemplateLinkDto) {
    const [template, test, assessment] = await Promise.all([
      this.prisma.reportTemplate.findUnique({ where: { id: templateId }, select: { id: true } }),
      this.prisma.test.findUnique({ where: { id: dto.testId }, select: { id: true } }),
      dto.assessmentId ? this.prisma.assessment.findUnique({ where: { id: dto.assessmentId }, select: { id: true } }) : null,
    ]);
    if (!template) throw new NotFoundException('La plantilla no existe.');
    if (!test) throw new NotFoundException('La prueba seleccionada no existe.');
    if (dto.assessmentId && !assessment) throw new NotFoundException('La evaluación seleccionada no existe.');
    const language = dto.language?.trim() || 'es-MX';
    const audience = dto.audience?.trim().toUpperCase() || 'INDIVIDUAL';
    const isDefault = dto.isDefault ?? true;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.testReportTemplate.updateMany({ where: { testId: dto.testId, assessmentId: dto.assessmentId || null, language, audience, isDefault: true }, data: { isDefault: false } });
      await tx.testReportTemplate.deleteMany({ where: { reportTemplateId: templateId } });
      const link = await tx.testReportTemplate.create({ data: { testId: dto.testId, assessmentId: dto.assessmentId || null, reportTemplateId: templateId, language, audience, isDefault, isActive: dto.isActive ?? true } });
      await tx.auditLog.create({ data: { actorId, action: 'REPORT_TEMPLATE_LINK_UPDATED', entityType: 'ReportTemplate', entityId: templateId, metadata: { testId: dto.testId, assessmentId: dto.assessmentId ?? null, language, audience, isDefault } } });
      return link;
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.reportTemplate.findUnique({ where: { id }, include: { testLinks: { include: { test: true, assessment: true } }, versions: { orderBy: { createdAt: 'desc' }, include: { theme: true } } } });
    if (!template) throw new NotFoundException('La plantilla no existe.');
    return template;
  }

  async getVersion(id: string, resultRunId?: string) {
    const version = await this.loadVersion(id);
    return { ...version, previewData: await this.previewData(resultRunId), publication: this.publicationState(version) };
  }

  async updateVersion(actorId: string, id: string, dto: UpdateReportVersionDto) {
    const current = await this.loadVersion(id);
    this.assertMutable(current.status);
    const layout = dto.layoutJson ?? object(current.layoutJson);
    const bindings = normalizeBindings(dto.bindingConfigJson ?? object(current.bindingConfigJson));
    const pendingBindings = countPendingBindings(bindings);
    const configurationHash = hash({ layout, bindings });
    const updated = await this.prisma.reportTemplateVersion.update({ where: { id }, data: {
      ...(dto.layoutJson ? { layoutJson: asJson(layout) } : {}),
      ...(dto.bindingConfigJson ? { bindingConfigJson: asJson(bindings) } : {}),
      pendingBindings,
      configurationHash,
    } });
    await this.audit(actorId, 'REPORT_TEMPLATE_VERSION_UPDATED', id, { configurationHash, pendingBindings });
    return { ...updated, publication: this.publicationState(updated) };
  }

  async updateBinding(actorId: string, id: string, dto: UpdateBindingDto) {
    const current = await this.loadVersion(id);
    this.assertMutable(current.status);
    const bindings = structuredClone(object(current.bindingConfigJson));
    const presets = array<JsonObject>(bindings.bindingPresets);
    const preset = presets.find((item) => item.code === dto.presetCode);
    if (!preset) throw new NotFoundException('El preset de binding no existe.');
    const configured = object(preset.configuredMappings);
    configured[dto.itemKey] = { sourceType: dto.sourceType, sourceCode: dto.sourceCode };
    preset.configuredMappings = configured;
    const required = bindingRequiredKeys(preset);
    if (required.length && required.every((key) => object(preset.configuredMappings)[key])) preset.status = 'READY_CONFIGURED';
    return this.updateVersion(actorId, id, { bindingConfigJson: bindings });
  }

  async publish(actorId: string, id: string) {
    const current = await this.loadVersion(id);
    this.assertMutable(current.status);
    const pending = countPendingBindings(object(current.bindingConfigJson));
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reportTemplateVersion.updateMany({ where: { reportTemplateId: current.reportTemplateId, status: ReportStudioStatus.PUBLISHED }, data: { status: ReportStudioStatus.ARCHIVED } });
      const version = await tx.reportTemplateVersion.update({ where: { id }, data: { status: ReportStudioStatus.PUBLISHED, publishedById: actorId, publishedAt: new Date(), pendingBindings: pending } });
      await tx.reportTemplate.update({ where: { id: current.reportTemplateId }, data: { status: ReportStudioStatus.PUBLISHED } });
      return version;
    });
    await this.audit(actorId, 'REPORT_TEMPLATE_VERSION_PUBLISHED', id, { configurationHash: updated.configurationHash, optionalBindingsPending: pending });
    return updated;
  }

  async cloneVersion(actorId: string, id: string, nextVersion: string) {
    const current = await this.loadVersion(id);
    if (!/^\d+\.\d+\.\d+$/.test(nextVersion.trim())) throw new BadRequestException('Usa una versión semántica, por ejemplo 1.1.0.');
    return this.prisma.reportTemplateVersion.create({ data: {
      reportTemplateId: current.reportTemplateId,
      version: nextVersion.trim(),
      status: ReportStudioStatus.DRAFT,
      themeId: current.themeId,
      layoutJson: current.layoutJson as Prisma.InputJsonValue,
      bindingConfigJson: current.bindingConfigJson as Prisma.InputJsonValue,
      pendingBindings: current.pendingBindings,
      configurationHash: current.configurationHash,
      createdById: actorId,
    } });
  }

  async bindingOptions() {
    const [targets, derived] = await Promise.all([
      this.prisma.normTarget.findMany({ orderBy: [{ targetType: 'asc' }, { name: 'asc' }], select: { targetType: true, targetCode: true, name: true } }),
      this.prisma.derivedMetric.findMany({ orderBy: { name: 'asc' }, select: { code: true, name: true } }),
    ]);
    return [
      ...targets.map((item) => ({ group: item.targetType, sourceType: item.targetType, sourceCode: item.targetCode, label: item.name })),
      ...derived.map((item) => ({ group: 'DERIVED_METRIC', sourceType: 'DERIVED_METRIC', sourceCode: item.code, label: item.name })),
    ];
  }

  async generatePdf(actorId: string, versionId: string, dto: GenerateReportDto) {
    const version = await this.loadVersion(versionId);
    if (dto.resultRunId) await this.assertVersionMatchesResult(version.reportTemplateId, dto.resultRunId);
    const previewData = await this.previewData(dto.resultRunId);
    const filename = `Reporte_${version.template.code}_${version.version}_${Date.now()}.pdf`;
    const record = await this.prisma.generatedReport.create({ data: {
      resultRunId: dto.resultRunId ?? null,
      reportTemplateVersionId: version.id,
      generatedById: actorId,
      filename,
      dataSnapshot: asJson(previewData),
    } });
    try {
      const token = randomBytes(32).toString('hex');
      this.sessions.set(token, { expiresAt: Date.now() + 120_000, payload: {
        version: serializeVersion(version), previewData, pageSize: dto.pageSize ?? 'LETTER', printMode: true,
      } });
      const frontendUrl = this.config.get<string>('FRONTEND_INTERNAL_URL') ?? 'http://localhost:3000';
      const browser = await chromium.launch({ headless: true });
      let pdf: Buffer;
      let pageCount: number;
      try {
        const page = await browser.newPage();
        await page.goto(`${frontendUrl}/report-studio/render/${token}`, { waitUntil: 'networkidle', timeout: 120_000 });
        await page.waitForSelector('[data-report-ready="true"]', { timeout: 120_000 });
        pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, tagged: true });
        pageCount = await page.locator('[data-report-page]').count();
      } finally {
        await browser.close();
        this.sessions.delete(token);
      }
      const ready = await this.prisma.generatedReport.update({ where: { id: record.id }, data: {
        status: 'READY', pdfData: Uint8Array.from(pdf), byteSize: pdf.length,
        sha256: createHash('sha256').update(pdf).digest('hex'), pageCount,
      } });
      return { id: ready.id, status: ready.status, filename, pageCount, reportTemplateVersionId: version.id, configurationHash: version.configurationHash, downloadUrl: `/admin/report-studio/generated/${ready.id}` };
    } catch (error) {
      await this.prisma.generatedReport.update({ where: { id: record.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 4000) : 'Error desconocido' } });
      throw error;
    }
  }

  async generateForResultRun(actorId: string, resultRunId: string, dto: GenerateReportDto = {}) {
    const version = await this.resolvePublishedVersion(resultRunId);
    return this.generatePdf(actorId, version.id, { ...dto, resultRunId });
  }

  async publishedVersionIdentity(resultRunId: string) {
    const version = await this.resolvePublishedVersion(resultRunId);
    return { reportTemplateVersionId: version.id, configurationHash: version.configurationHash };
  }

  async download(id: string) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id } });
    if (!report?.pdfData) throw new NotFoundException('El PDF no está disponible.');
    return { filename: report.filename, buffer: Buffer.from(report.pdfData) };
  }

  consumeRenderSession(token: string) {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      this.sessions.delete(token);
      throw new NotFoundException('La sesión de render expiró.');
    }
    return session.payload;
  }

  private async previewData(resultRunId?: string): Promise<JsonObject> {
    if (!resultRunId) return sampleData();
    const run = await this.prisma.resultRun.findUnique({ where: { id: resultRunId }, include: {
      values: true,
      assessmentVersion: { include: { assessment: true } },
      attempt: { include: { assignment: { include: { user: true, test: true } } } },
    } });
    if (!run) throw new NotFoundException('El ResultRun seleccionado no existe.');
    return {
      person: { fullName: `${run.attempt.assignment.user.firstName} ${run.attempt.assignment.user.lastName}`.trim(), firstName: run.attempt.assignment.user.firstName },
      assessment: { name: run.assessmentVersion.assessment.name, completedAt: run.attempt.completedAt ?? run.calculatedAt },
      report: { generatedAt: new Date() },
      values: Object.fromEntries(run.values.map((value) => [`${value.targetType}.${value.targetCode}`, { rawScore: Number(value.rawScore), displayScore: value.displayScore == null ? null : Number(value.displayScore), decile: value.decile }])),
    };
  }

  private async loadVersion(id: string) {
    const version = await this.prisma.reportTemplateVersion.findUnique({ where: { id }, include: { template: { include: { testLinks: { where: { isActive: true }, include: { test: { select: { id: true, code: true, name: true } }, assessment: { select: { id: true, code: true, name: true } } } } } }, theme: true } });
    if (!version) throw new NotFoundException('La versión de plantilla no existe.');
    return version;
  }

  private async resultIdentity(resultRunId: string) {
    const run = await this.prisma.resultRun.findUnique({ where: { id: resultRunId }, select: {
      assessmentVersion: { select: { assessmentId: true } },
      attempt: { select: { assignment: { select: { testId: true } } } },
    } });
    if (!run) throw new NotFoundException('El ResultRun seleccionado no existe.');
    return { testId: run.attempt.assignment.testId, assessmentId: run.assessmentVersion.assessmentId };
  }

  private async assertVersionMatchesResult(reportTemplateId: string, resultRunId: string) {
    const identity = await this.resultIdentity(resultRunId);
    const link = await this.prisma.testReportTemplate.findFirst({ where: {
      reportTemplateId,
      testId: identity.testId,
      isActive: true,
      OR: [{ assessmentId: identity.assessmentId }, { assessmentId: null }],
    } });
    if (!link) throw new ConflictException('Esta plantilla no está vinculada con la prueba y evaluación del resultado seleccionado.');
  }

  private async resolvePublishedVersion(resultRunId: string) {
    const identity = await this.resultIdentity(resultRunId);
    const links = await this.prisma.testReportTemplate.findMany({
      where: { testId: identity.testId, isActive: true, OR: [{ assessmentId: identity.assessmentId }, { assessmentId: null }] },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      include: { reportTemplate: { include: { versions: { where: { status: ReportStudioStatus.PUBLISHED }, orderBy: { publishedAt: 'desc' }, take: 1 } } } },
    });
    const exact = links.find((link) => link.assessmentId === identity.assessmentId && link.reportTemplate.versions.length) ?? links.find((link) => link.reportTemplate.versions.length);
    const version = exact?.reportTemplate.versions[0];
    if (!version) throw new ConflictException('La prueba todavía no tiene una plantilla de reporte publicada y activa.');
    return version;
  }

  private assertMutable(status: ReportStudioStatus) {
    if (status === ReportStudioStatus.PUBLISHED || status === ReportStudioStatus.ARCHIVED) throw new ConflictException('Las versiones publicadas son inmutables. Clónala para editar.');
  }

  private publicationState(version: { pendingBindings: number; status: ReportStudioStatus }) {
    return { canPublish: version.status !== ReportStudioStatus.PUBLISHED && version.status !== ReportStudioStatus.ARCHIVED, pendingBindings: version.pendingBindings };
  }

  private audit(actorId: string, action: string, entityId: string, metadata: JsonObject) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'ReportTemplateVersion', entityId, metadata: asJson(metadata) } });
  }
}

function object(value: unknown): JsonObject { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}; }
function array<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function asJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function serializeVersion(version: { id: string; version: string; status: string; layoutJson: unknown; bindingConfigJson: unknown; pendingBindings: number; template: unknown; theme: unknown }) {
  return { id: version.id, version: version.version, status: version.status, layoutJson: version.layoutJson, bindingConfigJson: version.bindingConfigJson, pendingBindings: version.pendingBindings, template: version.template, theme: version.theme };
}
function bindingRequiredKeys(preset: JsonObject): string[] {
  const labels = array<string>(preset.displayLabels);
  if (labels.length) return labels;
  return array<JsonObject>(preset.groups).filter((group) => stringValue(group.status).includes('CONFIGURABLE')).flatMap((group) => array<string>(group.labels).map((label) => `${stringValue(group.code)}:${label}`));
}
function countPendingBindings(bindings: JsonObject) {
  return array<JsonObject>(bindings.bindingPresets).reduce((count, preset) => {
    if (stringValue(preset.status).includes('CONFIGURABLE')) return count + 1;
    return count + array<JsonObject>(preset.groups).filter((group) => stringValue(group.status).includes('CONFIGURABLE')).length;
  }, 0);
}
function normalizeBindings(input: JsonObject): JsonObject {
  const bindings = structuredClone(input);
  const presets = array<JsonObject>(bindings.bindingPresets);
  for (const preset of presets) {
    const configured = object(preset.configuredMappings);
    const labels = array<string>(preset.displayLabels);
    if (stringValue(preset.status).includes('CONFIGURABLE') && labels.length && labels.every((label) => configured[label])) preset.status = 'READY_CONFIGURED';
    const groups = array<JsonObject>(preset.groups);
    for (const group of groups) {
      const groupLabels = array<string>(group.labels);
      if (stringValue(group.status).includes('CONFIGURABLE') && groupLabels.length && groupLabels.every((label) => configured[`${stringValue(group.code)}:${label}`])) group.status = 'READY_CONFIGURED';
    }
    if (groups.length && groups.every((group) => !stringValue(group.status).includes('CONFIGURABLE'))) preset.status = 'READY_CONFIGURED';
  }
  for (const preset of presets) {
    const includes = array<string>(preset.includes);
    if (includes.length && includes.every((code) => !stringValue(presets.find((item) => item.code === code)?.status).includes('PARTIAL') && !stringValue(presets.find((item) => item.code === code)?.status).includes('CONFIGURABLE'))) preset.status = 'READY_CONFIGURED';
  }
  bindings.bindingPresets = presets;
  return bindings;
}
function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function sampleData(): JsonObject {
  const values: JsonObject = {};
  const codes = ['DPO-C014','DPO-C031','DPO-C011','LIKERT-INGRESO','LIKERT-GASTO','LIKERT-AHORRO','LIKERT-DEUDA','LIKERT-INVERSION'];
  codes.forEach((code, index) => { values[`${code.startsWith('LIKERT') ? 'LIKERT_DIMENSION' : 'COMPOSITE'}.${code}`] = { rawScore: 4 + index, displayScore: 5 + (index % 4), decile: 3 + (index % 7) }; });
  return { isSample: true, person: { fullName: 'Mariana Ejemplo', firstName: 'Mariana' }, assessment: { name: 'Diagnóstico de Perfil Psicofinanciero', completedAt: new Date().toISOString() }, report: { generatedAt: new Date().toISOString() }, values };
}

function blankLayout(pageSize: 'LETTER' | 'A4', reportName: string): JsonObject {
  return {
    schemaVersion: '1.0.0',
    document: { title: reportName, pageSize },
    pages: [{
      pageId: 'page-1',
      sectionCode: 'INTRO',
      sectionName: 'Introducción',
      layoutMode: 'FLOW_LAYOUT',
      pageSize,
      header: { enabled: true },
      footer: { enabled: true, pageNumber: 1 },
      blocks: [
        { id: 'heading-1', type: 'HEADING', flow: true, content: { text: reportName } },
        { id: 'rich-text-1', type: 'RICH_TEXT', flow: true, content: { text: 'Escribe aquí la introducción del reporte.' } },
      ],
    }],
  };
}
