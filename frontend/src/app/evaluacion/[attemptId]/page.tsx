import { AssessmentPlayer } from "@/components/assessment-player";
import { SessionGate } from "@/components/session-gate";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return (
    <SessionGate area="client">
      <AssessmentPlayer attemptId={attemptId} />
    </SessionGate>
  );
}
