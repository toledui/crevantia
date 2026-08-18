'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '@/app/home.module.css';
import { apiFetch } from '@/lib/api';

interface ProductItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  features?: string[];
  isActive: boolean;
  testCode: string;
  testName: string;
  currentPrice: {
    id: string;
    amountCents: number;
    amountFormatted: string;
    currency: string;
  } | null;
}

const DEFAULT_FEATURES = [
  '1 acceso individual a la evaluación',
  'Aplicación en línea',
  'Resultados procesados automáticamente',
  'Reporte personal en PDF',
  'Acceso posterior desde tu cuenta',
];

export function HomePricingSlider() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    apiFetch<ProductItem[]>('/pricing/products')
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setProducts(data);
        }
      })
      .catch(() => {
        // Fallback gracefully
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeProduct = products[currentIndex] || {
    id: 'default',
    code: 'DPO-PRO',
    slug: 'dpo-pro',
    name: 'Evaluación DPO-PRO',
    shortDescription: null,
    features: DEFAULT_FEATURES,
    currentPrice: {
      id: 'price-default',
      amountCents: 220000,
      amountFormatted: '2,200.00',
      currency: 'MXN',
    },
  };

  const features = activeProduct.features && activeProduct.features.length > 0
    ? activeProduct.features
    : DEFAULT_FEATURES;

  const formattedAmount = activeProduct.currentPrice
    ? Number(activeProduct.currentPrice.amountFormatted.replace(/,/g, '')).toLocaleString('es-MX', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : '2,200';

  const currency = activeProduct.currentPrice?.currency || 'MXN';

  function handlePrev() {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
  }

  function handleNext() {
    setCurrentIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
  }

  return (
    <aside className={styles.priceCard}>
      {products.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
            {currentIndex + 1} de {products.length} evaluaciones
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Evaluación anterior"
              style={{
                width: '28px',
                height: '28px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                transition: '0.2s ease',
              }}
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Siguiente evaluación"
              style={{
                width: '28px',
                height: '28px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                transition: '0.2s ease',
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      <span className={styles.priceLabel}>Evaluación individual</span>
      <h3>{activeProduct.name}</h3>

      {activeProduct.shortDescription && (
        <p
          style={{
            margin: '4px 0 0',
            color: 'rgba(255, 255, 255, 0.68)',
            fontSize: '12px',
            lineHeight: '1.45',
          }}
        >
          {activeProduct.shortDescription}
        </p>
      )}

      <div className={styles.price}>
        <strong>${formattedAmount}</strong>
        <span>{currency}</span>
      </div>

      <p className={styles.priceNote}>
        Precio oficial de catálogo. Los impuestos aplicables y cupones de descuento se calculan y confirman en el checkout.
      </p>

      <ul>
        {features.map((feature, idx) => (
          <li key={`${feature}-${idx}`}>{feature}</li>
        ))}
      </ul>

      <Link
        href={`/pago/${activeProduct.slug}`}
        className={`${styles.button} ${styles.buttonCyan}`}
      >
        Comprar evaluación <span aria-hidden="true">→</span>
      </Link>

      {products.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '16px',
          }}
        >
          {products.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Ir a ${p.name}`}
              style={{
                width: idx === currentIndex ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: idx === currentIndex ? 'var(--cyan)' : 'rgba(255, 255, 255, 0.25)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: '0.25s ease',
              }}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
