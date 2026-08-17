"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status =
  "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED" | "BLOCKED";
type ScoringStatus = "CONFIGURED" | "PENDING_SCORING_SPEC";
type Polarity = "POSITIVE" | "NEGATIVE";

interface Scale {
  id: string;
  code: string;
  name: string;
}
interface Scoring {
  scaleCode: string;
  scaleName?: string;
  polarity: Polarity;
  fixedWeight: number;
  scoreIfMore: number;
  scoreIfLess: number;
}
interface Reactive {
  id?: string;
  code: string;
  text: string;
  position: number;
  scoring: Scoring | null;
}
interface LikertOption {
  id?: string;
  value: number;
  label: string;
  order: number;
}
interface BaseQuestion {
  id?: string;
  code: string;
  order: number;
  required: boolean;
}
interface PairQuestion extends BaseQuestion {
  type: "PAIR";
  reactives: Reactive[];
}
interface LikertQuestion extends BaseQuestion {
  type: "LIKERT";
  text: string;
  optionSetCode: string;
  scoringStatus: ScoringStatus;
  options: LikertOption[];
}
type Question = PairQuestion | LikertQuestion;
interface Section {
  id?: string;
  code: string;
  name: string;
  instructions: string | null;
  order: number;
  questions: Question[];
}
interface Demographic {
  id?: string;
  code: string;
  fieldKey: string;
  label: string;
  type: string;
  order: number;
  required: boolean;
  config?: Record<string, unknown> | null;
}
interface Version {
  id: string;
  version: number;
  versionCode: string;
  language: string;
  status: Status;
  intro: string | null;
  estimatedMinutes: number | null;
  configurationHash: string | null;
  publishedAt: string | null;
  updatedAt: string;
  editable: boolean;
  counts: { attempts: number; resultRuns: number };
  scoringVersion: { id: string; version: number; status: Status } | null;
  demographics: Demographic[];
  sections: Section[];
}
interface VersionSummary {
  id: string;
  version: number;
  versionCode: string;
  status: Status;
  language: string;
  estimatedMinutes: number | null;
  updatedAt: string;
  _count: {
    sections: number;
    pairQuestions: number;
    likertQuestions: number;
    attempts: number;
  };
}
interface Assessment {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  versions: Version[];
}
interface AssessmentListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  versions: VersionSummary[];
}
interface Validation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverage: { reactives: number; rules: number };
}
interface QuestionEditor {
  sectionIndex: number;
  questionIndex: number | null;
  value: Question;
}

const statusLabel: Record<Status, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
  BLOCKED: "Bloqueada",
};

