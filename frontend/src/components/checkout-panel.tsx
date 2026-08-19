'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Play,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { apiFetch } from '@/lib/api';

interface QuoteResponse {
  product: {
    id: string;
    code: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    publishedVersion: number | null;
    estimatedMin: number | null;
    testId?: string;
  };
  currency: string;
  decimalPlaces: number;
  taxName: string;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  subtotalCents: number;
  subtotalFormatted: string;
  discountCents: number;
  discountFormatted: string;
  taxCents: number;
  taxFormatted: string;
  totalCents: number;
  totalFormatted: string;
  appliedCoupon: {
    code: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    discountFormatted: string;
  } | null;
  isAlreadyAssigned?: boolean;
  existingAssignmentStatus?: string | null;
  existingAttemptId?: string | null;
  existingResultRunId?: string | null;
  gatewayActive?: boolean;
}

interface OrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  totalFormatted: string;
  currency: string;
}

interface PaymentResult {
  success?: boolean;
  status?: string;
  message: string;
  orderId?: string;
  orderNumber: string;
  productName?: string;
  totalFormatted?: string;
  assignmentId: string | null;
  transactionId?: string;
}

interface StripeConfig {
  enabled: boolean;
  mode: string;
  publishableKey: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function CheckoutPanel({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteError, setQuoteError] = useState('');

  const [stripeConfig, setStripeConfig] = useState<StripeConfig>({ enabled: false, mode: 'test', publishableKey: '' });
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);

  // Coupon state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Buyer identity state
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  // Account check state
  const [emailChecked, setEmailChecked] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // Payment process state
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentResult | null>(null);

