import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadOfficialAssessment,
  loadOfficialNorm,
} from "../prisma/seeds/official-dpo-data";
import {
  calculateAssessment,
  type LikertScoringDefinition,
  type NormDefinition,
} from "../src/modules/scoring/scoring-engine";

interface LikertFixture {
  case: { answerCount: number };
  likertAnswers: Array<{ questionCode: string; value: number }>;
}

describe("DPO-PRO · fixture Likert independiente", () => {
  it("valida las 25 respuestas sin cargar el Caso 1 pareado", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, "fixtures", "dpo-pro-likert-test-1.json"),
        "utf8",
      ),
    ) as LikertFixture;
    const assessment = loadOfficialAssessment();
    const norm = loadOfficialNorm();
    const likertRules: LikertScoringDefinition[] =
      assessment.likertQuestions.map((question) => ({
        questionCode: question.code,
        scaleCode: `LIKERT-${question.dimensionCode}`,
        weight: question.weight,
        reverse: false,
        minValue: 1,
        maxValue: 5,
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
      answers: [],
      rules: [],
      likertAnswers: fixture.likertAnswers,
      likertRules,
      composites: [],
      norms,
    });

    expect(fixture.case.answerCount).toBe(25);
    expect(fixture.likertAnswers).toHaveLength(25);
    expect(
      new Set(fixture.likertAnswers.map(({ questionCode }) => questionCode))
        .size,
    ).toBe(25);
    expect(result.contributions).toHaveLength(0);
    expect(result.likertContributions).toHaveLength(25);
    expect(result.likertDimensions).toHaveLength(5);
    expect(result.likertTotal?.rawScore).toBeCloseTo(4.84, 12);
    expect(result.likertTotal?.decile).toBe(10);
  });
});
