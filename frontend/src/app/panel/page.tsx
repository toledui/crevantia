import Link from 'next/link';
import { Brand } from '@/components/brand';
import { SessionGate } from '@/components/session-gate';

export default function UserPanel() {
  return <SessionGate area="client"><main className="user-panel"><Brand/><section><span className="eyebrow dark">Mi espacio</span><h1>Hola, tu panel está listo.</h1><p>Aquí aparecerán tus evaluaciones compradas o asignadas. La carga de contenido definitivo está pendiente.</p><div className="empty-state"><strong>No tienes evaluaciones disponibles</strong><small>Cuando recibas una asignación podrás iniciarla desde aquí.</small></div><Link className="text-link" href="/iniciar-sesion">Volver al acceso</Link></section></main></SessionGate>;
}
