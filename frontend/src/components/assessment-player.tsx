"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ListChecks,
  Save,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Brand } from "./brand";

interface PairQuestion {
  id: string;
  code: string;
  order: number;
  required: boolean;
  type: "FORCED_CHOICE_PAIR";
  reactives: Array<{ id: string; text: string }>;
  answer: { selectedMoreReactiveId: string; version: number } | null;
}
interface LikertQuestion {
  id: string;
  code: string;
  order: number;
  required: boolean;
  type: "LIKERT_5";
  text: string;
  scoringStatus: string;
  options: Array<{ value: number; label: string }>;
  answer: { value: number; version: number } | null;
}
type Question = PairQuestion | LikertQuestion;
interface Demographic {
  id: string;
  code: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  config: {
    options?: string[];
    validation?: { min?: number; max?: number };
  } | null;
  answer: { value: unknown; version: number } | null;
}
interface Player {
  attempt: {
    id: string;
    status: string;
    currentProgress: { answered: number; required: number; percent: number };
  };
  intro: string | null;
  demographics: Demographic[];
  sections: Array<{
    id: string;
    code: string;
    name: string;
    instructions: string | null;
    questions: Question[];
  }>;
}
type Block =
  | { kind: "DEMOGRAPHIC"; section: string; item: Demographic }
  | {
      kind: "QUESTION";
      section: string;
      instructions: string | null;
      item: Question;
    };
type SaveState = "saved" | "saving" | "error" | "offline";
interface SectionGroup {
  name: string;
  entries: Array<{ block: Block; index: number }>;
  answered: number;
}

