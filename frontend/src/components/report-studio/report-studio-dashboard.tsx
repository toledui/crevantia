'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FilePlus2, LayoutTemplate, Link2, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import styles from '@/app/admin/report-studio/page.module.css';

interface CatalogItem { id: string; code: string; name: string }
interface Catalog { tests: CatalogItem[]; assessments: CatalogItem[]; themes: CatalogItem[] }
interface TemplateLink { test: CatalogItem; assessment: CatalogItem | null; isDefault: boolean; isActive: boolean }
interface TemplateVersion { id: string; version: string; status: string; pendingBindings: number; updatedAt: string }
interface Template { id: string; code: string; name: string; description?: string | null; status: string; testLinks: TemplateLink[]; versions: TemplateVersion[] }

const initialForm = { name: '', code: '', description: '', testId: '', assessmentId: '', themeId: '', cloneFromVersionId: '', pageSize: 'LETTER' as 'LETTER' | 'A4' };

export function ReportStudioDashboard() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ tests: [], assessments: [], themes: [] });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  async function load() {
    const [items, options] = await Promise.all([apiFetch<Template[]>('/admin/report-studio/templates'), apiFetch<Catalog>('/admin/report-studio/catalog')]);
    setTemplates(items); setCatalog(options);
  }

  useEffect(() => {
    let active = true;
    Promise.all([apiFetch<Template[]>('/admin/report-studio/templates'), apiFetch<Catalog>('/admin/report-studio/catalog')])
      .then(([items, options]) => { if (active) { setTemplates(items); setCatalog(options); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'No fue posible cargar Report Studio.'); });
    return () => { active = false; };
  }, []);
  const cloneOptions = useMemo(() => templates.flatMap((template) => template.versions.map((version) => ({ id: version.id, label: `${template.name} · ${version.version}` }))), [templates]);

  function openCreate() {
    setForm({ ...initialForm, testId: catalog.tests[0]?.id ?? '', assessmentId: catalog.assessments[0]?.id ?? '', themeId: catalog.themes[0]?.id ?? '' });
    setError(''); setCreating(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const created = await apiFetch<Template>('/admin/report-studio/templates', { method: 'POST', body: JSON.stringify({ ...form, assessmentId: form.assessmentId || undefined, themeId: form.themeId || undefined, cloneFromVersionId: form.cloneFromVersionId || undefined }) });
      setCreating(false); await load();
      const versionId = created.versions[0]?.id;
      if (versionId) router.push(`/admin/report-studio/${versionId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible crear el reporte.'); }
    finally { setSaving(false); }
  }

  return <div className={`admin-content ${styles.page}`}>
    <section className="welcome"><div><span className="eyebrow dark">Diseño editorial</span><h1>Report Studio</h1><p>Crea, vincula, versiona y publica el reporte específico de cada prueba.</p></div><button type="button" className="primary-button compact" onClick={openCreate}><Plus size={16}/> Nuevo reporte</button></section>
    {error && !creating && <div className={styles.errorBanner}>{error}</div>}
    <section className={styles.summary} aria-label="Resumen de Report Studio"><div><LayoutTemplate/><span><b>{templates.length}</b> plantillas</span></div><div><Link2/><span><b>{templates.filter((item) => item.testLinks.length).length}</b> vinculadas</span></div><div><FilePlus2/><span><b>{templates.filter((item) => item.versions.some((version) => version.status === 'PUBLISHED')).length}</b> publicadas</span></div></section>
    <section className={styles.templateGrid} aria-label="Plantillas de reporte">
      {templates.map((template) => { const version = template.versions[0]; const link = template.testLinks[0]; return <article className={`panel ${styles.templateCard}`} key={template.id}>
        <div className={styles.cardTop}><span className={styles.icon}><LayoutTemplate/></span><span className={`${styles.status} ${version?.status === 'PUBLISHED' ? styles.published : ''}`}>{version?.status ?? template.status}</span></div>
        <div className={styles.cardBody}><span className={styles.kicker}>{template.code}</span><h2>{template.name}</h2><p>{template.description || 'Plantilla editorial configurable.'}</p></div>
        <div className={styles.linkInfo}>{link ? <><Link2/><span><b>{link.test.name}</b>{link.assessment ? ` · ${link.assessment.name}` : ' · Cualquier evaluación compatible'}</span></> : <><Link2/><span className={styles.unlinked}>Sin prueba vinculada</span></>}</div>
        <div className={styles.cardFooter}><span className={version?.pendingBindings ? styles.pending : styles.ready}>{version?.pendingBindings ? `${version.pendingBindings} datos opcionales sin vincular` : 'Lista para publicar'}</span>{version && <Link className={`primary-button compact ${styles.action}`} href={`/admin/report-studio/${version.id}`}>Abrir <ArrowRight/></Link>}</div>
      </article>; })}
      {!templates.length && <button type="button" className={styles.emptyCard} onClick={openCreate}><Plus/><b>Crear el primer reporte</b><span>Empieza en blanco o clona una plantilla existente.</span></button>}
    </section>
    {creating && <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}><form className={styles.modal} onSubmit={submit}>
      <div className={styles.modalHead}><div><span className="eyebrow dark">Nueva plantilla</span><h2>Crear reporte</h2><p>La asociación define qué reporte se utilizará al finalizar cada prueba.</p></div><button type="button" aria-label="Cerrar" onClick={() => setCreating(false)}><X/></button></div>
      <div className={styles.formGrid}>
        <label>Nombre del reporte<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, code: form.code || event.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') })}/></label>
        <label>Código<input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}/></label>
        <label className={styles.wide}>Descripción<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label>
        <label>Prueba<select required value={form.testId} onChange={(event) => setForm({ ...form, testId: event.target.value })}><option value="">Selecciona una prueba</option>{catalog.tests.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}</select></label>
        <label>Evaluación de resultados<select value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })}><option value="">Cualquier evaluación compatible</option>{catalog.assessments.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}</select></label>
        <label>Base<select value={form.cloneFromVersionId} onChange={(event) => setForm({ ...form, cloneFromVersionId: event.target.value })}><option value="">Plantilla en blanco</option>{cloneOptions.map((item) => <option value={item.id} key={item.id}>Clonar {item.label}</option>)}</select></label>
        <label>Tamaño<select value={form.pageSize} onChange={(event) => setForm({ ...form, pageSize: event.target.value as 'LETTER' | 'A4' })}><option value="LETTER">Letter</option><option value="A4">A4</option></select></label>
        <label className={styles.wide}>Tema visual<select value={form.themeId} onChange={(event) => setForm({ ...form, themeId: event.target.value })}><option value="">Tema predeterminado</option>{catalog.themes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      </div>
      {error && <p className={styles.modalError}>{error}</p>}
      <div className={styles.modalActions}><button type="button" className="secondary-button compact" onClick={() => setCreating(false)}>Cancelar</button><button disabled={saving || !form.testId} className="primary-button compact">{saving ? 'Creando…' : 'Crear y abrir editor'}</button></div>
    </form></div>}
  </div>;
}
