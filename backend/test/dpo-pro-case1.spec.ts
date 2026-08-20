import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import {
  loadOfficialAssessment,
  loadOfficialComposites,
  loadOfficialNorm,
  loadOfficialScoring,
} from "../prisma/seeds/official-dpo-data";
import {
  calculateAssessment,
  type CompositeDefinition,
  type DerivedMetricDefinition,
  type NormDefinition,
  type ScoringRule,
} from "../src/modules/scoring/scoring-engine";

interface PairAnswer {
  pairCode: string;
  selectedMoreReactiveCode: string;
}
interface PairedFixture {
  case: {
    answerCount: number;
    answersSha256: string;
    sourceWorkbookSha256: string;
  };
  answers: PairAnswer[];
}
interface SharedStringXml {
  t?: unknown;
  r?: { t?: unknown } | Array<{ t?: unknown }>;
}
interface CellXml {
  r: string;
  t?: string;
  v?: string | number;
}
interface RowXml {
  r: string | number;
  c: CellXml | CellXml[];
}

const loadJson = <T>(...parts: string[]) =>
  JSON.parse(readFileSync(join(__dirname, ...parts), "utf8")) as T;
const fixture = loadJson<PairedFixture>(
  "fixtures",
  "dpo-pro-case-1-paired.json",
);
const assessment = loadOfficialAssessment();
const scoring = loadOfficialScoring();
const composites = loadOfficialComposites();
const norm = loadOfficialNorm();

const pairByReactive = new Map(
  assessment.reactives.map(({ code, pairCode }) => [code, pairCode]),
);
const rules: ScoringRule[] = scoring.reactiveScoringRules.map((rule) => ({
  reactiveCode: rule.reactiveCode,
  pairCode: pairByReactive.get(rule.reactiveCode) ?? "",
  scaleCode: rule.scaleCode,
  scoreIfMore: rule.scoreIfMore,
  scoreIfLess: rule.scoreIfLess,
}));
const compositeDefinitions: CompositeDefinition[] =
  composites.normedComposites.map((composite) => ({
    code: composite.code,
    aggregationMethod: "ARITHMETIC_MEAN",
    components: composite.componentScaleCodes.map((scaleCode, index) => ({
      scaleCode,
      weight: 1,
      order: index + 1,
    })),
  }));
const derivedMetricDefinitions: DerivedMetricDefinition[] =
  composites.derivedDecileMeanMetrics.map((metric) => ({
    code: metric.code,
    calculationType: "DECILE_MEAN",
    sources: metric.componentScaleCodes.map((targetCode) => ({
      targetType: "SCALE",
      targetCode,
      valueType: "DECILE",
      weight: 1,
    })),
  }));
const norms: NormDefinition[] = norm.activeTargets.map((target) => ({
  targetType: target.targetType,
  targetCode: target.targetCode,
  status: "ACTIVE",
  thresholds: target.thresholds.map((threshold, index) => ({
    decile: threshold.decile,
    lowerBound: threshold.lowerBound,
    ordinal: index + 1,
  })),
}));
const result = calculateAssessment({
  answers: fixture.answers,
  rules,
  composites: compositeDefinitions,
  derivedMetricDefinitions,
  norms,
});

const scale = (code: string) => {
  const value = result.scales.find(
    (candidate) => candidate.targetCode === code,
  );
  if (!value) throw new Error(`Escala ausente: ${code}`);
  return value;
};
const composite = (code: string) => {
  const value = result.composites.find(
    (candidate) => candidate.targetCode === code,
  );
  if (!value) throw new Error(`Competencia ausente: ${code}`);
  return value;
};
const answerHash = (answers: PairAnswer[]) =>
  createHash("sha256").update(JSON.stringify(answers)).digest("hex");

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function xmlText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object" && "#text" in value)
    return xmlText(value["#text"]);
  return "";
}