export function AssessmentPlayer({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [index, setIndex] = useState(0);
  const [demographicValues, setDemographicValues] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [introSection, setIntroSection] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const blocks = useMemo<Block[]>(
    () =>
      player
        ? [
            ...player.demographics.map((item) => ({
              kind: "DEMOGRAPHIC" as const,
              section: "Control estadístico",
              item,
            })),
            ...player.sections.flatMap((section) =>
              section.questions.map((item) => ({
                kind: "QUESTION" as const,
                section: section.name,
                instructions: section.instructions,
                item,
              })),
            ),
          ]
        : [],
    [player],
  );
  const block = blocks[index];
  const completedCount = blocks.filter(answered).length;
  const completionPercent = blocks.length
    ? Math.round((completedCount * 100) / blocks.length)
    : 0;
  const sectionGroups = useMemo<SectionGroup[]>(() => {
    const groups = new Map<string, SectionGroup>();
    blocks.forEach((entry, blockIndex) => {
      const group = groups.get(entry.section) ?? {
        name: entry.section,
        entries: [],
        answered: 0,
      };
      group.entries.push({ block: entry, index: blockIndex });
      if (answered(entry)) group.answered += 1;
      groups.set(entry.section, group);
    });
    return Array.from(groups.values());
  }, [blocks]);

  useEffect(() => {
    let active = true;
    apiFetch<Player>(`/attempts/${attemptId}/player`)
      .then((result) => {
        if (!active) return;
        setPlayer(result);
        setDemographicValues(
          Object.fromEntries(
            result.demographics.map((item) => [
              item.id,
              item.answer?.value === undefined || item.answer?.value === null
                ? ""
                : String(item.answer.value),
            ]),
          ),
        );
        const all: Block[] = [
          ...result.demographics.map(
            (item) =>
              ({
                kind: "DEMOGRAPHIC",
                section: "Control estadístico",
                item,
              }) as Block,
          ),
          ...result.sections.flatMap((section) =>
            section.questions.map(
              (item) =>
                ({
                  kind: "QUESTION",
                  section: section.name,
                  instructions: section.instructions,
                  item,
                }) as Block,
            ),
          ),
        ];
        const first = all.findIndex((entry) => !answered(entry));
        const initialIndex = first < 0 ? Math.max(all.length - 1, 0) : first;
        setIndex(initialIndex);
        if (all[initialIndex]) setIntroSection(all[initialIndex].section);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible abrir la evaluación.",
          );
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  useEffect(() => {
    const offline = () => setSaveState("offline");
    const online = () => setSaveState("saved");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  useEffect(() => {
    if (!introSection && !reviewing) headingRef.current?.focus();
  }, [index, introSection, reviewing]);

  useEffect(() => {
    if (!navigatorOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavigatorOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigatorOpen]);

  async function selectPair(question: PairQuestion, reactiveId: string) {
    setBusy(true);
    setSaveState("saving");
    setError("");
    try {
      const answer = await apiFetch<{
        selectedMoreReactiveId: string;
        version: number;
      }>(`/attempts/${attemptId}/answers/${question.id}`, {
        method: "PUT",
        body: JSON.stringify({
          selectedMoreReactiveId: reactiveId,
          operationId: crypto.randomUUID(),
          version: question.answer?.version,
        }),
      });
      updateQuestion(question.id, { ...question, answer });
      setSaveState("saved");
    } catch (reason) {
      setError(errorMessage(reason));
      setSaveState(window.navigator.onLine ? "error" : "offline");
    } finally {
      setBusy(false);
    }
  }

  async function selectLikert(question: LikertQuestion, value: number) {
    setBusy(true);
    setSaveState("saving");
    setError("");
    try {
      const answer = await apiFetch<{ value: number; version: number }>(
        `/attempts/${attemptId}/answers/${question.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value,
            operationId: crypto.randomUUID(),
            version: question.answer?.version,
          }),
        },
      );
      updateQuestion(question.id, { ...question, answer });
      setSaveState("saved");
    } catch (reason) {
      setError(errorMessage(reason));
      setSaveState(window.navigator.onLine ? "error" : "offline");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!block || !player) return;
    if (block.kind === "DEMOGRAPHIC") {
      const demographicValue = demographicValues[block.item.id] ?? "";
      if (block.item.required && !demographicValue.trim()) {
        setError("Este dato es obligatorio.");
        return;
      }
      const previousValue =
        block.item.answer?.value === undefined ||
        block.item.answer?.value === null
          ? ""
          : String(block.item.answer.value);
      if (demographicValue !== previousValue) {
        setBusy(true);
        setSaveState("saving");
        setError("");
        try {
          await apiFetch(`/attempts/${attemptId}/demographics`, {
            method: "PUT",
            body: JSON.stringify({
              answers: { [block.item.code]: demographicValue },
              operationId: crypto.randomUUID(),
            }),
          });
          setPlayer({
            ...player,
            demographics: player.demographics.map((item) =>
              item.id === block.item.id
                ? {
                    ...item,
                    answer: {
                      value: demographicValue,
                      version: (item.answer?.version ?? 0) + 1,
                    },
                  }
                : item,
            ),
          });
          setSaveState("saved");
        } catch (reason) {
          setError(errorMessage(reason));
          setSaveState(window.navigator.onLine ? "error" : "offline");
          setBusy(false);
          return;
        }
        setBusy(false);
      }
    } else if (!answered(block)) {
      setError("Selecciona una respuesta antes de continuar.");
      return;
    }
    if (index < blocks.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setError("");
      if (blocks[nextIndex].section !== block.section) {
        setIntroSection(blocks[nextIndex].section);
      }
    } else {
      setReviewing(true);
      setError("");
    }
  }

  async function finalize() {
    if (completedCount < blocks.length) {
      setError("Completa los reactivos pendientes antes de enviar.");
      return;
    }
    setBusy(true);
    setSaveState("saving");
    setError("");
    try {
      const result = await apiFetch<{ id: string }>(
        `/attempts/${attemptId}/submit`,
        { method: "POST" },
      );
      router.push(`/resultados/${result.id}`);
    } catch (reason) {
      setError(errorMessage(reason));
      setSaveState(window.navigator.onLine ? "error" : "offline");
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    setBusy(true);
    try {
      await apiFetch(`/attempts/${attemptId}/pause`, { method: "POST" });
      router.push("/panel");
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
    }
  }
  function updateQuestion(questionId: string, nextQuestion: Question) {
    if (!player) return;
    setPlayer({
      ...player,
      sections: player.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) =>
          question.id === questionId ? nextQuestion : question,
        ),
      })),
    });
  }
  function errorMessage(reason: unknown) {
    return reason instanceof Error
      ? reason.message
      : "No fue posible guardar la respuesta.";
  }

  function navigateTo(targetIndex: number) {
    setIndex(targetIndex);
    setNavigatorOpen(false);
    setIntroSection(null);
    setReviewing(false);
    setError("");
  }

  if (!player || !block)
    return (
      <main className="assessment-player loading">
        <Brand />
        <p>{error || "Preparando evaluación…"}</p>
      </main>
    );
  const currentGroup = sectionGroups.find(
    (group) => group.name === block.section,
  );
  const currentSectionPosition =
    (currentGroup?.entries.findIndex((entry) => entry.index === index) ?? 0) +
    1;
  const sectionInstructions = getSectionInstructions(player, introSection);
  const currentDemographicValue =
    block.kind === "DEMOGRAPHIC"
      ? (demographicValues[block.item.id] ?? "")
      : "";
  return (
    <main className="assessment-player">
      <header>
        <Brand />
        <div className="player-progress" aria-label="Progreso de la evaluación">
          <div className="player-progress-labels">
            <span>{block.section}</span>
            <small>
              {completedCount} de {blocks.length} respondidos
            </small>
          </div>
          <div
            className="player-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={blocks.length}
            aria-valuenow={completedCount}
          >
            <i style={{ width: `${completionPercent}%` }} />
          </div>
          <small>
            Reactivo {index + 1} de {blocks.length} · {completionPercent}%
            completado
          </small>
        </div>
        <div className="player-header-actions">
          <button
            type="button"
            className="secondary-button player-overview-button"
            aria-expanded={navigatorOpen}
            aria-controls="assessment-navigator"
            onClick={() => setNavigatorOpen(true)}
          >
            <ListChecks size={16} aria-hidden="true" /> Ver avance
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void pause()}
          >
            Guardar y salir
          </button>
        </div>
      </header>
      {introSection ? (
        <section className="player-card player-section-intro">
          <span className="eyebrow dark">Siguiente sección</span>
          <h1 ref={headingRef} tabIndex={-1}>
            {introSection}
          </h1>
          <p>{sectionInstructions}</p>
          <div className="section-intro-summary">
            <div>
              <strong>{currentGroup?.entries.length ?? 0}</strong>
              <span>reactivos en esta sección</span>
            </div>
            <div>
              <Save size={20} aria-hidden="true" />
              <span>Tus respuestas se guardan automáticamente.</span>
            </div>
          </div>
          <footer>
            <span>Puedes pausar y continuar más tarde.</span>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => setIntroSection(null)}
            >
              Comenzar sección <ChevronRight size={17} aria-hidden="true" />
            </button>
          </footer>
        </section>
      ) : reviewing ? (
        <section className="player-card player-review-card">
          <span className="eyebrow dark">Revisión final</span>
          <h1 ref={headingRef} tabIndex={-1}>
            Tu evaluación está lista para enviarse
          </h1>
          <p>
            Verifica el avance por sección. Después de enviarla ya no podrás
            modificar tus respuestas.
          </p>
          <div className="review-total">
            <CheckCircle2 size={28} aria-hidden="true" />
            <div>
              <strong>
                {completedCount} de {blocks.length} reactivos respondidos
              </strong>
              <span>{completionPercent}% de la evaluación completada</span>
            </div>
          </div>
          <div className="review-sections">
            {sectionGroups.map((group) => (
              <button
                type="button"
                key={group.name}
                onClick={() =>
                  navigateTo(
                    group.entries.find((entry) => !answered(entry.block))
                      ?.index ?? group.entries[0].index,
                  )
                }
              >
                <span>
                  <strong>{group.name}</strong>
                  <small>
                    {group.answered} de {group.entries.length} respondidos
                  </small>
                </span>
                {group.answered === group.entries.length ? (
                  <CheckCircle2 size={21} aria-label="Sección completa" />
                ) : (
                  <ChevronRight size={21} aria-label="Revisar sección" />
                )}
              </button>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setReviewing(false);
                setIndex(blocks.length - 1);
              }}
            >
              Volver al último reactivo
            </button>
            <span className={`save-status ${saveState}`} aria-live="polite">
              {saveStatusLabel(saveState)}
            </span>
            <button
              type="button"
              className="primary-button compact"
              disabled={busy || completedCount < blocks.length}
              onClick={() => void finalize()}
            >
              Enviar evaluación
            </button>
          </footer>
        </section>
      ) : (
        <section className="player-card">
          <div className="player-question-meta">
            <span className="eyebrow dark">{block.section}</span>
            <span>
              {currentSectionPosition} de {currentGroup?.entries.length ?? 0} en
              esta sección
            </span>
          </div>
          {block.kind === "DEMOGRAPHIC" ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                {block.item.label}
              </h1>
              <p>
                Esta información se usa únicamente para control estadístico.
              </p>
              <DemographicInput
                field={block.item}
                value={currentDemographicValue}
                onChange={(value) =>
                  setDemographicValues((current) => ({
                    ...current,
                    [block.item.id]: value,
                  }))
                }
              />
            </>
          ) : block.item.type === "FORCED_CHOICE_PAIR" ? (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                ¿Con cuál afirmación te identificas más?
              </h1>
              <p>{block.instructions}</p>
              <div
                className="pair-options"
                role="radiogroup"
                aria-label="Selecciona la afirmación con la que más te identificas"
              >
                {block.item.reactives.map((reactive) => {
                  const selected =
                    (block.item.answer as PairQuestion["answer"])
                      ?.selectedMoreReactiveId === reactive.id;
                  const oppositeSelected =
                    Boolean(block.item.answer) && !selected;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={busy}
                      className={
                        selected
                          ? "selected-more"
                          : oppositeSelected
                            ? "selected-less"
                            : ""
                      }
                      key={reactive.id}
                      onClick={() =>
                        void selectPair(block.item as PairQuestion, reactive.id)
                      }
                    >
                      <strong>{reactive.text}</strong>
                      <span>
                        {selected
                          ? "Me identifico más"
                          : oppositeSelected
                            ? "Me identifico menos"
                            : "Seleccionar como “Más”"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 ref={headingRef} tabIndex={-1}>
                {block.item.text}
              </h1>
              <p>
                Indica qué tan falsa o verdadera es esta afirmación para ti.
              </p>
              <div
                className="likert-options"
                role="radiogroup"
                aria-label="Selecciona qué tan verdadera es la afirmación"
              >
                {block.item.options.map((option) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={
                      (block.item.answer as LikertQuestion["answer"])?.value ===
                      option.value
                    }
                    disabled={busy}
                    className={
                      (block.item.answer as LikertQuestion["answer"])?.value ===
                      option.value
                        ? "selected"
                        : ""
                    }
                    key={option.value}
                    onClick={() =>
                      void selectLikert(
                        block.item as LikertQuestion,
                        option.value,
                      )
                    }
                  >
                    <strong>{option.value}</strong>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <aside>
                La calificación de Gestión de recursos permanece pendiente de
                especificación oficial.
              </aside>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button
              className="secondary-button"
              disabled={!index || busy}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
            >
              Anterior
            </button>
            <span className={`save-status ${saveState}`} aria-live="polite">
              {saveStatusLabel(saveState)}
            </span>
            <button
              className="primary-button compact"
              disabled={
                busy || (!answered(block) && block.kind !== "DEMOGRAPHIC")
              }
              onClick={() => void next()}
            >
              {index === blocks.length - 1
                ? "Revisar y finalizar"
                : "Siguiente"}
            </button>
          </footer>
        </section>
      )}
      {navigatorOpen && (
        <>
          <button
            type="button"
            className="player-navigator-backdrop"
            aria-label="Cerrar resumen de avance"
            onClick={() => setNavigatorOpen(false)}
          />
          <aside
            className="player-navigator"
            id="assessment-navigator"
            aria-label="Resumen de avance"
          >
            <header>
              <div>
                <span className="eyebrow dark">Tu avance</span>
                <h2>
                  {completedCount} de {blocks.length} respondidos
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar resumen de avance"
                onClick={() => setNavigatorOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="navigator-legend">
              <span>
                <Check size={13} aria-hidden="true" /> Respondido
              </span>
              <span>
                <Circle size={10} aria-hidden="true" /> Pendiente
              </span>
            </div>
            <div className="navigator-sections">
              {sectionGroups.map((group) => (
                <details key={group.name} open={group.name === block.section}>
                  <summary>
                    <span>{group.name}</span>
                    <small>
                      {group.answered}/{group.entries.length}
                    </small>
                  </summary>
                  <div className="navigator-question-grid">
                    {group.entries.map((entry, groupIndex) => (
                      <button
                        type="button"
                        key={`${group.name}-${entry.index}`}
                        className={`${answered(entry.block) ? "answered" : "pending"} ${entry.index === index ? "current" : ""}`}
                        aria-label={`${group.name}, reactivo ${groupIndex + 1}, ${answered(entry.block) ? "respondido" : "pendiente"}`}
                        aria-current={
                          entry.index === index ? "step" : undefined
                        }
                        onClick={() => navigateTo(entry.index)}
                      >
                        {answered(entry.block) ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          groupIndex + 1
                        )}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

function answered(block: Block) {
  return Boolean(block.item.answer);
}

function getSectionInstructions(player: Player, section: string | null) {
  if (!section) return "";
  if (section === "Control estadístico") {
    return (
      player.intro ??
      "Completa estos datos para dar contexto estadístico a tus resultados."
    );
  }
  return (
    player.sections.find((entry) => entry.name === section)?.instructions ??
    "Responde con calma y elige la opción que mejor te represente."
  );
}

function saveStatusLabel(state: SaveState) {
  if (state === "saving") return "Guardando…";
  if (state === "error") return "No se pudo guardar";
  if (state === "offline") return "Sin conexión";
  return "Todo guardado";
}

function DemographicInput({
  field,
  value,
  onChange,
}: {
  field: Demographic;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field.config?.options;
  if (options?.length)
    return (
      <select
        className="demographic-input"
        value={value}
        aria-label={field.label}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecciona una opción</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    );
  return (
    <input
      className="demographic-input"
      value={value}
      aria-label={field.label}
      onChange={(event) => onChange(event.target.value)}
      type={
        field.type === "INTEGER"
          ? "number"
          : field.type === "EMAIL"
            ? "email"
            : field.type === "PHONE"
              ? "tel"
              : "text"
      }
      min={field.config?.validation?.min}
      max={field.config?.validation?.max}
      autoFocus
    />
  );
}
