'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

interface DashboardData { users: number; tests: number; activeAttempts: number; completedAttempts: number }

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<DashboardData>('/admin/dashboard').then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar el panel.');
      if (reason instanceof ApiError && reason.status === 401) {
        setTimeout(() => router.push('/iniciar-sesion'), 1200);
      }
    });
  }, [router]);

  return <div className="admin-content">
    <div className="demo-banner">ENTORNO DE DEMOSTRACIÓN — RESULTADOS NO VÁLIDOS</div>
    <section className="welcome"><div><span className="eyebrow dark">Resumen ejecutivo · Agosto 2026</span><h1>La operación avanza con estabilidad.</h1><p>Una vista rápida del estado de Crevantia y de las tareas que requieren seguimiento.</p></div><button className="primary-button compact">+ Asignar evaluación</button></section>
    {error && <p className="form-error">{error}</p>}
    <section className="metric-grid">
      <article><span>Usuarios registrados</span><strong>{data?.users ?? '—'}</strong><small>Personas en la plataforma</small></article>
      <article><span>Evaluaciones activas</span><strong>{data?.activeAttempts ?? '—'}</strong><small>En curso o en pausa</small></article>
      <article><span>Evaluaciones finalizadas</span><strong>{data?.completedAttempts ?? '—'}</strong><small>Histórico acumulado</small></article>
      <article><span>Pruebas publicadas</span><strong>{data?.tests ?? '—'}</strong><small>Versiones disponibles</small></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel chart-panel"><header><div><h2>Flujo de evaluaciones</h2><p>Actividad demostrativa de los últimos 14 días</p></div><span>14 días⌄</span></header><div className="fake-chart"><i style={{height:'26%'}}/><i style={{height:'46%'}}/><i style={{height:'38%'}}/><i style={{height:'62%'}}/><i style={{height:'54%'}}/><i style={{height:'78%'}}/><i style={{height:'66%'}}/><i style={{height:'84%'}}/><i style={{height:'72%'}}/><i style={{height:'92%'}}/></div></article>
      <article className="panel attention"><header><div><h2>Requieren atención</h2><p>Priorizadas por riesgo operativo</p></div><b>3</b></header><ul><li><i className="danger"/><span><strong>Intento sin actividad</strong><small>Actualizado hace 2 horas</small></span><em>Revisar</em></li><li><i className="warning"/><span><strong>Reporte pendiente</strong><small>En cola de demostración</small></span><em>Revisar</em></li><li><i className="cyan"/><span><strong>Norma por validar</strong><small>Requiere insumos del cliente</small></span><em>Revisar</em></li></ul></article>
      <article className="panel quick"><header><div><h2>Acciones frecuentes</h2><p>Atajos administrativos</p></div></header><div><button>＋<span>Crear usuario</span></button><button>↗<span>Asignar prueba</span></button><button>▤<span>Ver reportes</span></button></div></article>
    </section>
  </div>;
}
