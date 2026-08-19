'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Check, CheckCircle2, Clock, Play, ShoppingCart } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';

interface ProductItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  features: string[] | null;
  currentPrice: {
    amountCents: number;
    amountFormatted: string;
    currency: string;
  };
  estimatedMin: number | null;
}

interface UserAssignment {
  id: string;
  status: string;
  test: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  testVersion: {
    version: number;
    estimatedMin: number | null;
  };
  attempt: {
    id: string;
    status: string;
    resultRuns?: Array<{ id: string }>;
  } | null;
}

export function UserCatalogPanel() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<ProductItem[]>('/pricing/products'),
      apiFetch<{ items: UserAssignment[] }>('/me/assignments').catch(() => ({ items: [] })),
    ])
      .then(([prodRes, assignRes]) => {
        if (active) {
          setProducts(prodRes || []);
          setAssignments(assignRes?.items || []);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar el catálogo de evaluaciones.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStartOrContinue(assignment: UserAssignment) {
    if (assignment.attempt?.status === 'COMPLETED' && assignment.attempt.resultRuns?.[0]?.id) {
      router.push(`/resultados/${assignment.attempt.resultRuns[0].id}`);
      return;
    }

    setBusy(assignment.id);
    setError('');
    try {
      const attempt =
        assignment.attempt ??
        (await apiFetch<{ id: string }>(`/assignments/${assignment.id}/start`, {
          method: 'POST',
        }));
      router.push(`/evaluacion/${attempt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible abrir la evaluación.');
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <strong>Cargando catálogo de evaluaciones…</strong>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      <div className="catalog-grid">
        {products.map((product) => {
          const assignment = assignments.find(
            (a) =>
              a.test.code?.toUpperCase() === product.code?.toUpperCase() ||
              a.test.id === product.id
          );

          const isCompleted = assignment?.attempt?.status === 'COMPLETED';
          const isInProgress =
            assignment?.attempt?.status === 'IN_PROGRESS' || assignment?.attempt?.status === 'PAUSED';
          const isAssignedPending = assignment && !assignment.attempt;

          const featuresList = Array.isArray(product.features)
            ? product.features
            : [
                '1 acceso individual a la evaluación',
                'Aplicación en línea con guardado automático',
                'Baremación psicométrica automatizada de 10 deciles',
                'Reporte ejecutivo y diagnóstico en PDF',
                'Recibo de compra con validez fiscal',
              ];

          return (
            <article
              key={product.id}
              style={{
                background: 'white',
                borderRadius: '24px',
                padding: '32px',
                border: assignment ? '2px solid rgba(48, 43, 120, 0.18)' : '1px solid var(--line)',
                boxShadow: assignment ? '0 12px 36px rgba(48, 43, 120, 0.08)' : '0 8px 30px rgba(8, 11, 18, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' }}>
                  <span className="eyebrow dark" style={{ margin: 0 }}>Evaluación profesional</span>

                  {isCompleted ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#dcfce7',
                        color: '#15803d',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={12} /> Completada
                    </span>
                  ) : isInProgress ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Play size={12} /> En progreso
                    </span>
                  ) : isAssignedPending ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={12} /> Asignada
                    </span>
                  ) : (
                    <span className="status-badge published" style={{ fontSize: '11px' }}>{product.code}</span>
                  )}
                </div>

                <h2 style={{ fontSize: '24px', color: 'var(--night)', letterSpacing: '-0.04em', margin: '4px 0 12px' }}>
                  {product.name}
                </h2>

                <p style={{ color: '#687386', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                  {product.shortDescription || product.description || 'Evaluación psicométrica para diagnóstico de competencias y liderazgo.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                  <strong style={{ fontSize: '32px', color: 'var(--indigo)', letterSpacing: '-0.04em' }}>
                    ${product.currentPrice.amountFormatted}
                  </strong>
                  <span style={{ fontSize: '14px', color: '#687386', fontWeight: 600 }}>{product.currentPrice.currency}</span>
                  <small style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {product.estimatedMin ? `${product.estimatedMin} min` : '40-50 min'}
                  </small>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: '10px' }}>
                  {featuresList.map((feature, idx) => (
                    <li key={idx} style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botón dinámico según el estado de la asignación del usuario */}
              {isCompleted ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => assignment && void handleStartOrContinue(assignment)}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '14px',
                    color: '#0284c7',
                    borderColor: '#bae6fd',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <BarChart3 size={16} /> Ver resultados y reporte
                </button>
              ) : isInProgress ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy === assignment?.id}
                  onClick={() => assignment && void handleStartOrContinue(assignment)}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '14px',
                    background: 'linear-gradient(110deg, #302b78, #4740a3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={16} /> {busy === assignment?.id ? 'Abriendo…' : 'Continuar evaluación →'}
                </button>
              ) : isAssignedPending ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy === assignment?.id}
                  onClick={() => assignment && void handleStartOrContinue(assignment)}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '14px',
                    background: 'linear-gradient(110deg, #302b78, #4740a3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Play size={16} /> {busy === assignment?.id ? 'Iniciando…' : 'Iniciar evaluación →'}
                </button>
              ) : (
                <Link
                  href={`/pago/${product.slug}`}
                  className="primary-button"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <ShoppingCart size={16} /> Comprar evaluación →
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