export function TestsAdminPanel() {
  const [items, setItems] = useState<AssessmentListItem[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<Version | null>(null);
  const [scales, setScales] = useState<Scale[]>([]);
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(
    null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);

  const selectedVersion = useMemo(
    () =>
      assessment?.versions.find(
        (version) => version.id === selectedVersionId,
      ) ?? null,
    [assessment, selectedVersionId],
  );
  const counts = useMemo(
    () => summarize(draft ?? selectedVersion),
    [draft, selectedVersion],
  );

  const loadAssessment = useCallback(
    async (id: string, preferredVersionId?: string) => {
      const detail = await apiFetch<Assessment>(`/admin/assessments/${id}`);
      setAssessment(detail);
      const versionId =
        preferredVersionId &&
        detail.versions.some(
          ({ id: candidate }) => candidate === preferredVersionId,
        )
          ? preferredVersionId
          : (detail.versions[0]?.id ?? null);
      setSelectedVersionId(versionId);
      const version =
        detail.versions.find(({ id: candidate }) => candidate === versionId) ??
        null;
      setDraft(version?.editable ? clone(version) : null);
      setValidation(null);
    },
    [],
  );

  const loadAll = useCallback(
    async (preferredAssessmentId?: string, preferredVersionId?: string) => {
      const [response, scaleResponse] = await Promise.all([
        apiFetch<{ items: AssessmentListItem[] }>("/admin/assessments"),
        apiFetch<{ items: Scale[] }>("/admin/assessments/scales"),
      ]);
      setItems(response.items);
      setScales(scaleResponse.items);
      const assessmentId =
        preferredAssessmentId ?? assessment?.id ?? response.items[0]?.id;
      if (assessmentId) await loadAssessment(assessmentId, preferredVersionId);
    },
    [assessment?.id, loadAssessment],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ items: AssessmentListItem[] }>("/admin/assessments"),
      apiFetch<{ items: Scale[] }>("/admin/assessments/scales"),
    ])
      .then(async ([response, scaleResponse]) => {
        if (!active) return;
        setItems(response.items);
        setScales(scaleResponse.items);
        if (response.items[0]) await loadAssessment(response.items[0].id);
      })
      .catch((reason: unknown) => active && setError(errorText(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [loadAssessment]);

  function chooseVersion(version: Version) {
    setSelectedVersionId(version.id);
    setDraft(version.editable ? clone(version) : null);
    setValidation(null);
    clearAlerts();
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startBusy();
    try {
      const created = await apiFetch<{ id: string }>("/admin/assessments", {
        method: "POST",
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          description: form.get("description"),
        }),
      });
      setShowCreate(false);
      setMessage("Evaluación creada con su primer borrador.");
      await loadAll(created.id);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function saveAssessmentMetadata() {
    if (!assessment) return;
    startBusy();
    try {
      await apiFetch(`/admin/assessments/${assessment.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: assessment.name,
          description: assessment.description,
          isActive: assessment.isActive,
        }),
      });
      setMessage("Datos generales actualizados.");
      await loadAll(assessment.id, selectedVersionId ?? undefined);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cloneVersion() {
    if (!assessment || !selectedVersion) return;
    startBusy();
    try {
      const created = await apiFetch<{ id: string }>(
        `/admin/assessments/${assessment.id}/versions`,
        {
          method: "POST",
          body: JSON.stringify({ sourceVersionId: selectedVersion.id }),
        },
      );
      setMessage(
        `Versión ${selectedVersion.version + 1} creada como borrador editable.`,
      );
      await loadAll(assessment.id, created.id);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft || !assessment) return;
    startBusy();
    try {
      const saved = await apiFetch<Version>(
        `/admin/assessments/versions/${draft.id}/content`,
        {
          method: "PUT",
          body: JSON.stringify(toPayload(draft)),
        },
      );
      setMessage("Borrador guardado y clave de puntuación sincronizada.");
      await loadAll(assessment.id, saved.id);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function validateVersion() {
    if (!selectedVersion) return;
    startBusy();
    try {
      const result = await apiFetch<Validation>(
        `/admin/assessments/versions/${selectedVersion.id}/validate`,
        { method: "POST" },
      );
      setValidation(result);
      setMessage(
        result.valid
          ? "La versión está lista para publicar."
          : "La versión todavía contiene errores.",
      );
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publishVersion() {
    if (!selectedVersion || !assessment) return;
    if (
      !window.confirm(
        `¿Publicar la versión ${selectedVersion.version}? Después será inmutable.`,
      )
    )
      return;
    startBusy();
    try {
      const result = await apiFetch<Validation>(
        `/admin/assessments/versions/${selectedVersion.id}/publish`,
        { method: "POST" },
      );
      setValidation(result);
      setMessage("Versión y clave de puntuación publicadas.");
      await loadAll(assessment.id, selectedVersion.id);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function archiveVersion() {
    if (!selectedVersion || !assessment) return;
    if (!window.confirm(`¿Archivar la versión ${selectedVersion.version}?`))
      return;
    startBusy();
    try {
      await apiFetch(
        `/admin/assessments/versions/${selectedVersion.id}/archive`,
        { method: "POST" },
      );
      setMessage("Versión archivada.");
      await loadAll(assessment.id, selectedVersion.id);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  function addSection() {
    if (!draft) return;
    const order = draft.sections.length + 1;
    setDraft({
      ...draft,
      sections: [
        ...draft.sections,
        {
          code: `SECCION_${order}`,
          name: `Nueva sección ${order}`,
          instructions: "",
          order,
          questions: [],
        },
      ],
    });
  }

  function updateSection(index: number, patch: Partial<Section>) {
    if (!draft) return;
    setDraft({
      ...draft,
      sections: draft.sections.map((section, candidate) =>
        candidate === index ? { ...section, ...patch } : section,
      ),
    });
  }

  function removeSection(index: number) {
    const section = draft?.sections[index];
    if (section && isStatisticalControlSection(section, draft.demographics)) {
      setError(
        "El bloque de Datos estadísticos se administra desde sus campos y no puede eliminarse como una sección de preguntas.",
      );
      return;
    }
    if (
      !draft ||
      !window.confirm("¿Eliminar la sección y todas sus preguntas?")
    )
      return;
    setDraft({
      ...draft,
      sections: normalizeOrders(
        draft.sections.filter((_, candidate) => candidate !== index),
      ),
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!draft) return;
    setDraft({ ...draft, sections: move(draft.sections, index, direction) });
  }

  function addQuestion(sectionIndex: number, type: Question["type"]) {
    const section = draft?.sections[sectionIndex];
    if (!section) return;
    const number = section.questions.length + 1;
    const value: Question =
      type === "PAIR"
        ? newPair(section, number, scales[0])
        : newLikert(section, number);
    setQuestionEditor({ sectionIndex, questionIndex: null, value });
  }

  function editQuestion(sectionIndex: number, questionIndex: number) {
    const value = draft?.sections[sectionIndex]?.questions[questionIndex];
    if (value)
      setQuestionEditor({ sectionIndex, questionIndex, value: clone(value) });
  }

  function saveQuestionEditor() {
    if (!draft || !questionEditor) return;
    const { sectionIndex, questionIndex, value } = questionEditor;
    const sections = clone(draft.sections);
    const questions = sections[sectionIndex].questions;
    if (questionIndex === null) questions.push(value);
    else questions[questionIndex] = value;
    sections[sectionIndex].questions = normalizeOrders(questions);
    setDraft({ ...draft, sections });
    setQuestionEditor(null);
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    if (!draft || !window.confirm("¿Eliminar esta pregunta del borrador?"))
      return;
    const sections = clone(draft.sections);
    sections[sectionIndex].questions = normalizeOrders(
      sections[sectionIndex].questions.filter(
        (_, index) => index !== questionIndex,
      ),
    );
    setDraft({ ...draft, sections });
  }

  function duplicateQuestion(sectionIndex: number, questionIndex: number) {
    if (!draft) return;
    const sections = clone(draft.sections);
    const source = clone(sections[sectionIndex].questions[questionIndex]);
    source.code = uniqueCode(
      `${source.code}_COPIA`,
      sections.flatMap((section) => section.questions.map(({ code }) => code)),
    );
    if (source.type === "PAIR")
      source.reactives = source.reactives.map((reactive) => ({
        ...reactive,
        id: undefined,
        code: uniqueCode(
          `${reactive.code}_COPIA`,
          sections.flatMap((section) =>
            section.questions.flatMap((question) =>
              question.type === "PAIR"
                ? question.reactives.map(({ code }) => code)
                : [],
            ),
          ),
        ),
      }));
    source.id = undefined;
    sections[sectionIndex].questions.splice(questionIndex + 1, 0, source);
    sections[sectionIndex].questions = normalizeOrders(
      sections[sectionIndex].questions,
    );
    setDraft({ ...draft, sections });
  }

  function moveQuestion(
    sectionIndex: number,
    questionIndex: number,
    direction: -1 | 1,
  ) {
    if (!draft) return;
    const sections = clone(draft.sections);
    sections[sectionIndex].questions = move(
      sections[sectionIndex].questions,
      questionIndex,
      direction,
    );
    setDraft({ ...draft, sections });
  }

  function addDemographic() {
    if (!draft) return;
    const number = draft.demographics.length + 1;
    setDraft({
      ...draft,
      demographics: [
        ...draft.demographics,
        {
          code: `DATO_${number}`,
          fieldKey: `dato_${number}`,
          label: "Nuevo dato",
          type: "TEXT",
          order: number,
          required: true,
        },
      ],
    });
  }

  function updateDemographic(index: number, patch: Partial<Demographic>) {
    if (!draft) return;
    setDraft({
      ...draft,
      demographics: draft.demographics.map((field, candidate) =>
        candidate === index ? { ...field, ...patch } : field,
      ),
    });
  }

  function moveDemographic(index: number, direction: -1 | 1) {
    if (!draft) return;
    setDraft({
      ...draft,
      demographics: move(draft.demographics, index, direction),
    });
  }

  function startBusy() {
    setBusy(true);
    clearAlerts();
  }
  function clearAlerts() {
    setError("");
    setMessage("");
  }

  if (loading)
    return (
      <div className="admin-content">
        <section className="panel tests-empty">
          Cargando editor de evaluaciones…
        </section>
      </div>
    );

  return (
    <div className="admin-content tests-page assessment-editor-page">
      <section className="tests-heading">
        <div>
          <span className="eyebrow dark">Fuente única del motor</span>
          <h1>Pruebas y reactivos</h1>
          <p>
            Administra contenido, puntuación y versiones inmutables del
            instrumento real.
          </p>
        </div>
        <button
          className="primary-button compact"
          type="button"
          onClick={() => {
            clearAlerts();
            setShowCreate(true);
          }}
        >
          + Nueva evaluación
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
      <section className="tests-workspace">
        <aside className="panel tests-catalog">
          <header>
            <div>
              <h2>Catálogo</h2>
              <p>{items.length} evaluaciones configuradas</p>
            </div>
          </header>
          {items.map((item) => (
            <button
              key={item.id}
              className={assessment?.id === item.id ? "active" : ""}
              type="button"
              onClick={() => void loadAssessment(item.id)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.code} · {item.isActive ? "Activa" : "Inactiva"}
                </small>
              </span>
              <b>{item.versions.length}</b>
            </button>
          ))}
        </aside>
        <div className="tests-detail">
          {!assessment ? (
            <section className="panel tests-empty">
              Crea una evaluación para comenzar.
            </section>
          ) : (
            <>
              <section className="panel assessment-meta-editor">
                <div className="assessment-meta-fields">
                  <label>
                    Código
                    <input value={assessment.code} disabled />
                  </label>
                  <label>
                    Nombre
                    <input
                      value={assessment.name}
                      onChange={(event) =>
                        setAssessment({
                          ...assessment,
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    Descripción
                    <textarea
                      rows={2}
                      value={assessment.description ?? ""}
                      onChange={(event) =>
                        setAssessment({
                          ...assessment,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="toggle-field">
                    <input
                      type="checkbox"
                      checked={assessment.isActive}
                      onChange={(event) =>
                        setAssessment({
                          ...assessment,
                          isActive: event.target.checked,
                        })
                      }
                    />{" "}
                    Evaluación activa
                  </label>
                </div>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void saveAssessmentMetadata()}
                >
                  Guardar datos
                </button>
              </section>
              <div className="version-tabs">
                {assessment.versions.map((version) => (
                  <button
                    key={version.id}
                    className={selectedVersionId === version.id ? "active" : ""}
                    onClick={() => chooseVersion(version)}
                  >
                    <strong>v{version.version}</strong>
                    <span
                      className={`version-status ${version.status.toLowerCase()}`}
                    >
                      {statusLabel[version.status]}
                    </span>
                  </button>
                ))}
              </div>
              {selectedVersion && (
                <>
                  <section className="test-summary">
                    <article>
                      <strong>{counts.sections}</strong>
                      <span>Secciones</span>
                    </article>
                    <article>
                      <strong>{counts.questions}</strong>
                      <span>Preguntas</span>
                    </article>
                    <article>
                      <strong>{counts.pairs}</strong>
                      <span>Pares</span>
                    </article>
                    <article>
                      <strong>{counts.reactives}</strong>
                      <span>Afirmaciones</span>
                    </article>
                    <article>
                      <strong>{counts.likert}</strong>
                      <span>Likert</span>
                    </article>
                    <article>
                      <strong>{counts.rules}</strong>
                      <span>Reglas</span>
                    </article>
                  </section>
                  <section className="panel version-actions-card">
                    <div>
                      <h3>
                        Versión {selectedVersion.version} ·{" "}
                        {statusLabel[selectedVersion.status]}
                      </h3>
                      <p>
                        {selectedVersion.versionCode} ·{" "}
                        {selectedVersion.language} · clave{" "}
                        {selectedVersion.scoringVersion
                          ? `v${selectedVersion.scoringVersion.version} ${statusLabel[selectedVersion.scoringVersion.status]}`
                          : "sin configurar"}
                      </p>
                    </div>
                    <div className="editor-actions">
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => void cloneVersion()}
                      >
                        Clonar a borrador
                      </button>
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => void validateVersion()}
                      >
                        Validar
                      </button>
                      {selectedVersion.editable && (
                        <button
                          className="primary-button compact"
                          disabled={busy}
                          onClick={() => void saveDraft()}
                        >
                          Guardar borrador
                        </button>
                      )}
                      {selectedVersion.editable && (
                        <button
                          className="primary-button compact"
                          disabled={busy}
                          onClick={() => void publishVersion()}
                        >
                          Publicar
                        </button>
                      )}
                      {selectedVersion.status === "PUBLISHED" && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() => void archiveVersion()}
                        >
                          Archivar
                        </button>
                      )}
                    </div>
                  </section>
                  {!selectedVersion.editable && (
                    <aside className="client-warning">
                      <strong>Versión protegida</strong>
                      <p>
                        Esta versión o su clave de puntuación ya está publicada,
                        tiene intentos, o no posee una clave editable. Clónala
                        para modificar contenido.
                      </p>
                    </aside>
                  )}
                  {validation && <ValidationPanel validation={validation} />}
                  {draft ? (
                    <>
                      <section className="panel assessment-version-settings">
                        <label>
                          Idioma
                          <input
                            value={draft.language}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                language: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Minutos estimados
                          <input
                            type="number"
                            min={1}
                            max={600}
                            value={draft.estimatedMinutes ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                estimatedMinutes:
                                  Number(event.target.value) || null,
                              })
                            }
                          />
                        </label>
                        <label className="wide">
                          Introducción
                          <textarea
                            rows={3}
                            value={draft.intro ?? ""}
                            onChange={(event) =>
                              setDraft({ ...draft, intro: event.target.value })
                            }
                          />
                        </label>
                      </section>
                      <section className="panel demographics-editor">
                        <header>
                          <div>
                            <h2>Datos estadísticos</h2>
                            <p>
                              {draft.demographics.length} campos previos; no
                              forman parte de las preguntas evaluables.
                            </p>
                          </div>
                          <button
                            className="secondary-button"
                            onClick={addDemographic}
                          >
                            + Campo
                          </button>
                        </header>
                        <div className="demographic-grid">
                          {draft.demographics.map((field, index) => (
                            <article key={`${field.code}-${index}`}>
                              <input
                                aria-label="Código demográfico"
                                value={field.code}
                                onChange={(event) =>
                                  updateDemographic(index, {
                                    code: event.target.value,
                                  })
                                }
                              />
                              <input
                                aria-label="Clave demográfica"
                                value={field.fieldKey}
                                onChange={(event) =>
                                  updateDemographic(index, {
                                    fieldKey: event.target.value,
                                  })
                                }
                              />
                              <input
                                aria-label="Etiqueta demográfica"
                                value={field.label}
                                onChange={(event) =>
                                  updateDemographic(index, {
                                    label: event.target.value,
                                  })
                                }
                              />
                              <select
                                aria-label="Tipo demográfico"
                                value={field.type}
                                onChange={(event) =>
                                  updateDemographic(index, {
                                    type: event.target.value,
                                  })
                                }
                              >
                                <option value="TEXT">Texto</option>
                                <option value="INTEGER">Número</option>
                                <option value="SINGLE_CHOICE">
                                  Selección única
                                </option>
                                <option value="EMAIL">Correo</option>
                              </select>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(event) =>
                                    updateDemographic(index, {
                                      required: event.target.checked,
                                    })
                                  }
                                />{" "}
                                Obligatorio
                              </label>
                              <div className="row-actions">
                                <button
                                  disabled={index === 0}
                                  onClick={() => moveDemographic(index, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  disabled={
                                    index === draft.demographics.length - 1
                                  }
                                  onClick={() => moveDemographic(index, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                              <button
                                className="icon-danger"
                                aria-label={`Eliminar ${field.label}`}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    demographics: normalizeOrders(
                                      draft.demographics.filter(
                                        (_, candidate) => candidate !== index,
                                      ),
                                    ),
                                  })
                                }
                              >
                                ×
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section className="editor-toolbar">
                        <div>
                          <input
                            placeholder="Buscar por código o texto…"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                          />
                          <span>
                            {counts.questions} preguntas en el borrador
                          </span>
                        </div>
                        <button
                          className="primary-button compact"
                          onClick={addSection}
                        >
                          + Sección
                        </button>
                      </section>
                      <section className="assessment-sections">
                        {draft.sections.map((section, sectionIndex) =>
                          isStatisticalControlSection(
                            section,
                            draft.demographics,
                          ) ? null : (
                            <article
                              className="panel assessment-section-editor"
                              key={`${section.code}-${sectionIndex}`}
                            >
                              <header>
                                <div className="section-fields">
                                  <input
                                    aria-label="Código de sección"
                                    value={section.code}
                                    onChange={(event) =>
                                      updateSection(sectionIndex, {
                                        code: event.target.value,
                                      })
                                    }
                                  />
                                  <input
                                    aria-label="Nombre de sección"
                                    value={section.name}
                                    onChange={(event) =>
                                      updateSection(sectionIndex, {
                                        name: event.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="row-actions">
                                  <button
                                    disabled={
                                      sectionIndex === 0 ||
                                      draft.sections
                                        .slice(0, sectionIndex)
                                        .every((candidate) =>
                                          isStatisticalControlSection(
                                            candidate,
                                            draft.demographics,
                                          ),
                                        )
                                    }
                                    onClick={() =>
                                      moveSection(sectionIndex, -1)
                                    }
                                  >
                                    ↑
                                  </button>
                                  <button
                                    disabled={
                                      sectionIndex === draft.sections.length - 1
                                    }
                                    onClick={() => moveSection(sectionIndex, 1)}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    className="danger-link"
                                    onClick={() => removeSection(sectionIndex)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </header>
                              <textarea
                                className="section-instructions"
                                rows={2}
                                placeholder="Instrucciones de la sección"
                                value={section.instructions ?? ""}
                                onChange={(event) =>
                                  updateSection(sectionIndex, {
                                    instructions: event.target.value,
                                  })
                                }
                              />
                              <div className="section-question-actions">
                                <strong>
                                  {section.questions.length} preguntas
                                </strong>
                                <button
                                  onClick={() =>
                                    addQuestion(sectionIndex, "PAIR")
                                  }
                                >
                                  + Par
                                </button>
                                <button
                                  onClick={() =>
                                    addQuestion(sectionIndex, "LIKERT")
                                  }
                                >
                                  + Likert
                                </button>
                              </div>
                              <div className="question-admin-list">
                                {section.questions
                                  .map((question, questionIndex) => ({
                                    question,
                                    questionIndex,
                                  }))
                                  .filter(({ question }) =>
                                    matchesQuestion(question, query),
                                  )
                                  .map(({ question, questionIndex }) => (
                                    <div
                                      className="question-admin-row"
                                      key={`${question.code}-${questionIndex}`}
                                    >
                                      <span
                                        className={`question-kind ${question.type.toLowerCase()}`}
                                      >
                                        {question.type === "PAIR"
                                          ? "PAR"
                                          : "LIKERT"}
                                      </span>
                                      <div>
                                        <strong>{question.code}</strong>
                                        <p>{questionSummary(question)}</p>
                                        <small>
                                          {question.type === "PAIR"
                                            ? `${question.reactives.filter(({ scoring }) => scoring).length}/2 reglas configuradas`
                                            : `${question.options.length} opciones · ${question.scoringStatus === "CONFIGURED" ? "Configurada" : "Puntuación pendiente"}`}
                                        </small>
                                      </div>
                                      <div className="row-actions">
                                        <button
                                          disabled={questionIndex === 0}
                                          onClick={() =>
                                            moveQuestion(
                                              sectionIndex,
                                              questionIndex,
                                              -1,
                                            )
                                          }
                                        >
                                          ↑
                                        </button>
                                        <button
                                          disabled={
                                            questionIndex ===
                                            section.questions.length - 1
                                          }
                                          onClick={() =>
                                            moveQuestion(
                                              sectionIndex,
                                              questionIndex,
                                              1,
                                            )
                                          }
                                        >
                                          ↓
                                        </button>
                                        <button
                                          onClick={() =>
                                            duplicateQuestion(
                                              sectionIndex,
                                              questionIndex,
                                            )
                                          }
                                        >
                                          Duplicar
                                        </button>
                                        <button
                                          onClick={() =>
                                            editQuestion(
                                              sectionIndex,
                                              questionIndex,
                                            )
                                          }
                                        >
                                          Editar
                                        </button>
                                        <button
                                          className="danger-link"
                                          onClick={() =>
                                            removeQuestion(
                                              sectionIndex,
                                              questionIndex,
                                            )
                                          }
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </article>
                          ),
                        )}
                      </section>
                    </>
                  ) : (
                    <ReadOnlyVersion
                      version={selectedVersion}
                      query={query}
                      setQuery={setQuery}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
      {questionEditor && (
        <QuestionModal
          editor={questionEditor}
          scales={scales}
          setEditor={setQuestionEditor}
          onSave={saveQuestionEditor}
        />
      )}
      {showCreate && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button
            className="modal-backdrop"
            aria-label="Cerrar"
            onClick={() => setShowCreate(false)}
          />
          <form className="user-editor" onSubmit={createAssessment}>
            <header>
              <div>
                <span className="eyebrow dark">Nuevo instrumento</span>
                <h2>Crear evaluación</h2>
                <p>
                  Se crea con una versión y clave de puntuación en borrador.
                </p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>
                ×
              </button>
            </header>
            <div className="editor-grid">
              <label>
                Código
                <input
                  name="code"
                  required
                  pattern="[A-Za-z0-9_-]+"
                  placeholder="DPO_NUEVA"
                />
              </label>
              <label>
                Nombre
                <input name="name" required />
              </label>
              <label className="full">
                Descripción
                <textarea name="description" rows={3} />
              </label>
            </div>
            <footer>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>
              <button className="primary-button compact" disabled={busy}>
                Crear evaluación
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function QuestionModal({
  editor,
  scales,
  setEditor,
  onSave,
}: {
  editor: QuestionEditor;
  scales: Scale[];
  setEditor: (editor: QuestionEditor | null) => void;
  onSave: () => void;
}) {
  const value = editor.value;
  const patch = (next: Question) => setEditor({ ...editor, value: next });
  return (
    <div className="user-modal question-modal" role="dialog" aria-modal="true">
      <button
        className="modal-backdrop"
        aria-label="Cerrar"
        onClick={() => setEditor(null)}
      />
      <div className="user-editor question-editor-dialog">
        <header>
          <div>
            <span className="eyebrow dark">
              {value.type === "PAIR" ? "Elección forzada" : "Escala Likert"}
            </span>
            <h2>
              {editor.questionIndex === null
                ? "Nueva pregunta"
                : "Editar pregunta"}
            </h2>
          </div>
          <button onClick={() => setEditor(null)}>×</button>
        </header>
        <div className="question-editor-body">
          <div className="editor-grid">
            <label>
              Código
              <input
                value={value.code}
                onChange={(event) =>
                  patch({ ...value, code: event.target.value })
                }
              />
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={value.required}
                onChange={(event) =>
                  patch({ ...value, required: event.target.checked })
                }
              />{" "}
              Obligatoria
            </label>
          </div>
          {value.type === "PAIR" ? (
            <div className="reactive-editors">
              {value.reactives.map((reactive, index) => (
                <article key={index}>
                  <h3>Afirmación {index + 1}</h3>
                  <label>
                    Código
                    <input
                      value={reactive.code}
                      onChange={(event) =>
                        patch({
                          ...value,
                          reactives: value.reactives.map((item, candidate) =>
                            candidate === index
                              ? { ...item, code: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Texto
                    <textarea
                      rows={3}
                      value={reactive.text}
                      onChange={(event) =>
                        patch({
                          ...value,
                          reactives: value.reactives.map((item, candidate) =>
                            candidate === index
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="scoring-editor">
                    <label>
                      Escala
                      <select
                        value={reactive.scoring?.scaleCode ?? ""}
                        onChange={(event) =>
                          patchReactiveScoring(
                            value,
                            index,
                            { scaleCode: event.target.value },
                            patch,
                          )
                        }
                      >
                        <option value="">Sin regla</option>
                        {scales.map((scale) => (
                          <option key={scale.id} value={scale.code}>
                            {scale.name} · {scale.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Polaridad
                      <select
                        value={reactive.scoring?.polarity ?? "POSITIVE"}
                        onChange={(event) =>
                          patchReactiveScoring(
                            value,
                            index,
                            { polarity: event.target.value as Polarity },
                            patch,
                          )
                        }
                      >
                        <option value="POSITIVE">Positiva</option>
                        <option value="NEGATIVE">Negativa</option>
                      </select>
                    </label>
                    <label>
                      Si MÁS
                      <input
                        type="number"
                        step="any"
                        value={reactive.scoring?.scoreIfMore ?? 4}
                        onChange={(event) =>
                          patchReactiveScoring(
                            value,
                            index,
                            { scoreIfMore: Number(event.target.value) },
                            patch,
                          )
                        }
                      />
                    </label>
                    <label>
                      Si MENOS
                      <input
                        type="number"
                        step="any"
                        value={reactive.scoring?.scoreIfLess ?? 1}
                        onChange={(event) =>
                          patchReactiveScoring(
                            value,
                            index,
                            { scoreIfLess: Number(event.target.value) },
                            patch,
                          )
                        }
                      />
                    </label>
                    <label>
                      Peso
                      <input
                        type="number"
                        step="any"
                        value={reactive.scoring?.fixedWeight ?? 4}
                        onChange={(event) =>
                          patchReactiveScoring(
                            value,
                            index,
                            { fixedWeight: Number(event.target.value) },
                            patch,
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="likert-editor">
              <label>
                Texto
                <textarea
                  rows={4}
                  value={value.text}
                  onChange={(event) =>
                    patch({ ...value, text: event.target.value })
                  }
                />
              </label>
              <div className="editor-grid">
                <label>
                  Código de opciones
                  <input
                    value={value.optionSetCode}
                    onChange={(event) =>
                      patch({ ...value, optionSetCode: event.target.value })
                    }
                  />
                </label>
                <label>
                  Estado de puntuación
                  <select
                    value={value.scoringStatus}
                    onChange={(event) =>
                      patch({
                        ...value,
                        scoringStatus: event.target.value as ScoringStatus,
                      })
                    }
                  >
                    <option value="PENDING_SCORING_SPEC">Pendiente</option>
                    <option value="CONFIGURED">Configurada</option>
                  </select>
                </label>
              </div>
              <h3>Opciones</h3>
              {value.options.map((option, index) => (
                <div className="likert-option-row" key={index}>
                  <input
                    type="number"
                    aria-label="Valor"
                    value={option.value}
                    onChange={(event) =>
                      patch({
                        ...value,
                        options: value.options.map((item, candidate) =>
                          candidate === index
                            ? { ...item, value: Number(event.target.value) }
                            : item,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Etiqueta"
                    value={option.label}
                    onChange={(event) =>
                      patch({
                        ...value,
                        options: value.options.map((item, candidate) =>
                          candidate === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-danger"
                    onClick={() =>
                      patch({
                        ...value,
                        options: normalizeOrders(
                          value.options.filter(
                            (_, candidate) => candidate !== index,
                          ),
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="secondary-button"
                onClick={() =>
                  patch({
                    ...value,
                    options: [
                      ...value.options,
                      {
                        value: value.options.length + 1,
                        label: `Opción ${value.options.length + 1}`,
                        order: value.options.length + 1,
                      },
                    ],
                  })
                }
              >
                + Opción
              </button>
            </div>
          )}
        </div>
        <footer>
          <button className="secondary-button" onClick={() => setEditor(null)}>
            Cancelar
          </button>
          <button className="primary-button compact" onClick={onSave}>
            Aplicar al borrador
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReadOnlyVersion({
  version,
  query,
  setQuery,
}: {
  version: Version;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <>
      <section className="editor-toolbar">
        <div>
          <input
            placeholder="Buscar por código o texto…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span>Vista de solo lectura</span>
        </div>
      </section>
      {version.demographics.length > 0 && (
        <details className="panel section-card" open>
          <summary>
            <span>
              <strong>1. Datos estadísticos</strong>
              <small>
                {version.demographics.length} campos previos · no son preguntas
                evaluables
              </small>
            </span>
            <b>+</b>
          </summary>
          <div className="question-admin-list">
            {version.demographics.map((field) => (
              <div className="question-admin-row" key={field.id ?? field.code}>
                <span className="question-kind">DATO</span>
                <div>
                  <strong>{field.code}</strong>
                  <p>
                    {field.label} ·{" "}
                    {field.required ? "Obligatorio" : "Opcional"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <section className="assessment-sections">
        {version.sections.map((section) =>
          isStatisticalControlSection(section, version.demographics) ? null : (
            <details className="panel section-card" key={section.id} open>
              <summary>
                <span>
                  <strong>
                    {section.order}. {section.name}
                  </strong>
                  <small>
                    {section.code} · {section.questions.length} preguntas
                  </small>
                </span>
                <b>+</b>
              </summary>
              <div className="question-admin-list">
                {section.questions
                  .filter((question) => matchesQuestion(question, query))
                  .map((question) => (
                    <div className="question-admin-row" key={question.id}>
                      <span
                        className={`question-kind ${question.type.toLowerCase()}`}
                      >
                        {question.type === "PAIR" ? "PAR" : "LIKERT"}
                      </span>
                      <div>
                        <strong>{question.code}</strong>
                        <p>{questionSummary(question)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          ),
        )}
      </section>
    </>
  );
}

function ValidationPanel({ validation }: { validation: Validation }) {
  return (
    <aside
      className={`validation-panel ${validation.valid ? "valid" : "invalid"}`}
    >
      <strong>
        {validation.valid
          ? "Validación correcta"
          : `${validation.errors.length} errores por corregir`}
      </strong>
      <p>
        Cobertura: {validation.coverage.rules}/{validation.coverage.reactives}{" "}
        afirmaciones con regla.
      </p>
      {validation.errors.length > 0 && (
        <ul>
          {validation.errors.slice(0, 10).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {validation.warnings.length > 0 && (
        <details>
          <summary>{validation.warnings.length} advertencias</summary>
          <ul>
            {validation.warnings.slice(0, 20).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

function patchReactiveScoring(
  value: PairQuestion,
  index: number,
  scoringPatch: Partial<Scoring>,
  patch: (next: Question) => void,
) {
  const current = value.reactives[index].scoring ?? {
    scaleCode: "",
    polarity: "POSITIVE" as Polarity,
    fixedWeight: 4,
    scoreIfMore: 4,
    scoreIfLess: 1,
  };
  const scoring = { ...current, ...scoringPatch };
  patch({
    ...value,
    reactives: value.reactives.map((reactive, candidate) =>
      candidate === index
        ? { ...reactive, scoring: scoring.scaleCode ? scoring : null }
        : reactive,
    ),
  });
}

function newPair(
  section: Section,
  number: number,
  scale?: Scale,
): PairQuestion {
  const code = `${section.code}_P${String(number).padStart(3, "0")}`;
  const scoring = scale
    ? {
        scaleCode: scale.code,
        polarity: "POSITIVE" as Polarity,
        fixedWeight: 4,
        scoreIfMore: 4,
        scoreIfLess: 1,
      }
    : null;
  return {
    type: "PAIR",
    code,
    order: number,
    required: true,
    reactives: [
      { code: `${code}_A`, text: "Primera afirmación", position: 1, scoring },
      {
        code: `${code}_B`,
        text: "Segunda afirmación",
        position: 2,
        scoring: scoring ? { ...scoring } : null,
      },
    ],
  };
}

function newLikert(section: Section, number: number): LikertQuestion {
  const code = `${section.code}_L${String(number).padStart(3, "0")}`;
  return {
    type: "LIKERT",
    code,
    order: number,
    required: true,
    text: "Nueva afirmación",
    optionSetCode: `${code}_OPTIONS`,
    scoringStatus: "PENDING_SCORING_SPEC",
    options: [1, 2, 3, 4, 5].map((value) => ({
      value,
      label: String(value),
      order: value,
    })),
  };
}

function summarize(version: Version | null) {
  if (!version)
    return {
      sections: 0,
      questions: 0,
      pairs: 0,
      reactives: 0,
      likert: 0,
      rules: 0,
    };
  const questions = version.sections.flatMap((section) => section.questions);
  const pairs = questions.filter(
    (question): question is PairQuestion => question.type === "PAIR",
  );
  return {
    sections: version.sections.length,
    questions: questions.length,
    pairs: pairs.length,
    reactives: pairs.reduce(
      (sum, question) => sum + question.reactives.length,
      0,
    ),
    likert: questions.filter(({ type }) => type === "LIKERT").length,
    rules: pairs.reduce(
      (sum, question) =>
        sum + question.reactives.filter(({ scoring }) => scoring).length,
      0,
    ),
  };
}

function toPayload(version: Version) {
  return {
    expectedUpdatedAt: version.updatedAt,
    language: version.language,
    intro: version.intro ?? undefined,
    estimatedMinutes: version.estimatedMinutes ?? undefined,
    demographics: version.demographics.map(
      ({ code, fieldKey, label, type, order, required, config }) => ({
        code,
        fieldKey,
        label,
        type,
        order,
        required,
        config: config ?? undefined,
      }),
    ),
    sections: version.sections.map((section, sectionIndex) => ({
      code: section.code,
      name: section.name,
      instructions: section.instructions ?? undefined,
      order: sectionIndex + 1,
      questions: section.questions.map((question, questionIndex) =>
        question.type === "PAIR"
          ? {
              type: "PAIR",
              code: question.code,
              order: questionIndex + 1,
              required: question.required,
              reactives: question.reactives.map(
                ({ code, text, position, scoring }) => ({
                  code,
                  text,
                  position,
                  scoring: scoring
                    ? {
                        scaleCode: scoring.scaleCode,
                        polarity: scoring.polarity,
                        fixedWeight: scoring.fixedWeight,
                        scoreIfMore: scoring.scoreIfMore,
                        scoreIfLess: scoring.scoreIfLess,
                      }
                    : undefined,
                }),
              ),
              options: [],
            }
          : {
              type: "LIKERT",
              code: question.code,
              order: questionIndex + 1,
              required: question.required,
              text: question.text,
              optionSetCode: question.optionSetCode,
              scoringStatus: question.scoringStatus,
              reactives: [],
              options: question.options.map(({ value, label }, index) => ({
                value,
                label,
                order: index + 1,
              })),
            },
      ),
    })),
  };
}

function questionSummary(question: Question) {
  return question.type === "PAIR"
    ? question.reactives.map(({ text }) => text).join(" · ")
    : question.text;
}
function isStatisticalControlSection(
  section: Section,
  demographics: Demographic[],
) {
  return (
    section.code === "DPO_STATISTICAL_CONTROL" &&
    section.questions.length === 0 &&
    demographics.length > 0
  );
}
function matchesQuestion(question: Question, query: string) {
  const value = query.trim().toLocaleLowerCase("es");
  return (
    !value ||
    `${question.code} ${questionSummary(question)}`
      .toLocaleLowerCase("es")
      .includes(value)
  );
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
function normalizeOrders<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}
function move<T extends { order: number }>(
  items: T[],
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return normalizeOrders(next);
}
function uniqueCode(base: string, existing: string[]) {
  let code = base;
  let suffix = 2;
  while (existing.includes(code)) code = `${base}_${suffix++}`;
  return code;
}
function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "No fue posible completar la operación.";
}
