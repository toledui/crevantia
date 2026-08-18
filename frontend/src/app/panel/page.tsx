import { SessionGate } from "@/components/session-gate";
import { UserPanelContainer } from "@/components/user-panel-container";

export default function UserPanel() {
  return (
    <SessionGate area="client">
      <UserPanelContainer />
    </SessionGate>
  );
}
