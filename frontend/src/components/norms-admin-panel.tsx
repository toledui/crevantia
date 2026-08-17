"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status =
  "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "BLOCKED";
interface Threshold {
  id: string;
  decile: number;
  lowerBound: string;
  ordinal: number;
}
interface Target {
  id: string;
  targetType: string;
  targetCode: string;
  name: string;
  status: string;
  isBlocked: boolean;
  validationNotes: string | null;
  thresholds: Threshold[];
}
interface ValidationRun {
  id: string;
  hasErrors: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  createdAt: string;
  issues: Array<{
    id: string;
    severity: string;
    code: string;
    message: string;
  }>;
}
interface Version {
  id: string;
  normSetId: string;
  version: number;
  name: string;
  status: Status;
  populationLabel: string | null;
  sampleSize: number | null;
  validationStatus: string | null;
  configurationHash: string;
  updatedAt: string;
  targets?: Target[];
  validationRuns?: ValidationRun[];
  _count?: { targets: number; resultRuns: number };
}
interface NormSet {
  id: string;
  code: string;
  name: string;
  versions: Version[];
}
interface CompareResult {
  changedTargets: number;
  thresholdChanges: number;
  changes: Array<{
    targetCode: string;
    name: string;
    kind: string;
    thresholds: Array<{
      decile: number;
      previous: number | null;
      next: number;
    }>;
  }>;
}
interface ImpactResult {
  evaluationsAnalyzed: number;
  resultValues: {
    unchanged: number;
    changedOneDecile: number;
    changedMoreThanOneDecile: number;
  };
  mostAffectedTargets: Array<{ targetCode: string; changes: number }>;
}

const statusLabel: Record<Status, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
  BLOCKED: "Bloqueada",
};

