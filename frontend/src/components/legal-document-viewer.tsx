'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, Clock, ArrowLeft } from 'lucide-react';
import { HomeNavbar } from '@/components/home-navbar';
import { apiFetch } from '@/lib/api';
import styles from '@/app/home.module.css';

interface LegalDoc {
  id: string;
  type: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY';
  title: string;
  content: string;
  version: string;
  updatedAt?: string;
}

interface Props {
  type: 'TERMS_AND_CONDITIONS' | 'PRIVACY_POLICY';
}

function LogoLight() {
  return (
    <Image
      className={`${styles.logo} ${styles.logoLight}`}
      src="/branding/logo-crevantia.png"
      alt="Crevantia"
      width={1600}
      height={416}
    />
  );
}

export function LegalDocumentViewer({ type }: Props) {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const endpoint = type === 'TERMS_AND_CONDITIONS' ? '/legal/terms' : '/legal/privacy';
    apiFetch<LegalDoc>(endpoint)
      .then((res) => {
        if (mounted && res) setDoc(res);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Error al cargar el documento.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [type]);

  const isTerms = type === 'TERMS_AND_CONDITIONS';

  return (
    <div className={styles.page} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <HomeNavbar />

      <main style={{ flex: '1 0 auto', padding: '48px 0 80px' }}>
        <div className={styles.container}>
          {/* Breadcrumb / Back Link */}
          <div style={{ marginBottom: '24px' }}>
            <Link
              href="/"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          </div>

          {loading ? (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '60px 40px',
                textAlign: 'center',
                border: '1px solid var(--line)',
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)',
              }}
            >
              <p style={{ color: '#64748b', margin: 0, fontWeight: 500 }}>Cargando documento oficial…</p>
            </div>
          ) : error ? (
            <div
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '40px',
                textAlign: 'center',
                border: '1px solid #fca5a5',
              }}
            >
              <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            </div>
          ) : doc ? (
            <article
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                padding: '48px 40px',
                boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
                border: '1px solid var(--line)',
              }}
            >
              {/* Header Badge & Title */}
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '24px', marginBottom: '32px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '14px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      background: isTerms ? '#ede9fe' : '#dcfce7',
                      color: isTerms ? '#6d28d9' : '#15803d',
                      padding: '5px 12px',
                      borderRadius: '8px',
                    }}
                  >
                    {isTerms ? <FileText size={13} /> : <ShieldCheck size={13} />}
                    Documento Oficial Crevantia
                  </span>

                  <span
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={13} /> Versión {doc.version}
                  </span>

                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 'auto' }}>
                    Última actualización:{' '}
                    {doc.updatedAt
                      ? new Date(doc.updatedAt).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '18 de agosto de 2026'}
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: '32px',
                    fontWeight: 800,
                    color: 'var(--night)',
                    letterSpacing: '-0.03em',
                    margin: '8px 0 0',
                    lineHeight: '1.25',
                  }}
                >
                  {doc.title}
                </h1>
              </div>

              {/* Formatted Markdown Content */}
              <div
                style={{
                  fontSize: '15px',
                  lineHeight: '1.85',
                  color: '#334155',
                  display: 'grid',
                  gap: '16px',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                }}
              >
                {doc.content}
              </div>

              {/* Bottom Quick Navigation */}
              <div
                style={{
                  marginTop: '48px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Link
                    href="/terminos-y-condiciones"
                    style={{
                      fontSize: '13px',
                      fontWeight: isTerms ? 700 : 500,
                      color: isTerms ? 'var(--indigo)' : '#64748b',
                      textDecoration: 'none',
                    }}
                  >
                    Términos y Condiciones
                  </Link>
                  <span style={{ color: '#cbd5e1' }}>·</span>
                  <Link
                    href="/politica-de-privacidad"
                    style={{
                      fontSize: '13px',
                      fontWeight: !isTerms ? 700 : 500,
                      color: !isTerms ? 'var(--indigo)' : '#64748b',
                      textDecoration: 'none',
                    }}
                  >
                    Política de Privacidad
                  </Link>
                </div>

                <Link
                  href="/registro"
                  className={`${styles.button} ${styles.buttonCyan}`}
                  style={{ fontSize: '13px', minHeight: '40px', padding: '0 20px' }}
                >
                  Comenzar evaluación <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ) : null}
        </div>
      </main>

      {/* Same Official Footer as Home Page */}
      <footer className={styles.footer} style={{ flexShrink: 0 }}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <LogoLight />
          <span>© 2026 Crevantia · Todos los derechos reservados.</span>
          <span>
            <Link
              href="/politica-de-privacidad"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Aviso de privacidad
            </Link>{' '}
            ·{' '}
            <Link
              href="/terminos-y-condiciones"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Términos de uso
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
