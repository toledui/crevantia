'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Code2, ShieldAlert } from 'lucide-react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch } from '@/lib/api';

interface CustomCodeSettings { version: number; headCode: string | null; bodyEndCode: string | null; updatedAt: string | null }

export function CustomCodeSettingsPanel() {
  const [data, setData] = useState<CustomCodeSettings>({ version: 1, headCode: null, bodyEndCode: null, updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<CustomCodeSettings>('/admin/settings/custom-code').then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar los códigos.')).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    try {
      const updated = await apiFetch<CustomCodeSettings>('/admin/settings/custom-code', { method: 'PATCH', body: JSON.stringify({ headCode: data.headCode?.trim() || undefined, bodyEndCode: data.bodyEndCode?.trim() || undefined }) });
      setData(updated); setMessage('Códigos personalizados publicados. Se aplicarán al cargar nuevamente cualquier página.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar los códigos.'); }
    finally { setSaving(false); }
  }

  return <div className="settings-content settings-section">
    <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
    <section className="welcome"><div><span className="eyebrow dark">Integraciones avanzadas</span><h1>Códigos personalizados</h1><p>Inserta widgets, analítica o botones flotantes sin modificar el código fuente del sitio.</p></div><span className="settings-status enabled">Versión {data.version}</span></section>
    {loading ? <div className="panel settings-card">Cargando códigos personalizados…</div> : <form className="site-settings-form" onSubmit={save}>
      <section className="panel settings-card danger-zone-soft">
        <div className="custom-code-warning"><ShieldAlert size={22} /><div><strong>Acceso exclusivo de superadministrador</strong><p>Estos fragmentos se ejecutan en todas las páginas. Verifica siempre su origen, privacidad, accesibilidad y efecto en el rendimiento.</p></div></div>
        <div className="settings-section-head"><div><h2><Code2 size={20} /> Código dentro de &lt;head&gt;</h2><p>Ideal para etiquetas de verificación, estilos, analítica y scripts que deban cargarse globalmente.</p></div></div>
        <label className="settings-wide-label">Fragmento HTML o JavaScript<textarea className="code-input" spellCheck={false} rows={14} value={data.headCode ?? ''} onChange={(e) => setData((current) => ({ ...current, headCode: e.target.value }))} placeholder={'<script src="https://..."></script>'} /></label>
      </section>
      <section className="panel settings-card danger-zone-soft">
        <div className="settings-section-head"><div><h2><Code2 size={20} /> Código al final de &lt;body&gt;</h2><p>Úsalo para widgets, chats, botones flotantes u otros elementos que deban aparecer después del contenido.</p></div></div>
        <label className="settings-wide-label">Fragmento HTML o JavaScript<textarea className="code-input" spellCheck={false} rows={18} value={data.bodyEndCode ?? ''} onChange={(e) => setData((current) => ({ ...current, bodyEndCode: e.target.value }))} placeholder="<!-- widget, botón flotante o script -->" /></label>
      </section>
      <div className="settings-sticky-actions"><span>{data.updatedAt ? `Última publicación: ${new Date(data.updatedAt).toLocaleString('es-MX')}` : 'Aún no se han publicado códigos personalizados.'}</span><button className="primary-button compact" disabled={saving}>{saving ? 'Publicando…' : 'Guardar y publicar códigos'}</button></div>
    </form>}
  </div>;
}
