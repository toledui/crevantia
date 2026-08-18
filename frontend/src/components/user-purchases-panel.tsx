'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface UserOrder {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalFormatted: string;
  discountFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  customerName: string;
  customerEmail: string;
  product: {
    id: string;
    name: string;
    code: string;
    slug: string;
  };
  couponCode: string | null;
  assignmentId: string | null;
  assignmentStatus: string | null;
  attemptId: string | null;
  attemptStatus: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function UserPurchasesPanel() {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumingId, setResumingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<UserOrder[]>('/me/orders')
      .then((res) => {
        if (active) setOrders(res || []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar el historial de compras.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleResumeStripe(orderId: string) {
    setResumingId(orderId);
    setError('');
    setMessage('');

    try {
      const res = await apiFetch<{ sessionUrl: string }>(`/pricing/checkout/orders/${orderId}/resume-stripe`, {
        method: 'POST',
      });
      if (res.sessionUrl) {
        window.location.href = res.sessionUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible reanudar la sesión de pago con Stripe.');
      setResumingId('');
    }
  }

  async function handleSendReminder(orderId: string) {
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(`/checkout/orders/${orderId}/reminder`, {
        method: 'POST',
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible enviar el recordatorio.');
    }
  }

  function downloadReceipt(orderId: string) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    window.open(`${apiUrl}/checkout/orders/${orderId}/receipt-pdf`, '_blank');
  }

  if (loading) {
    return (
      <div className="empty-state">
        <strong>Cargando historial de compras…</strong>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px', fontWeight: '600' }}>
          {message}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>🛍️</span>
          <strong style={{ display: 'block', fontSize: '16px', color: 'var(--night)', marginBottom: '8px' }}>
            No tienes órdenes de compra registradas
          </strong>
          <p style={{ color: '#687386', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
            Cuando adquieras una evaluación psicométrica, aquí podrás consultar tu comprobante, descargar el recibo en PDF o completar pagos pendientes.
          </p>
          <Link href="/pago/dpo-pro" className="primary-button" style={{ display: 'inline-flex' }}>
            Ver catálogo de evaluaciones →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {orders.map((order) => {
            const isPaid = order.status === 'PAID';
            const isPending = order.status === 'PENDING';
            const dateFormatted = new Intl.DateTimeFormat('es-MX', {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(order.paidAt || order.createdAt));

            return (
              <article
                key={order.id}
                style={{
                  background: 'white',
                  borderRadius: '18px',
                  padding: '24px',
                  border: '1px solid var(--line)',
                  boxShadow: '0 4px 20px rgba(8, 11, 18, 0.04)',
                  display: 'grid',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--night)' }}>{order.product.name}</strong>
                      <span className={`status-badge ${isPaid ? 'published' : isPending ? 'draft' : 'archived'}`}>
                        {isPaid ? 'PAGADO' : isPending ? 'PENDIENTE DE PAGO' : order.status}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Folio: <strong>{order.orderNumber}</strong> · Fecha: {dateFormatted}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '20px', color: isPaid ? 'var(--indigo)' : '#475569', letterSpacing: '-0.03em' }}>
                      ${order.totalFormatted}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>{order.currency}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    {isPaid ? (
                      <span>✓ Acceso a evaluación activado en tu panel</span>
                    ) : (
                      <span>⚠️ Pago pendiente de confirmación</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isPaid && (
                      <button
                        type="button"
                        onClick={() => downloadReceipt(order.id)}
                        className="secondary-button compact"
                        style={{ fontSize: '12px', padding: '0 14px' }}
                      >
                        📄 Descargar Recibo PDF
                      </button>
                    )}

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendReminder(order.id)}
                          className="ghost-button"
                          style={{ fontSize: '12px' }}
                        >
                          📧 Reenviar recordatorio
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResumeStripe(order.id)}
                          disabled={resumingId === order.id}
                          className="primary-button compact"
                          style={{ fontSize: '12px', padding: '0 16px', background: 'linear-gradient(135deg, #635bff, #0a2540)' }}
                        >
                          {resumingId === order.id ? 'Conectando con Stripe…' : '💳 Pagar con Stripe'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
