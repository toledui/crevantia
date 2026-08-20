"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch, currentUser } from "@/lib/api";
import { AdminToast } from "@/components/admin-toast";

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
  description: string | null;
  status: Status;
  populationLabel: string | null;
  sampleSize: number | null;
  country: string | null;
  ageRange: string | null;
  notes: string | null;
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
  description: string | null;
  versions: Version[];
}
interface VersionMetadata {
  name: string;
  description: string;
  populationLabel: string;
  sampleSize: string;
  country: string;
  ageRange: string;
  notes: string;
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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [targetEditor, setTargetEditor] = useState<Target | null>(null);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [versionMetadata, setVersionMetadata] =
    useState<VersionMetadata>(emptyMetadata());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

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
    setVersionMetadata(metadataFromVersion(detail));
    setMetadataDirty(false);
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
        setVersionMetadata(metadataFromVersion(detail));
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

  useEffect(() => {
    currentUser()
      .then((user) => setPermissions(user.permissions))
      .catch(() => setPermissions([]));
  }, []);

  const selectedSet = sets.find(({ id }) => id === setId);
  const canCreate = permissions.includes("norm.create");
  const canEdit = permissions.includes("norm.edit");
  const canReview = permissions.includes("norm.review");
  const canApprove = permissions.includes("norm.approve");
  const canPublish = permissions.includes("norm.publish");
  const canArchive = permissions.includes("norm.archive");
  function patchMetadata(patch: Partial<VersionMetadata>) {
    setVersionMetadata((current) => ({ ...current, ...patch }));
    setMetadataDirty(true);
  }
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
              thresholds:
                value === ""
                  ? target.thresholds.filter(
                      (threshold) => threshold.decile !== decile,
                    )
                  : target.thresholds.some(
                        (threshold) => threshold.decile === decile,
                      )
                    ? target.thresholds.map((threshold) =>
                        threshold.decile === decile
                          ? { ...threshold, lowerBound: value }
                          : threshold,
                      )
                    : [
                        ...target.thresholds,
                        {
                          id: "",
                          decile,
                          ordinal: decile,
                          lowerBound: value,
                        },
                      ],
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

  function saveTargetEditor() {
    if (!targetEditor?.name.trim()) {
      setError("El nombre del target es obligatorio.");
      return;
    }
    if (!targetEditor.targetCode.trim()) {
      setError("El código técnico del target es obligatorio.");
      return;
    }
    setDraftTargets((current) =>
      current.map((target) =>
        target.id === targetEditor.id
          ? {
              ...targetEditor,
              name: targetEditor.name.trim(),
              targetCode: targetEditor.targetCode.trim(),
            }
          : target,
      ),
    );
    setDirty((current) => new Set(current).add(targetEditor.id));
    setTargetEditor(null);
    setMessage(
      "Cambios del target preparados. Pulsa Guardar borrador para persistirlos.",
    );
  }

