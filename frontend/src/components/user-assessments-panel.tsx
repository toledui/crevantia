'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Download, Mail } from "lucide-react";
import { apiDownload, apiFetch } from "@/lib/api";
import { AdminToast } from "@/components/admin-toast";

interface Assignment {
  id: string;
  status: string;
  test: { code: string; name: string; description: string | null };
  testVersion: { version: number; estimatedMin: number | null };
  attempt: {
    id: string;
    status: string;
    resultRuns: Array<{
      id: string;
      report: {
        status: string;
        generatedAt: string | null;
        deliveries: Array<{ status: string; sentAt: string | null }>;
      } | null;
    }>;
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
  async function downloadReport(resultRunId: string) {
    setBusy(`download:${resultRunId}`);
    setError("");
    try {
      const file = await apiDownload(`/results/${resultRunId}/report`);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Tu reporte se descargó correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible descargar el reporte.");
    } finally {
      setBusy("");
    }
  }
  async function resendReport(resultRunId: string) {
    setBusy(`email:${resultRunId}`);
    setError("");
    try {
      const response = await apiFetch<{ message: string }>(`/results/${resultRunId}/report/email`, { method: "POST" });
      setMessage(response.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible enviar el reporte.");
    } finally {
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
                <div className="assignment-report-actions">
                  <small className="assignment-report-status">
                    {assignment.attempt.resultRuns[0].report?.status === "READY"
                      ? assignment.attempt.resultRuns[0].report?.deliveries[0]?.status === "SENT"
                        ? "Reporte listo y enviado a tu correo."
                        : "Reporte listo para descargar. Puedes solicitar el envío por correo."
                      : "El reporte se preparará al descargarlo."}
                  </small>
                  <button className="secondary-button compact" onClick={() => router.push(`/resultados/${assignment.attempt?.resultRuns[0]?.id}`)}>
                    <BarChart3 size={14} /> Ver resultados
                  </button>
                  <button className="secondary-button compact" disabled={busy === `download:${assignment.attempt.resultRuns[0].id}`} onClick={() => void downloadReport(assignment.attempt!.resultRuns[0]!.id)}>
                    <Download size={14} /> {busy === `download:${assignment.attempt.resultRuns[0].id}` ? "Preparando…" : "Descargar PDF"}
                  </button>
                  <button className="secondary-button compact" disabled={busy === `email:${assignment.attempt.resultRuns[0].id}`} onClick={() => void resendReport(assignment.attempt!.resultRuns[0]!.id)}>
                    <Mail size={14} /> {busy === `email:${assignment.attempt.resultRuns[0].id}` ? "Enviando…" : "Enviar por correo"}
                  </button>
                </div>
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
