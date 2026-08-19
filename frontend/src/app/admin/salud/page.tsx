import type { Metadata } from 'next';
import { SystemHealthPanel } from '@/components/system-health-panel';

export const metadata: Metadata = {
  title: 'Estado del Servidor y Salud del Sistema',
  description: 'Supervisión en tiempo real de recursos físicos (RAM, CPU, Disco) y microservicios de Crevantia.',
};

export default function SystemHealthPage() {
  return <SystemHealthPanel />;
}
