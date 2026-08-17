import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Express } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, TestVersionStatus } from '../../generated/prisma/client';
import { ClientWorkbookImporterService } from './client-workbook-importer.service';
import { CreateTestDto, CreateVersionDto, ReplaceVersionContentDto, UpdateTestDto } from './tests.dto';

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService, private readonly importer: ClientWorkbookImporterService) {}

  async list() {
    const items = await this.prisma.test.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: { id: true, version: true, status: true, language: true, estimatedMin: true, publishedAt: true, updatedAt: true, _count: { select: { sections: true, attempts: true, assignments: true } } },
        },
        _count: { select: { assignments: true } },
      },
    });
    return { items };
  }

  async detail(id: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' }, include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' }, include: { statements: { orderBy: { order: 'asc' } }, answerOptions: { orderBy: { order: 'asc' } } } } } } } } },
    });
    if (!test) throw new NotFoundException('La prueba no existe.');
    return test;
  }

  async create(actorId: string, dto: CreateTestDto) {
    const code = dto.code.trim().toUpperCase();
    const slug = dto.slug.trim().toLowerCase();
    const duplicate = await this.prisma.test.findFirst({ where: { OR: [{ code }, { slug }] }, select: { id: true } });
    if (duplicate) throw new ConflictException('Ya existe una prueba con ese código o URL.');
    return this.prisma.$transaction(async (tx) => {
      const test = await tx.test.create({ data: { code, slug, name: dto.name.trim(), description: dto.description?.trim() || null } });
      await tx.auditLog.create({ data: { actorId, action: 'TEST_CREATED', entityType: 'Test', entityId: test.id, metadata: { code, slug } } });
      return test;
    });
  }

  async update(actorId: string, id: string, dto: UpdateTestDto) {
    await this.assertTest(id);
    const slug = dto.slug.trim().toLowerCase();
    const duplicate = await this.prisma.test.findFirst({ where: { slug, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new ConflictException('La URL ya pertenece a otra prueba.');
    return this.prisma.$transaction(async (tx) => {
      const test = await tx.test.update({ where: { id }, data: { slug, name: dto.name.trim(), description: dto.description?.trim() || null, isActive: dto.isActive } });
      await tx.auditLog.create({ data: { actorId, action: 'TEST_UPDATED', entityType: 'Test', entityId: id, metadata: { slug, isActive: dto.isActive } } });
      return test;
    });
  }

  async createVersion(actorId: string, testId: string, dto: CreateVersionDto) {
    await this.assertTest(testId);
    const latest = await this.prisma.testVersion.aggregate({ where: { testId }, _max: { version: true } });
    const nextVersion = (latest._max.version ?? 0) + 1;
    const source = dto.cloneFromVersionId ? await this.getVersion(dto.cloneFromVersionId) : null;
    if (source && source.testId !== testId) throw new BadRequestException('La versión de origen no pertenece a esta prueba.');

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.testVersion.create({
        data: {
          testId, version: nextVersion, status: TestVersionStatus.DRAFT,
          language: dto.language || source?.language || 'es-MX', estimatedMin: dto.estimatedMin ?? source?.estimatedMin,
          labels: source?.labels === null ? undefined : source?.labels,
          sections: source ? { create: source.sections.map((section) => ({
            code: section.code, title: section.title, description: section.description, instructions: section.instructions, order: section.order,
            questions: { create: section.questions.map((question) => ({
              code: question.code, type: question.type, prompt: question.prompt, helpText: question.helpText, order: question.order, required: question.required, config: question.config ?? undefined,
              statements: { create: question.statements.map((statement) => ({ code: statement.code, text: statement.text, order: statement.order, config: statement.config ?? undefined })) },
              answerOptions: { create: question.answerOptions.map((option) => ({ value: option.value, label: option.label, order: option.order })) },
            })) },
          })) } : undefined,
        },
      });
      await tx.auditLog.create({ data: { actorId, action: 'TEST_VERSION_CREATED', entityType: 'TestVersion', entityId: version.id, metadata: { testId, version: nextVersion, clonedFrom: source?.id } } });
      return version;
    });
  }

  async replaceContent(actorId: string, versionId: string, dto: ReplaceVersionContentDto) {
    await this.assertDraft(versionId);
    this.validateContent(dto);
    await this.prisma.$transaction(async (tx) => {
      await tx.section.deleteMany({ where: { testVersionId: versionId } });
      await tx.testVersion.update({
        where: { id: versionId },
        data: {
          language: dto.language, estimatedMin: dto.estimatedMin ?? null, labels: dto.labels as Prisma.InputJsonValue | undefined,
          sections: { create: dto.sections.map((section) => ({
            code: section.code.trim().toUpperCase(), title: section.title.trim(), description: section.description?.trim() || null, instructions: section.instructions?.trim() || null, order: section.order,
            questions: { create: section.questions.map((question) => ({
              code: question.code.trim().toUpperCase(), type: question.type, prompt: question.prompt.trim(), helpText: question.helpText?.trim() || null, order: question.order, required: question.required, config: question.config as Prisma.InputJsonValue | undefined,
              statements: { create: question.statements.map((statement) => ({ code: statement.code.trim().toUpperCase(), text: statement.text.trim(), order: statement.order, config: statement.config as Prisma.InputJsonValue | undefined })) },
              answerOptions: { create: question.answerOptions.map((option) => ({ value: option.value.trim(), label: option.label.trim(), order: option.order })) },
            })) },
          })) },
        },
      });
      await tx.auditLog.create({ data: { actorId, action: 'TEST_VERSION_CONTENT_REPLACED', entityType: 'TestVersion', entityId: versionId, metadata: { sections: dto.sections.length, questions: dto.sections.reduce((total, section) => total + section.questions.length, 0) } } });
    });
    return this.getVersion(versionId);
  }

  async importClientWorkbook(actorId: string, versionId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Selecciona el archivo XLSM del cliente.');
    if (!/\.(xlsm|xlsx)$/i.test(file.originalname)) throw new BadRequestException('El archivo debe ser XLSM o XLSX.');
    if (file.size > 15 * 1024 * 1024) throw new BadRequestException('El archivo excede el límite de 15 MB.');
    await this.assertDraft(versionId);
    const imported = this.importer.parse(file.buffer);
    await this.replaceContent(actorId, versionId, { language: 'es-MX', estimatedMin: 40, labels: imported.labels, sections: imported.sections });
    await this.prisma.auditLog.create({ data: { actorId, action: 'CLIENT_WORKBOOK_IMPORTED', entityType: 'TestVersion', entityId: versionId, metadata: { fileName: file.originalname, ...imported.summary } } });
    return imported.summary;
  }

  async publish(actorId: string, versionId: string) {
    const version = await this.getVersion(versionId);
    if (version.status !== TestVersionStatus.DRAFT && version.status !== TestVersionStatus.VALIDATING) throw new BadRequestException('Solo una versión en borrador o validación puede publicarse.');
    const validation = this.versionValidation(version);
    if (validation.errors.length) throw new BadRequestException(validation.errors[0]);
    await this.prisma.$transaction(async (tx) => {
      await tx.testVersion.updateMany({ where: { testId: version.testId, status: TestVersionStatus.PUBLISHED }, data: { status: TestVersionStatus.ARCHIVED } });
      await tx.testVersion.update({ where: { id: versionId }, data: { status: TestVersionStatus.PUBLISHED, publishedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'TEST_VERSION_PUBLISHED', entityType: 'TestVersion', entityId: versionId, metadata: { version: version.version, testId: version.testId, warnings: validation.warnings } } });
    });
    return { success: true, warnings: validation.warnings };
  }

  async archive(actorId: string, versionId: string) {
    const version = await this.getVersion(versionId);
    if (version.status === TestVersionStatus.ARCHIVED) return { success: true };
    await this.prisma.$transaction([
      this.prisma.testVersion.update({ where: { id: versionId }, data: { status: TestVersionStatus.ARCHIVED } }),
      this.prisma.auditLog.create({ data: { actorId, action: 'TEST_VERSION_ARCHIVED', entityType: 'TestVersion', entityId: versionId, metadata: { version: version.version, testId: version.testId } } }),
    ]);
    return { success: true };
  }

  private async assertTest(id: string) { if (!await this.prisma.test.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException('La prueba no existe.'); }
  private async assertDraft(id: string) { const version = await this.getVersion(id); if (version.status !== TestVersionStatus.DRAFT) throw new BadRequestException('Solo las versiones en borrador pueden modificarse.'); return version; }
  private async getVersion(id: string) {
    const version = await this.prisma.testVersion.findUnique({ where: { id }, include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' }, include: { statements: { orderBy: { order: 'asc' } }, answerOptions: { orderBy: { order: 'asc' } } } } } } } });
    if (!version) throw new NotFoundException('La versión no existe.'); return version;
  }

  private validateContent(dto: ReplaceVersionContentDto) {
    const unique = (values: Array<string | number>, label: string) => { if (new Set(values).size !== values.length) throw new BadRequestException(`${label} contiene valores duplicados.`); };
    unique(dto.sections.map(({ code }) => code.toUpperCase()), 'Los códigos de sección'); unique(dto.sections.map(({ order }) => order), 'El orden de secciones');
    for (const section of dto.sections) {
      unique(section.questions.map(({ code }) => code.toUpperCase()), `Los códigos de ${section.title}`); unique(section.questions.map(({ order }) => order), `El orden de ${section.title}`);
      for (const question of section.questions) {
        if (question.type === 'PAIRED' && question.statements.length !== 2) throw new BadRequestException(`La pregunta ${question.code} debe contener exactamente dos afirmaciones.`);
        if (question.type === 'PAIRED' && question.answerOptions.length) throw new BadRequestException(`La pregunta ${question.code} no debe contener opciones normales.`);
        if (question.type !== 'PAIRED' && question.statements.length) throw new BadRequestException(`La pregunta ${question.code} no admite afirmaciones pareadas.`);
        if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CATALOG', 'LIKERT'].includes(question.type) && question.answerOptions.length < 2) throw new BadRequestException(`La pregunta ${question.code} requiere al menos dos opciones.`);
      }
    }
  }

  private versionValidation(version: Awaited<ReturnType<TestsService['getVersion']>>) {
    const errors: string[] = []; const warnings: string[] = [];
    if (!version.sections.length) errors.push('La versión no tiene secciones.');
    if (version.sections.some(({ questions }) => !questions.length)) errors.push('Todas las secciones deben incluir al menos una pregunta.');
    for (const section of version.sections) for (const question of section.questions) {
      if (question.type === 'PAIRED' && question.statements.length !== 2) errors.push(`${question.code} no contiene exactamente dos afirmaciones.`);
      if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'CATALOG', 'LIKERT'].includes(question.type) && question.answerOptions.length < 2) errors.push(`${question.code} no tiene opciones suficientes.`);
    }
    const labels = version.labels as { clientValidation?: { availableLikertCount?: number; expectedLikertCount?: number } } | null;
    if (labels?.clientValidation?.availableLikertCount !== labels?.clientValidation?.expectedLikertCount) warnings.push('El contenido Likert está pendiente de completar y validar con el cliente.');
    return { errors: [...new Set(errors)], warnings };
  }
}
