'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

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

export function UserCatalogPanel() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<ProductItem[]>('/pricing/products')
      .then((res) => {
        if (active) setProducts(res || []);
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

  if (loading) {
    return (
      <div className="empty-state">
        <strong>Cargando catálogo de evaluaciones…</strong>
      </div>
    );
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {products.map((product) => {
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
                border: '1px solid var(--line)',
                boxShadow: '0 8px 30px rgba(8, 11, 18, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="eyebrow dark" style={{ margin: 0 }}>Evaluación profesional</span>
                  <span className="status-badge published" style={{ fontSize: '11px' }}>{product.code}</span>
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
                  <small style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
                    ⏱ {product.estimatedMin ? `${product.estimatedMin} min` : '40-50 min'}
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

              <Link
                href={`/pago/${product.slug}`}
                className="primary-button"
                style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '14px' }}
              >
                Comprar evaluación →
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
