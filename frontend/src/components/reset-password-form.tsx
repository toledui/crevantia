'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { resetPassword } from '@/lib/api';

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(token ? '' : 'El enlace no contiene un token válido.');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (password !== data.get('confirmPassword')) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try { setMessage((await resetPassword(token, password)).message); event.currentTarget.reset(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible actualizar la contraseña.'); }
    finally { setBusy(false); }
  }

  return <div className="auth-card">
    <span className="eyebrow dark">Nueva contraseña</span>
    <h2>Restablece tu contraseña</h2>
    <p className="lead">Utiliza al menos 10 caracteres, una mayúscula, una minúscula y un número.</p>
    <form onSubmit={submit}>
      <label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={10} required disabled={!token} /></label>
      <label>Confirmar contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required disabled={!token} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="primary-button" disabled={busy || !token}>{busy ? 'Actualizando…' : 'Actualizar contraseña'}<span>→</span></button>
    </form>
    <p className="switch-auth"><Link href="/iniciar-sesion">Ir a iniciar sesión</Link></p>
  </div>;
}

