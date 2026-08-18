'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch } from '@/lib/api';

interface StripeSettings {
  enabled: boolean;
  mode: 'test' | 'live';
  publishableKey: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  updatedAt: string | null;
}

export function StripeSettingsPanel() {
  const [settings, setSettings] = useState<StripeSettings>({
    enabled: false,
    mode: 'test',
    publishableKey: '',
    hasSecretKey: false,
    hasWebhookSecret: false,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch<StripeSettings>('/admin/settings/stripe')
      .then((data) => {
        if (mounted) setSettings(data);
      })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : 'No fue posible cargar la configuración de Stripe.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setTestResult(null);

    const form = new FormData(e.currentTarget);
    const enabled = form.get('enabled') === 'on';
    const mode = String(form.get('mode') || 'test') as 'test' | 'live';
    const publishableKey = String(form.get('publishableKey') || '').trim();
    const secretKey = String(form.get('secretKey') || '').trim();
    const webhookSecret = String(form.get('webhookSecret') || '').trim();

    try {
      const updated = await apiFetch<StripeSettings>('/admin/settings/stripe', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          mode,
          publishableKey,
          secretKey: secretKey || undefined,
          webhookSecret: webhookSecret || undefined,
        }),
      });
      setSettings(updated);
      setMessage('Configuración de Stripe guardada correctamente.');
      if (formRef.current) {
        const secretInput = formRef.current.querySelector<HTMLInputElement>('input[name="secretKey"]');
        const webhookInput = formRef.current.querySelector<HTMLInputElement>('input[name="webhookSecret"]');
        if (secretInput) secretInput.value = '';
        if (webhookInput) webhookInput.value = '';
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setError('');
    setMessage('');
    setTestResult(null);

    try {
      const res = await apiFetch<{ success: boolean; message: string; mode: string }>('/admin/settings/stripe/test', {
        method: 'POST',
      });
      setTestResult({ success: true, message: res.message });
      setMessage(res.message);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : 'Falló la conexión con la API de Stripe.';
      setTestResult({ success: false, message: msg });
      setError(msg);
    } finally {
      setTesting(false);
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host.replace(':3000', ':4000')}/api/v1/webhooks/stripe`
    : 'https://tu-dominio.com/api/v1/webhooks/stripe';

  return (
    <div className="settings-content settings-section">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      <section className="welcome">
        <div>
          <span className="eyebrow dark">Pasarela de Pago</span>
          <h1>Configuración de Stripe</h1>
          <p>Permite a los usuarios comprar evaluaciones psicométricas de forma segura con tarjeta de crédito o débito.</p>
        </div>
        <span
          className={`settings-status ${settings.enabled ? 'enabled' : ''}`}
        >
          {settings.enabled
            ? `Stripe activo (${settings.mode === 'live' ? 'Producción' : 'Pruebas'})`
            : 'Stripe deshabilitado'}
        </span>
      </section>

      {loading ? (
        <div className="panel settings-card">Cargando configuración de Stripe…</div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          <form ref={formRef} className="panel settings-card" onSubmit={save}>
            <div className="settings-section-head">
              <div>
                <h2>Credenciales y Entorno</h2>
                <p>Las claves secretas se cifran con AES-256-GCM antes de guardarse en base de datos.</p>
              </div>
              <label className="toggle">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={settings.enabled}
                />
                <span />
                Habilitar Stripe
              </label>
            </div>

            <div className="settings-grid">
              <label>
                Modo de operación
                <select name="mode" defaultValue={settings.mode}>
                  <option value="test">Modo Pruebas (Sandbox / Test)</option>
                  <option value="live">Modo Producción (Live)</option>
                </select>
              </label>

              <label className="wide">
                Clave pública de Stripe (Publishable Key)
                <input
                  name="publishableKey"
                  defaultValue={settings.publishableKey}
                  placeholder="pk_test_51..."
                  required
                />
              </label>

              <label className="wide">
                Clave secreta de Stripe (Secret Key)
                <input
                  name="secretKey"
                  type="password"
                  placeholder={
                    settings.hasSecretKey
                      ? '•••••••••••••••••••••••••••••• (Clave secreta guardada)'
                      : 'sk_test_51...'
                  }
                  autoComplete="new-password"
                />
              </label>

              <label className="wide">
                Secreto del Webhook (Signing Secret)
                <input
                  name="webhookSecret"
                  type="password"
                  placeholder={
                    settings.hasWebhookSecret
                      ? '•••••••••••••••••••••••••••••• (Secreto de webhook guardado)'
                      : 'whsec_...'
                  }
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="settings-actions">
              <button
                type="button"
                className="secondary-button compact"
                onClick={handleTestConnection}
                disabled={testing || saving || !settings.hasSecretKey}
              >
                {testing ? 'Verificando con Stripe…' : 'Probar conexión con Stripe'}
              </button>

              <button className="primary-button compact" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </form>

          {/* Webhook Guide Card */}
          <section className="panel settings-card">
            <div className="settings-section-head">
              <div>
                <h2>Configuración de Webhooks en Stripe</h2>
                <p>Configura este endpoint en tu Dashboard de Stripe para confirmar pagos y asignaciones en tiempo real de forma asíncrona.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '14px', marginTop: '10px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#5f6877', marginBottom: '6px', textTransform: 'uppercase' }}>
                  URL de Endpoint para el Webhook:
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px 8px 16px',
                    background: '#f8fafc',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: '#1e293b',
                  }}
                >
                  <code style={{ flex: 1, wordBreak: 'break-all', color: '#0f172a', fontWeight: 600 }}>{webhookUrl}</code>
                  <button
                    type="button"
                    className="secondary-button compact"
                    style={{ minHeight: '36px', padding: '0 16px', whiteSpace: 'nowrap', fontSize: '12px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setMessage('URL del Webhook copiada al portapapeles.');
                    }}
                  >
                    📋 Copiar URL
                  </button>
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#5f6877', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Eventos requeridos a escuchar en Stripe:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="status-badge published">checkout.session.completed</span>
                  <span className="status-badge published">charge.refunded</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
