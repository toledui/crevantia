'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromName: string;
  fromAddress: string;
  updatedAt: string | null;
}

const emptySettings: MailSettings = { enabled: false, host: '', port: 587, secure: false, username: '', hasPassword: false, fromName: 'Crevantia', fromAddress: '', updatedAt: null };

export function MailSettingsPanel() {
  const router = useRouter();
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<MailSettings>('/admin/settings/mail')
      .then(setSettings)
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) {
          router.push('/iniciar-sesion');
          return;
        }
        setError(reason instanceof Error ? reason.message : 'No fue posible cargar la configuración.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      enabled: data.get('enabled') === 'on', host: data.get('host'), port: Number(data.get('port')),
      secure: data.get('secure') === 'on', username: data.get('username'), fromName: data.get('fromName'), fromAddress: data.get('fromAddress'),
      ...(data.get('password') ? { password: data.get('password') } : {}),
    };
    try {
      const updated = await apiFetch<MailSettings>('/admin/settings/mail', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(updated); setMessage('Configuración SMTP guardada de forma segura.');
      const passwordInput = form.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar la configuración.'); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true); setMessage(''); setError('');
    try { setMessage((await apiFetch<{ message: string }>('/admin/settings/mail/test', { method: 'POST' })).message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'La prueba SMTP falló.'); }
    finally { setTesting(false); }
  }

  return <div className="settings-content settings-section">
    <section className="welcome"><div><span className="eyebrow dark">Comunicaciones</span><h1>Servidor de correo SMTP</h1><p>Configura el envío de confirmaciones, recuperación de contraseña y notificaciones.</p></div><span className={`settings-status ${settings.enabled ? 'enabled' : ''}`}>{settings.enabled ? 'Servicio habilitado' : 'Servicio deshabilitado'}</span></section>
    {loading ? <div className="panel settings-card">Cargando configuración…</div> : <form className="panel settings-card" onSubmit={save}>
      <div className="settings-section-head"><div><h2>Conexión SMTP</h2><p>La contraseña se cifra antes de almacenarse y nunca vuelve al navegador.</p></div><label className="toggle"><input name="enabled" type="checkbox" defaultChecked={settings.enabled}/><span/>Habilitar envío</label></div>
      <div className="settings-grid">
        <label className="wide">Servidor SMTP<input name="host" defaultValue={settings.host} placeholder="smtp.example.com" required/></label>
        <label>Puerto<input name="port" type="number" min="1" max="65535" defaultValue={settings.port} required/></label>
        <div className="toggle-field"><span>Conexión segura</span><label className="toggle"><input name="secure" type="checkbox" defaultChecked={settings.secure}/><span/>SSL/TLS directo</label></div>
        <label>Usuario<input name="username" defaultValue={settings.username} autoComplete="off" placeholder="usuario@example.com"/></label>
        <label>Contraseña<input name="password" type="password" autoComplete="new-password" placeholder={settings.hasPassword ? 'Guardada · deja vacío para conservar' : 'Contraseña SMTP'}/></label>
      </div>
      <div className="settings-divider"/>
      <div className="settings-section-head"><div><h2>Remitente</h2><p>Identidad visible en los mensajes enviados por Crevantia.</p></div></div>
      <div className="settings-grid two-columns"><label>Nombre del remitente<input name="fromName" defaultValue={settings.fromName} required/></label><label>Correo del remitente<input name="fromAddress" type="email" defaultValue={settings.fromAddress} placeholder="no-reply@example.com" required/></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
      <div className="settings-actions"><button type="button" className="secondary-button" onClick={() => void test()} disabled={testing || !settings.enabled}>{testing ? 'Probando…' : 'Probar conexión y envío'}</button><button className="primary-button compact" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button></div>
    </form>}
  </div>;
}
