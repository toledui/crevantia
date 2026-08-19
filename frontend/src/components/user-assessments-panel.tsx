'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AdminToast } from "@/components/admin-toast";

interface Assignment {
  id: string;
  status: string;
  test: { code: string; name: string; description: string | null };
  testVersion: { version: number; estimatedMin: number | null };
  attempt: {
    id: string;
    status: string;
    resultRuns: Array<{ id: string }>;
  } | null;
}

export function UserAssessmentsPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch<{ items: Assignment[] }>("/me/assignments")
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible cargar tus evaluaciones.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(assignment: Assignment) {
    setBusy(assignment.id);
    setError("");
    try {
      const attempt =
        assignment.attempt ??
        (await apiFetch<{ id: string }>(`/assignments/${assignment.id}/start`, {
          method: "POST",
        }));
      router.push(`/evaluacion/${attempt.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible iniciar la evaluación.",
      );
      setBusy("");
    }
  }
  return (
    <section className="user-assessments">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
      <span className="eyebrow dark">Mi espacio</span>
      <h1>Mis evaluaciones</h1>
      <p>
        Continúa una aplicación guardada o inicia una asignación disponible.
      </p>
      {loading ? (
        <div className="empty-state">
          <strong>Cargando evaluaciones…</strong>
        </div>
      ) : !items.length ? (
        <div className="empty-state">
          <strong>No tienes evaluaciones disponibles</strong>
          <small>
            Cuando recibas una asignación podrás iniciarla desde aquí.
          </small>
        </div>
      ) : (
        <div className="assignment-grid">
          {items.map((assignment) => (
            <article key={assignment.id}>
              <div>
                <span>{assignment.test.code}</span>
                <strong>{assignment.test.name}</strong>
                <p>{assignment.test.description}</p>
              </div>
              <dl>
                <div>
                  <dt>Versión</dt>
                  <dd>{assignment.testVersion.version}</dd>
                </div>
                <div>
                  <dt>Duración</dt>
                  <dd>{assignment.testVersion.estimatedMin ?? 40} min</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{assignment.attempt?.status ?? assignment.status}</dd>
                </div>
              </dl>
              {assignment.attempt?.status === "COMPLETED" && assignment.attempt.resultRuns?.[0]?.id ? (
                <button
                  className="secondary-button compact"
                  onClick={() => router.push(`/resultados/${assignment.attempt?.resultRuns[0]?.id}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <BarChart3 size={14} /> Ver Resultados y Reporte
                </button>
              ) : (
                <button
                  className="primary-button compact"
                  disabled={
                    busy === assignment.id ||
                    assignment.attempt?.status === "COMPLETED"
                  }
                  onClick={() => void open(assignment)}
                >
                  {busy === assignment.id
                    ? "Abriendo…"
                    : assignment.attempt
                      ? "Continuar evaluación"
                      : "Iniciar evaluación"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
