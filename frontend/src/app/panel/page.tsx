import { Brand } from "@/components/brand";
import { SessionGate } from "@/components/session-gate";
import { UserAssessmentsPanel } from "@/components/user-assessments-panel";

export default function UserPanel() {
  return (
    <SessionGate area="client">
      <main className="user-panel">
        <Brand />
        <UserAssessmentsPanel />
      </main>
    </SessionGate>
  );
}
