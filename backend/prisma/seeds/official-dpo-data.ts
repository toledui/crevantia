import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface OfficialAssessmentData {
  schemaVersion: string;
  assessment: {
    code: string;
    name: string;
    version: string;
    status: string;
    language: string;
    sections: Array<{
      code: string;
      order: number;
      type: string;
      scored: boolean;
      questionCount: number;
    }>;
    source: Record<string, unknown>;
  };
  statisticalControlQuestions: Array<{
    code: string;
    order: number;
    text: string;
    inputType: string;
    options: string[] | null;
    required: boolean;
    sourceRequirement: string;
    includeInScoring: false;
  }>;
  pairQuestions: Array<{
    code: string;
    order: number;
    sectionCode: string;
    polarityGroup: "POSITIVE" | "NEGATIVE";
    required: boolean;
    reactiveCodes: [string, string];
  }>;
  reactives: Array<{
    code: string;
    order: number;
    sourceReactiveId: number;
    pairCode: string;
    pairNumber: number;
    text: string;
  }>;
  likertQuestions: OfficialLikertQuestion[];
}

export interface OfficialLikertQuestion {
  code: string;
  order: number;
  text: string;
  dimensionCode: string;
  dimensionName: string;
  direction: "DIRECT";
  weight: number;
  required: boolean;
  options: Array<{ value: number; label: string }>;
}

export interface OfficialReactiveRule {
  reactiveCode: string;
  scaleCode: string;
  scaleName: string;
  polarity: "POSITIVE" | "NEGATIVE";
  fixedWeight: number;
  scoreIfMore: number;
  scoreIfLess: number;
}

export interface OfficialScale {
  code: string;
  name: string;
  aggregationMethod: string;
  reactiveCodes: string[];
  expectedReactiveCount: number;
  positiveReactiveCount: number;
  negativeReactiveCount: number;
}

export interface OfficialComposite {
  code: string;
  name: string;
  calculationMethod: "RAW_MEAN_THEN_NORM";
  componentScaleCodes: string[];
  componentCount: number;
  normRequired: true;
}

export interface OfficialDerivedMetric {
  code: string;
  group: string;
  name: string;
  calculationMethod: "DECILE_MEAN";
  componentType: "SCALE_DECILE";
  componentScaleCodes: string[];
  componentCount: number;
  normRequired: false;
}

export interface OfficialReportAlias {
  alias: string;
  sourceType: "SCALE" | "COMPOSITE";
  sourceCode: string;
  sourceLabel: string;
  calculationMethod: "DIRECT_ALIAS";
}

export interface OfficialNormTarget {
  targetType: "SCALE" | "COMPOSITE" | "LIKERT_DIMENSION" | "LIKERT_TOTAL";
  targetCode: string;
  targetName: string;
  thresholds: Array<{ decile: number; lowerBound: number }>;
}

function load<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(join(__dirname, "data", fileName), "utf8"),
  ) as T;
}

export const loadOfficialAssessment = () =>
  load<OfficialAssessmentData>("dpo-pro.official.assessment.v1.json");
export const loadOfficialReactives = () =>
  load<{
    reactives: Array<
      OfficialReactiveRule & { code: string; pairCode: string; text: string }
    >;
  }>("dpo-pro.official.reactives.v1.json");
export const loadOfficialScoring = () =>
  load<{
    scoringKey: Record<string, unknown> & { code: string; version: string };
    reactiveScoringRules: OfficialReactiveRule[];
  }>("dpo-pro.official.scoring-key.v1.json");
export const loadOfficialScales = () =>
  load<{ scales: OfficialScale[] }>("dpo-pro.official.scales.v1.json");
export const loadOfficialComposites = () =>
  load<{
    normedComposites: OfficialComposite[];
    derivedDecileMeanMetrics: OfficialDerivedMetric[];
    reportAliases: OfficialReportAlias[];
  }>("dpo-pro.official.composites.v1.json");
export const loadOfficialNorm = () =>
  load<{
    normSet: Record<string, unknown> & {
      code: string;
      name: string;
      version: string;
      sourceTitle: string;
      lookupMethod: string;
      numericMode: string;
      roundingMode: string;
      source: Record<string, unknown>;
    };
    activeTargets: OfficialNormTarget[];
    sourceTablesNotActive: Record<string, unknown>;
  }>("dpo-pro.official.norm.v1.json");
export const loadOfficialLikert = () =>
  load<{
    calculation: Record<string, unknown>;
    dimensions: Array<{ code: string; questionCodes: string[] }>;
    questions: OfficialLikertQuestion[];
    normTargets: OfficialNormTarget[];
  }>("dpo-pro.official.likert.v1.json");
export const loadOfficialExpectedCounts = () =>
  load<Record<string, number>>("dpo-pro.official.expected-counts.json");

