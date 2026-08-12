'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { forgotPassword } from '@/lib/api';

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const email = String(new FormData(event.currentTarget).get('email'));
    try { setMessage((await forgotPassword(email)).message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible procesar la solicitud.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-card">
    <span className="eyebrow dark">Recuperación segura</span>
    <h2>Recupera tu acceso</h2>
    <p className="lead">Escribe tu correo. Si existe una cuenta, enviaremos un enlace válido durante 60 minutos.</p>
    <form onSubmit={submit}>
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Enviando…' : 'Enviar instrucciones'}<span>→</span></button>
    </form>
    <p className="switch-auth"><Link href="/iniciar-sesion">Volver a iniciar sesión</Link></p>
  </div>;
}

