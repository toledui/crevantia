import type { Metadata } from 'next';
import { UsersAdminPanel } from '@/components/users-admin-panel';

export const metadata: Metadata = { title: 'Usuarios' };
export default function UsersPage() { return <UsersAdminPanel/>; }
