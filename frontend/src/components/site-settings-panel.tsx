'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch, apiUpload } from '@/lib/api';

interface Category { label: string; description: string; color: string }
interface Mapping { targetType: string; targetCode: string; displayName: string; section?: string }
interface TextBlock { key: string; title: string; content: string; sourcePage?: number; section?: string }
interface ReportSettings {
  version: number; reportDefaultsVersion: number; reportLogoUrl: string;
  reportBrandName: string | null; reportPromoTitle: string | null; reportPromoText: string | null;
  reportPromoUrl: string | null; reportIntroduction: string | null; reportInterpretation: string | null;
  reportCategories: Category[]; reportDisplayMappings: Mapping[]; reportTextBlocks: TextBlock[];
  updatedAt: string | null;
}

const empty: ReportSettings = {
  version: 1, reportDefaultsVersion: 0, reportLogoUrl: '/branding/logo-crevantia.png',
  reportBrandName: null, reportPromoTitle: null, reportPromoText: null, reportPromoUrl: null,
  reportIntroduction: null, reportInterpretation: null,
  reportCategories: [], reportDisplayMappings: [], reportTextBlocks: [], updatedAt: null,
};

const optionalKeys = ['reportBrandName', 'reportPromoTitle', 'reportPromoText', 'reportPromoUrl', 'reportIntroduction', 'reportInterpretation'] as const;

