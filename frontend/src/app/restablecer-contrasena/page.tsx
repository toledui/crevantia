import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/reset-password-form';
export const metadata: Metadata = { title: 'Restablecer contraseña' };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <AuthShell><ResetPasswordForm token={token} /></AuthShell>;
}

