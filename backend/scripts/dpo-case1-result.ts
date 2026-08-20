import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadOfficialAssessment,
  loadOfficialComposites,
  loadOfficialNorm,
  loadOfficialScales,
  loadOfficialScoring,
} from "../prisma/seeds/official-dpo-data";
import {
  calculateAssessment,
  type CompositeDefinition,
  type DerivedMetricDefinition,
  type NormDefinition,
  type ScoringRule,
} from "../src/modules/scoring/scoring-engine";

interface Fixture {
  answers: Array<{ pairCode: string; selectedMoreReactiveCode: string }>;
}

export function buildCaseOneResult() {
  const assessment = loadOfficialAssessment();
  const scoring = loadOfficialScoring();
  const scales = loadOfficialScales();
  const composites = loadOfficialComposites();
  const norm = loadOfficialNorm();
  const fixture = JSON.parse(
    readFileSync(
      join(__dirname, "..", "test", "fixtures", "dpo-pro-case-1-paired.json"),
      "utf8",
    ),
  ) as Fixture;
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
  const definitions: CompositeDefinition[] = composites.normedComposites.map(
    (composite) => ({
      code: composite.code,
      aggregationMethod: "ARITHMETIC_MEAN",
      components: composite.componentScaleCodes.map((scaleCode, index) => ({
        scaleCode,
        weight: 1,
        order: index + 1,
      })),
    }),
  );
  const derived: DerivedMetricDefinition[] =
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
    composites: definitions,
    derivedMetricDefinitions: derived,
    norms,
  });
  const scaleNames = new Map(
    scales.scales.map(({ code, name }) => [code, name]),
  );
  const scaleResults = new Map(
    result.scales.map((value) => [value.targetCode, value]),
  );
  return {
    schemaVersion: "1.0.0",
    caseCode: "DPO_PRO_CASE_1_V2",
    configuration: {
      assessment: "DPO-PRO v1.0.0",
      scoring: "DPO-PRO-SCORING v1.0.0",
      norm: "DPO-PRO-OFFICIAL v1.0.0",
      numericMode: "EXCEL_BINARY64",
      roundingMode: "NONE_BEFORE_NORM_LOOKUP",
    },
    counts: {
      contributions: result.contributions.length,
      scales: result.scales.length,
      composites: result.composites.length,
      derivedDecileMeans: result.derivedMetrics.length,
    },
    contributions: result.contributions,
    scales: result.scales.map((value) => ({
      code: value.targetCode,
      name: scaleNames.get(value.targetCode),
      rawScore: value.rawScore,
      decile: value.decile,
    })),
    composites: result.composites.map((value) => {
      const definition = composites.normedComposites.find(
        ({ code }) => code === value.targetCode,
      );
      return {
        code: value.targetCode,
        name: definition?.name,
        calculationMethod: definition?.calculationMethod,
        components: definition?.componentScaleCodes.map((code) => ({
          code,
          rawScore: scaleResults.get(code)?.rawScore,
          decile: scaleResults.get(code)?.decile,
        })),
        rawScore: value.rawScore,
        decile: value.decile,
      };
    }),
    derivedMetrics: result.derivedMetrics,
  };
}

const output = JSON.stringify(buildCaseOneResult(), null, 2) + "\n";
if (process.argv.includes("--stdout")) process.stdout.write(output);
else {
  const destination = join(__dirname, "..", "..", "DPO_CASE_1_RESULT.json");
  writeFileSync(destination, output);
  console.log(destination);
}
