import {
  calculateDerivedMetric,
  calculateLikertContributions,
  calculateScaleScores,
} from "../src/modules/scoring/scoring-engine";

describe("Configurable psychometric scoring", () => {
  it("scores direct, reversed and custom Likert rules", () => {
    const contributions = calculateLikertContributions(
      [
        { questionCode: "L1", value: 2 },
        { questionCode: "L2", value: 2 },
        { questionCode: "L3", value: 2 },
      ],
      [
        {
          questionCode: "L1",
          scaleCode: "S",
          weight: 1,
          reverse: false,
          minValue: 1,
          maxValue: 5,
        },
        {
          questionCode: "L2",
          scaleCode: "S",
          weight: 2,
          reverse: true,
          minValue: 1,
          maxValue: 5,
        },
        {
          questionCode: "L3",
          scaleCode: "T",
          weight: 1,
          reverse: false,
          minValue: 1,
          maxValue: 5,
          scoreMap: { "2": 10 },
        },
      ],
    );
    expect(contributions.map(({ appliedScore }) => appliedScore)).toEqual([
      2, 8, 10,
    ]);
    expect(calculateScaleScores([], contributions)).toEqual(
      new Map([
        ["S", 10],
        ["T", 10],
      ]),
    );
  });

  it("calculates configured derived metrics from scales and composites", () => {
    expect(
      calculateDerivedMetric(
        {
          code: "INDEX",
          calculationType: "WEIGHTED_MEAN",
          sources: [
            { targetType: "SCALE", targetCode: "A", weight: 1 },
            { targetType: "COMPOSITE", targetCode: "B", weight: 3 },
          ],
        },
        new Map([["A", 10]]),
        new Map([["B", 20]]),
      ),
    ).toBe(17.5);
  });
});
