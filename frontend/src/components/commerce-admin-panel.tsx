'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch } from '@/lib/api';

type CommerceTab = 'pricing' | 'coupons' | 'orders';

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
  publishedVersion: number | null;
  estimatedMin: number | null;
  currentPrice: {
    id: string;
    amountCents: number;
    amountFormatted: string;
    currency: string;
    effectiveFrom: string;
  } | null;
}

interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minPurchaseAmountFormatted: string;
  maxUsesGlobal: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  redemptionsCount: number;
}

interface OrderItem {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  currency: string;
  subtotalFormatted: string;
  discountFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  totalCents: number;
  taxName: string;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  customerName: string;
  customerEmail: string;
  productName: string;
  couponCode: string | null;
  assignmentId: string | null;
  assignmentStatus: string | null;
  lastTransaction: {
    gateway: string;
    status: string;
    reference: string | null;
  } | null;
  paidAt: string | null;
  createdAt: string;
}

interface OrdersResponse {
  items: OrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const orderStatusLabels: Record<string, { label: string; class: string }> = {
  PAID: { label: 'Pagado', class: 'published' },
  PENDING: { label: 'Pendiente', class: 'draft' },
  REFUNDED: { label: 'Reembolsado', class: 'archived' },
  CANCELLED: { label: 'Cancelado', class: 'blocked' },
  EXPIRED: { label: 'Expirado', class: 'blocked' },
};

export function CommerceAdminPanel() {
  const [tab, setTab] = useState<CommerceTab>('pricing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Products state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [availableTests, setAvailableTests] = useState<Array<{ id: string; code: string; name: string; slug: string }>>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProductModal, setEditProductModal] = useState<ProductItem | null>(null);
  const [productSaving, setProductSaving] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState<ProductItem | null>(null);
  const [newPriceAmount, setNewPriceAmount] = useState('');
  const [priceSaving, setPriceSaving] = useState(false);

  // Coupons state
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponSaving, setCouponSaving] = useState(false);

  // Orders state
  const [ordersData, setOrdersData] = useState<OrdersResponse>({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 });
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [refundModalOrder, setRefundModalOrder] = useState<OrderItem | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSaving, setRefundSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'pricing') {
        const [prodData, testData] = await Promise.all([
          apiFetch<ProductItem[]>('/admin/commerce/products'),
          apiFetch<{ items: Array<{ id: string; code: string; name: string; slug: string }> }>('/admin/tests').catch(() => ({ items: [] })),
        ]);
        setProducts(prodData);
        setAvailableTests(testData.items);
      } else if (tab === 'coupons') {
        const data = await apiFetch<CouponItem[]>('/admin/commerce/coupons');
        setCoupons(data);
      } else if (tab === 'orders') {
        const params = new URLSearchParams({ page: String(ordersData.page), limit: '20' });
        if (orderStatus !== 'ALL') params.set('status', orderStatus);
        if (orderSearch.trim()) params.set('search', orderSearch.trim());
        const data = await apiFetch<OrdersResponse>(`/admin/commerce/orders?${params}`);
        setOrdersData(data);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la información.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [tab, orderStatus]);

  async function handleSetPrice(e: FormEvent) {
    e.preventDefault();
    if (!priceModalProduct) return;
    setPriceSaving(true);
    setError('');
    setMessage('');
    try {
      const amountCents = Math.round(parseFloat(newPriceAmount) * 100);
      if (isNaN(amountCents) || amountCents < 0) {
        throw new Error('Ingresa un importe numérico válido.');
      }
      await apiFetch(`/admin/commerce/products/${priceModalProduct.id}/price`, {
        method: 'POST',
        body: JSON.stringify({ amountCents }),
      });
      setMessage(`Precio actualizado para ${priceModalProduct.name}.`);
      setPriceModalProduct(null);
      setNewPriceAmount('');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible actualizar el precio.');
    } finally {
      setPriceSaving(false);
    }
  }