  async function saveDraft() {
    if (!version || version.status !== "DRAFT") return;
    const changed = draftTargets.filter(({ id }) => dirty.has(id));
    setBusy(true);
    clearAlerts();
    try {
      if (metadataDirty) {
        await apiFetch(`/norm-versions/${version.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...versionMetadata,
            sampleSize: versionMetadata.sampleSize
              ? Number(versionMetadata.sampleSize)
              : undefined,
          }),
        });
      }
      for (const target of changed) {
        await apiFetch(`/norm-versions/${version.id}/targets/${target.id}`, {
          method: "PUT",
          body: JSON.stringify({
            targetType: target.targetType,
            targetCode: target.targetCode,
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
        `${changed.length} targets y metadatos guardados. La versión requiere una nueva validación.`,
      );
      await loadVersion(version.normSetId, version.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function createNorm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    clearAlerts();
    try {
      const created = await apiFetch<Version>("/norms", {
        method: "POST",
        body: JSON.stringify({
          code: form.get("code"),
          setName: form.get("setName"),
          setDescription: form.get("setDescription") || undefined,
          name: form.get("versionName"),
          populationLabel: form.get("populationLabel") || undefined,
          sampleSize: form.get("sampleSize")
            ? Number(form.get("sampleSize"))
            : undefined,
          country: form.get("country") || undefined,
        }),
      });
      setShowCreate(false);
      setMessage("Norma creada como versión 1 en borrador.");
      await loadSets(created.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function updateNormSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSet) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    clearAlerts();
    try {
      await apiFetch(`/norms/${selectedSet.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("setName"),
          description: form.get("setDescription") || undefined,
        }),
      });
      setMessage("Datos generales de la norma actualizados.");
      await loadSets(version?.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget(target: Target) {
    if (
      !version ||
      !window.confirm(`¿Eliminar el target ${target.targetCode} y sus baremos?`)
    )
      return;
    setBusy(true);
    clearAlerts();
    try {
      await apiFetch(`/norm-versions/${version.id}/targets/${target.id}`, {
        method: "DELETE",
      });
      setMessage("Target eliminado del borrador.");
      await loadVersion(version.normSetId, version.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function exportVersion() {
    if (!version || !selectedSet) return;
    setBusy(true);
    clearAlerts();
    try {
      const payload = await apiFetch<Record<string, unknown>>(
        `/norms/${selectedSet.id}/versions/${version.id}/export`,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedSet.code}-v${version.version}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Archivo normativo exportado correctamente.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function importNorm(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    clearAlerts();
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      const created = await apiFetch<Version>("/norms/import", {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      setMessage("Norma importada como borrador.");
      await loadSets(created.id);
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
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
        <div className="norms-heading-actions">
          <button
            className="secondary-button"
            disabled={!version || busy}
            onClick={() => void exportVersion()}
          >
            Exportar JSON
          </button>
          {canCreate && (
            <>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => void importNorm(event)}
              />
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => importInput.current?.click()}
              >
                Importar
              </button>
              <button
                className="secondary-button"
                disabled={!version || busy}
                onClick={() => void cloneVersion()}
              >
                Clonar versión
              </button>
              <button
                className="primary-button compact"
                disabled={busy}
                onClick={() => setShowCreate((value) => !value)}
              >
                + Nueva norma
              </button>
            </>
          )}
        </div>
      </section>
      {showCreate && (
        <form className="panel norm-create-form" onSubmit={createNorm}>
          <header>
            <div>
              <h2>Crear familia normativa</h2>
              <p>Se generará una versión 1 editable en estado borrador.</p>
            </div>
            <button type="button" onClick={() => setShowCreate(false)}>
              ×
            </button>
          </header>
          <label>
            Código estable
            <input name="code" placeholder="MEXICO_PROFESIONALES" required />
          </label>
          <label>
            Nombre de la norma
            <input name="setName" required />
          </label>
          <label>
            Nombre de la versión
            <input name="versionName" required />
          </label>
          <label>
            Población
            <input name="populationLabel" />
          </label>
          <label>
            Tamaño de muestra
            <input name="sampleSize" type="number" min={1} />
          </label>
          <label>
            País
            <input name="country" />
          </label>
          <label className="wide">
            Descripción
            <textarea name="setDescription" rows={2} />
          </label>
          <button className="primary-button compact" disabled={busy}>
            Crear borrador
          </button>
        </form>
      )}
      <AdminToast
        error={error}
        message={message}
        setError={setError}
        setMessage={setMessage}
      />
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
      {version && selectedSet && (
        <section className="panel norm-metadata-editor">
          <header>
            <div>
              <h2>Identidad y población normativa</h2>
              <p>
                La familia identifica la norma; cada versión conserva su propia
                población y muestra.
              </p>
            </div>
            <button
              className="primary-button compact"
              disabled={
                busy ||
                version.status !== "DRAFT" ||
                !canEdit ||
                (!metadataDirty && !dirty.size)
              }
              onClick={() => void saveDraft()}
            >
              Guardar cambios
            </button>
          </header>
          <form key={selectedSet.id} onSubmit={updateNormSet}>
            <label>
              Código de familia
              <input value={selectedSet.code} disabled />
            </label>
            <label>
              Nombre de familia
              <input
                name="setName"
                defaultValue={selectedSet.name}
                disabled={!canEdit}
                required
              />
            </label>
            <label className="wide">
              Descripción de familia
              <textarea
                name="setDescription"
                defaultValue={selectedSet.description ?? ""}
                disabled={!canEdit}
                rows={2}
              />
            </label>
            {canEdit && (
              <button className="secondary-button" disabled={busy}>
                Guardar familia
              </button>
            )}
          </form>
          <div className="norm-version-fields">
            <label>
              Nombre de versión
              <input
                value={versionMetadata.name}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ name: event.target.value })
                }
              />
            </label>
            <label>
              Población
              <input
                value={versionMetadata.populationLabel}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ populationLabel: event.target.value })
                }
              />
            </label>
            <label>
              Tamaño de muestra
              <input
                type="number"
                min={1}
                value={versionMetadata.sampleSize}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ sampleSize: event.target.value })
                }
              />
            </label>
            <label>
              País
              <input
                value={versionMetadata.country}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ country: event.target.value })
                }
              />
            </label>
            <label>
              Rango de edad
              <input
                value={versionMetadata.ageRange}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ ageRange: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Descripción de versión
              <textarea
                rows={2}
                value={versionMetadata.description}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ description: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Notas metodológicas
              <textarea
                rows={3}
                value={versionMetadata.notes}
                disabled={version.status !== "DRAFT" || !canEdit}
                onChange={(event) =>
                  patchMetadata({ notes: event.target.value })
                }
              />
            </label>
          </div>
        </section>
      )}
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
            disabled={busy || version?.status !== "DRAFT" || !canReview}
            onClick={() => void action("validate")}
          >
            Validar
          </button>
          <button
            className="secondary-button"
            disabled={busy || version?.status !== "DRAFT" || !canReview}
            onClick={() => void action("submit-review")}
          >
            Enviar a revisión
          </button>
          <button
            className="secondary-button"
            disabled={busy || version?.status !== "IN_REVIEW" || !canApprove}
            onClick={() => void action("approve")}
          >
            Aprobar
          </button>
          <button
            className="primary-button compact"
            disabled={busy || version?.status !== "APPROVED" || !canPublish}
            onClick={() => void action("publish")}
          >
            Publicar
          </button>
          <button
            className="secondary-button"
            disabled={
              busy ||
              !version ||
              (version.status !== "APPROVED" &&
                version.status !== "PUBLISHED") ||
              !canArchive
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
              disabled={(!dirty.size && !metadataDirty) || busy}
              onClick={() =>
                version && void loadVersion(version.normSetId, version.id)
              }
            >
              Descartar
            </button>
            <button
              className="primary-button compact"
              disabled={
                (!dirty.size && !metadataDirty) ||
                busy ||
                version?.status !== "DRAFT" ||
                !canEdit
              }
              onClick={() => void saveDraft()}
            >
              Guardar borrador ({dirty.size + Number(metadataDirty)})
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
                <th>Acciones</th>
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
                            disabled={version?.status !== "DRAFT" || !canEdit}
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
                          disabled={version?.status !== "DRAFT" || !canEdit}
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
                    <td>
                      <div className="norm-target-actions">
                        <button
                          className="secondary-link"
                          disabled={
                            busy || version?.status !== "DRAFT" || !canEdit
                          }
                          onClick={() => {
                            clearAlerts();
                            setTargetEditor(structuredClone(target));
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="danger-link"
                          disabled={
                            busy || version?.status !== "DRAFT" || !canEdit
                          }
                          onClick={() => void removeTarget(target)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {version?.status === "DRAFT" && canEdit && (
        <form className="panel add-target" onSubmit={addTarget}>
          <strong>Agregar target</strong>
          <select name="targetType">
            <option value="SCALE">Escala</option>
            <option value="COMPOSITE">Composite</option>
            <option value="DERIVED_METRIC">Métrica derivada</option>
            <option value="LIKERT_DIMENSION">Dimensión Likert</option>
            <option value="LIKERT_TOTAL">Total Likert</option>
            <option value="REPORT_ALIAS">Alias de reporte</option>
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
      {targetEditor && (
        <TargetEditor
          target={targetEditor}
          setTarget={setTargetEditor}
          onSave={saveTargetEditor}
          canEditIdentity={
            version?.status === "DRAFT" &&
            (version?._count?.resultRuns ?? 0) === 0
          }
        />
      )}
    </div>
  );
}

function TargetEditor({
  target,
  setTarget,
  onSave,
  canEditIdentity,
}: {
  target: Target;
  setTarget: (target: Target | null) => void;
  onSave: () => void;
  canEditIdentity: boolean;
}) {
  const [correctIdentity, setCorrectIdentity] = useState(false);
  const checks = validateTarget(target);
  const statuses = ["VALIDATED_STRUCTURE", "REVIEW_REQUIRED", "BLOCKED"];
  if (!statuses.includes(target.status)) statuses.unshift(target.status);
  return (
    <div className="user-modal" role="dialog" aria-modal="true">
      <button
        className="modal-backdrop"
        aria-label="Cerrar editor de target"
        onClick={() => setTarget(null)}
      />
      <div className="user-editor target-editor-dialog">
        <header>
          <div>
            <span className="eyebrow dark">Target normativo</span>
            <h2>Editar target</h2>
            <p>
              Edita sus datos administrativos y, cuando sea seguro, su identidad
              técnica.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar editor de target"
            onClick={() => setTarget(null)}
          >
            ×
          </button>
        </header>
        <div className="target-editor-grid">
          <label>
            Tipo
            <select
              value={target.targetType}
              disabled={!correctIdentity}
              onChange={(event) =>
                setTarget({ ...target, targetType: event.target.value })
              }
            >
              <option value="SCALE">Escala</option>
              <option value="COMPOSITE">Composite</option>
              <option value="DERIVED_METRIC">Métrica derivada</option>
              <option value="LIKERT_DIMENSION">Dimensión Likert</option>
              <option value="LIKERT_TOTAL">Total Likert</option>
              <option value="REPORT_ALIAS">Alias de reporte</option>
              <option value="LEGACY_STYLE_PROFILE">Perfil legacy</option>
            </select>
          </label>
          <label>
            Código estable
            <input
              value={target.targetCode}
              disabled={!correctIdentity}
              onChange={(event) =>
                setTarget({ ...target, targetCode: event.target.value })
              }
            />
          </label>
          <div className="target-identity-correction wide">
            <label>
              <input
                type="checkbox"
                checked={correctIdentity}
                disabled={!canEditIdentity}
                onChange={(event) => setCorrectIdentity(event.target.checked)}
              />
              Corregir identidad técnica
            </label>
            <p>
              {canEditIdentity
                ? "Úsalo solo para corregir un tipo o código capturado por error. Al guardar se comprobarán duplicados y su referencia en el modelo psicométrico."
                : "La identidad técnica no puede cambiar porque la versión no es borrador o ya tiene resultados históricos. Clona la versión para corregirla."}
            </p>
          </div>
          <label className="wide">
            Nombre visible
            <input
              value={target.name}
              onChange={(event) =>
                setTarget({ ...target, name: event.target.value })
              }
            />
          </label>
          <label>
            Estado administrativo
            <select
              value={target.status}
              onChange={(event) => {
                const status = event.target.value;
                setTarget({
                  ...target,
                  status,
                  isBlocked: status === "BLOCKED",
                });
              }}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {targetStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="target-blocked-field">
            <input
              type="checkbox"
              checked={target.isBlocked}
              onChange={(event) =>
                setTarget({
                  ...target,
                  isBlocked: event.target.checked,
                  status: event.target.checked
                    ? "BLOCKED"
                    : target.status === "BLOCKED"
                      ? "REVIEW_REQUIRED"
                      : target.status,
                })
              }
            />
            Bloquear publicación de este target
          </label>
          <label className="wide">
            Notas de revisión
            <textarea
              rows={4}
              placeholder="Documenta observaciones, decisiones o referencias metodológicas."
              value={target.validationNotes ?? ""}
              onChange={(event) =>
                setTarget({
                  ...target,
                  validationNotes: event.target.value || null,
                })
              }
            />
          </label>
        </div>
        <section className="target-computed-warnings">
          <div>
            <strong>Validaciones calculadas</strong>
            <p>
              Se generan a partir de los diez thresholds. Para resolverlas,
              corrige los valores en la matriz y vuelve a validar.
            </p>
          </div>
          {!checks.errors.length && !checks.warnings.length ? (
            <span className="target-check-ok">Sin observaciones locales</span>
          ) : (
            <ul>
              {checks.errors.map((issue) => (
                <li className="error" key={`error-${issue}`}>
                  {issue}
                </li>
              ))}
              {checks.warnings.map((issue) => (
                <li className="warning" key={`warning-${issue}`}>
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </section>
        <footer>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setTarget(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button compact"
            onClick={onSave}
          >
            Aplicar cambios
          </button>
        </footer>
      </div>
    </div>
  );
}

function targetStatusLabel(status: string) {
  if (status === "VALIDATED_STRUCTURE") return "Estructura validada";
  if (status === "REVIEW_REQUIRED") return "Revisión requerida";
  if (status === "BLOCKED") return "Bloqueado";
  return status;
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

function emptyMetadata(): VersionMetadata {
  return {
    name: "",
    description: "",
    populationLabel: "",
    sampleSize: "",
    country: "",
    ageRange: "",
    notes: "",
  };
}

function metadataFromVersion(version: Version): VersionMetadata {
  return {
    name: version.name,
    description: version.description ?? "",
    populationLabel: version.populationLabel ?? "",
    sampleSize: version.sampleSize?.toString() ?? "",
    country: version.country ?? "",
    ageRange: version.ageRange ?? "",
    notes: version.notes ?? "",
  };
}