export function NormsAdminPanel() {
  const [sets, setSets] = useState<NormSet[]>([]);
  const [setId, setSetId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [version, setVersion] = useState<Version | null>(null);
  const [draftTargets, setDraftTargets] = useState<Target[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [compareId, setCompareId] = useState("");
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSets(preferredVersionId?: string) {
    const response = await apiFetch<{ items: NormSet[] }>("/norms");
    setSets(response.items);
    const nextSet =
      response.items.find((item) =>
        item.versions.some(({ id }) => id === preferredVersionId),
      ) ??
      response.items.find(({ id }) => id === setId) ??
      response.items[0];
    const nextVersion =
      nextSet?.versions.find(({ id }) => id === preferredVersionId) ??
      nextSet?.versions.find(({ id }) => id === versionId) ??
      nextSet?.versions[0];
    if (nextSet) setSetId(nextSet.id);
    if (nextSet && nextVersion) await loadVersion(nextSet.id, nextVersion.id);
  }

  async function loadVersion(nextSetId: string, nextVersionId: string) {
    const detail = await apiFetch<Version>(
      `/norms/${nextSetId}/versions/${nextVersionId}`,
    );
    setVersion(detail);
    setVersionId(nextVersionId);
    setDraftTargets(detail.targets ?? []);
    setDirty(new Set());
    setComparison(null);
    setImpact(null);
  }

  useEffect(() => {
    let active = true;
    apiFetch<{ items: NormSet[] }>("/norms")
      .then(async ({ items }) => {
        if (!active) return;
        setSets(items);
        const firstSet = items[0];
        const firstVersion = firstSet?.versions[0];
        if (!firstSet || !firstVersion) return;
        const detail = await apiFetch<Version>(
          `/norms/${firstSet.id}/versions/${firstVersion.id}`,
        );
        if (!active) return;
        setSetId(firstSet.id);
        setVersionId(firstVersion.id);
        setVersion(detail);
        setDraftTargets(detail.targets ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedSet = sets.find(({ id }) => id === setId);
  const targetChecks = useMemo(
    () =>
      new Map(
        draftTargets.map((target) => [target.id, validateTarget(target)]),
      ),
    [draftTargets],
  );
  const totals = useMemo(
    () => ({
      targets: draftTargets.length,
      thresholds: draftTargets.reduce(
        (sum, target) => sum + target.thresholds.length,
        0,
      ),
      blocked: draftTargets.filter(({ isBlocked }) => isBlocked).length,
      warnings: [...targetChecks.values()].reduce(
        (sum, check) => sum + check.warnings.length,
        0,
      ),
      errors: [...targetChecks.values()].reduce(
        (sum, check) => sum + check.errors.length,
        0,
      ),
    }),
    [draftTargets, targetChecks],
  );

  function editThreshold(targetId: string, decile: number, value: string) {
    setDraftTargets((current) =>
      current.map((target) =>
        target.id === targetId
          ? {
              ...target,
              thresholds: target.thresholds.map((threshold) =>
                threshold.decile === decile
                  ? { ...threshold, lowerBound: value }
                  : threshold,
              ),
            }
          : target,
      ),
    );
    setDirty((current) => new Set(current).add(targetId));
  }

  function toggleBlocked(targetId: string) {
    setDraftTargets((current) =>
      current.map((target) =>
        target.id === targetId
          ? {
              ...target,
              isBlocked: !target.isBlocked,
              status: target.isBlocked ? "REVIEW_REQUIRED" : "BLOCKED",
            }
          : target,
      ),
    );
    setDirty((current) => new Set(current).add(targetId));
  }

  async function saveDraft() {
    if (!version || version.status !== "DRAFT") return;
    const changed = draftTargets.filter(({ id }) => dirty.has(id));
    if (
      changed.some(
        (target) => (targetChecks.get(target.id)?.errors.length ?? 0) > 0,
      )
    ) {
      setError("Corrige los límites inválidos antes de guardar.");
      return;
    }
    setBusy(true);
    clearAlerts();
    try {
      for (const target of changed) {
        await apiFetch(`/norm-versions/${version.id}/targets/${target.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: target.name,
            status: target.status,
            isBlocked: target.isBlocked,
            validationNotes: target.validationNotes,
          }),
        });
        await apiFetch(`/norm-targets/${target.id}/thresholds`, {
          method: "PUT",
          body: JSON.stringify({
            thresholds: target.thresholds.map((threshold) => ({
              decile: threshold.decile,
              ordinal: threshold.ordinal,
              lowerBound: Number(threshold.lowerBound),
            })),
          }),
        });
      }
      setMessage(
        `${changed.length} targets guardados. La versión requiere una nueva validación.`,
      );
      await loadVersion(version.normSetId, version.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cloneVersion() {
    if (!version || !selectedSet) return;
    setBusy(true);
    clearAlerts();
    try {
      const cloned = await apiFetch<Version>(
        `/norms/${selectedSet.id}/versions/${version.id}/clone`,
        { method: "POST" },
      );
      setMessage(`Versión ${cloned.version} creada como borrador.`);
      await loadSets(cloned.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function action(
    name: "validate" | "submit-review" | "approve" | "publish" | "archive",
  ) {
    if (!version) return;
    if (
      (name === "publish" || name === "archive") &&
      !window.confirm(
        `¿Confirmas ${name === "publish" ? "la publicación" : "el archivo"} de la versión ${version.version}?`,
      )
    )
      return;
    setBusy(true);
    clearAlerts();
    try {
      const result = await apiFetch<ValidationRun | Version>(
        `/norm-versions/${version.id}/${name}`,
        { method: "POST" },
      );
      setMessage(
        name === "validate" && "errorCount" in result
          ? `Validación: ${result.errorCount} errores, ${result.warningCount} advertencias.`
          : "Transición completada.",
      );
      await loadSets(version.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    if (!version || !compareId) return;
    setBusy(true);
    clearAlerts();
    try {
      setComparison(
        await apiFetch<CompareResult>(
          `/norm-versions/${version.id}/compare/${compareId}`,
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  async function previewImpact() {
    if (!version) return;
    setBusy(true);
    clearAlerts();
    try {
      setImpact(
        await apiFetch<ImpactResult>(
          `/norm-versions/${version.id}/impact-preview`,
          { method: "POST", body: JSON.stringify({ limit: 1000 }) },
        ),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function addTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!version) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    clearAlerts();
    try {
      await apiFetch(`/norm-versions/${version.id}/targets`, {
        method: "POST",
        body: JSON.stringify({
          targetType: form.get("targetType"),
          targetCode: form.get("targetCode"),
          name: form.get("name"),
          status: "REVIEW_REQUIRED",
          isBlocked: false,
        }),
      });
      setMessage("Target agregado; captura sus diez límites.");
      await loadVersion(version.normSetId, version.id);
      event.currentTarget.reset();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function clearAlerts() {
    setError("");
    setMessage("");
  }
  function errorMessage(reason: unknown) {
    return reason instanceof Error
      ? reason.message
      : "No fue posible completar la operación.";
  }

  if (loading)
    return (
      <div className="admin-content norms-page">
        <p className="panel norms-empty">Cargando normas…</p>
      </div>
    );
  return (
    <div className="admin-content norms-page">
      <section className="norms-heading">
        <div>
          <span className="eyebrow dark">Motor versionado</span>
          <h1>Normas y baremos</h1>
          <p>
            Edita clones en borrador; las versiones publicadas permanecen
            inmutables.
          </p>
        </div>
        <button
          className="primary-button compact"
          disabled={!version || busy}
          onClick={() => void cloneVersion()}
        >
          Clonar versión
        </button>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <section className="panel norms-toolbar">
        <label>
          Norma
          <select
            value={setId}
            onChange={(event) => {
              const next = sets.find(({ id }) => id === event.target.value);
              const first = next?.versions[0];
              setSetId(event.target.value);
              if (first) void loadVersion(event.target.value, first.id);
            }}
          >
            {sets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Versión
          <select
            value={versionId}
            onChange={(event) => void loadVersion(setId, event.target.value)}
          >
            {selectedSet?.versions.map((item) => (
              <option key={item.id} value={item.id}>
                v{item.version} · {statusLabel[item.status]}
              </option>
            ))}
          </select>
        </label>
        <div className={`norm-state ${version?.status.toLowerCase()}`}>
          {version ? statusLabel[version.status] : "—"}
        </div>
        <code>{version?.configurationHash.slice(0, 12)}…</code>
      </section>
      <section className="norm-stats">
        <article>
          <strong>{totals.targets}</strong>
          <span>Targets</span>
        </article>
        <article>
          <strong>{totals.thresholds}</strong>
          <span>Thresholds</span>
        </article>
        <article>
          <strong>{totals.blocked}</strong>
          <span>Bloqueados</span>
        </article>
        <article>
          <strong>{totals.warnings}</strong>
          <span>Warnings locales</span>
        </article>
        <article>
          <strong>{version?._count?.resultRuns ?? 0}</strong>
          <span>Resultados históricos</span>
        </article>
      </section>
      <section className="panel norm-actions">
        <div>
          <h2>{version?.name}</h2>
          <p>
            {version?.populationLabel ?? "Población por confirmar"} · n=
            {version?.sampleSize ?? "—"} ·{" "}
            {version?.validationStatus ?? "Sin validar"}
          </p>
        </div>
        <div>
          <button
            className="secondary-button"
            disabled={busy || version?.status !== "DRAFT"}
            onClick={() => void action("validate")}
          >
            Validar
          </button>
          <button
            className="secondary-button"
            disabled={busy || version?.status !== "DRAFT"}
            onClick={() => void action("submit-review")}
          >
            Enviar a revisión
          </button>
          <button
            className="secondary-button"
            disabled={busy || version?.status !== "IN_REVIEW"}
            onClick={() => void action("approve")}
          >
            Aprobar
          </button>
          <button
            className="primary-button compact"
            disabled={busy || version?.status !== "APPROVED"}
            onClick={() => void action("publish")}
          >
            Publicar
          </button>
          <button
            className="secondary-button"
            disabled={
              busy ||
              !version ||
              (version.status !== "APPROVED" && version.status !== "PUBLISHED")
            }
            onClick={() => void action("archive")}
          >
            Archivar
          </button>
        </div>
      </section>
      <section className="panel norm-matrix-card">
        <header>
          <div>
            <h2>Editor de baremos</h2>
            <p>
              Lookup por límite inferior; los duplicados se conservan y se
              señalan.
            </p>
          </div>
          <div>
            <button
              className="secondary-button"
              disabled={!dirty.size || busy}
              onClick={() =>
                version && void loadVersion(version.normSetId, version.id)
              }
            >
              Descartar
            </button>
            <button
              className="primary-button compact"
              disabled={
                !dirty.size ||
                busy ||
                version?.status !== "DRAFT" ||
                totals.errors > 0
              }
              onClick={() => void saveDraft()}
            >
              Guardar borrador ({dirty.size})
            </button>
          </div>
        </header>
        <div className="norm-matrix-wrap">
          <table className="norm-matrix">
            <thead>
              <tr>
                <th>Target</th>
                {Array.from({ length: 10 }, (_, index) => (
                  <th key={index}>D{index + 1}</th>
                ))}
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {draftTargets.map((target) => {
                const check = targetChecks.get(target.id);
                return (
                  <tr
                    key={target.id}
                    className={`${dirty.has(target.id) ? "changed" : ""} ${check?.errors.length ? "invalid" : check?.warnings.length ? "warning" : ""}`}
                  >
                    <td>
                      <strong>{target.name}</strong>
                      <small>
                        {target.targetType}:{target.targetCode}
                      </small>
                    </td>
                    {Array.from({ length: 10 }, (_, index) => {
                      const threshold = target.thresholds.find(
                        ({ decile }) => decile === index + 1,
                      );
                      return (
                        <td key={index}>
                          <input
                            aria-label={`${target.name} decil ${index + 1}`}
                            disabled={version?.status !== "DRAFT"}
                            value={threshold?.lowerBound ?? ""}
                            onChange={(event) =>
                              editThreshold(
                                target.id,
                                index + 1,
                                event.target.value,
                              )
                            }
                          />
                        </td>
                      );
                    })}
                    <td>
                      <label className="blocked-toggle">
                        <input
                          type="checkbox"
                          checked={target.isBlocked}
                          disabled={version?.status !== "DRAFT"}
                          onChange={() => toggleBlocked(target.id)}
                        />
                        <span>
                          {target.isBlocked
                            ? "Bloqueado"
                            : check?.errors.length
                              ? "Error"
                              : check?.warnings.length
                                ? "Warning"
                                : "OK"}
                        </span>
                      </label>
                      {check?.warnings[0] && (
                        <small title={check.warnings.join("\n")}>
                          {check.warnings.length} aviso(s)
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {version?.status === "DRAFT" && (
        <form className="panel add-target" onSubmit={addTarget}>
          <strong>Agregar target</strong>
          <select name="targetType">
            <option value="SCALE">Escala</option>
            <option value="COMPOSITE">Composite</option>
            <option value="DERIVED_METRIC">Métrica derivada</option>
          </select>
          <input name="targetCode" placeholder="Código estable" required />
          <input name="name" placeholder="Nombre" required />
          <button className="secondary-button" disabled={busy}>
            Agregar
          </button>
        </form>
      )}
      <section className="norm-analysis">
        <article className="panel">
          <h3>Comparar versiones</h3>
          <div className="analysis-controls">
            <select
              value={compareId}
              onChange={(event) => setCompareId(event.target.value)}
            >
              <option value="">Selecciona otra versión</option>
              {selectedSet?.versions
                .filter(({ id }) => id !== versionId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    v{item.version}
                  </option>
                ))}
            </select>
            <button
              className="secondary-button"
              disabled={!compareId || busy}
              onClick={() => void compare()}
            >
              Comparar
            </button>
          </div>
          {comparison && (
            <div className="analysis-result">
              <strong>{comparison.changedTargets} targets modificados</strong>
              <span>{comparison.thresholdChanges} cortes cambiaron</span>
              {comparison.changes.slice(0, 8).map((change) => (
                <small key={change.targetCode}>
                  {change.name}:{" "}
                  {change.thresholds
                    .map(
                      ({ decile, previous, next }) =>
                        `D${decile} ${previous}→${next}`,
                    )
                    .join(", ") || change.kind}
                </small>
              ))}
            </div>
          )}
        </article>
        <article className="panel">
          <h3>Impact preview</h3>
          <p>Simula sobre resultados históricos sin modificarlos.</p>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void previewImpact()}
          >
            Analizar impacto
          </button>
          {impact && (
            <div className="analysis-result">
              <strong>{impact.evaluationsAnalyzed} evaluaciones</strong>
              <span>
                {impact.resultValues.unchanged} sin cambio ·{" "}
                {impact.resultValues.changedOneDecile} ±1 ·{" "}
                {impact.resultValues.changedMoreThanOneDecile} &gt;1
              </span>
              {impact.mostAffectedTargets.slice(0, 5).map((target) => (
                <small key={target.targetCode}>
                  {target.targetCode}: {target.changes} cambios
                </small>
              ))}
            </div>
          )}
        </article>
      </section>
      {version?.validationRuns?.[0] && (
        <section className="panel validation-summary">
          <h3>Última validación</h3>
          <p>
            {version.validationRuns[0].errorCount} errores ·{" "}
            {version.validationRuns[0].warningCount} warnings ·{" "}
            {version.validationRuns[0].infoCount} info
          </p>
          {version.validationRuns[0].issues.slice(0, 12).map((issue) => (
            <div key={issue.id} className={issue.severity.toLowerCase()}>
              <strong>
                {issue.severity} · {issue.code}
              </strong>
              <span>{issue.message}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function validateTarget(target: Target) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ordered = [...target.thresholds].sort(
    (left, right) => left.ordinal - right.ordinal,
  );
  if (ordered.length !== 10) errors.push("Debe contener diez deciles.");
  for (let index = 0; index < ordered.length; index += 1) {
    const value = Number(ordered[index]?.lowerBound);
    const previous = Number(ordered[index - 1]?.lowerBound);
    if (!Number.isFinite(value)) errors.push(`D${index + 1} no es numérico.`);
    if (index && value < previous)
      errors.push(`D${index + 1} desciende respecto al corte anterior.`);
    if (index && value === previous)
      warnings.push(
        `D${index} y D${index + 1} comparten ${value}; gana el posterior.`,
      );
  }
  if (target.isBlocked)
    errors.push("Target bloqueado por validación pendiente.");
  return { errors, warnings };
}
