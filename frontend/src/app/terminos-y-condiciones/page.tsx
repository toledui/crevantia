import type { Metadata } from 'next';
import { LegalDocumentViewer } from '@/components/legal-document-viewer';

export const metadata: Metadata = {
  title: 'Términos y Condiciones de Uso · Crevantia',
  description: 'Términos y condiciones legales para el uso de la plataforma de evaluación psicométrica Crevantia.',
};

export default function TermsPage() {
  return <LegalDocumentViewer type="TERMS_AND_CONDITIONS" />;
}
