export const DPO_ENGINE_VERSION = "dpo-engine-v2";

export type Selection = "MORE" | "LESS";
export type TargetType =
  | "SCALE"
  | "COMPOSITE"
  | "DERIVED_METRIC"
  | "LIKERT_DIMENSION"
  | "LIKERT_TOTAL"
  | "REPORT_ALIAS"
  | "LEGACY_STYLE_PROFILE";

export interface ScoringRule {
  reactiveCode: string;
  pairCode: string;
  scaleCode: string;
  scoreIfMore: number;
  scoreIfLess: number;
}

export interface LikertScoringDefinition {
  questionCode: string;
  scaleCode: string;
  weight: number;
  reverse: boolean;
  minValue: number;
  maxValue: number;
  scoreMap?: Record<string, number> | null;
}

export interface LikertScore {
  questionCode: string;
  scaleCode: string;
  answerValue: number;
  appliedScore: number;
}

export interface CompositeDefinition {
  code: string;
  aggregationMethod:
    "ARITHMETIC_MEAN" | "WEIGHTED_MEAN" | "SUM" | "DIRECT_SCALE" | "TWO_AXIS";
  components: Array<{ scaleCode: string; weight: number; order: number }>;
}

export interface DerivedMetricDefinition {
  code: string;
  calculationType:
    | "ARITHMETIC_MEAN"
    | "WEIGHTED_MEAN"
    | "SUM"
    | "DIRECT_SCALE"
    | "DECILE_MEAN"
    | "CUSTOM_DECLARATIVE";
  sourceScaleCode?: string | null;
  sources?: Array<{
    targetType: "SCALE" | "COMPOSITE";
    targetCode: string;
    valueType?: "RAW" | "DECILE";
    weight?: number;
  }>;
}

export interface ReportAliasDefinition {
  code: string;
  label: string;
  sourceType: "SCALE" | "COMPOSITE";
  sourceCode: string;
}

export interface NormDefinition {
  targetType: TargetType;
  targetCode: string;
  status: string;
  isBlocked?: boolean;
  thresholds: Array<{ decile: number; lowerBound: number; ordinal: number }>;
}

export interface ReactiveScore {
  reactiveCode: string;
  pairCode: string;
  scaleCode: string;
  selection: Selection;
  scoreIfMore: number;
  scoreIfLess: number;
  appliedScore: number;
}

export interface TargetScore {
  targetType: TargetType;
  targetCode: string;
  rawScore: number;
  displayScore: number;
  decile: number | null;
  normalizedScore?: number | null;
  status: string;
}

export function scoreReactive(
  rule: ScoringRule,
  selection: Selection,
): ReactiveScore {
  return {
    reactiveCode: rule.reactiveCode,
    pairCode: rule.pairCode,
    scaleCode: rule.scaleCode,
    selection,
    scoreIfMore: rule.scoreIfMore,
    scoreIfLess: rule.scoreIfLess,
    appliedScore: selection === "MORE" ? rule.scoreIfMore : rule.scoreIfLess,
  };
}

export function calculateReactiveContributions(
  answers: Array<{ pairCode: string; selectedMoreReactiveCode: string }>,
  rules: ScoringRule[],
): ReactiveScore[] {
  const answersByPair = new Map(
    answers.map((answer) => [answer.pairCode, answer.selectedMoreReactiveCode]),
  );
  const rulesByPair = new Map<string, ScoringRule[]>();
  for (const rule of rules)
    rulesByPair.set(rule.pairCode, [
      ...(rulesByPair.get(rule.pairCode) ?? []),
      rule,
    ]);
  if (answersByPair.size !== rulesByPair.size)
    throw new Error("INCOMPLETE_FORCED_CHOICE_ANSWERS");
  for (const [pairCode, pairRules] of rulesByPair) {
    if (pairRules.length !== 2)
      throw new Error(`INVALID_PAIR_RULE_COUNT:${pairCode}`);
    const selected = answersByPair.get(pairCode);
    if (
      !selected ||
      !pairRules.some(({ reactiveCode }) => reactiveCode === selected)
    )
      throw new Error(`INVALID_MORE_SELECTION:${pairCode}`);
  }
  return rules.map((rule) =>
    scoreReactive(
      rule,
      answersByPair.get(rule.pairCode) === rule.reactiveCode ? "MORE" : "LESS",
    ),
  );
}

export function calculateScaleScores(
  contributions: ReactiveScore[],
  likertContributions: LikertScore[] = [],
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const contribution of contributions)
    scores.set(
      contribution.scaleCode,
      (scores.get(contribution.scaleCode) ?? 0) + contribution.appliedScore,
    );
  for (const contribution of likertContributions)
    scores.set(
      contribution.scaleCode,
      (scores.get(contribution.scaleCode) ?? 0) + contribution.appliedScore,
    );
  return scores;
}

