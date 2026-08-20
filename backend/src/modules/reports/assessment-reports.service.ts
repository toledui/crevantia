import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "../../common/auth.types";
import { PrismaService } from "../../database/prisma.service";
import {
  AssessmentReportStatus,
  Prisma,
  ReportDeliveryStatus,
  ResultRunStatus,
} from "../../generated/prisma/client";
import { MailService } from "../mail/mail.service";
import { ReportStudioService } from "../report-studio/report-studio.service";
import {
  ReportPdfService,
  type ReportCategory,
  type ReportMapping,
  type ReportTextBlock,
} from "./report-pdf.service";

const REPORT_INCLUDE = {
  values: { orderBy: [{ targetType: "asc" }, { targetCode: "asc" }] },
  assessmentVersion: { include: { assessment: { select: { name: true } } } },
  attempt: {
    include: {
      assignment: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          test: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.ResultRunInclude;

@Injectable()
export class AssessmentReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: ReportPdfService,
    private readonly mail: MailService,
    private readonly studio: ReportStudioService,
  ) {}

  async generateAndEmail(resultRunId: string) {
    const report = await this.ensure(resultRunId);
    const run = await this.loadRun(resultRunId);
    await this.deliver(report.id, run, "AUTO_COMPLETION", null, false);
    return report;
  }

  async status(user: AuthenticatedUser, resultRunId: string) {
    const run = await this.loadRun(resultRunId);
    this.assertAccess(user, run.attempt.assignment.user.id);
    const report = await this.prisma.assessmentReport.findUnique({
      where: { resultRunId },
      select: {
        status: true,
        filename: true,
        byteSize: true,
        generatedAt: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, sentAt: true, createdAt: true },
        },
      },
    });
    return report ?? { status: "PENDING", filename: null, byteSize: null, generatedAt: null, deliveries: [] };
  }

  async download(user: AuthenticatedUser, resultRunId: string) {
    const run = await this.loadRun(resultRunId);
    this.assertAccess(user, run.attempt.assignment.user.id);
    const report = await this.ensure(resultRunId);
    if (!report.pdfData) throw new NotFoundException("El PDF todavía no está disponible.");
    return { filename: report.filename, buffer: Buffer.from(report.pdfData) };
  }

  async resend(user: AuthenticatedUser, resultRunId: string) {
    const run = await this.loadRun(resultRunId);
    this.assertAccess(user, run.attempt.assignment.user.id);
    const recent = await this.prisma.assessmentReportDelivery.findFirst({
      where: {
        report: { resultRunId },
        trigger: "USER_RESEND",
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recent) throw new HttpException("Espera un minuto antes de volver a enviar el reporte.", 429);
    const report = await this.ensure(resultRunId);
    await this.deliver(report.id, run, "USER_RESEND", user.sub, true);
    return { success: true, message: `Enviamos el reporte a ${maskEmail(run.attempt.assignment.user.email)}.` };
  }

  private async ensure(resultRunId: string) {
    const current = await this.prisma.assessmentReport.findUnique({ where: { resultRunId } });
    const run = await this.loadRun(resultRunId);
    if (run.status !== ResultRunStatus.COMPLETED) throw new NotFoundException("El resultado oficial aún no está completo.");
    let publishedStudio: Awaited<ReturnType<ReportStudioService["publishedVersionIdentity"]>> | null = null;
    try {
      publishedStudio = await this.studio.publishedVersionIdentity(resultRunId);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
    }
    if (current?.status === AssessmentReportStatus.READY && current.pdfData && (!publishedStudio || studioReportIsCurrent(current.configurationSnapshot, publishedStudio))) return current;
    try {
      if (publishedStudio) {
        const generated = await this.studio.generateForResultRun(run.attempt.assignment.user.id, resultRunId, {});
        const file = await this.studio.download(generated.id);
        const studioSnapshot = asJson({ source: "REPORT_STUDIO", generatedReportId: generated.id, reportTemplateVersionId: generated.reportTemplateVersionId, configurationHash: generated.configurationHash });
        return await this.prisma.assessmentReport.upsert({
          where: { resultRunId },
          update: { status: AssessmentReportStatus.READY, filename: file.filename, pdfData: Uint8Array.from(file.buffer), byteSize: file.buffer.length, sha256: createHash("sha256").update(file.buffer).digest("hex"), configurationVersion: 0, configurationSnapshot: studioSnapshot, generatedAt: new Date(), error: null },
          create: { resultRunId, status: AssessmentReportStatus.READY, filename: file.filename, pdfData: Uint8Array.from(file.buffer), byteSize: file.buffer.length, sha256: createHash("sha256").update(file.buffer).digest("hex"), configurationVersion: 0, configurationSnapshot: studioSnapshot, generatedAt: new Date() },
        });
      }
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
    }
    const settings = await this.prisma.siteSettings.findUnique({ where: { id: "default" } });
    const filename = safeFilename(`Reporte_${run.attempt.assignment.test.name}_${run.attempt.assignment.user.firstName}_${run.attempt.assignment.user.lastName}.pdf`);
    const snapshot = {
      siteName: settings?.siteName ?? "Crevantia",
      reportBrandName: settings?.reportBrandName ?? settings?.siteName ?? "Crevantia",
      reportPromoTitle: settings?.reportPromoTitle,
      reportPromoText: settings?.reportPromoText,
      reportPromoUrl: settings?.reportPromoUrl,
      reportIntroduction: settings?.reportIntroduction,
      reportInterpretation: settings?.reportInterpretation,
      reportCategories: jsonArray<ReportCategory>(settings?.reportCategories),
      reportDisplayMappings: jsonArray<ReportMapping>(settings?.reportDisplayMappings),
      reportTextBlocks: jsonArray<ReportTextBlock>(settings?.reportTextBlocks),
      reportDefaultsVersion: settings?.reportDefaultsVersion ?? 0,
      settingsVersion: settings?.version ?? 0,
      reportLogoMimeType: settings?.reportLogoMimeType ?? settings?.logoMimeType,
    };
    const pending = await this.prisma.assessmentReport.upsert({
      where: { resultRunId },
      update: {
        status: AssessmentReportStatus.GENERATING,
        filename,
        configurationVersion: settings?.version ?? 0,
        configurationSnapshot: asJson(snapshot),
        error: null,
      },
      create: {
        resultRunId,
        status: AssessmentReportStatus.GENERATING,
        filename,
        configurationVersion: settings?.version ?? 0,
        configurationSnapshot: asJson(snapshot),
      },
    });
    try {
      const buffer = await this.pdf.generate({
        brandName: snapshot.reportBrandName,
        siteName: snapshot.siteName,
        title: run.assessmentVersion.assessment.name || run.attempt.assignment.test.name,
        subjectName: `${run.attempt.assignment.user.firstName} ${run.attempt.assignment.user.lastName}`.trim(),
        completedAt: run.attempt.completedAt ?? run.calculatedAt,
        logo: settings?.reportLogoData ? Buffer.from(settings.reportLogoData) : settings?.logoData ? Buffer.from(settings.logoData) : null,
        introduction: snapshot.reportIntroduction,
        interpretation: snapshot.reportInterpretation,
        promoTitle: snapshot.reportPromoTitle,
        promoText: snapshot.reportPromoText,
        promoUrl: snapshot.reportPromoUrl,
        categories: snapshot.reportCategories,
        mappings: snapshot.reportDisplayMappings,
        textBlocks: snapshot.reportTextBlocks,
        values: run.values.map((value) => ({
          targetType: value.targetType,
          targetCode: value.targetCode,
          rawScore: Number(value.rawScore),
          displayScore: value.displayScore == null ? null : Number(value.displayScore),
          decile: value.decile,
        })),
      });
      return await this.prisma.assessmentReport.update({
        where: { id: pending.id },
        data: {
          status: AssessmentReportStatus.READY,
          pdfData: Uint8Array.from(buffer),
          byteSize: buffer.length,
          sha256: createHash("sha256").update(buffer).digest("hex"),
          generatedAt: new Date(),
          error: null,
        },
      });
    } catch (error) {
      await this.prisma.assessmentReport.update({
        where: { id: pending.id },
        data: { status: AssessmentReportStatus.FAILED, error: errorMessage(error) },
      });
      throw error;
    }
  }

  private async deliver(
    reportId: string,
    run: Awaited<ReturnType<AssessmentReportsService["loadRun"]>>,
    trigger: "AUTO_COMPLETION" | "USER_RESEND",
    requestedById: string | null,
    throwOnFailure: boolean,
  ) {
    const user = run.attempt.assignment.user;
    const report = await this.prisma.assessmentReport.findUnique({ where: { id: reportId } });
    if (!report?.pdfData) throw new NotFoundException("El PDF todavía no está disponible.");
    const delivery = await this.prisma.assessmentReportDelivery.create({
      data: { reportId, recipient: user.email, trigger, requestedById, status: ReportDeliveryStatus.PENDING },
    });
    try {
      await this.mail.sendAssessmentReportEmail(
        user.email,
        user.firstName,
        run.assessmentVersion.assessment.name || run.attempt.assignment.test.name,
        Buffer.from(report.pdfData),
        report.filename,
      );
      await this.prisma.assessmentReportDelivery.update({
        where: { id: delivery.id },
        data: { status: ReportDeliveryStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.assessmentReportDelivery.update({
        where: { id: delivery.id },
        data: { status: ReportDeliveryStatus.FAILED, error: errorMessage(error) },
      });
      if (throwOnFailure) throw error;
    }
  }

  private async loadRun(resultRunId: string) {
    const run = await this.prisma.resultRun.findUnique({ where: { id: resultRunId }, include: REPORT_INCLUDE });
    if (!run) throw new NotFoundException("El resultado no existe.");
    return run;
  }

  private assertAccess(user: AuthenticatedUser, ownerId: string) {
    if (user.sub !== ownerId && !user.permissions.includes("result.read")) throw new ForbiddenException("No puedes consultar este reporte.");
  }
}

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function studioReportIsCurrent(snapshot: unknown, published: { reportTemplateVersionId: string; configurationHash: string | null }) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const value = snapshot as Record<string, unknown>;
  return value.source === "REPORT_STUDIO" && value.reportTemplateVersionId === published.reportTemplateVersionId && value.configurationHash === published.configurationHash;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 4000) : "Error desconocido";
}

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/_+/g, "_");
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${(name ?? "").slice(0, 2)}***@${domain ?? ""}`;
}
