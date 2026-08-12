import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { VerifyEmailCard } from '@/components/verify-email-card';
export const metadata: Metadata = { title: 'Verificar correo' };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return <AuthShell><VerifyEmailCard token={token} /></AuthShell>;
}

