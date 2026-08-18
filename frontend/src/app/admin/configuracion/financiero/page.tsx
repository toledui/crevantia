import type { Metadata } from 'next';
import { FinancialSettingsPanel } from '@/components/financial-settings-panel';

export const metadata: Metadata = { title: 'Finanzas e Impuestos · Configuración' };

export default function FinancialSettingsPage() {
  return <FinancialSettingsPanel />;
}