export function calculateLikertContributions(
  answers: Array<{ questionCode: string; value: number }>,
  rules: LikertScoringDefinition[],
): LikertScore[] {
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionCode, answer.value]),
  );
  return rules.map((rule) => {
    const value = answerByQuestion.get(rule.questionCode);
    if (value === undefined)
      throw new Error(`INCOMPLETE_LIKERT_ANSWER:${rule.questionCode}`);
    const mapped = rule.scoreMap?.[String(value)];
    const baseScore =
      mapped ?? (rule.reverse ? rule.maxValue + rule.minValue - value : value);
    return {
      questionCode: rule.questionCode,
      scaleCode: rule.scaleCode,
      answerValue: value,
      appliedScore: baseScore * rule.weight,
    };
  });
}

export function calculateLikertDimensionScores(
  contributions: LikertScore[],
): Map<string, number> {
  const grouped = new Map<string, number[]>();
  for (const contribution of contributions)
    grouped.set(contribution.scaleCode, [
      ...(grouped.get(contribution.scaleCode) ?? []),
      contribution.appliedScore,
    ]);
  return new Map(
    [...grouped].map(([code, values]) => [
      code,
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ]),
  );
}

export function calculateCompositeScore(
  definition: CompositeDefinition,
  scaleScores: ReadonlyMap<string, number>,
): number | null {
  const ordered = [...definition.components].sort(
    (left, right) => left.order - right.order,
  );
  const values = ordered.map((component) => {
    const score = scaleScores.get(component.scaleCode);
    if (score === undefined)
      throw new Error(
        `COMPOSITE_SCALE_SCORE_MISSING:${definition.code}:${component.scaleCode}`,
      );
    return { score, weight: component.weight };
  });
  if (!values.length)
    throw new Error(`COMPOSITE_WITHOUT_COMPONENTS:${definition.code}`);
  if (definition.aggregationMethod === "TWO_AXIS") return null;
  if (definition.aggregationMethod === "DIRECT_SCALE")
    return values[0]?.score ?? null;
  if (definition.aggregationMethod === "SUM")
    return values.reduce((sum, value) => sum + value.score * value.weight, 0);
  if (definition.aggregationMethod === "WEIGHTED_MEAN") {
    const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
    if (totalWeight === 0)
      throw new Error(`COMPOSITE_ZERO_WEIGHT:${definition.code}`);
    return (
      values.reduce((sum, value) => sum + value.score * value.weight, 0) /
      totalWeight
    );
  }
  return values.reduce((sum, value) => sum + value.score, 0) / values.length;
}

export function resolveDecile(
  score: number,
  thresholds: NormDefinition["thresholds"],
): number {
  const sorted = [...thresholds].sort(
    (left, right) =>
      left.lowerBound - right.lowerBound || left.ordinal - right.ordinal,
  );
  let result: number | null = null;
  for (const threshold of sorted) {
    if (score >= threshold.lowerBound) result = threshold.decile;
    else break;
  }
  if (result === null) throw new Error("SCORE_OUTSIDE_NORM");
  return result;
}

