import { ReportPdfService } from "../src/modules/reports/report-pdf.service";

describe("ReportPdfService", () => {
  it("genera un PDF paginado con resultados, contenido editorial y metadatos", async () => {
    const service = new ReportPdfService();
    const buffer = await service.generate({
      brandName: "Marca de prueba",
      siteName: "Sitio de prueba",
      title: "Evaluación de prueba",
      subjectName: "Persona de prueba",
      completedAt: new Date("2026-08-20T12:00:00-06:00"),
      interpretation: "Los indicadores deben leerse como tendencias dentro de una escala de 1 a 10.",
      categories: [
        { label: "Brisa", color: "#55b6c7" },
        { label: "Viento", color: "#4b8fd3" },
        { label: "Ráfaga", color: "#6a5acd" },
        { label: "Huracán", color: "#302b78" },
      ],
      mappings: [
        { targetType: "SCALE", targetCode: "VISION", displayName: "Visión estratégica", section: "Capacidades" },
        { targetType: "SCALE", targetCode: "DOMINIO", displayName: "Autodominio", section: "Capacidades" },
        { targetType: "SCALE", targetCode: "COMPETENCIA", displayName: "Competencia financiera", section: "Capacidades" },
      ],
      textBlocks: [{ title: "Interpretación", section: "Lectura", content: "Este es un bloque editorial que conserva la configuración vigente al generar el documento." }],
      values: [
        { targetType: "SCALE", targetCode: "VISION", rawScore: 8, displayScore: 8, decile: 8 },
        { targetType: "SCALE", targetCode: "DOMINIO", rawScore: 5, displayScore: 5, decile: 5 },
        { targetType: "SCALE", targetCode: "COMPETENCIA", rawScore: 3, displayScore: 3, decile: 3 },
      ],
    });

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5_000);
    const pages = buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(pages).toBeLessThanOrEqual(6);
  });
});