  async function handleCreateCoupon(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCouponSaving(true);
    setError('');
    setMessage('');
    const form = new FormData(e.currentTarget);
    const code = String(form.get('code')).trim().toUpperCase();
    const discountType = String(form.get('discountType')) as 'PERCENTAGE' | 'FIXED_AMOUNT';
    const discountValue = parseFloat(String(form.get('discountValue')));
    const description = String(form.get('description') || '').trim();
    const maxUsesGlobal = form.get('maxUsesGlobal') ? parseInt(String(form.get('maxUsesGlobal')), 10) : undefined;
    const maxUsesPerUser = form.get('maxUsesPerUser') ? parseInt(String(form.get('maxUsesPerUser')), 10) : 1;
    const expiresAt = form.get('expiresAt') ? String(form.get('expiresAt')) : undefined;

    try {
      await apiFetch('/admin/commerce/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code,
          discountType,
          discountValue,
          description: description || undefined,
          maxUsesGlobal,
          maxUsesPerUser,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          isActive: true,
        }),
      });
      setMessage(`Cupón ${code} creado correctamente.`);
      setCouponModalOpen(false);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear el cupón.');
    } finally {
      setCouponSaving(false);
    }
  }

  async function handleToggleCoupon(coupon: CouponItem) {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/admin/commerce/coupons/${coupon.id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      setMessage(`Cupón ${coupon.code} ${!coupon.isActive ? 'activado' : 'desactivado'}.`);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cambiar el estado del cupón.');
    }
  }

  async function handleRefundOrder(e: FormEvent) {
    e.preventDefault();
    if (!refundModalOrder) return;
    setRefundSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/admin/commerce/orders/${refundModalOrder.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason: refundReason.trim() }),
      });
      setMessage(`Orden ${refundModalOrder.orderNumber} reembolsada.`);
      setRefundModalOrder(null);
      setRefundReason('');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible procesar el reembolso.');
    } finally {
      setRefundSaving(false);
    }
  }

  async function handleCreateProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProductSaving(true);
    setError('');
    setMessage('');
    const form = new FormData(e.currentTarget);
    const testId = String(form.get('testId'));
    const name = String(form.get('name')).trim();
    const code = String(form.get('code')).trim().toUpperCase();
    const slug = String(form.get('slug')).trim().toLowerCase();
    const shortDescription = String(form.get('shortDescription') || '').trim();
    const initialPriceAmount = parseFloat(String(form.get('initialPrice')));
    const featuresRaw = String(form.get('features') || '');
    const features = featuresRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const initialPriceCents = Math.round(initialPriceAmount * 100);
      if (isNaN(initialPriceCents) || initialPriceCents < 0) {
        throw new Error('Ingresa un importe numérico válido para el precio.');
      }
      await apiFetch('/admin/commerce/products', {
        method: 'POST',
        body: JSON.stringify({
          testId,
          name,
          code,
          slug,
          shortDescription: shortDescription || undefined,
          features: features.length ? features : undefined,
          initialPriceCents,
          isActive: true,
        }),
      });
      setMessage(`Evaluación ${name} agregada al catálogo comercial.`);
      setProductModalOpen(false);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible registrar la evaluación comercial.');
    } finally {
      setProductSaving(false);
    }
  }

  async function handleUpdateProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editProductModal) return;
    setProductSaving(true);
    setError('');
    setMessage('');
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name')).trim();
    const shortDescription = String(form.get('shortDescription') || '').trim();
    const featuresRaw = String(form.get('features') || '');
    const features = featuresRaw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await apiFetch(`/admin/commerce/products/${editProductModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          shortDescription: shortDescription || undefined,
          features,
        }),
      });
      setMessage(`Evaluación ${name} actualizada.`);
      setEditProductModal(null);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible actualizar la evaluación.');
    } finally {
      setProductSaving(false);
    }
  }

  return (
    <div className="admin-content settings-area">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      <header className="settings-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="eyebrow dark">Comercio y Monetización</span>
            <h1>Pagos y Catálogo Comercial</h1>
            <p>Controla precios de evaluaciones, campañas con cupones de descuento y órdenes de compra.</p>
          </div>
          {tab === 'pricing' && (
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setProductModalOpen(true)}
            >
              + Agregar evaluación a catálogo
            </button>
          )}
          {tab === 'coupons' && (
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setCouponModalOpen(true)}
            >
              + Crear cupón
            </button>
          )}
        </div>
      </header>

      <div className="settings-workspace">
        <nav className="settings-nav" aria-label="Secciones comerciales">
          <button
            type="button"
            className={tab === 'pricing' ? 'active' : ''}
            onClick={() => setTab('pricing')}
          >
            <strong>Precios y Catálogo</strong>
            <small>Evaluaciones y tarifas vigentes</small>
          </button>
          <button
            type="button"
            className={tab === 'coupons' ? 'active' : ''}
            onClick={() => setTab('coupons')}
          >
            <strong>Cupones de Descuento</strong>
            <small>Promociones y límites de uso</small>
          </button>
          <button
            type="button"
            className={tab === 'orders' ? 'active' : ''}
            onClick={() => setTab('orders')}
          >
            <strong>Transacciones y Pedidos</strong>
            <small>Órdenes, pagos y asignaciones</small>
          </button>
        </nav>

        <div className="settings-pane">

      {/* TAB 1: PRICING */}
      {tab === 'pricing' && (
        <section className="panel users-panel">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Evaluación / Producto</th>
                  <th>Prueba vinculada</th>
                  <th>Versión publicada</th>
                  <th>Precio vigente</th>
                  <th>Moneda</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="table-empty">Cargando productos comerciales…</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">No hay productos comerciales registrados.</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small style={{ display: 'block', color: '#8992a1' }}>{p.code} · /{p.slug}</small>
                      </td>
                      <td>
                        <span>{p.testName}</span>
                        <small style={{ display: 'block', color: '#8992a1' }}>{p.testCode}</small>
                      </td>
                      <td>
                        {p.publishedVersion ? (
                          <span className="status-badge published">v{p.publishedVersion} publicada</span>
                        ) : (
                          <span className="status-badge draft">Sin publicar</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ fontSize: '15px', color: 'var(--indigo)' }}>
                          ${p.currentPrice?.amountFormatted ?? '0.00'}
                        </strong>
                      </td>
                      <td>{p.currentPrice?.currency ?? 'MXN'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => setEditProductModal(p)}
                          >
                            Editar datos y viñetas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPriceModalProduct(p);
                              setNewPriceAmount(p.currentPrice ? p.currentPrice.amountFormatted : '2200.00');
                            }}
                          >
                            Modificar precio
                          </button>
                          <a
                            href={`/pago/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            Ver checkout ↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: COUPONS */}
      {tab === 'coupons' && (
        <section className="panel users-panel">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Código de cupón</th>
                  <th>Descuento</th>
                  <th>Descripción</th>
                  <th>Usos / Límite</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="table-empty">Cargando cupones…</td></tr>
                ) : coupons.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">No hay cupones configurados.</td></tr>
                ) : (
                  coupons.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ letterSpacing: '0.05em', color: 'var(--indigo)' }}>{c.code}</strong>
                      </td>
                      <td>
                        <strong>
                          {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `$${(c.discountValue).toFixed(2)}`}
                        </strong>
                      </td>
                      <td>{c.description || '—'}</td>
                      <td>
                        <span>{c.usedCount}</span>
                        <small style={{ color: '#8992a1' }}> / {c.maxUsesGlobal ?? 'Ilimitado'}</small>
                      </td>
                      <td>
                        {c.expiresAt ? (
                          new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(c.expiresAt))
                        ) : (
                          <span style={{ color: '#8992a1' }}>Permanente</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${c.isActive ? 'published' : 'blocked'}`}>
                          {c.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className={c.isActive ? 'disable' : 'enable'}
                            onClick={() => void handleToggleCoupon(c)}
                          >
                            {c.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: ORDERS */}
      {tab === 'orders' && (
        <section className="panel users-panel">
          <div className="users-toolbar">
            <label className="users-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por folio, cliente o correo…"
                onKeyDown={(e) => e.key === 'Enter' && void loadData()}
              />
            </label>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
            >
              <option value="ALL">Todos los estados</option>
              <option value="PAID">Pagados</option>
              <option value="PENDING">Pendientes</option>
              <option value="REFUNDED">Reembolsados</option>
              <option value="CANCELLED">Cancelados</option>
            </select>
            <button className="secondary-button" type="button" onClick={() => void loadData()}>
              Filtrar
            </button>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Folio / Fecha</th>
                  <th>Cliente</th>
                  <th>Evaluación</th>
                  <th>Desglose</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Asignación</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="table-empty">Cargando órdenes…</td></tr>
                ) : ordersData.items.length === 0 ? (
                  <tr><td colSpan={8} className="table-empty">No se encontraron órdenes registradas.</td></tr>
                ) : (
                  ordersData.items.map((o) => {
                    const st = orderStatusLabels[o.status] ?? { label: o.status, class: 'draft' };
                    return (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.orderNumber}</strong>
                          <time dateTime={o.createdAt} style={{ display: 'block', color: '#8992a1', fontSize: '11px' }}>
                            {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(o.createdAt))}
                          </time>
                        </td>
                        <td>
                          <strong>{o.customerName}</strong>
                          <small style={{ display: 'block', color: '#8992a1' }}>{o.customerEmail}</small>
                        </td>
                        <td>{o.productName}</td>
                        <td>
                          <div style={{ fontSize: '11px', color: '#687386' }}>
                            <div>Sub: ${o.subtotalFormatted}</div>
                            {parseFloat(o.discountFormatted) > 0 && <div style={{ color: 'var(--success)' }}>Cupón ({o.couponCode}): -${o.discountFormatted}</div>}
                            <div>{o.taxName}: +${o.taxFormatted}</div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: '14px', color: 'var(--indigo)' }}>${o.totalFormatted} {o.currency}</strong>
                        </td>
                        <td>
                          <span className={`status-badge ${st.class}`}>{st.label}</span>
                        </td>
                        <td>
                          {o.assignmentId ? (
                            <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '600' }}>
                              ✓ Asignada
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#8992a1' }}>Sin asignar</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {o.status === 'PAID' && (
                              <button
                                type="button"
                                className="disable"
                                onClick={() => setRefundModalOrder(o)}
                              >
                                Reembolsar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL: Create Product */}
      {productModalOpen && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button className="modal-backdrop" type="button" onClick={() => setProductModalOpen(false)} />
          <form className="user-editor" onSubmit={handleCreateProduct}>
            <header>
              <div>
                <span className="eyebrow dark">Catálogo</span>
                <h2>Agregar evaluación a catálogo comercial</h2>
                <p>Vincula una prueba psicométrica existente del sistema, define su nombre comercial y fija su precio inicial.</p>
              </div>
              <button type="button" onClick={() => setProductModalOpen(false)}>×</button>
            </header>
            <div className="editor-grid">
              <label className="full">
                Prueba psicométrica base
                <select name="testId" required defaultValue={availableTests[0]?.id}>
                  {availableTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombre comercial
                <input name="name" placeholder="Ej. Evaluación DPO-PRO" required />
              </label>
              <label>
                Código del producto
                <input name="code" placeholder="Ej. DPO-PRO" required style={{ textTransform: 'uppercase' }} />
              </label>
              <label>
                Slug / Identificador URL
                <input name="slug" placeholder="Ej. dpo-pro" required style={{ textTransform: 'lowercase' }} />
              </label>
              <label>
                Precio inicial en MXN ($)
                <input name="initialPrice" type="number" step="0.01" min="0" placeholder="2200.00" required />
              </label>
              <label className="full">
                Descripción corta (checkout y catálogo)
                <input name="shortDescription" placeholder="Ej. Diagnóstico integral de competencias y potencial de liderazgo." />
              </label>
              <label className="full">
                Viñetas / Puntos incluidos (un punto por renglón)
                <textarea
                  name="features"
                  rows={4}
                  placeholder="1 acceso individual a la evaluación&#10;Aplicación en línea&#10;Resultados procesados automáticamente&#10;Reporte personal en PDF&#10;Acceso posterior desde tu cuenta"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #dce1e8',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                  }}
                />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setProductModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={productSaving}>
                {productSaving ? 'Guardando…' : 'Publicar en catálogo'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Edit Product */}
      {editProductModal && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button className="modal-backdrop" type="button" onClick={() => setEditProductModal(null)} />
          <form className="user-editor" onSubmit={handleUpdateProduct}>
            <header>
              <div>
                <span className="eyebrow dark">Catálogo</span>
                <h2>Editar evaluación: {editProductModal.name}</h2>
                <p>Ajusta el título comercial, descripción y los puntos o características visibles en la página de inicio y checkout.</p>
              </div>
              <button type="button" onClick={() => setEditProductModal(null)}>×</button>
            </header>
            <div className="editor-grid">
              <label className="full">
                Nombre comercial
                <input name="name" defaultValue={editProductModal.name} required />
              </label>
              <label className="full">
                Descripción corta
                <input
                  name="shortDescription"
                  defaultValue={editProductModal.shortDescription || ''}
                  placeholder="Ej. Diagnóstico integral de competencias y potencial de liderazgo."
                />
              </label>
              <label className="full">
                Viñetas / Puntos incluidos (un punto por renglón)
                <textarea
                  name="features"
                  rows={5}
                  defaultValue={(editProductModal.features || []).join('\n')}
                  placeholder="1 acceso individual a la evaluación&#10;Aplicación en línea&#10;Resultados procesados automáticamente&#10;Reporte personal en PDF&#10;Acceso posterior desde tu cuenta"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #dce1e8',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                  }}
                />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setEditProductModal(null)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={productSaving}>
                {productSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Set Price */}
      {priceModalProduct && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button className="modal-backdrop" type="button" onClick={() => setPriceModalProduct(null)} />
          <form className="user-editor" onSubmit={handleSetPrice}>
            <header>
              <div>
                <span className="eyebrow dark">Tarifas</span>
                <h2>Modificar precio: {priceModalProduct.name}</h2>
                <p>Establece el nuevo importe en catálogo. Creará una nueva versión histórica de precio sin alterar compras pasadas.</p>
              </div>
              <button type="button" onClick={() => setPriceModalProduct(null)}>×</button>
            </header>
            <div className="editor-grid">
              <label className="full">
                Nuevo precio en {priceModalProduct.currentPrice?.currency || 'MXN'}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPriceAmount}
                  onChange={(e) => setNewPriceAmount(e.target.value)}
                  placeholder="2200.00"
                  required
                />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setPriceModalProduct(null)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={priceSaving}>
                {priceSaving ? 'Guardando…' : 'Aplicar nuevo precio'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Create Coupon */}
      {couponModalOpen && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button className="modal-backdrop" type="button" onClick={() => setCouponModalOpen(false)} />
          <form className="user-editor" onSubmit={handleCreateCoupon}>
            <header>
              <div>
                <span className="eyebrow dark">Promociones</span>
                <h2>Crear cupón de descuento</h2>
                <p>Configura el código alfanumérico, porcentaje o monto y límites de redención.</p>
              </div>
              <button type="button" onClick={() => setCouponModalOpen(false)}>×</button>
            </header>
            <div className="editor-grid">
              <label>
                Código del cupón
                <input
                  name="code"
                  placeholder="EJ. PROMO2026"
                  required
                  style={{ textTransform: 'uppercase' }}
                />
              </label>
              <label>
                Tipo de descuento
                <select name="discountType" defaultValue="PERCENTAGE">
                  <option value="PERCENTAGE">Porcentual (%)</option>
                  <option value="FIXED_AMOUNT">Monto fijo en centavos</option>
                </select>
              </label>
              <label>
                Valor del descuento (% o importe)
                <input name="discountValue" type="number" step="0.01" min="0.01" placeholder="Ej. 15 para 15%" required />
              </label>
              <label>
                Límite de usos global (opcional)
                <input name="maxUsesGlobal" type="number" min="1" placeholder="Ej. 100 (vacío = sin límite)" />
              </label>
              <label>
                Límite por usuario
                <input name="maxUsesPerUser" type="number" min="1" defaultValue="1" required />
              </label>
              <label>
                Fecha de expiración (opcional)
                <input name="expiresAt" type="date" />
              </label>
              <label className="full">
                Descripción interna
                <input name="description" placeholder="Ej. Campaña LinkedIn 2026" />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setCouponModalOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={couponSaving}>
                {couponSaving ? 'Creando…' : 'Crear cupón'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Refund Order */}
      {refundModalOrder && (
        <div className="user-modal" role="dialog" aria-modal="true">
          <button className="modal-backdrop" type="button" onClick={() => setRefundModalOrder(null)} />
          <form className="user-editor" onSubmit={handleRefundOrder}>
            <header>
              <div>
                <span className="eyebrow dark">Reembolso</span>
                <h2>Reembolsar orden {refundModalOrder.orderNumber}</h2>
                <p>Esta acción revocará la asignación de la evaluación si aún no ha sido completada y registrará la auditoría contable.</p>
              </div>
              <button type="button" onClick={() => setRefundModalOrder(null)}>×</button>
            </header>
            <div className="editor-grid">
              <label className="full">
                Motivo del reembolso
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Explica la razón del reembolso para el registro contable y de auditoría…"
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #dce1e8',
                    fontFamily: 'inherit',
                  }}
                />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setRefundModalOrder(null)}>
                Cancelar
              </button>
              <button className="danger-button" disabled={refundSaving}>
                {refundSaving ? 'Procesando…' : 'Confirmar reembolso'}
              </button>
            </footer>
          </form>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
