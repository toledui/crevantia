import type { Metadata } from 'next';
import { ReportSettingsPanel } from '@/components/site-settings-panel';

export const metadata: Metadata = { title: 'Configuración del reporte' };
export default function ReportSettingsPage() { return <ReportSettingsPanel />; }
