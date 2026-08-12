'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { resendVerification, verifyEmail } from '@/lib/api';

export function VerifyEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? 'Estamos confirmando tu correo…' : 'El enlace no contiene un token válido.');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then((result) => { setState('success'); setMessage(result.message); })
      .catch((reason: unknown) => { setState('error'); setMessage(reason instanceof Error ? reason.message : 'No fue posible verificar el correo.'); });
  }, [token]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setResending(true);
    try { setMessage((await resendVerification(email)).message); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No fue posible reenviar el enlace.'); }
    finally { setResending(false); }
  }

  return <div className="auth-card">
    <span className="eyebrow dark">Confirmación de cuenta</span>
    <h2>{state === 'success' ? 'Correo confirmado' : 'Verifica tu correo'}</h2>
    <p className={state === 'success' ? 'form-success' : state === 'error' ? 'form-error' : 'lead'} role="status">{message}</p>
    {state === 'error' && <form onSubmit={resend} className="resend-form">
      <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <button className="primary-button" disabled={resending}>{resending ? 'Reenviando…' : 'Reenviar enlace'}<span>→</span></button>
    </form>}
    <p className="switch-auth"><Link href="/iniciar-sesion">Ir a iniciar sesión</Link></p>
  </div>;
}

