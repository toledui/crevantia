import { ResultSummary } from "@/components/result-summary";
import { SessionGate } from "@/components/session-gate";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  return (
    <SessionGate area="client">
      <ResultSummary resultId={resultId} />
    </SessionGate>
  );
}
