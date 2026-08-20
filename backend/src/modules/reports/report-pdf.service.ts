import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

export interface ReportCategory {
  label: string;
  description?: string;
  color?: string;
}

export interface ReportMapping {
  targetType: string;
  targetCode: string;
  displayName: string;
  section?: string;
}

export interface ReportTextBlock {
  key?: string;
  title: string;
  content: string;
  sourcePage?: number;
  section?: string;
}

export interface ReportPdfData {
  brandName: string;
  siteName: string;
  title: string;
  subjectName: string;
  completedAt: Date;
  logo?: Buffer | null;
  introduction?: string | null;
  interpretation?: string | null;
  promoTitle?: string | null;
  promoText?: string | null;
  promoUrl?: string | null;
  categories: ReportCategory[];
  mappings: ReportMapping[];
  textBlocks: ReportTextBlock[];
  values: Array<{
    targetType: string;
    targetCode: string;
    displayScore: number | null;
    rawScore: number;
    decile: number | null;
  }>;
}

const COLORS = {
  primary: "#302b78",
  accent: "#00a6c7",
  ink: "#172033",
  muted: "#687386",
  line: "#dce3eb",
  pale: "#f3f6fa",
  white: "#ffffff",
};

@Injectable()
export class ReportPdfService {
  generate(data: ReportPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 54, right: 48, bottom: 56, left: 48 },
        bufferPages: true,
        info: {
          Title: `${data.title} — ${data.subjectName}`,
          Author: data.brandName || data.siteName,
          Subject: "Reporte individual de evaluación",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.cover(doc, data);
      this.summary(doc, data);
      this.results(doc, data);
      this.editorial(doc, data);
      this.promo(doc, data);
      this.decoratePages(doc, data);
      doc.end();
    });
  }

  private cover(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    doc.rect(0, 0, 612, 792).fill(COLORS.primary);
    doc.circle(545, 95, 125).fillOpacity(0.13).fill(COLORS.accent);
    doc.circle(80, 720, 150).fillOpacity(0.09).fill(COLORS.white);
    doc.fillOpacity(1);
    if (data.logo) {
      try {
        doc.roundedRect(48, 50, 170, 72, 9).fillOpacity(0.94).fill(COLORS.white).fillOpacity(1);
        doc.image(data.logo, 60, 61, { fit: [146, 50], valign: "center" });
      } catch {
        doc.font("Helvetica-Bold").fontSize(19).fillColor(COLORS.white).text(data.brandName, 48, 64);
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(19).fillColor(COLORS.white).text(data.brandName, 48, 64);
    }
    doc.font("Helvetica").fontSize(11).fillColor("#bdeff8").text("REPORTE INDIVIDUAL", 48, 225, { characterSpacing: 2.2 });
    doc.font("Helvetica-Bold").fontSize(31).fillColor(COLORS.white).text(data.title, 48, 258, { width: 500, lineGap: 5 });
    doc.moveTo(48, 380).lineTo(190, 380).lineWidth(4).strokeColor(COLORS.accent).stroke();
    doc.font("Helvetica").fontSize(11).fillColor("#cdd2ea").text("Preparado para", 48, 415);
    doc.font("Helvetica-Bold").fontSize(22).fillColor(COLORS.white).text(data.subjectName, 48, 438, { width: 500 });
    const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(data.completedAt);
    doc.font("Helvetica").fontSize(10).fillColor("#cdd2ea").text(`Fecha de aplicación: ${date}`, 48, 490);
    doc.fontSize(9).text(data.siteName, 48, 704);
  }

  private summary(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    this.chapter(doc, "Resumen ejecutivo", "Una vista rápida de tus principales indicadores");
    const ranked = data.values
      .filter((value) => value.decile != null)
      .sort((a, b) => (b.decile ?? 0) - (a.decile ?? 0));
    const overview = ranked.slice(0, 10);
    if (!overview.length) {
      doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text("No hay indicadores normalizados disponibles para esta aplicación.");
    } else {
      overview.forEach((value) => this.bar(doc, this.labelFor(data, value), value.decile ?? 0, this.colorFor(data, value.decile)));
    }
    if (data.interpretation) {
      this.ensure(doc, 190);
      const y = doc.y + 8;
      this.triangle(doc, ranked.slice(0, 3), 155, y + 78);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.primary).text("Cómo leer este reporte", 300, y, { width: 264 });
      doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.ink).text(cleanText(data.interpretation), 300, y + 25, { width: 264, height: 135, ellipsis: true, lineGap: 3, align: "justify" });
      doc.x = 48;
      doc.y = y + 170;
    }
  }

  private results(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    const grouped = new Map<string, typeof data.values>();
    data.values.forEach((value) => {
      const mapping = this.mappingFor(data, value);
      const section = mapping?.section || defaultSection(value.targetType);
      grouped.set(section, [...(grouped.get(section) ?? []), value]);
    });
    for (const [section, values] of grouped) {
      this.chapter(doc, section, "Resultados expresados en una escala normalizada de 1 a 10");
      values
        .sort((a, b) => this.labelFor(data, a).localeCompare(this.labelFor(data, b), "es"))
        .forEach((value) => this.resultRow(doc, data, value));
    }
  }

  private editorial(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    const blocks = data.textBlocks.length
      ? data.textBlocks
      : data.introduction
        ? [{ title: "Introducción", content: data.introduction }]
        : [];
    for (const block of blocks) {
      this.chapter(doc, block.title, block.section || "Contenido interpretativo");
      const paragraphs = cleanText(block.content).split(/\n\s*\n/).filter(Boolean);
      for (const paragraph of paragraphs) {
        doc.font("Helvetica").fontSize(9.3).fillColor(COLORS.ink).text(paragraph, 48, doc.y, { width: 516, align: "justify", lineGap: 3 });
        doc.x = 48;
        doc.y += 7;
      }
    }
  }

  private promo(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    if (!data.promoTitle && !data.promoText && !data.promoUrl) return;
    this.chapter(doc, data.promoTitle || "Siguiente paso", "Continúa tu proceso de desarrollo");
    doc.roundedRect(48, doc.y, 516, 180, 14).fill(COLORS.pale);
    const y = doc.y + 28;
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.primary).text(data.promoTitle || "Conoce más", 72, y, { width: 468 });
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(cleanText(data.promoText || ""), 72, y + 34, { width: 468, height: 82, ellipsis: true, lineGap: 3 });
    if (data.promoUrl) doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.accent).text(data.promoUrl, 72, y + 130, { link: data.promoUrl, underline: true });
  }

  private chapter(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
    doc.addPage();
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.accent).text(subtitle.toUpperCase(), 48, 54, { width: 516, characterSpacing: 1.2 });
    doc.font("Helvetica-Bold").fontSize(21).fillColor(COLORS.primary).text(title, 48, 76, { width: 516, lineGap: 2 });
    const lineY = doc.y + 10;
    doc.moveTo(48, lineY).lineTo(564, lineY).lineWidth(1).strokeColor(COLORS.line).stroke();
    doc.x = 48;
    doc.y = lineY + 24;
  }

  private bar(doc: PDFKit.PDFDocument, label: string, score: number, color: string) {
    this.ensure(doc, 45);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(label, 48, y, { width: 245, ellipsis: true });
    doc.roundedRect(305, y + 1, 220, 10, 5).fill(COLORS.pale);
    doc.roundedRect(305, y + 1, Math.max(4, Math.min(220, score * 22)), 10, 5).fill(color);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primary).text(String(score), 536, y, { width: 28, align: "right" });
    doc.x = 48;
    doc.y = y + 27;
  }

  private resultRow(doc: PDFKit.PDFDocument, data: ReportPdfData, value: ReportPdfData["values"][number]) {
    this.ensure(doc, 60);
    const y = doc.y;
    const decile = value.decile;
    const category = this.categoryFor(data, decile);
    doc.roundedRect(48, y, 516, 48, 6).fill(COLORS.pale);
    doc.font("Helvetica-Bold").fontSize(9.3).fillColor(COLORS.ink).text(this.labelFor(data, value), 60, y + 9, { width: 245, ellipsis: true });
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(`${value.targetType} · ${value.targetCode}`, 60, y + 27, { width: 245, ellipsis: true });
    doc.font("Helvetica-Bold").fontSize(16).fillColor(category.color).text(decile == null ? "—" : `${decile}/10`, 325, y + 12, { width: 70, align: "center" });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(category.color).text(category.label, 410, y + 17, { width: 138, align: "right" });
    doc.x = 48;
    doc.y = y + 58;
  }

  private triangle(
    doc: PDFKit.PDFDocument,
    values: ReportPdfData["values"],
    centerX: number,
    centerY: number,
  ) {
    if (values.length < 3) return;
    const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    for (let ring = 2; ring <= 10; ring += 2) {
      const radius = ring * 8;
      const points = angles.map((angle) => [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius] as const);
      doc.moveTo(points[0]![0], points[0]![1]).lineTo(points[1]![0], points[1]![1]).lineTo(points[2]![0], points[2]![1]).closePath().lineWidth(0.5).strokeColor(COLORS.line).stroke();
    }
    const points = values.slice(0, 3).map((value, index) => {
      const radius = (value.decile ?? 0) * 8;
      return [centerX + Math.cos(angles[index]!) * radius, centerY + Math.sin(angles[index]!) * radius] as const;
    });
    doc.moveTo(points[0]![0], points[0]![1]).lineTo(points[1]![0], points[1]![1]).lineTo(points[2]![0], points[2]![1]).closePath().fillOpacity(0.2).fillAndStroke(COLORS.accent, COLORS.primary).fillOpacity(1);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.muted).text("3 capacidades destacadas", 70, centerY + 90, { width: 170, align: "center" });
  }

  private mappingFor(data: ReportPdfData, value: { targetType: string; targetCode: string }) {
    const plainCode = value.targetCode.replace(/^REPORT_ALIAS:/, "");
    return data.mappings.find((mapping) => mapping.targetType === value.targetType && (mapping.targetCode === value.targetCode || mapping.targetCode === plainCode));
  }

  private labelFor(data: ReportPdfData, value: { targetType: string; targetCode: string }) {
    return this.mappingFor(data, value)?.displayName || value.targetCode.replace(/^REPORT_ALIAS:/, "").replaceAll("_", " ");
  }

  private categoryFor(data: ReportPdfData, decile: number | null) {
    const fallback = { label: "Sin clasificación", color: COLORS.muted };
    if (decile == null || !data.categories.length) return fallback;
    const index = decile <= 3 ? 0 : decile <= 5 ? 1 : decile <= 8 ? 2 : 3;
    const item = data.categories[Math.min(index, data.categories.length - 1)];
    return { label: item?.label || fallback.label, color: item?.color || COLORS.primary };
  }

  private colorFor(data: ReportPdfData, decile: number | null) {
    return this.categoryFor(data, decile).color;
  }

  private ensure(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > 730) doc.addPage();
  }

  private decoratePages(doc: PDFKit.PDFDocument, data: ReportPdfData) {
    const range = doc.bufferedPageRange();
    for (let index = 1; index < range.count; index += 1) {
      doc.switchToPage(index);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.save().moveTo(48, 750).lineTo(564, 750).lineWidth(0.7).strokeColor(COLORS.line).stroke();
      doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(data.brandName, 48, 760, { width: 240, lineBreak: false });
      doc.text(`${index + 1} / ${range.count}`, 474, 760, { width: 90, align: "right", lineBreak: false }).restore();
      doc.page.margins.bottom = bottomMargin;
    }
  }
}

function cleanText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/^\s*\d+\s*$/gm, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function defaultSection(targetType: string) {
  if (targetType === "SCALE") return "20 precursores de comportamiento";
  if (targetType === "COMPOSITE") return "Capacidades y dimensiones financieras";
  if (targetType === "DERIVED_METRIC") return "Habilidad y potencial financiero";
  if (targetType.startsWith("LIKERT")) return "Cuadrantes de realización";
  return "Resultados del reporte";
}
