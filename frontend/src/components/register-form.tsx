'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { register } from '@/lib/api';

export function RegisterForm() {
  const [message, setMessage] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    setMessage('');
    setAccountCreated(false);
    const data = new FormData(form);
    if (data.get('password') !== data.get('confirmPassword')) {
      setError('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    try {
      const result = await register({
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        email: data.get('email'),
        password: data.get('password'),
        termsAccepted: data.get('termsAccepted') === 'on',
        privacyAccepted: data.get('privacyAccepted') === 'on',
      });
      setMessage(result.deliveryStatus === 'SENT'
        ? 'Cuenta creada. Enviamos un enlace a tu correo; debes confirmarlo antes de iniciar sesión.'
        : 'Cuenta creada, pero el correo no pudo enviarse. Solicita un nuevo enlace cuando SMTP esté configurado.');
      setAccountCreated(true);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card register-card">
      <span className="eyebrow dark">Nueva cuenta</span><h2>Crea tu cuenta</h2>
      <p className="lead">Completa solo los datos necesarios para comenzar.</p>
      <form onSubmit={submit}>
        <div className="field-grid"><label>Nombre<input name="firstName" required minLength={2} /></label><label>Apellidos<input name="lastName" required minLength={2} /></label></div>
        <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
        <div className="field-grid"><label>Contraseña<input name="password" type="password" minLength={10} required /></label><label>Confirmar contraseña<input name="confirmPassword" type="password" minLength={10} required /></label></div>
        <label className="check consent"><input name="termsAccepted" type="checkbox" required /> Acepto los términos de uso.</label>
        <label className="check consent"><input name="privacyAccepted" type="checkbox" required /> Acepto el aviso de privacidad.</label>
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
        {accountCreated && <p className="switch-auth">¿No recibiste el mensaje? <Link href="/verificar-correo">Reenviar enlace de confirmación</Link></p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear mi cuenta'}<span>→</span></button>
      </form>
      <p className="switch-auth">¿Ya tienes una cuenta? <Link href="/iniciar-sesion">Iniciar sesión</Link></p>
    </div>
  );
}
