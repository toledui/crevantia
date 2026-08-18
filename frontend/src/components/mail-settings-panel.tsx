'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AdminToast } from '@/components/admin-toast';
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
  const formRef = useRef<HTMLFormElement>(null);
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
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
    const passwordVal = data.get('password');
    const payload = {
      enabled: data.get('enabled') === 'on',
      host: String(data.get('host') || '').trim(),
      port: Number(data.get('port')),
      secure: data.get('secure') === 'on',
      username: String(data.get('username') || '').trim(),
      fromName: String(data.get('fromName') || '').trim(),
      fromAddress: String(data.get('fromAddress') || '').trim().toLowerCase(),
      ...(passwordVal ? { password: String(passwordVal) } : {}),
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
    if (!testEmail) return;
    setTesting(true); setMessage(''); setError('');

    let payload: Record<string, unknown> = { email: testEmail.trim() };
    if (formRef.current) {
      const data = new FormData(formRef.current);
      const host = String(data.get('host') || '').trim();
      const port = Number(data.get('port'));
      const secure = data.get('secure') === 'on';
      const username = String(data.get('username') || '').trim();
      const password = String(data.get('password') || '');
      const fromName = String(data.get('fromName') || '').trim();
      const fromAddress = String(data.get('fromAddress') || '').trim().toLowerCase();

      payload = {
        email: testEmail.trim(),
        ...(host ? { host } : {}),
        ...(port ? { port } : {}),
        secure,
        username,
        ...(password ? { password } : {}),
        ...(fromName ? { fromName } : {}),
        ...(fromAddress ? { fromAddress } : {}),
      };
    }

    try {
      const result = await apiFetch<{ message: string }>('/admin/settings/mail/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'La prueba SMTP falló.');
    } finally {
      setTesting(false);
    }
  }

  return <div className="settings-content settings-section">
    <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
    <section className="welcome"><div><span className="eyebrow dark">Comunicaciones</span><h1>Servidor de correo SMTP</h1><p>Configura el envío de confirmaciones, recuperación de contraseña y notificaciones.</p></div><span className={`settings-status ${settings.enabled ? 'enabled' : ''}`}>{settings.enabled ? 'Servicio habilitado' : 'Servicio deshabilitado'}</span></section>
    {loading ? <div className="panel settings-card">Cargando configuración…</div> : <form ref={formRef} className="panel settings-card" onSubmit={save}>
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
      <div className="settings-divider"/>
      <div className="settings-section-head"><div><h2>Prueba real de envío</h2><p>Puedes probar con los datos actuales del formulario o los guardados. Enviaremos un mensaje real usando estos datos SMTP.</p></div></div>
      <div className="settings-grid two-columns mail-test-grid"><label>Correo destinatario de prueba<input name="testEmail" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="destino@example.com"/></label><div className="mail-test-action"><button type="button" className="secondary-button" onClick={() => void test()} disabled={testing || !testEmail}>{testing ? 'Enviando prueba…' : 'Enviar correo de prueba'}</button></div></div>
      <div className="settings-actions"><button className="primary-button compact" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button></div>
    </form>}
  </div>;
}
