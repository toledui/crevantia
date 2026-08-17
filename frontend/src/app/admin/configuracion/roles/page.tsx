import type { Metadata } from 'next';
import { RolesPermissionsPanel } from '@/components/roles-permissions-panel';

export const metadata: Metadata = { title: 'Roles y permisos' };
export default function RolesPage() { return <RolesPermissionsPanel/>; }
