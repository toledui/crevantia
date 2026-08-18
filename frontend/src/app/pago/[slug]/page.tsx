import type { Metadata } from 'next';
import { CheckoutPanel } from '@/components/checkout-panel';

export const metadata: Metadata = {
  title: 'Comprar Evaluación · Crevantia',
  description: 'Adquiere tu acceso oficial para responder la evaluación psicométrica con baremo estandarizado y reporte ejecutivo.',
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CheckoutPanel slug={slug} />;
}
