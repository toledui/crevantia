"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Brand } from "./brand";

interface Result {
  id: string;
  calculatedAt: string;
  configurationHash: string;
  normVersion: { version: number; normSet: { code: string; name: string } };
  values: Array<{
    id: string;
    targetType: string;
    targetCode: string;
    rawScore: string;
    displayScore: string | null;
    decile: number | null;
    status: string;
  }>;
}

export function ResultSummary({ resultId }: { resultId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
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
            <p>
              Calculado con {result.normVersion.normSet.name} v
              {result.normVersion.version}. La sección de Gestión de recursos
              sigue pendiente de clave oficial.
            </p>
            <div className="result-grid">
              {result.values
                .filter(({ targetType }) => targetType === "COMPOSITE")
                .map((value) => (
                  <article key={value.id}>
                    <span>{value.targetCode}</span>
                    <strong>{value.decile ?? "—"}</strong>
                    <small>
                      Decil · bruto {value.displayScore ?? value.rawScore}
                    </small>
                  </article>
                ))}
            </div>
            <footer>
              <code>
                Configuración {result.configurationHash.slice(0, 16)}…
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
