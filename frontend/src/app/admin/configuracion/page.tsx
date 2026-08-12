import type { Metadata } from 'next';
import { MailSettingsPanel } from '@/components/mail-settings-panel';
export const metadata: Metadata = { title: 'Configuración SMTP' };
export default function SettingsPage() { return <MailSettingsPanel />; }

