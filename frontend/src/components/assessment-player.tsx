"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export function AssessmentPlayer({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [index, setIndex] = useState(0);
  const [demographicValues, setDemographicValues] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        setIndex(first < 0 ? Math.max(all.length - 1, 0) : first);
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

  async function selectPair(question: PairQuestion, reactiveId: string) {
    setBusy(true);
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
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function selectLikert(question: LikertQuestion, value: number) {
    setBusy(true);
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
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!block || !player) return;
    if (block.kind === "DEMOGRAPHIC" && !block.item.answer) {
      const demographicValue = demographicValues[block.item.id] ?? "";
      if (block.item.required && !demographicValue.trim()) {
        setError("Este dato es obligatorio.");
        return;
      }
      setBusy(true);
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
              ? { ...item, answer: { value: demographicValue, version: 1 } }
              : item,
          ),
        });
      } catch (reason) {
        setError(errorMessage(reason));
        setBusy(false);
        return;
      }
      setBusy(false);
    } else if (!answered(block)) {
      setError("Selecciona una respuesta antes de continuar.");
      return;
    }
    if (index < blocks.length - 1) setIndex((value) => value + 1);
    else await finalize();
  }

  async function finalize() {
    if (
      !window.confirm(
        "¿Confirmas el envío final? Después no podrás modificar tus respuestas.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch<{ id: string }>(
        `/attempts/${attemptId}/submit`,
        { method: "POST" },
      );
      router.push(`/resultados/${result.id}`);
    } catch (reason) {
      setError(errorMessage(reason));
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

  if (!player || !block)
    return (
      <main className="assessment-player loading">
        <Brand />
        <p>{error || "Preparando evaluación…"}</p>
      </main>
    );
  const progress = Math.round(
    ((index + (answered(block) ? 1 : 0)) * 100) / blocks.length,
  );
  const currentDemographicValue =
    block.kind === "DEMOGRAPHIC"
      ? (demographicValues[block.item.id] ?? "")
      : "";
  return (
    <main className="assessment-player">
      <header>
        <Brand />
        <div className="player-progress">
          <span>{block.section}</span>
          <div>
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>
            {index + 1} de {blocks.length} · {progress}%
          </small>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void pause()}
        >
          Guardar y salir
        </button>
      </header>
      <section className="player-card">
        <span className="eyebrow dark">{block.section}</span>
        {block.kind === "DEMOGRAPHIC" ? (
          <>
            <h1>{block.item.label}</h1>
            <p>Esta información se usa únicamente para control estadístico.</p>
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
            <h1>¿Con cuál afirmación te identificas más?</h1>
            <p>{block.instructions}</p>
            <div className="pair-options">
              {block.item.reactives.map((reactive) => {
                const selected =
                  (block.item.answer as PairQuestion["answer"])
                    ?.selectedMoreReactiveId === reactive.id;
                const oppositeSelected =
                  Boolean(block.item.answer) && !selected;
                return (
                  <button
                    type="button"
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
            <h1>{block.item.text}</h1>
            <p>Indica qué tan falsa o verdadera es esta afirmación para ti.</p>
            <div className="likert-options">
              {block.item.options.map((option) => (
                <button
                  type="button"
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
          <span>Guardado automático</span>
          <button
            className="primary-button compact"
            disabled={
              busy || (!answered(block) && block.kind !== "DEMOGRAPHIC")
            }
            onClick={() => void next()}
          >
            {index === blocks.length - 1 ? "Finalizar" : "Siguiente"}
          </button>
        </footer>
      </section>
    </main>
  );
}

function answered(block: Block) {
  return Boolean(block.item.answer);
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
