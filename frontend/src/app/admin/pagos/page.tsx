import type { Metadata } from 'next';
import { CommerceAdminPanel } from '@/components/commerce-admin-panel';

export const metadata: Metadata = { title: 'Pagos y Catálogo Comercial · Crevantia' };

export default function PaymentsPage() {
  return <CommerceAdminPanel />;
}