function sharedStringText(value: SharedStringXml): string {
  if (value.t !== undefined) return xmlText(value.t);
  return value.r
    ? asArray(value.r)
        .map((run) => xmlText(run.t))
        .join("")
    : "";
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/)?.[0];
  if (!letters) throw new Error(`Referencia de celda inválida: ${reference}`);
  return (
    [...letters].reduce(
      (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

function extractExcelAnswers(bytes: Buffer): PairAnswer[] {
  const archive = unzipSync(bytes);
  const sharedStringsXml = archive["xl/sharedStrings.xml"];
  const answersSheetXml = archive["xl/worksheets/sheet1.xml"];
  if (!sharedStringsXml || !answersSheetXml)
    throw new Error(
      "El Excel del Caso 1 no contiene la hoja Respuestas esperada.",
    );
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });
  const sharedDocument = parser.parse(strFromU8(sharedStringsXml)) as {
    sst: { si: SharedStringXml | SharedStringXml[] };
  };
  const sheetDocument = parser.parse(strFromU8(answersSheetXml)) as {
    worksheet: { sheetData: { row: RowXml | RowXml[] } };
  };
  const sharedStrings = asArray(sharedDocument.sst.si).map(sharedStringText);
  const rows = asArray(sheetDocument.worksheet.sheetData.row);
  const rowValues = (rowNumber: number) => {
    const row = rows.find((candidate) => Number(candidate.r) === rowNumber);
    if (!row) throw new Error(`Fila ${rowNumber} ausente en Respuestas.`);
    const values: string[] = [];
    for (const cell of asArray(row.c))
      values[columnIndex(cell.r)] =
        cell.t === "s"
          ? (sharedStrings[Number(cell.v)] ?? "")
          : String(cell.v ?? "");
    return values;
  };
  const headers = rowValues(1);
  const response = rowValues(2);
  const pairs = [...assessment.pairQuestions].sort(
    (left, right) => left.order - right.order,
  );
  if (headers.length !== 349)
    throw new Error(`Columnas inesperadas en Respuestas: ${headers.length}.`);
  return pairs.map((pair, index) => {
    const offset = 13 + index * 2;
    const pairHeaders = headers.slice(offset, offset + 2);
    const headerNumbers = pairHeaders.map((header) =>
      Number(header.match(/^(\d+)\s*\[/)?.[1]),
    );
    if (headerNumbers.some((number) => number !== index + 1))
      throw new Error(`Encabezados inválidos para ${pair.code}.`);
    const moreIndexes = response
      .slice(offset, offset + 2)
      .flatMap((value, valueIndex) =>
        value.includes("+") ? [valueIndex] : [],
      );
    if (moreIndexes.length !== 1)
      throw new Error(`Selección MORE inválida para ${pair.code}.`);
    const selectedMoreReactiveCode = pair.reactiveCodes[moreIndexes[0] ?? -1];
    if (!selectedMoreReactiveCode)
      throw new Error(`Reactivo MORE ausente para ${pair.code}.`);
    return {
      pairCode: pair.code,
      selectedMoreReactiveCode,
    };
  });
}

const workbookPath = join(
  __dirname,
  "..",
  "..",
  "CREVANTIA_DPO_CODEX_BUNDLE_V2",
  "Caso de prueba 1 DPO-PRO.xlsx",
);
const workbookBytes = readFileSync(workbookPath);
const workbookHash = createHash("sha256").update(workbookBytes).digest("hex");
const excelAnswers = extractExcelAnswers(workbookBytes);

describe("DPO-PRO CASE 1 · ejecución pareada aislada", () => {
  it("compara las 168 selecciones MORE directamente contra el Excel fuente", () => {
    const expected = new Map(
      excelAnswers.map((answer) => [
        answer.pairCode,
        answer.selectedMoreReactiveCode,
      ]),
    );
    const mismatches = fixture.answers.filter(
      (answer) =>
        expected.get(answer.pairCode) !== answer.selectedMoreReactiveCode,
    );

    expect(workbookHash).toBe(fixture.case.sourceWorkbookSha256);
    expect(excelAnswers).toHaveLength(168);
    expect(new Set(excelAnswers.map(({ pairCode }) => pairCode)).size).toBe(
      168,
    );
    expect(fixture.case.answerCount).toBe(168);
    expect(fixture.answers).toHaveLength(168);
    expect(new Set(fixture.answers.map(({ pairCode }) => pairCode)).size).toBe(
      168,
    );
    expect(answerHash(excelAnswers)).toBe(fixture.case.answersSha256);
    expect(answerHash(fixture.answers)).toBe(fixture.case.answersSha256);
    expect(mismatches).toEqual([]);
  });

  it("valida que cada MORE pertenezca al par oficial y P039 deje R078 como LESS", () => {
    const officialPairs = new Map(
      assessment.pairQuestions.map((pair) => [pair.code, pair.reactiveCodes]),
    );
    for (const answer of fixture.answers)
      expect(officialPairs.get(answer.pairCode)).toContain(
        answer.selectedMoreReactiveCode,
      );

    expect(
      fixture.answers.find(({ pairCode }) => pairCode === "DPO-P039"),
    ).toEqual({
      pairCode: "DPO-P039",
      selectedMoreReactiveCode: "DPO-R077",
    });
    expect(
      result.contributions.find(
        ({ reactiveCode }) => reactiveCode === "DPO-R077",
      )?.selection,
    ).toBe("MORE");
    expect(
      result.contributions.find(
        ({ reactiveCode }) => reactiveCode === "DPO-R078",
      )?.selection,
    ).toBe("LESS");
  });

  it("usa exclusivamente las versiones oficiales V1", () => {
    expect(assessment.assessment).toMatchObject({
      code: "DPO-PRO",
      version: "1.0.0",
    });
    expect(scoring.scoringKey).toMatchObject({
      code: "DPO-PRO-SCORING",
      version: "1.0.0",
    });
    expect(norm.normSet).toMatchObject({
      code: "DPO-PRO-OFFICIAL",
      version: "1.0.0",
    });
  });

  it("ejecuta únicamente el pipeline pareado completo", () => {
    expect(result.contributions).toHaveLength(336);
    expect(result.scales).toHaveLength(48);
    expect(result.composites).toHaveLength(33);
    expect(result.derivedMetrics).toHaveLength(21);
    expect(result.likertContributions).toHaveLength(0);
    expect(result.likertDimensions).toHaveLength(0);
    expect(result.likertTotal).toBeNull();
  });

  it("reproduce las dos escalas afectadas por P039", () => {
    expect(scale("DPO-S001").rawScore).toBe(19);
    expect(scale("DPO-S043").rawScore).toBe(13);
  });

  it.each([
    ["DPO-C011", 11.666666666666666, 7],
    ["DPO-C013", 11.666666666666666, 4],
    ["DPO-C014", 10.333333333333334, 6],
    ["DPO-C015", 9.333333333333334, 4],
    ["DPO-C016", 14, 8],
    ["DPO-C026", 15.666666666666666, 10],
    ["DPO-C031", 12.666666666666666, 7],
  ])("calcula %s con bruto y decil V2", (code, rawScore, decile) => {
    expect(composite(code).rawScore).toBeCloseTo(rawScore, 12);
    expect(composite(code).decile).toBe(decile);
  });

  afterAll(() => {
    console.log(
      [
        "DPO-PRO CASE 1",
        "Pairs compared:             168/168 PASS",
        "Reactive contributions:     336/336 PASS",
        "Scales:                       48/48 PASS",
        "Normed composites:            33/33 PASS",
        "Norm lookup:                    PASS",
        "Configuration versions:        PASS",
        "",
        "RESULT: PASS",
      ].join("\n"),
    );
  });
});
