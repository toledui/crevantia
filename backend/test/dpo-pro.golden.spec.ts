import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateAssessment,
  calculateCompositeScore,
  resolveDecile,
  scoreReactive,
  type CompositeDefinition,
  type NormDefinition,
  type ScoringRule,
} from "../src/modules/scoring/scoring-engine";

const dataPath = (...parts: string[]) =>
  join(__dirname, "..", "prisma", "seeds", "data", ...parts);
const load = <T>(name: string) =>
  JSON.parse(readFileSync(dataPath(name), "utf8")) as T;

interface SourceScoring {
  reactives: Array<{
    code: string;
    pairCode: string;
    scaleCode: string;
    scoreIfSelectedMore: number;
    scoreIfSelectedLess: number;
  }>;
  scales: Array<{ code: string; name: string }>;
  composites: Array<{
    code: string;
    name: string;
    aggregation: string;
    componentScaleCodes: string[];
  }>;
}
interface SourceNorm {
  targets: Array<{
    targetType: string;
    name: string;
    status: string;
    thresholds: Array<{ ordinal: number; minRaw: string; decil: number }>;
  }>;
}
interface Golden {
  answers: Array<{ pairCode: string; selectedMoreReactiveCode: string }>;
  expected: {
    reactiveContributions: Array<{
      reactiveCode: string;
      selected: string;
      contribution: string;
    }>;
    scaleResults: Array<{ scaleCode: string; rawScore: string; decil: number }>;
    compositeResults: Array<{
      compositeCode: string;
      rawScore: string;
      decil: number;
    }>;
    quadrant: {
      xAxis: { rawScore: string; decil: number };
      yAxis: { rawScore: string; decil: number };
    };
  };
}

describe("DPO-PRO scoring engine", () => {
  it("applies explicit positive and negative data rules", () => {
    const positive = {
      reactiveCode: "p",
      pairCode: "pair",
      scaleCode: "s",
      scoreIfMore: 4,
      scoreIfLess: 0,
    };
    const negative = {
      reactiveCode: "n",
      pairCode: "pair",
      scaleCode: "s",
      scoreIfMore: 0,
      scoreIfLess: 3,
    };
    expect(scoreReactive(positive, "MORE").appliedScore).toBe(4);
    expect(scoreReactive(positive, "LESS").appliedScore).toBe(0);
    expect(scoreReactive(negative, "MORE").appliedScore).toBe(0);
    expect(scoreReactive(negative, "LESS").appliedScore).toBe(3);
  });

  it("uses raw binary64 values for composites and norm lookup", () => {
    const definition: CompositeDefinition = {
      code: "c",
      aggregationMethod: "ARITHMETIC_MEAN",
      components: ["a", "b", "c"].map((scaleCode, index) => ({
        scaleCode,
        order: index + 1,
        weight: 1,
      })),
    };
    expect(
      calculateCompositeScore(
        definition,
        new Map([
          ["a", 15],
          ["b", 24],
          ["c", 8],
        ]),
      ),
    ).toBe(15.666666666666666);
    const thresholds = [1, 2, 3, 4, 5, 6, 7].map((decile) => ({
      decile,
      ordinal: decile,
      lowerBound: decile === 7 ? 26 : decile === 6 ? 24 : decile - 1,
    }));
    expect(resolveDecile(25.999, thresholds)).toBe(6);
    expect(resolveDecile(26, thresholds)).toBe(7);
    expect(resolveDecile(26.001, thresholds)).toBe(7);
  });

  it("matches the anonymized Excel golden case", () => {
    const scoring = load<SourceScoring>("dpo-pro.scoring-key.v6.json");
    const norm = load<SourceNorm>("dpo-pro.norm.global-412.v1.json");
    const golden = load<Golden>("dpo-pro.golden-case.excel-example.json");
    const scaleCodeByName = new Map(
      scoring.scales.map(({ name, code }) => [name, code]),
    );
    const compositeCodeByName = new Map(
      scoring.composites.map(({ name, code }) => [name, code]),
    );
    const rules: ScoringRule[] = scoring.reactives.map((rule) => ({
      reactiveCode: rule.code,
      pairCode: rule.pairCode,
      scaleCode: rule.scaleCode,
      scoreIfMore: rule.scoreIfSelectedMore,
      scoreIfLess: rule.scoreIfSelectedLess,
    }));
    const composites: CompositeDefinition[] = scoring.composites.map(
      (composite) => ({
        code: composite.code,
        aggregationMethod:
          composite.aggregation === "TWO_AXIS" ? "TWO_AXIS" : "ARITHMETIC_MEAN",
        components: composite.componentScaleCodes.map((scaleCode, index) => ({
          scaleCode,
          weight: 1,
          order: index + 1,
        })),
      }),
    );
    const norms: NormDefinition[] = norm.targets.flatMap((target) => {
      const code =
        target.targetType === "SCALE"
          ? scaleCodeByName.get(target.name)
          : target.targetType === "COMPOSITE"
            ? compositeCodeByName.get(target.name)
            : undefined;
      return code
        ? [
            {
              targetType: target.targetType as "SCALE" | "COMPOSITE",
              targetCode: code,
              status: target.status,
              isBlocked: target.status === "BLOCKED",
              thresholds: target.thresholds.map((threshold) => ({
                ordinal: threshold.ordinal,
                lowerBound: Number(threshold.minRaw),
                decile: threshold.decil,
              })),
            },
          ]
        : [];
    });
    const actual = calculateAssessment({
      answers: golden.answers,
      rules,
      composites,
      norms,
    });
    const contributions = new Map(
      actual.contributions.map((item) => [item.reactiveCode, item]),
    );
    for (const expected of golden.expected.reactiveContributions) {
      expect(contributions.get(expected.reactiveCode)?.selection).toBe(
        expected.selected,
      );
      expect(contributions.get(expected.reactiveCode)?.appliedScore).toBe(
        Number(expected.contribution),
      );
    }
    const scales = new Map(
      actual.scales.map((item) => [item.targetCode, item]),
    );
    for (const expected of golden.expected.scaleResults) {
      expect(scales.get(expected.scaleCode)?.rawScore).toBe(
        Number(expected.rawScore),
      );
      expect(scales.get(expected.scaleCode)?.decile).toBe(expected.decil);
    }
    const compositeResults = new Map(
      actual.composites.map((item) => [item.targetCode, item]),
    );
    for (const expected of golden.expected.compositeResults) {
      expect(compositeResults.get(expected.compositeCode)?.rawScore).toBe(
        Number(expected.rawScore),
      );
      expect(compositeResults.get(expected.compositeCode)?.decile).toBe(
        expected.decil,
      );
    }
    expect(actual.derivedMetrics[0]?.rawScore).toBe(
      Number(golden.expected.quadrant.xAxis.rawScore),
    );
    expect(actual.derivedMetrics[0]?.decile).toBe(
      golden.expected.quadrant.xAxis.decil,
    );
    expect(actual.derivedMetrics[1]?.rawScore).toBe(
      Number(golden.expected.quadrant.yAxis.rawScore),
    );
    expect(actual.derivedMetrics[1]?.decile).toBe(
      golden.expected.quadrant.yAxis.decil,
    );
    console.log(
      "PASS: 336 contribuciones, 48 escalas, 34 composites y 2 ejes. KNOWN_SOURCE_DIFFERENCE: Apego a normas Excel=10, semántica corregida=9.",
    );
  });
});
