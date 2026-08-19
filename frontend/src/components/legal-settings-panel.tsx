'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, FileText, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';

interface LegalDoc {
  id: string;
  type: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY';
  title: string;
  content: string;
  version: string;
  updatedBy?: string | null;
  updatedAt?: string;
}

export function LegalSettingsPanel() {
  const [activeType, setActiveType] = useState<'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY'>('TERMS_AND_CONDITIONS');
  const [terms, setTerms] = useState<LegalDoc | null>(null);
  const [privacy, setPrivacy] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Current Form State
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');
  const [content, setContent] = useState('');

  useEffect(() => {
    let mounted = true;
    apiFetch<{ terms: LegalDoc; privacy: LegalDoc }>('/admin/legal')
      .then((res) => {
        if (mounted && res) {
          setTerms(res.terms);
          setPrivacy(res.privacy);
          const current = activeType === 'TERMS_AND_CONDITIONS' ? res.terms : res.privacy;
          if (current) {
            setTitle(current.title);
            setVersion(current.version || '1.0');
            setContent(current.content);
          }
        }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Error al cargar los documentos legales.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function handleTabChange(type: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY') {
    setActiveType(type);
    const target = type === 'TERMS_AND_CONDITIONS' ? terms : privacy;
    if (target) {
      setTitle(target.title);
      setVersion(target.version || '1.0');
      setContent(target.content);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await apiFetch<LegalDoc>('/admin/legal', {
        method: 'PUT',
        body: JSON.stringify({
          type: activeType,
          title: title.trim(),
          content: content.trim(),
          version: version.trim(),
        }),
      });

      if (activeType === 'TERMS_AND_CONDITIONS') {
        setTerms(updated);
      } else {
        setPrivacy(updated);
      }

      setMessage(`Documento "${updated.title}" guardado y publicado exitosamente.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <strong>Cargando configuración de términos y privacidad…</strong>
      </div>
    );
  }

  const publicUrl =
    activeType === 'TERMS_AND_CONDITIONS' ? '/terminos-y-condiciones' : '/politica-de-privacidad';

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow dark" style={{ margin: 0 }}>Documentos Legales</span>
          <h2 style={{ fontSize: '22px', color: 'var(--night)', letterSpacing: '-0.03em', margin: '4px 0 0' }}>
            Términos de Uso y Política de Privacidad
          </h2>
        </div>

        <Link
          href={publicUrl}
          target="_blank"
          className="secondary-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 14px' }}
        >
          <ExternalLink size={14} /> Ver página pública
        </Link>
      </div>

      {/* Type Switcher */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => handleTabChange('TERMS_AND_CONDITIONS')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: activeType === 'TERMS_AND_CONDITIONS' ? 'var(--indigo)' : '#f1f5f9',
            color: activeType === 'TERMS_AND_CONDITIONS' ? '#ffffff' : '#475569',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={15} /> Términos y Condiciones
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('PRIVACY_POLICY')}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: activeType === 'PRIVACY_POLICY' ? 'var(--indigo)' : '#f1f5f9',
            color: activeType === 'PRIVACY_POLICY' ? '#ffffff' : '#475569',
            transition: 'all 0.2s ease',
          }}
        >
          <ShieldCheck size={15} /> Política de Privacidad
        </button>
      </div>

      {/* Editor Form */}
      <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#687386' }}>
            Título del Documento
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                background: 'white',
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#687386' }}>
            Versión
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              required
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                background: 'white',
                textAlign: 'center',
              }}
            />
          </label>
        </div>

        {/* Content Editor with Side-by-side or Tabbed preview */}
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#687386' }}>
          Contenido Oficial (Markdown soportado)
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            required
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              lineHeight: '1.6',
              fontFamily: 'monospace',
              background: '#fcfcfd',
              resize: 'vertical',
            }}
          />
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            disabled={saving}
            className="primary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
          >
            <Save size={16} /> {saving ? 'Guardando…' : 'Guardar y Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}
