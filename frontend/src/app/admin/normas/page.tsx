import type { Metadata } from "next";
import { NormsAdminPanel } from "@/components/norms-admin-panel";

export const metadata: Metadata = { title: "Normas y baremos" };
export default function NormsPage() {
  return <NormsAdminPanel />;
}