export function calculateAssessment(input: {
  answers: Array<{ pairCode: string; selectedMoreReactiveCode: string }>;
  rules: ScoringRule[];
  likertAnswers?: Array<{ questionCode: string; value: number }>;
  likertRules?: LikertScoringDefinition[];
  composites: CompositeDefinition[];
  derivedMetricDefinitions?: DerivedMetricDefinition[];
  reportAliases?: ReportAliasDefinition[];
  norms: NormDefinition[];
}) {
  const contributions = calculateReactiveContributions(
    input.answers,
    input.rules,
  );
  const likertContributions = calculateLikertContributions(
    input.likertAnswers ?? [],
    input.likertRules ?? [],
  );
  const scaleScores = calculateScaleScores(contributions);
  const likertDimensionScores =
    calculateLikertDimensionScores(likertContributions);
  const normMap = new Map(
    input.norms.map((norm) => [`${norm.targetType}:${norm.targetCode}`, norm]),
  );
  const scales: TargetScore[] = [...scaleScores].map(([targetCode, rawScore]) =>
    normalized("SCALE", targetCode, rawScore, normMap),
  );
  const likertDimensions: TargetScore[] = [...likertDimensionScores].map(
    ([targetCode, rawScore]) =>
      normalized("LIKERT_DIMENSION", targetCode, rawScore, normMap),
  );
  const likertTotalRaw = likertContributions.length
    ? likertContributions.reduce((sum, item) => sum + item.appliedScore, 0) /
      likertContributions.length
    : null;
  const likertTotal =
    likertTotalRaw === null
      ? null
      : normalized("LIKERT_TOTAL", "LIKERT-TOTAL", likertTotalRaw, normMap);
  const composites: TargetScore[] = [];
  const derivedMetrics: TargetScore[] = [];
  for (const definition of input.composites) {
    const rawScore = calculateCompositeScore(definition, scaleScores);
    if (rawScore !== null)
      composites.push(
        normalized("COMPOSITE", definition.code, rawScore, normMap),
      );
    else {
      for (const [index, component] of [...definition.components]
        .sort((left, right) => left.order - right.order)
        .entries()) {
        const axisCode = `${definition.code}:${index === 0 ? "AXIS_X" : "AXIS_Y"}`;
        const value = scaleScores.get(component.scaleCode);
        if (value === undefined)
          throw new Error(`DERIVED_SCALE_SCORE_MISSING:${axisCode}`);
        const sourceNorm = normMap.get(`SCALE:${component.scaleCode}`);
        derivedMetrics.push({
          targetType: "DERIVED_METRIC",
          targetCode: axisCode,
          rawScore: value,
          displayScore: display(value),
          decile: sourceNorm
            ? resolveDecile(value, sourceNorm.thresholds)
            : null,
          status: sourceNorm?.status ?? "NORM_NOT_CONFIGURED",
        });
      }
    }
  }
  const compositeScores = new Map(
    composites.map((score) => [score.targetCode, score.rawScore]),
  );
  const scaleResults = new Map(
    scales.map((score) => [score.targetCode, score]),
  );
  const compositeResults = new Map(
    composites.map((score) => [score.targetCode, score]),
  );
  for (const definition of input.derivedMetricDefinitions ?? []) {
    if (definition.calculationType === "DECILE_MEAN") {
      const values = (definition.sources ?? []).map((source) => {
        const result =
          source.targetType === "SCALE"
            ? scaleResults.get(source.targetCode)
            : compositeResults.get(source.targetCode);
        if (!result || result.decile === null)
          throw new Error(
            `DERIVED_DECILE_SOURCE_MISSING:${definition.code}:${source.targetCode}`,
          );
        return { value: result.decile, weight: source.weight ?? 1 };
      });
      if (!values.length)
        throw new Error(`DERIVED_METRIC_WITHOUT_SOURCES:${definition.code}`);
      const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
      const value =
        values.reduce((sum, item) => sum + item.value * item.weight, 0) /
        totalWeight;
      derivedMetrics.push({
        targetType: "DERIVED_METRIC",
        targetCode: definition.code,
        rawScore: value,
        displayScore: display(value),
        normalizedScore: value,
        decile: Number.isInteger(value) ? value : null,
        status: "CALCULATED_DECILE_MEAN",
      });
      continue;
    }
    const rawScore = calculateDerivedMetric(
      definition,
      scaleScores,
      compositeScores,
    );
    derivedMetrics.push(
      normalized("DERIVED_METRIC", definition.code, rawScore, normMap),
    );
  }
  const aliases: TargetScore[] = (input.reportAliases ?? []).map((alias) => {
    const source =
      alias.sourceType === "SCALE"
        ? scaleResults.get(alias.sourceCode)
        : compositeResults.get(alias.sourceCode);
    if (!source)
      throw new Error(
        `REPORT_ALIAS_SOURCE_MISSING:${alias.code}:${alias.sourceCode}`,
      );
    return {
      ...source,
      targetType: "REPORT_ALIAS",
      targetCode: alias.code,
      status: "DIRECT_ALIAS",
    };
  });
  return {
    contributions,
    likertContributions,
    scales,
    composites,
    derivedMetrics,
    likertDimensions,
    likertTotal,
    aliases,
  };
}

export function calculateDerivedMetric(
  definition: DerivedMetricDefinition,
  scaleScores: ReadonlyMap<string, number>,
  compositeScores: ReadonlyMap<string, number>,
) {
  if (definition.sourceScaleCode) {
    const direct = scaleScores.get(definition.sourceScaleCode);
    if (direct === undefined)
      throw new Error(`DERIVED_SCALE_SCORE_MISSING:${definition.code}`);
    return direct;
  }
  const sources = definition.sources ?? [];
  if (!sources.length)
    throw new Error(`DERIVED_METRIC_WITHOUT_SOURCES:${definition.code}`);
  const values = sources.map((source) => {
    const value =
      source.targetType === "SCALE"
        ? scaleScores.get(source.targetCode)
        : compositeScores.get(source.targetCode);
    if (value === undefined)
      throw new Error(
        `DERIVED_SOURCE_MISSING:${definition.code}:${source.targetCode}`,
      );
    return { value, weight: source.weight ?? 1 };
  });
  if (definition.calculationType === "SUM")
    return values.reduce((sum, item) => sum + item.value * item.weight, 0);
  if (definition.calculationType === "WEIGHTED_MEAN") {
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
    if (!totalWeight) throw new Error(`DERIVED_ZERO_WEIGHT:${definition.code}`);
    return (
      values.reduce((sum, item) => sum + item.value * item.weight, 0) /
      totalWeight
    );
  }
  return values.reduce((sum, item) => sum + item.value, 0) / values.length;
}

function normalized(
  targetType: TargetType,
  targetCode: string,
  rawScore: number,
  norms: ReadonlyMap<string, NormDefinition>,
): TargetScore {
  const norm = norms.get(`${targetType}:${targetCode}`);
  return {
    targetType,
    targetCode,
    rawScore,
    displayScore: display(rawScore),
    decile: norm ? resolveDecile(rawScore, norm.thresholds) : null,
    normalizedScore: norm ? resolveDecile(rawScore, norm.thresholds) : null,
    status: norm?.status ?? "NORM_NOT_CONFIGURED",
  };
}

function display(rawScore: number) {
  return Number(rawScore.toFixed(2));
}
