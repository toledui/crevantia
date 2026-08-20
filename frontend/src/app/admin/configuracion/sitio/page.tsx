import type { Metadata } from 'next';
import { SiteContactSettingsPanel } from '@/components/site-contact-settings-panel';

export const metadata: Metadata = { title: 'Sitio y contacto · Configuración' };
export default function SiteSettingsPage() { return <SiteContactSettingsPanel />; }
