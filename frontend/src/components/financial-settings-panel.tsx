'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch } from '@/lib/api';

interface FinancialSettings {
  currency: string;
  decimalPlaces: number;
  taxName: string;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  updatedAt: string | null;
}

const defaultSettings: FinancialSettings = {
  currency: 'MXN',
  decimalPlaces: 2,
  taxName: 'IVA',
  taxRatePercent: 16.0,
  pricesIncludeTax: false,
  updatedAt: null,
};

export function FinancialSettingsPanel() {
  const [settings, setSettings] = useState<FinancialSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Live preview state controlled by inputs
  const [currency, setCurrency] = useState('MXN');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [taxName, setTaxName] = useState('IVA');
  const [taxRatePercent, setTaxRatePercent] = useState(16.0);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);

  useEffect(() => {
    apiFetch<FinancialSettings>('/admin/settings/financial')
      .then((data) => {
        setSettings(data);
        setCurrency(data.currency);
        setDecimalPlaces(data.decimalPlaces);
        setTaxName(data.taxName);
        setTaxRatePercent(data.taxRatePercent);
        setPricesIncludeTax(data.pricesIncludeTax);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'No fue posible cargar los ajustes financieros.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const payload = {
      currency: currency.trim().toUpperCase(),
      decimalPlaces: Number(decimalPlaces),
      taxName: taxName.trim(),
      taxRatePercent: Number(taxRatePercent),
      pricesIncludeTax: Boolean(pricesIncludeTax),
    };

    try {
      const updated = await apiFetch<FinancialSettings>('/admin/settings/financial', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      setMessage('Ajustes financieros y fiscales actualizados correctamente.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  // Calculate live preview with demo price $2,200.00
  const demoPrice = 2200;
  let previewBaseSubtotal = demoPrice;
  let previewTax = 0;
  let previewTotal = demoPrice;

  if (pricesIncludeTax) {
    previewBaseSubtotal = demoPrice / (1 + (taxRatePercent || 0) / 100);
    previewTax = demoPrice - previewBaseSubtotal;
    previewTotal = demoPrice;
  } else {
    previewBaseSubtotal = demoPrice;
    previewTax = (demoPrice * (taxRatePercent || 0)) / 100;
    previewTotal = demoPrice + previewTax;
  }

  return (
    <div className="settings-content settings-section">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      <section className="welcome">
        <div>
          <span className="eyebrow dark">Comercio y Fiscalidad</span>
          <h1>Finanzas e Impuestos (IVA)</h1>
          <p>Define la tasa impositiva, desglose de impuestos, moneda y formato de los importes en el checkout.</p>
        </div>
        <span className="settings-status enabled">Configuración fiscal activa</span>
      </section>

      {loading ? (
        <div className="panel settings-card">Cargando ajustes financieros…</div>
      ) : (
        <form className="panel settings-card" onSubmit={save}>
          <div className="settings-section-head">
            <div>
              <h2>Impuesto sobre la Venta</h2>
              <p>El motor de cotización aplicará esta tasa de forma matemática en cada orden de compra.</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={pricesIncludeTax}
                onChange={(e) => setPricesIncludeTax(e.target.checked)}
              />
              <span />
              Precios con impuesto incluido
            </label>
          </div>

          <div className="settings-grid two-columns">
            <label>
              Nombre del impuesto
              <input
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                placeholder="Ej. IVA, VAT, Impuesto"
                required
              />
            </label>
            <label>
              Tasa impositiva (%)
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(parseFloat(e.target.value) || 0)}
                required
              />
            </label>
          </div>

          <div className="settings-divider" />

          <div className="settings-section-head">
            <div>
              <h2>Moneda y Precisión Decimal</h2>
              <p>Formato de visualización para precios en landing, catálogo y pantalla de pago.</p>
            </div>
          </div>

          <div className="settings-grid two-columns">
            <label>
              Código de moneda ISO
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="MXN, USD"
                maxLength={5}
                required
              />
            </label>
            <label>
              Decimales de visualización
              <input
                type="number"
                min="0"
                max="4"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value, 10) || 0)}
                required
              />
            </label>
          </div>

          <div className="settings-divider" />

          <div className="settings-section-head">
            <div>
              <h2>Simulación de Cotización en Tiempo Real</h2>
              <p>Así es como se desglosará una evaluación con precio catálogo de $2,200.00 {currency}:</p>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(48, 43, 120, 0.04)',
              border: '1px solid rgba(48, 43, 120, 0.12)',
              borderRadius: '16px',
              padding: '20px 24px',
              display: 'grid',
              gap: '12px',
              maxWidth: '560px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#687386', fontSize: '14px' }}>
              <span>Subtotal antes de {taxName}:</span>
              <strong>${previewBaseSubtotal.toFixed(decimalPlaces)} {currency}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#687386', fontSize: '14px' }}>
              <span>{taxName} ({taxRatePercent}% {pricesIncludeTax ? 'incluido' : 'desglosado'}):</span>
              <strong>+ ${previewTax.toFixed(decimalPlaces)} {currency}</strong>
            </div>
            <div
              style={{
                borderTop: '1px dashed rgba(48, 43, 120, 0.2)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--indigo)',
                fontSize: '18px',
                fontWeight: '800',
              }}
            >
              <span>Total a pagar por el cliente:</span>
              <span>${previewTotal.toFixed(decimalPlaces)} {currency}</span>
            </div>
            <small style={{ color: '#8992a1', fontSize: '11px', marginTop: '4px' }}>
              * Modo configurado: {pricesIncludeTax ? 'El importe de catálogo incluye impuestos.' : 'El impuesto se suma sobre el subtotal neto.'}
            </small>
          </div>

          <div className="settings-actions">
            <button className="primary-button compact" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar configuración fiscal'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
