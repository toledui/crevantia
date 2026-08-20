export interface ThresholdInput {
  decile: number;
  lowerBound: number;
  ordinal: number;
}

export interface NormTargetInput {
  id?: string;
  targetType: string;
  targetCode: string;
  isBlocked: boolean;
  thresholds: ThresholdInput[];
}

export interface ValidationIssue {
  targetId?: string;
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export function validateNormTargets(
  targets: NormTargetInput[],
  validReferences?: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const target of targets) {
    const add = (
      severity: ValidationIssue["severity"],
      code: string,
      message: string,
      metadata?: Record<string, unknown>,
    ) =>
      issues.push({ targetId: target.id, severity, code, message, metadata });
    if (target.isBlocked)
      add(
        "ERROR",
        "TARGET_BLOCKED",
        `${target.targetCode} está bloqueado por una anomalía de origen.`,
      );
    if (
      validReferences &&
      !validReferences.has(`${target.targetType}:${target.targetCode}`) &&
      ![
        "LEGACY_STYLE_PROFILE",
        "DERIVED_METRIC",
        "LIKERT_TOTAL",
        "REPORT_ALIAS",
      ].includes(target.targetType)
    )
      add(
        "ERROR",
        "TARGET_REFERENCE_NOT_FOUND",
        `${target.targetCode} no existe en la configuración de scoring.`,
      );
    if (!target.thresholds.length) {
      add(
        "ERROR",
        "TARGET_WITHOUT_THRESHOLDS",
        `${target.targetCode} no tiene baremo.`,
      );
      continue;
    }
    const deciles = target.thresholds.map(({ decile }) => decile);
    if (!deciles.includes(1))
      add(
        "ERROR",
        "MISSING_DECILE_1",
        `${target.targetCode} no contiene el decil 1.`,
      );
    for (let decile = 1; decile <= 10; decile += 1)
      if (!deciles.includes(decile))
        add(
          "ERROR",
          "MISSING_DECILE",
          `${target.targetCode} no contiene el decil ${decile}.`,
          { decile },
        );
    if (new Set(deciles).size !== deciles.length)
      add(
        "ERROR",
        "DUPLICATE_DECILE",
        `${target.targetCode} contiene deciles duplicados.`,
      );
    if (
      target.thresholds.some(({ lowerBound }) => !Number.isFinite(lowerBound))
    )
      add(
        "ERROR",
        "INVALID_LOWER_BOUND",
        `${target.targetCode} contiene un límite no numérico.`,
      );
    const ordered = [...target.thresholds].sort(
      (left, right) => left.ordinal - right.ordinal,
    );
    if (ordered.some((threshold, index) => threshold.ordinal !== index + 1))
      add(
        "ERROR",
        "INVALID_ORDINAL_SEQUENCE",
        `${target.targetCode} no tiene ordinales consecutivos desde 1.`,
      );
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (!previous || !current) continue;
      if (current.lowerBound < previous.lowerBound)
        add(
          "ERROR",
          "DESCENDING_LOWER_BOUND",
          `${target.targetCode} contiene límites descendentes.`,
          { previous: previous.lowerBound, current: current.lowerBound },
        );
      if (current.lowerBound === previous.lowerBound)
        add(
          "WARNING",
          "DUPLICATE_LOWER_BOUND",
          `${target.targetCode} repite el límite ${current.lowerBound}; con LOOKUP gana el decil posterior.`,
          {
            lowerBound: current.lowerBound,
            lowerDecile: previous.decile,
            upperDecile: current.decile,
          },
        );
    }
  }
  if (!targets.length)
    issues.push({
      severity: "ERROR",
      code: "NORM_WITHOUT_TARGETS",
      message: "La norma no contiene targets.",
    });
  issues.push({
    severity: "INFO",
    code: "VALIDATION_COMPLETED",
    message: `Se validaron ${targets.length} targets sin modificar sus valores.`,
  });
  return issues;
}
