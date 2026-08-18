import { Metadata } from 'next';
import { StripeSettingsPanel } from '@/components/stripe-settings-panel';

export const metadata: Metadata = {
  title: 'Pasarela de Pago Stripe | Configuración | Crevantia',
};

export default function StripeSettingsPage() {
  return <StripeSettingsPanel />;
}
