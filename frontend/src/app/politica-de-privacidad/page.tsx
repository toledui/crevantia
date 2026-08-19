import type { Metadata } from 'next';
import { LegalDocumentViewer } from '@/components/legal-document-viewer';

export const metadata: Metadata = {
  title: 'Política de Privacidad y Protección de Datos · Crevantia',
  description: 'Política de privacidad, tratamiento confidencial de reactivos y protección de datos personales de Crevantia.',
};

export default function PrivacyPage() {
  return <LegalDocumentViewer type="PRIVACY_POLICY" />;
}
