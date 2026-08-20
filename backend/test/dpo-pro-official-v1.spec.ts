import {
  calculateAssessment,
  type CompositeDefinition,
  type DerivedMetricDefinition,
  type LikertScoringDefinition,
  type NormDefinition,
  type ReportAliasDefinition,
  type ScoringRule,
} from "../src/modules/scoring/scoring-engine";
import {
  loadOfficialAssessment,
  loadOfficialComposites,
  loadOfficialNorm,
  loadOfficialScoring,
  validateOfficialBundle,
} from "../prisma/seeds/official-dpo-data";

describe("DPO-PRO official v1", () => {
  it("passes every publication integrity assertion", () => {
    const report = validateOfficialBundle();
    expect(report.status).toBe("PASS");
    expect(report.counts).toMatchObject({
      statisticalControlQuestions: 17,
      pairQuestions: 168,
      reactives: 336,
      scales: 48,
      normedComposites: 33,
      derivedDecileMeanMetrics: 21,
      likertQuestions: 25,
      activeNormTargets: 87,
    });
    expect(report.thresholds).toBe(870);
  });

  it("calculates the complete official pipeline without Excel at runtime", () => {
    const assessment = loadOfficialAssessment();
    const scoring = loadOfficialScoring();
    const compositesSource = loadOfficialComposites();
    const norm = loadOfficialNorm();
    const rules: ScoringRule[] = scoring.reactiveScoringRules.map((rule) => ({
      reactiveCode: rule.reactiveCode,
      pairCode: assessment.reactives.find(
        (reactive) => reactive.code === rule.reactiveCode,
      )!.pairCode,
      scaleCode: rule.scaleCode,
      scoreIfMore: rule.scoreIfMore,
      scoreIfLess: rule.scoreIfLess,
    }));
    const answers = assessment.pairQuestions.map((pair, index) => ({
        pairCode: pair.code,
        selectedMoreReactiveCode:
          pair.reactiveCodes[index % 2] ?? pair.reactiveCodes[0],
    }));
    const likertRules: LikertScoringDefinition[] =
      assessment.likertQuestions.map((question) => ({
        questionCode: question.code,
        scaleCode: `LIKERT-${question.dimensionCode}`,
        weight: 1,
        reverse: false,
        minValue: 1,
        maxValue: 5,
      }));
    const composites: CompositeDefinition[] =
      compositesSource.normedComposites.map((item) => ({
        code: item.code,
        aggregationMethod: "ARITHMETIC_MEAN",
        components: item.componentScaleCodes.map(
          (scaleCode: string, index: number) => ({
            scaleCode,
            weight: 1,
            order: index + 1,
          }),
        ),
      }));
    const derivedMetricDefinitions: DerivedMetricDefinition[] =
      compositesSource.derivedDecileMeanMetrics.map((item) => ({
        code: item.code,
        calculationType: "DECILE_MEAN",
        sources: item.componentScaleCodes.map((targetCode: string) => ({
          targetType: "SCALE",
          targetCode,
          valueType: "DECILE",
          weight: 1,
        })),
      }));
    const reportAliases: ReportAliasDefinition[] =
      compositesSource.reportAliases.map((item) => ({
        code: `REPORT_ALIAS:${item.alias}`,
        label: item.alias,
        sourceType: item.sourceType,
        sourceCode: item.sourceCode,
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
      answers,
      rules,
      likertAnswers: assessment.likertQuestions.map((question) => ({
        questionCode: question.code,
        value: 4,
      })),
      likertRules,
      composites,
      derivedMetricDefinitions,
      reportAliases,
      norms,
    });

    expect(result.contributions).toHaveLength(336);
    expect(result.scales).toHaveLength(48);
    expect(result.scales.every((item) => item.decile !== null)).toBe(true);
    expect(result.composites).toHaveLength(33);
    expect(result.composites.every((item) => item.decile !== null)).toBe(true);
    expect(result.derivedMetrics).toHaveLength(21);
    expect(
      result.derivedMetrics.every(
        (item) => item.status === "CALCULATED_DECILE_MEAN",
      ),
    ).toBe(true);
    expect(result.likertDimensions).toHaveLength(5);
    expect(result.likertDimensions.every((item) => item.rawScore === 4)).toBe(
      true,
    );
    expect(result.likertTotal?.rawScore).toBe(4);
    expect(result.aliases).toHaveLength(12);
  });
});
