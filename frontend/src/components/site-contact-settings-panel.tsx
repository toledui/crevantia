'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch, apiUpload } from '@/lib/api';

interface SiteContactSettings {
  version: number; reportDefaultsVersion: number; siteName: string; siteDescription: string; logoUrl: string; faviconUrl: string;
  contactEmail: string | null; contactPhone: string | null; contactWhatsapp: string | null;
  contactAddress: string | null; contactHours: string | null; contactMapUrl: string | null; updatedAt: string | null;
}

const initial: SiteContactSettings = { version: 1, reportDefaultsVersion: 0, siteName: 'Crevantia', siteDescription: 'Plataforma de evaluaciones Crevantia', logoUrl: '/branding/logo-crevantia.png', faviconUrl: '/branding/logo-crevantia.png', contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null, contactHours: null, contactMapUrl: null, updatedAt: null };
const optional = ['contactEmail', 'contactPhone', 'contactWhatsapp', 'contactAddress', 'contactHours', 'contactMapUrl'] as const;

export function SiteContactSettingsPanel() {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { apiFetch<SiteContactSettings>('/admin/settings/site').then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar la configuración.')).finally(() => setLoading(false)); }, []);
  function field<K extends keyof SiteContactSettings>(key: K, value: SiteContactSettings[K]) { setData((current) => ({ ...current, [key]: value })); }

  async function upload(kind: 'logo' | 'favicon', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const body = new FormData(); body.append('file', file); setUploading(kind); setError(''); setMessage('');
    try { setData(await apiUpload<SiteContactSettings>(`/admin/settings/site/assets/${kind}`, body)); setMessage(`${kind === 'logo' ? 'Logotipo del sitio' : 'Favicon'} actualizado.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible subir la imagen.'); }
    finally { setUploading(null); event.target.value = ''; }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const payload: Record<string, unknown> = { siteName: data.siteName, siteDescription: data.siteDescription };
    for (const key of optional) payload[key] = data[key]?.trim() || undefined;
    try { setData(await apiFetch<SiteContactSettings>('/admin/settings/site', { method: 'PATCH', body: JSON.stringify(payload) })); setMessage('Sitio e información de contacto publicados correctamente.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar la configuración.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="settings-content"><div className="panel settings-card">Cargando sitio y contacto…</div></div>;
  return <div className="settings-content settings-section">
    <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
    <section className="welcome"><div><span className="eyebrow dark">Presencia digital</span><h1>Sitio y contacto</h1><p>Administra la identidad pública, los metadatos y los canales de atención.</p></div><span className="settings-status enabled">Versión {data.version}</span></section>
    <form className="site-settings-form" onSubmit={save}>
      <section className="panel settings-card"><div className="settings-section-head"><div><h2>Identidad del sitio web</h2><p>El logotipo se utiliza en navegación y accesos. El favicon identifica la pestaña del navegador.</p></div></div>
        <div className="site-assets-grid"><AssetUpload title="Logotipo del sitio" help="PNG, JPG o WebP. Valor inicial: logo de assets." src={data.logoUrl} busy={uploading === 'logo'} onChange={(event) => void upload('logo', event)} /><AssetUpload title="Favicon" help="PNG, JPG, WebP o ICO. Recomendado: formato cuadrado." src={data.faviconUrl} busy={uploading === 'favicon'} compact onChange={(event) => void upload('favicon', event)} /></div>
        <div className="settings-grid two-columns"><label>Nombre del sitio<input required maxLength={120} value={data.siteName} onChange={(e) => field('siteName', e.target.value)} /></label><label>Descripción del sitio<textarea required maxLength={500} rows={3} value={data.siteDescription} onChange={(e) => field('siteDescription', e.target.value)} /></label></div>
      </section>
      <section className="panel settings-card"><div className="settings-section-head"><div><h2>Información de contacto</h2><p>Los campos completados se muestran automáticamente en la sección de contacto de la página inicial.</p></div></div>
        <div className="settings-grid two-columns"><TextField label="Correo" type="email" value={data.contactEmail} onChange={(value) => field('contactEmail', value)} /><TextField label="Teléfono" value={data.contactPhone} onChange={(value) => field('contactPhone', value)} /><TextField label="WhatsApp" value={data.contactWhatsapp} placeholder="5215512345678" onChange={(value) => field('contactWhatsapp', value)} /><TextField label="Horario de atención" value={data.contactHours} onChange={(value) => field('contactHours', value)} /><label>Dirección<textarea rows={3} value={data.contactAddress ?? ''} onChange={(e) => field('contactAddress', e.target.value)} /></label><TextField label="Enlace de mapa" type="url" value={data.contactMapUrl} placeholder="https://maps.google.com/..." onChange={(value) => field('contactMapUrl', value)} /></div>
      </section>
      <div className="settings-sticky-actions"><span>{data.updatedAt ? `Última publicación: ${new Date(data.updatedAt).toLocaleString('es-MX')}` : 'Configuración inicial'}</span><button className="primary-button compact" disabled={saving || Boolean(uploading)}>{saving ? 'Publicando…' : 'Guardar sitio y contacto'}</button></div>
    </form>
  </div>;
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | null; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label>{label}<input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function AssetUpload({ title, help, src, busy, onChange, compact = false }: { title: string; help: string; src: string; busy: boolean; compact?: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="site-asset"><div className={compact ? 'asset-preview compact' : 'asset-preview'}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={`Vista previa: ${title}`} />
  </div><div><strong>{title}</strong><small>{help}</small><label className="secondary-button compact"><Upload size={15} /> {busy ? 'Subiendo…' : 'Seleccionar archivo'}<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon" disabled={busy} onChange={onChange} /></label></div></div>;
}
