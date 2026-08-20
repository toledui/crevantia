"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Brand } from "./brand";

interface Result {
  id: string;
  isOfficial: boolean;
  recalculationOfResultRunId: string | null;
  reason: string | null;
  calculatedAt: string;
  configurationHash: string;
  requestedResultRunId: string;
  displayedResultRunId: string;
  isLatestResultRun: boolean;
  normVersion: { version: number; normSet: { code: string; name: string } };
  resultHistory: Array<{
    id: string;
    isOfficial: boolean;
    recalculationOfResultRunId: string | null;
    calculatedAt: string;
    reason: string | null;
    configurationHash: string;
    normVersion: {
      version: number;
      normSet: { code: string; name: string };
    };
  }>;
  values: Array<{
    id: string;
    targetType: string;
    targetCode: string;
    targetName?: string;
    rawScore: string;
    displayScore: string | null;
    decile: number | null;
    status: string;
  }>;
}

export function ResultSummary({ resultId }: { resultId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loadingRun, setLoadingRun] = useState(false);

  function loadResult(id: string, exact = false) {
    setLoadingRun(true);
    setError("");
    return apiFetch<Result>(`/results/${id}${exact ? "?exact=true" : ""}`)
      .then((value) => {
        setResult(value);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "No fue posible cargar el resultado.",
        );
      })
      .finally(() => setLoadingRun(false));
  }

  useEffect(() => {
    let active = true;
    apiFetch<Result>(`/results/${resultId}`)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar el resultado.",
          );
      });
    return () => {
      active = false;
    };
  }, [resultId]);
  return (
    <main className="result-page">
      <Brand />
      <section>
        <span className="eyebrow dark">Resultado reproducible</span>
        <h1>{error ? "Resultado no disponible" : "Evaluación completada"}</h1>
        {error ? (
          <p className="form-error">{error}</p>
        ) : !result ? (
          <p>Preparando resultados…</p>
        ) : (
          <>
            <div
              className={`result-run-banner ${result.isLatestResultRun ? "current" : "historical"}`}
            >
              <div>
                <strong>
                  {result.isLatestResultRun
                    ? result.isOfficial
                      ? "Resultado vigente"
                      : "Recalificación vigente"
                    : "Resultado histórico"}
                </strong>
                <small>
                  ID {result.id} · {new Date(result.calculatedAt).toLocaleString("es-MX")}
                </small>
                {result.reason ? <small>Motivo: {result.reason}</small> : null}
              </div>
              {result.resultHistory.length > 1 ? (
                <label>
                  Ejecución mostrada
                  <select
                    aria-label="Ejecución mostrada"
                    disabled={loadingRun}
                    value={result.id}
                    onChange={(event) => void loadResult(event.target.value, true)}
                  >
                    {result.resultHistory.map((run, index) => (
                      <option key={run.id} value={run.id}>
                        {run.recalculationOfResultRunId
                          ? index === result.resultHistory.length - 1
                            ? "Recalificación vigente"
                            : `Recalificación ${index}`
                          : "Resultado original"}{" "}
                        · {new Date(run.calculatedAt).toLocaleString("es-MX")}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <p>
              Calculado con {result.normVersion.normSet.name} v
              {result.normVersion.version}. Incluye elección pareada y las 25
              preguntas oficiales de Gestión de recursos.
            </p>
            <h2>33 competencias</h2>
            <div className="result-grid">
              {result.values
                .filter(({ targetType }) => targetType === "COMPOSITE")
                .map((value) => (
                  <article key={value.id}>
                    <span>{value.targetCode}</span>
                    <strong>{value.decile ?? "—"}</strong>
                    <small>
                      {value.targetName} · bruto{" "}
                      {value.displayScore ?? value.rawScore}
                    </small>
                  </article>
                ))}
            </div>
            <details className="result-technical-details" open>
              <summary>48 escalas técnicas</summary>
              <div className="result-grid">
                {result.values
                  .filter(({ targetType }) => targetType === "SCALE")
                  .map((value) => (
                    <article key={value.id}>
                      <span>{value.targetCode}</span>
                      <strong>{value.decile ?? "—"}</strong>
                      <small>
                        {value.targetName} · bruto{" "}
                        {value.displayScore ?? value.rawScore}
                      </small>
                    </article>
                  ))}
              </div>
            </details>
            <details className="result-technical-details" open>
              <summary>Gestión de recursos</summary>
              <div className="result-grid">
                {result.values
                  .filter(({ targetType }) =>
                    ["LIKERT_DIMENSION", "LIKERT_TOTAL"].includes(targetType),
                  )
                  .map((value) => (
                    <article key={value.id}>
                      <span>{value.targetCode}</span>
                      <strong>{value.decile ?? "—"}</strong>
                      <small>
                        {value.targetName} · promedio{" "}
                        {value.displayScore ?? value.rawScore}
                      </small>
                    </article>
                  ))}
              </div>
            </details>
            <footer>
              <code>
                ResultRun {result.id} · Configuración{" "}
                {result.configurationHash.slice(0, 16)}…
              </code>
              <Link className="secondary-button" href="/panel">
                Volver a mis evaluaciones
              </Link>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