export function ReportSettingsPanel() {
  const [data, setData] = useState<ReportSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<ReportSettings>('/admin/settings/report').then(setData).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar la configuración del reporte.')).finally(() => setLoading(false));
  }, []);

  function field<K extends keyof ReportSettings>(key: K, value: ReportSettings[K]) { setData((current) => ({ ...current, [key]: value })); }

  async function uploadReportLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData(); body.append('file', file);
    setUploading(true); setError(''); setMessage('');
    try {
      const updated = await apiUpload<ReportSettings>('/admin/settings/report/logo', body);
      setData(updated); setMessage('Logotipo del reporte actualizado.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible subir la imagen.'); }
    finally { setUploading(false); event.target.value = ''; }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const payload: Record<string, unknown> = { reportCategories: data.reportCategories, reportDisplayMappings: data.reportDisplayMappings, reportTextBlocks: data.reportTextBlocks };
    for (const key of optionalKeys) payload[key] = data[key]?.trim() || undefined;
    try {
      const updated = await apiFetch<ReportSettings>('/admin/settings/report', { method: 'PATCH', body: JSON.stringify(payload) });
      setData(updated); setMessage('Configuración del reporte publicada correctamente.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar la configuración.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="settings-content"><div className="panel settings-card">Cargando configuración del reporte…</div></div>;

  return <div className="settings-content settings-section">
    <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
    <section className="welcome"><div><span className="eyebrow dark">Documento final</span><h1>Configuración del reporte</h1><p>Administra de forma independiente el logotipo, marca, contenidos y nombres que utilizará el PDF.</p></div><span className="settings-status enabled">Versión {data.version}</span></section>
    <form onSubmit={save} className="site-settings-form">
      <section className="panel settings-card">
        <div className="settings-section-head"><div><h2>Identidad visual del reporte</h2><p>Este logotipo es exclusivo del PDF y puede ser distinto al del sitio web.</p></div></div>
        <div className="site-assets-grid single"><AssetUpload title="Logotipo del reporte" help="Valor inicial: logo Crevantia de assets. PNG, JPG o WebP." src={data.reportLogoUrl} busy={uploading} onChange={(event) => void uploadReportLogo(event)} /></div>
        <div className="settings-section-head"><div><h2>Marca y promoción</h2><p>Estos textos reemplazan las referencias fijas a PsicoFinanzas y Prospera.</p></div></div>
        <div className="settings-grid two-columns">
          <TextField label="Marca que aparecerá en el reporte" value={data.reportBrandName} onChange={(v) => field('reportBrandName', v)} />
          <TextField label="Título del programa o promoción" value={data.reportPromoTitle} onChange={(v) => field('reportPromoTitle', v)} />
          <TextField label="Enlace de la promoción" type="url" value={data.reportPromoUrl} placeholder="https://..." onChange={(v) => field('reportPromoUrl', v)} />
          <label>Texto de promoción<textarea rows={4} value={data.reportPromoText ?? ''} onChange={(e) => field('reportPromoText', e.target.value)} /></label>
        </div>
        <label className="settings-wide-label">Introducción general del reporte<textarea rows={7} value={data.reportIntroduction ?? ''} onChange={(e) => field('reportIntroduction', e.target.value)} /></label>
        <label className="settings-wide-label">Texto general de interpretación<textarea rows={7} value={data.reportInterpretation ?? ''} onChange={(e) => field('reportInterpretation', e.target.value)} /></label>
      </section>

      <section className="panel settings-card">
        <RepeaterHeader title="Categorías interpretativas" copy="Define nombre, color y significado de Brisa, Viento, Ráfaga, Huracán o las categorías que decidas." onAdd={() => field('reportCategories', [...data.reportCategories, { label: '', description: '', color: '#302b78' }])} />
        <div className="settings-repeater">{data.reportCategories.map((category, index) => <div className="settings-repeat-row category-row" key={`${index}-${category.label}`}>
          <input aria-label={`Nombre de categoría ${index + 1}`} placeholder="Nombre" value={category.label} onChange={(e) => field('reportCategories', data.reportCategories.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} />
          <input type="color" aria-label={`Color de categoría ${index + 1}`} value={category.color} onChange={(e) => field('reportCategories', data.reportCategories.map((item, i) => i === index ? { ...item, color: e.target.value } : item))} />
          <textarea aria-label={`Descripción de categoría ${index + 1}`} placeholder="Descripción" rows={2} value={category.description} onChange={(e) => field('reportCategories', data.reportCategories.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
          <IconButton label="Eliminar categoría" onClick={() => field('reportCategories', data.reportCategories.filter((_, i) => i !== index))} />
        </div>)}</div>
      </section>

      <section className="panel settings-card">
        <RepeaterHeader title="Nombres visibles de resultados" copy="Relaciona cada código técnico actual con el nombre y la sección que verá el cliente." onAdd={() => field('reportDisplayMappings', [...data.reportDisplayMappings, { targetType: 'SCALE', targetCode: '', displayName: '', section: '' }])} />
        <div className="settings-repeater">{data.reportDisplayMappings.map((mapping, index) => <div className="settings-repeat-row mapping-row" key={index}>
          <select aria-label={`Tipo de resultado ${index + 1}`} value={mapping.targetType} onChange={(e) => field('reportDisplayMappings', data.reportDisplayMappings.map((item, i) => i === index ? { ...item, targetType: e.target.value } : item))}><option value="SCALE">Escala</option><option value="COMPOSITE">Compuesto</option><option value="DERIVED_METRIC">Métrica derivada</option><option value="LIKERT_DIMENSION">Dimensión Likert</option><option value="REPORT_ALIAS">Alias del reporte</option></select>
          <input aria-label={`Código técnico ${index + 1}`} placeholder="Código actual" value={mapping.targetCode} onChange={(e) => field('reportDisplayMappings', data.reportDisplayMappings.map((item, i) => i === index ? { ...item, targetCode: e.target.value } : item))} />
          <input aria-label={`Nombre visible ${index + 1}`} placeholder="Nombre visible" value={mapping.displayName} onChange={(e) => field('reportDisplayMappings', data.reportDisplayMappings.map((item, i) => i === index ? { ...item, displayName: e.target.value } : item))} />
          <input aria-label={`Sección ${index + 1}`} placeholder="Sección" value={mapping.section ?? ''} onChange={(e) => field('reportDisplayMappings', data.reportDisplayMappings.map((item, i) => i === index ? { ...item, section: e.target.value } : item))} />
          <IconButton label="Eliminar correspondencia" onClick={() => field('reportDisplayMappings', data.reportDisplayMappings.filter((_, i) => i !== index))} />
        </div>)}</div>
      </section>

      <section className="panel settings-card">
        <RepeaterHeader title={`Bloques editoriales extensos (${data.reportTextBlocks.length})`} copy="El reporte provisional completo está precargado en el orden de sus 63 páginas, incluidos portada, capítulos, glosario y nota final." onAdd={() => field('reportTextBlocks', [...data.reportTextBlocks, { key: '', title: '', content: '' }])} />
        <div className="settings-repeater">{data.reportTextBlocks.map((block, index) => <details className="settings-text-block" key={block.key || index} open={index === 0}><summary><span>{block.title || `Bloque ${index + 1}`}</span>{block.section && <small>{block.section}</small>}</summary><div className="settings-grid two-columns"><input aria-label={`Clave del bloque ${index + 1}`} placeholder="Clave, ej. toma-de-decisiones" value={block.key} onChange={(e) => field('reportTextBlocks', data.reportTextBlocks.map((item, i) => i === index ? { ...item, key: e.target.value } : item))} /><input aria-label={`Título del bloque ${index + 1}`} placeholder="Título visible" value={block.title} onChange={(e) => field('reportTextBlocks', data.reportTextBlocks.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /></div><textarea aria-label={`Contenido del bloque ${index + 1}`} placeholder="Contenido completo" rows={14} value={block.content} onChange={(e) => field('reportTextBlocks', data.reportTextBlocks.map((item, i) => i === index ? { ...item, content: e.target.value } : item))} /><IconButton label="Eliminar bloque" onClick={() => field('reportTextBlocks', data.reportTextBlocks.filter((_, i) => i !== index))} /></details>)}</div>
      </section>

      <div className="settings-sticky-actions"><span>{data.updatedAt ? `Última publicación: ${new Date(data.updatedAt).toLocaleString('es-MX')}` : 'Aún no se ha publicado una personalización.'}</span><button className="primary-button compact" disabled={saving || Boolean(uploading)}>{saving ? 'Publicando…' : 'Guardar y publicar configuración'}</button></div>
    </form>
  </div>;
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | null; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label>{label}<input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function RepeaterHeader({ title, copy, onAdd }: { title: string; copy: string; onAdd: () => void }) { return <div className="settings-section-head"><div><h2>{title}</h2><p>{copy}</p></div><button type="button" className="secondary-button compact" onClick={onAdd}><Plus size={15} /> Agregar</button></div>; }
function IconButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" className="icon-danger-button" aria-label={label} title={label} onClick={onClick}><Trash2 size={16} /></button>; }
function AssetUpload({ title, help, src, busy, onChange, compact = false }: { title: string; help: string; src: string; busy: boolean; compact?: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="site-asset">
    <div className={compact ? 'asset-preview compact' : 'asset-preview'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Vista previa: ${title}`} />
    </div>
    <div><strong>{title}</strong><small>{help}</small><label className="secondary-button compact"><Upload size={15} /> {busy ? 'Subiendo…' : 'Seleccionar archivo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon" disabled={busy} onChange={onChange} hidden /></label></div>
  </div>;
}
