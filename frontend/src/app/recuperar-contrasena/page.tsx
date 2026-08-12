import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
export const metadata: Metadata = { title: 'Recuperar contraseña' };
export default function ForgotPasswordPage() { return <AuthShell><ForgotPasswordForm /></AuthShell>; }

