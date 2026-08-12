import { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { SessionGate } from '@/components/session-gate';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <SessionGate area="admin"><AdminShell>{children}</AdminShell></SessionGate>;
}