  async function fetchQuote(couponCode?: string) {
    setQuoteError('');
    try {
      const data = await apiFetch<QuoteResponse>('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({
          productSlug: slug,
          couponCode: couponCode || undefined,
        }),
      });
      setQuote(data);
      if (couponCode && data.appliedCoupon) {
        setAppliedCouponCode(data.appliedCoupon.code);
        setCouponFeedback({
          type: 'success',
          text: `Cupón ${data.appliedCoupon.code} aplicado (-$${data.appliedCoupon.discountFormatted} ${data.currency})`,
        });
      } else if (couponCode && !data.appliedCoupon) {
        setCouponFeedback({ type: 'error', text: 'No se pudo aplicar el cupón.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al obtener la cotización.';
      if (couponCode) {
        setCouponFeedback({ type: 'error', text: msg });
      } else {
        setQuoteError(msg);
      }
    } finally {
      setLoading(false);
      setApplyingCoupon(false);
    }
  }

  // Check for Stripe session return
  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      apiFetch<PaymentResult>(`/pricing/checkout/stripe-verify?sessionId=${encodeURIComponent(sessionId)}`)
        .then((res) => {
          if (res.status === 'PAID') {
            setPaymentSuccess(res);
          } else {
            setPayError(res.message || 'El pago no fue completado.');
          }
        })
        .catch((err) => {
          setPayError(err instanceof Error ? err.message : 'No fue posible verificar el pago con Stripe.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    void fetchQuote();
    apiFetch<StripeConfig>('/pricing/stripe/config')
      .then((cfg) => setStripeConfig(cfg))
      .catch(() => {});

    apiFetch<AuthenticatedUser>('/auth/me')
      .then((user) => {
        if (user && user.id) {
          setCurrentUser(user);
          setCustomerEmail(user.email);
          setCustomerFirstName(user.firstName);
          setCustomerLastName(user.lastName);
          setEmailChecked(true);
          setAccountExists(true);
          // Re-fetch quote with authenticated user context
          void fetchQuote();
        }
      })
      .catch(() => {});
  }, [slug]);

  // Debounced check email
  useEffect(() => {
    if (currentUser) return;
    const cleanEmail = customerEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setEmailChecked(false);
      setAccountExists(false);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingEmail(true);
      setAuthError('');
      apiFetch<{ exists: boolean; firstName?: string | null }>(`/auth/check-email?email=${encodeURIComponent(cleanEmail)}`)
        .then((res) => {
          setEmailChecked(true);
          setAccountExists(res.exists);
          if (res.exists && res.firstName && !customerFirstName) {
            setCustomerFirstName(res.firstName);
          }
        })
        .catch(() => {})
        .finally(() => setCheckingEmail(false));
    }, 450);

    return () => clearTimeout(timer);
  }, [customerEmail, currentUser]);

  async function handleInlineLogin(e: FormEvent) {
    e.preventDefault();
    if (!passwordInput) return;
    setLoggingIn(true);
    setAuthError('');

    try {
      const res = await apiFetch<{ accessToken: string; user: AuthenticatedUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: customerEmail.trim().toLowerCase(),
          password: passwordInput,
        }),
      });

      setCurrentUser(res.user);
      setCustomerEmail(res.user.email);
      setCustomerFirstName(res.user.firstName);
      setCustomerLastName(res.user.lastName);
      setAccountExists(true);
      setPasswordInput('');
      void fetchQuote(appliedCouponCode);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Contraseña incorrecta.');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleApplyCoupon(e: FormEvent) {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;
    setApplyingCoupon(true);
    setCouponFeedback(null);
    void fetchQuote(couponCodeInput.trim());
  }

  function handleRemoveCoupon() {
    setCouponCodeInput('');
    setAppliedCouponCode('');
    setCouponFeedback(null);
    setApplyingCoupon(true);
    void fetchQuote();
  }

  async function ensureUserAuthenticated(): Promise<string> {
    if (currentUser) return currentUser.id;

    const email = customerEmail.trim().toLowerCase();
    if (!email) throw new Error('Ingresa tu correo electrónico para continuar.');

    if (accountExists && !currentUser) {
      if (!passwordInput) {
        throw new Error('Esta cuenta ya existe. Por favor ingresa tu contraseña para iniciar sesión.');
      }
      const res = await apiFetch<{ accessToken: string; user: AuthenticatedUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: passwordInput }),
      });
      setCurrentUser(res.user);
      return res.user.id;
    }

    if (!customerFirstName.trim()) {
      throw new Error('Ingresa tu nombre para generar tu cuenta y el certificado de la evaluación.');
    }

    const reg = await apiFetch<{ accessToken: string; user: AuthenticatedUser }>('/auth/checkout-register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        firstName: customerFirstName.trim(),
        lastName: customerLastName.trim() || 'Cliente',
        password: passwordInput.trim() || undefined,
      }),
    });

    setCurrentUser(reg.user);
    return reg.user.id;
  }

  async function handleStripeCheckout() {
    setPaying(true);
    setPayError('');
    setAuthError('');

    try {
      await ensureUserAuthenticated();

      const session = await apiFetch<{
        sessionId: string;
        sessionUrl: string;
        orderId: string;
        orderNumber: string;
      }>('/pricing/checkout/stripe-session', {
        method: 'POST',
        body: JSON.stringify({
          productSlug: slug,
          couponCode: appliedCouponCode || undefined,
          customerEmail: customerEmail.trim().toLowerCase(),
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
        }),
      });

      if (session.sessionUrl) {
        window.location.href = session.sessionUrl;
      } else {
        throw new Error('No se recibió la URL de pago de Stripe.');
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No fue posible iniciar la sesión de Stripe.');
      setPaying(false);
    }
  }

  async function handleFreeOrSimulatedCheckout() {
    setPaying(true);
    setPayError('');
    setAuthError('');

    try {
      await ensureUserAuthenticated();

      const order = await apiFetch<OrderResult>('/checkout/order', {
        method: 'POST',
        body: JSON.stringify({
          productSlug: slug,
          couponCode: appliedCouponCode || undefined,
          customerEmail: customerEmail.trim().toLowerCase(),
          customerName: `${customerFirstName} ${customerLastName}`.trim(),
        }),
      });

      const payment = await apiFetch<PaymentResult>('/checkout/pay', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.orderId,
          gateway: 'SIMULATED',
          simulateSuccess: true,
        }),
      });

      setPaymentSuccess(payment);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No fue posible procesar el acceso a la evaluación.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#687386' }}>Cargando detalles de la evaluación…</p>
      </div>
    );
  }

  if (quoteError || !quote) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '30px', textAlign: 'center', background: 'white', borderRadius: '24px', boxShadow: 'var(--shadow)' }}>
        <h2 style={{ color: 'var(--night)', marginBottom: '12px' }}>Evaluación no disponible</h2>
        <p style={{ color: '#687386', marginBottom: '24px' }}>{quoteError || 'No se encontró la evaluación solicitada.'}</p>
        <Link href="/panel" className="primary-button">Volver al panel</Link>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <main style={{ maxWidth: '680px', margin: '60px auto', padding: '40px 32px', background: 'white', borderRadius: '28px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(32, 140, 112, 0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
          <CheckCircle2 size={36} />
        </div>
        <span className="eyebrow" style={{ color: 'var(--success)', marginBottom: '8px' }}>Compra confirmada</span>
        <h1 style={{ fontSize: '32px', color: 'var(--night)', letterSpacing: '-0.04em', margin: '8px 0 16px' }}>
          ¡Tu evaluación está lista!
        </h1>
        <p style={{ color: '#606a7b', fontSize: '16px', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto 28px' }}>
          Hemos procesado tu pago exitosamente. Te enviamos el comprobante en PDF a <strong>{customerEmail || 'tu correo'}</strong> y tu evaluación ya está disponible para responder.
        </p>

        <div style={{ background: 'rgba(48, 43, 120, 0.03)', border: '1px solid rgba(48, 43, 120, 0.1)', borderRadius: '16px', padding: '20px', textAlign: 'left', marginBottom: '32px', display: 'grid', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#687386' }}>
            <span>Folio de orden:</span>
            <strong style={{ color: 'var(--night)' }}>{paymentSuccess.orderNumber}</strong>
          </div>
          {paymentSuccess.transactionId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#687386' }}>
              <span>Referencia de pago:</span>
              <span style={{ fontFamily: 'monospace' }}>{paymentSuccess.transactionId}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#687386' }}>
            <span>Importe:</span>
            <strong style={{ color: 'var(--indigo)' }}>${quote.totalFormatted} {quote.currency}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {paymentSuccess.orderId && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/checkout/orders/${paymentSuccess.orderId}/receipt-pdf`}
              target="_blank"
              rel="noreferrer"
              className="secondary-button"
              style={{ padding: '14px 22px', fontSize: '15px' }}
            >
              <FileText size={16} /> Descargar Recibo PDF
            </a>
          )}
          <Link href="/panel" className="primary-button" style={{ padding: '14px 28px', fontSize: '15px' }}>
            Ir a mi panel y comenzar evaluación →
          </Link>
        </div>
      </main>
    );
  }

  const isGatewayActive = stripeConfig.enabled || quote.gatewayActive;
  const isZeroTotal = quote.totalCents === 0;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f7f6f1, #eef1f6)', padding: '32px 20px' }}>
      <header style={{ maxWidth: '1100px', margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/panel" style={{ color: '#687386', fontSize: '14px', fontWeight: '600' }}>
          {currentUser ? `Hola, ${currentUser.firstName} (Mi Panel →)` : 'Mi panel de usuario →'}
        </Link>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)', gap: '32px', alignItems: 'start' }}>
        {/* Left Column: Product Summary */}
        <section style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 12px 40px rgba(8, 11, 18, 0.06)', border: '1px solid rgba(156, 166, 184, 0.16)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="eyebrow dark" style={{ margin: 0 }}>Instrumento psicométrico</span>
            <span className="status-badge published">{quote.product.code}</span>
          </div>

          <h1 style={{ fontSize: '28px', color: 'var(--night)', letterSpacing: '-0.04em', margin: '8px 0 14px' }}>
            {quote.product.name}
          </h1>

          <p style={{ color: '#606a7b', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            {quote.product.shortDescription || 'Diagnóstico psicométrico estandarizado de alto nivel para evaluación de competencias, liderazgo y estilo de toma de decisiones.'}
          </p>

          <div style={{ display: 'grid', gap: '14px', borderTop: '1px solid #edf0f5', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4a5568', fontSize: '13px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(48, 43, 120, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--indigo)' }}>
                <Clock size={15} />
              </span>
              <span>Tiempo estimado: <strong>{quote.product.estimatedMin ? `${quote.product.estimatedMin} minutos` : '40-50 minutos'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4a5568', fontSize: '13px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(0, 194, 232, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0097b6' }}>
                <BarChart3 size={15} />
              </span>
              <span>Baremo estandarizado de 10 deciles con baremación continua</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4a5568', fontSize: '13px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(32, 140, 112, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <FileText size={15} />
              </span>
              <span>Reporte ejecutivo con recibo en PDF descargable y enviado por correo</span>
            </div>
          </div>
        </section>

        {/* Right Column: Checkout or Already Assigned Notice */}
        <section style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow)', border: '1px solid rgba(48, 43, 120, 0.08)' }}>
          {quote.isAlreadyAssigned ? (
            /* Alerta de evaluación ya adquirida / asignada */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: quote.existingAssignmentStatus === 'COMPLETED' ? 'rgba(32, 140, 112, 0.12)' : 'rgba(48, 43, 120, 0.08)',
                  color: quote.existingAssignmentStatus === 'COMPLETED' ? 'var(--success)' : 'var(--indigo)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                }}
              >
                {quote.existingAssignmentStatus === 'COMPLETED' ? <CheckCircle2 size={30} /> : <ShieldCheck size={30} />}
              </div>

              <span className="eyebrow" style={{ color: 'var(--indigo)', marginBottom: '6px' }}>
                Acceso registrado
              </span>

              <h2 style={{ fontSize: '24px', color: 'var(--night)', letterSpacing: '-0.04em', margin: '4px 0 12px' }}>
                {quote.existingAssignmentStatus === 'COMPLETED'
                  ? 'Ya completaste esta evaluación'
                  : 'Ya tienes esta prueba asignada'}
              </h2>

              <p style={{ color: '#687386', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                {quote.existingAssignmentStatus === 'COMPLETED'
                  ? 'Tu cuenta ya cuenta con un resultado oficial registrado para esta prueba. No es necesario realizar una nueva compra.'
                  : 'Tu cuenta ya dispone de un acceso activo para responder esta evaluación psicométrica. Puedes iniciarla o continuarla de inmediato.'}
              </p>

              <div style={{ display: 'grid', gap: '12px' }}>
                {quote.existingAssignmentStatus === 'COMPLETED' && quote.existingResultRunId ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => router.push(`/resultados/${quote.existingResultRunId}`)}
                    style={{ width: '100%', justifyContent: 'center', padding: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <BarChart3 size={16} /> Ver Resultados y Reporte Oficial
                  </button>
                ) : quote.existingAttemptId ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => router.push(`/evaluacion/${quote.existingAttemptId}`)}
                    style={{ width: '100%', justifyContent: 'center', padding: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Play size={16} /> Continuar respondiendo evaluación →
                  </button>
                ) : (
                  <Link
                    href="/panel"
                    className="primary-button"
                    style={{ width: '100%', justifyContent: 'center', padding: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Play size={16} /> Ir a Mis Evaluaciones →
                  </Link>
                )}

                <Link href="/panel" className="secondary-button" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                  Volver a mi panel
                </Link>
              </div>
            </div>
          ) : (
            /* Formulario normal de checkout */
            <div>
              <div style={{ marginBottom: '24px' }}>
                <span className="eyebrow dark" style={{ margin: 0 }}>Paso final</span>
                <h2 style={{ fontSize: '24px', color: 'var(--night)', letterSpacing: '-0.04em', margin: '4px 0 8px' }}>
                  Datos de facturación y acceso
                </h2>
                <p style={{ color: '#687386', fontSize: '13px' }}>
                  {currentUser
                    ? `Comprando con la cuenta verificada de ${currentUser.firstName} (${currentUser.email}).`
                    : 'Ingresa tus datos para registrar tu cuenta y habilitar el acceso a la prueba.'}
                </p>
              </div>

              {/* Formulario de cuenta / usuario */}
              <div style={{ marginBottom: '24px' }}>
                {currentUser ? (
                  <div style={{ background: 'rgba(48, 43, 120, 0.04)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(48, 43, 120, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: 'var(--night)' }}>
                        {currentUser.firstName} {currentUser.lastName}
                      </strong>
                      <span style={{ fontSize: '13px', color: '#687386' }}>{currentUser.email}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)', background: '#dcfce7', padding: '4px 8px', borderRadius: '6px' }}>
                      Sesión activa
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#687386' }}>
                      Correo electrónico
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        required
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          background: 'white',
                        }}
                      />
                    </label>

                    {checkingEmail && <small style={{ color: '#687386', fontSize: '12px' }}>Verificando correo…</small>}

                    {emailChecked && accountExists && !currentUser && (
                      <div style={{ background: 'rgba(48, 43, 120, 0.04)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(48, 43, 120, 0.12)' }}>
                        <p style={{ fontSize: '13px', color: 'var(--night)', margin: '0 0 10px', fontWeight: 600 }}>
                          Ya tienes una cuenta registrada. Ingresa tu contraseña para continuar:
                        </p>
                        <form onSubmit={handleInlineLogin} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Contraseña de tu cuenta"
                            required
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '13px',
                            }}
                          />
                          <button type="submit" disabled={loggingIn} className="primary-button compact">
                            {loggingIn ? 'Ingresando…' : 'Iniciar sesión'}
                          </button>
                        </form>
                        {authError && <p style={{ color: 'var(--danger)', fontSize: '12px', margin: '6px 0 0' }}>{authError}</p>}
                      </div>
                    )}

                    {emailChecked && !accountExists && !currentUser && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#687386' }}>
                          Nombre
                          <input
                            type="text"
                            value={customerFirstName}
                            onChange={(e) => setCustomerFirstName(e.target.value)}
                            placeholder="Ej. Luis Antonio"
                            required
                            style={{
                              width: '100%',
                              marginTop: '6px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              background: 'white',
                            }}
                          />
                        </label>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#687386' }}>
                          Apellidos
                          <input
                            type="text"
                            value={customerLastName}
                            onChange={(e) => setCustomerLastName(e.target.value)}
                            placeholder="Ej. Toledo Méndez"
                            required
                            style={{
                              width: '100%',
                              marginTop: '6px',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              background: 'white',
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Formulario de cupón de descuento */}
              <form onSubmit={handleApplyCoupon} style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#687386', marginBottom: '6px' }}>
                  Cupón de descuento / Código institucional
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código promocional (ej. BIENVENIDA10)"
                    disabled={Boolean(appliedCouponCode)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #dce1e8',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                    }}
                  />
                  {appliedCouponCode ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="secondary-button"
                      style={{ padding: '10px 16px', color: 'var(--danger)' }}
                    >
                      Quitar
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={applyingCoupon || !couponCodeInput.trim()}
                      className="secondary-button"
                      style={{ padding: '10px 18px' }}
                    >
                      {applyingCoupon ? '…' : 'Aplicar'}
                    </button>
                  )}
                </div>
                {couponFeedback && (
                  <p style={{
                    margin: '8px 0 0',
                    fontSize: '12px',
                    color: couponFeedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
                    fontWeight: '600',
                  }}>
                    {couponFeedback.text}
                  </p>
                )}
              </form>

              {/* Desglose de Precios */}
              <div style={{ background: 'rgba(48, 43, 120, 0.02)', border: '1px solid #edf0f5', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'grid', gap: '10px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#606a7b' }}>
                  <span>Subtotal:</span>
                  <strong>${quote.subtotalFormatted} {quote.currency}</strong>
                </div>

                {quote.discountCents > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                    <span>Descuento de cupón ({quote.appliedCoupon?.code}):</span>
                    <strong>-${quote.discountFormatted} {quote.currency}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#606a7b' }}>
                  <span>{quote.taxName} ({quote.taxRatePercent}% {quote.pricesIncludeTax ? 'incluido' : ''}):</span>
                  <span>{quote.pricesIncludeTax ? '' : '+'}${quote.taxFormatted} {quote.currency}</span>
                </div>

                <div style={{ borderTop: '2px solid #edf0f5', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--night)' }}>Total a pagar:</span>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ fontSize: '26px', color: 'var(--indigo)', letterSpacing: '-0.04em' }}>
                      ${quote.totalFormatted}
                    </strong>
                    <span style={{ fontSize: '13px', color: '#8992a1', marginLeft: '6px' }}>{quote.currency}</span>
                  </div>
                </div>
              </div>

              {payError && (
                <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(196, 90, 90, 0.1)', color: 'var(--danger)', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>
                  {payError}
                </div>
              )}

              {/* Botones de acción y control de pasarela */}
              {isZeroTotal ? (
                /* Total $0 por cupón 100% de descuento */
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleFreeOrSimulatedCheckout()}
                  disabled={paying}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '15px',
                    justifyContent: 'center',
                    background: 'linear-gradient(110deg, #15803d, #16a34a)',
                  }}
                >
                  {paying ? 'Activando tu acceso…' : '✓ Canjear acceso y comenzar evaluación gratis →'}
                </button>
              ) : !isGatewayActive ? (
                /* Pasarela desactivada y total > $0 */
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: '14px',
                      padding: '16px',
                      color: '#92400e',
                      fontSize: '13px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Pasarela de pago no activa</strong>
                      <p style={{ margin: 0, lineHeight: '1.5' }}>
                        Los pagos directos con tarjeta están temporalmente deshabilitados en la plataforma. Si cuentas con un código de cupón de acceso institucional, ingrésalo arriba.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="primary-button"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '15px',
                      justifyContent: 'center',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }}
                  >
                    <Lock size={16} /> Pasarela no disponible
                  </button>
                </div>
              ) : (
                /* Pasarela activa y total > $0 */
                <div style={{ display: 'grid', gap: '12px' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleStripeCheckout()}
                    disabled={paying}
                    style={{
                      width: '100%',
                      padding: '16px',
                      fontSize: '16px',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #635bff, #0a2540)',
                      color: '#fff',
                    }}
                  >
                    {paying
                      ? 'Conectando con Stripe…'
                      : `💳 Pagar $${quote.totalFormatted} ${quote.currency} con Stripe`}
                  </button>
                </div>
              )}

              <p style={{ textAlign: 'center', fontSize: '11px', color: '#8992a1', marginTop: '16px' }}>
                🔒 Transacción cifrada y segura. Acceso inmediato a la evaluación y recibo PDF tras confirmar la compra.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
