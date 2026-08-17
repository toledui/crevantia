import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface QuestionBankData {
  schemaVersion: string;
  assessment: {
    code: string;
    workingName: string;
    language: string;
    versionCode: string;
    intro: string;
    sections: Array<{
      code: string;
      order: number;
      name: string;
      instructions: string;
    }>;
    counts: Record<string, number>;
    estimatedMinutesFromBrief: { minimum: number; maximum: number };
    sourceDiscrepancies: unknown[];
  };
  demographicFields: Array<{
    code: string;
    order: number;
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    validation?: unknown;
    prefillFromAccount?: boolean;
  }>;
  pairedQuestions: Array<{
    code: string;
    order: number;
    sectionCode: string;
    polarity: string;
    required: boolean;
    sourceFormQuestionNumber: number;
    statements: Array<{ code: string; orderInPair: number; text: string }>;
  }>;
  likertOptionSets: Array<{
    code: string;
    options: Array<{ value: number; code: string; label: string }>;
  }>;
  likertQuestions: Array<{
    code: string;
    order: number;
    sectionCode: string;
    required: boolean;
    text: string;
    optionSetCode: string;
    scoringStatus: string;
    sourceFormQuestionNumber: number;
  }>;
}

export interface ScoringData {
  schemaVersion: string;
  scoringKey: {
    code: string;
    name: string;
    version: string;
    status: string;
    algorithm: Record<string, unknown>;
    validatedCounts: Record<string, number>;
  };
  reactives: Array<{
    code: string;
    order: number;
    pairCode: string;
    text: string;
    polarity: "POSITIVE" | "NEGATIVE";
    scaleCode: string;
    scaleName: string;
    fixedWeight: number;
    scoreIfSelectedMore: number;
    scoreIfSelectedLess: number;
    sourceReferences: unknown;
  }>;
  scales: Array<{
    code: string;
    name: string;
    aggregation: string;
    reactiveCodes: string[];
    expectedReactiveCount: number;
    positiveReactiveCount: number;
    negativeReactiveCount: number;
  }>;
  composites: Array<{
    code: string;
    name: string;
    aggregation: string;
    componentScaleCodes: string[];
    specialNotes: string | null;
  }>;
  legacyStyleProfiles: unknown;
  reportMappingStatus: unknown;
}

export interface NormData {
  schemaVersion: string;
  normSet: {
    code: string;
    name: string;
    version: string;
    status: string;
    population: string;
    sampleSize: { value: number };
    lookupMethod: string;
    qualitySummary: unknown;
    knownWorkbookNotes: string[];
  };
  targets: Array<{
    targetType: string;
    name: string;
    code: string;
    sourceRange: string;
    status: string;
    thresholds: Array<{
      ordinal: number;
      minRaw: string;
      displayMinRaw: string;
      decil: number;
      sourceRaw: string;
      sourceOutputRaw: string;
      sourceCells: unknown;
    }>;
    warnings: unknown[];
  }>;
}

export interface GoldenData {
  schemaVersion: string;
  case: {
    code: string;
    scoringKeyCode: string;
    normSetCode: string;
    answerCount: number;
  };
  answers: Array<{ pairCode: string; selectedMoreReactiveCode: string }>;
  expected: Record<string, unknown>;
}

function load<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(join(__dirname, "data", fileName), "utf8"),
  ) as T;
}

export const loadQuestionBank = () =>
  load<QuestionBankData>("dpo-pro.question-bank.v1.json");
export const loadScoringKey = () =>
  load<ScoringData>("dpo-pro.scoring-key.v6.json");
export const loadNorm = () => load<NormData>("dpo-pro.norm.global-412.v1.json");
export const loadGoldenCase = () =>
  load<GoldenData>("dpo-pro.golden-case.excel-example.json");
