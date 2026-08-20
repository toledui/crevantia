import type { Metadata } from 'next';
import { CustomCodeSettingsPanel } from '@/components/custom-code-settings-panel';

export const metadata: Metadata = { title: 'Códigos personalizados · Configuración' };
export default function CustomCodeSettingsPage() { return <CustomCodeSettingsPanel />; }
