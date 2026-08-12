import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';
export const metadata: Metadata = { title: 'Iniciar sesión' };
export default function LoginPage() { return <AuthShell><LoginForm /></AuthShell>; }