export function validateOfficialBundle() {
  const assessment = loadOfficialAssessment();
  const scoring = loadOfficialScoring();
  const scales = loadOfficialScales();
  const composites = loadOfficialComposites();
  const norm = loadOfficialNorm();
  const likert = loadOfficialLikert();
  const expected = loadOfficialExpectedCounts();
  const failures: string[] = [];
  const check = (condition: boolean, code: string) => {
    if (!condition) failures.push(code);
  };

  check(
    assessment.statisticalControlQuestions.length ===
      expected.statisticalControlQuestions,
    "CONTROL_COUNT",
  );
  check(
    assessment.pairQuestions.length === expected.pairQuestions,
    "PAIR_COUNT",
  );
  check(
    assessment.pairQuestions.filter((item) => item.polarityGroup === "POSITIVE")
      .length === expected.positivePairs,
    "POSITIVE_PAIR_COUNT",
  );
  check(
    assessment.pairQuestions.filter((item) => item.polarityGroup === "NEGATIVE")
      .length === expected.negativePairs,
    "NEGATIVE_PAIR_COUNT",
  );
  check(assessment.reactives.length === expected.reactives, "REACTIVE_COUNT");
  check(
    assessment.likertQuestions.length === expected.likertQuestions,
    "LIKERT_COUNT",
  );
  check(
    scoring.reactiveScoringRules.length === expected.reactives,
    "SCORING_RULE_COUNT",
  );
  check(scales.scales.length === expected.scales, "SCALE_COUNT");
  check(
    composites.normedComposites.length === expected.normedComposites,
    "COMPOSITE_COUNT",
  );
  check(
    composites.derivedDecileMeanMetrics.length ===
      expected.derivedDecileMeanMetrics,
    "DERIVED_COUNT",
  );
  check(
    composites.reportAliases.length === expected.reportAliases,
    "ALIAS_COUNT",
  );
  check(
    likert.dimensions.length === expected.likertDimensions,
    "LIKERT_DIMENSION_COUNT",
  );
  check(
    norm.activeTargets.length === expected.activeNormTargets,
    "NORM_TARGET_COUNT",
  );

  const reactiveCodes = new Set(assessment.reactives.map(({ code }) => code));
  const pairCodes = new Set(assessment.pairQuestions.map(({ code }) => code));
  const ruleByReactive = new Map(
    scoring.reactiveScoringRules.map((rule) => [rule.reactiveCode, rule]),
  );
  const scaleCodes = new Set(scales.scales.map(({ code }) => code));
  check(
    reactiveCodes.size === assessment.reactives.length,
    "DUPLICATE_REACTIVE_CODE",
  );
  check(
    pairCodes.size === assessment.pairQuestions.length,
    "DUPLICATE_PAIR_CODE",
  );
  for (const pair of assessment.pairQuestions) {
    check(pair.reactiveCodes.length === 2, `PAIR_REACTIVE_COUNT:${pair.code}`);
    for (const code of pair.reactiveCodes)
      check(
        reactiveCodes.has(code),
        `PAIR_REACTIVE_MISSING:${pair.code}:${code}`,
      );
  }
  for (const reactive of assessment.reactives) {
    check(
      pairCodes.has(reactive.pairCode),
      `REACTIVE_PAIR_MISSING:${reactive.code}`,
    );
    const rule = ruleByReactive.get(reactive.code);
    check(Boolean(rule), `REACTIVE_RULE_MISSING:${reactive.code}`);
    if (rule)
      check(
        scaleCodes.has(rule.scaleCode),
        `REACTIVE_SCALE_MISSING:${reactive.code}`,
      );
  }
  for (const scale of scales.scales) {
    const rules = scoring.reactiveScoringRules.filter(
      ({ scaleCode }) => scaleCode === scale.code,
    );
    check(rules.length === 7, `SCALE_REACTIVE_COUNT:${scale.code}`);
    check(
      rules.filter(({ polarity }) => polarity === "POSITIVE").length === 4,
      `SCALE_POSITIVE_COUNT:${scale.code}`,
    );
    check(
      rules.filter(({ polarity }) => polarity === "NEGATIVE").length === 3,
      `SCALE_NEGATIVE_COUNT:${scale.code}`,
    );
  }
  for (const dimension of likert.dimensions) {
    check(
      dimension.questionCodes.length === expected.questionsPerLikertDimension,
      `LIKERT_DIMENSION_SIZE:${dimension.code}`,
    );
  }
  for (const target of norm.activeTargets) {
    check(
      target.thresholds.length === 10,
      `NORM_THRESHOLD_COUNT:${target.targetCode}`,
    );
    check(
      target.thresholds.every(
        (threshold, index) => threshold.decile === index + 1,
      ),
      `NORM_DECILES:${target.targetCode}`,
    );
    check(
      target.thresholds.every(
        (threshold, index, all) =>
          index === 0 || threshold.lowerBound > all[index - 1]!.lowerBound,
      ),
      `NORM_ASCENDING:${target.targetCode}`,
    );
  }
  if (failures.length)
    throw new Error(`DPO_OFFICIAL_VALIDATION_FAILED:${failures.join(",")}`);
  return {
    status: "PASS",
    counts: expected,
    thresholds: norm.activeTargets.reduce(
      (sum, target) => sum + target.thresholds.length,
      0,
    ),
  };
}
