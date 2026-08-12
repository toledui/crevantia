'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError, currentUser, login } from '@/lib/api';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    currentUser()
      .then((user) => {
        if (!active) return;
        router.replace(user.roles.some((role) => role === 'ADMIN' || role === 'SUPERADMIN') ? '/admin' : '/panel');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (!(reason instanceof ApiError) || reason.status !== 401) {
          setError('No fue posible comprobar la sesión. Puedes iniciar sesión manualmente.');
        }
        setCheckingSession(false);
      });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const user = await login(String(data.get('email')), String(data.get('password')));
      router.push(user.roles.some((role) => role === 'ADMIN' || role === 'SUPERADMIN') ? '/admin' : '/panel');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión.');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-card">
      <span className="eyebrow dark">Acceso seguro</span>
      <h2>Bienvenido de nuevo</h2>
      <p className="lead">{checkingSession ? 'Comprobando tu sesión…' : 'Ingresa tus datos para continuar en Crevantia.'}</p>
      <form onSubmit={submit}>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required disabled={checkingSession} /></label>
        <label>Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required disabled={checkingSession} /></label>
        <div className="form-row"><label className="check"><input type="checkbox" /> Recordarme</label><Link href="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy || checkingSession}>{checkingSession ? 'Comprobando sesión…' : busy ? 'Ingresando…' : 'Iniciar sesión'}<span>→</span></button>
      </form>
      <p className="switch-auth">¿Aún no tienes cuenta? <Link href="/registro">Crear una cuenta</Link></p>
    </div>
  );
}
