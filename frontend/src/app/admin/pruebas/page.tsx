import type { Metadata } from 'next';
import { TestsAdminPanel } from '@/components/tests-admin-panel';

export const metadata: Metadata = { title: 'Pruebas y reactivos' };
export default function TestsPage() { return <TestsAdminPanel/>; }
