'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Send,
  Settings,
  UserPlus,
  Zap,
} from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';

interface DashboardMetrics {
  users: number;
  tests: number;
  activeAttempts: number;
  completedAttempts: number;
  totalResults: number;
  publishedNorms: number;
}

interface ActivityDay {
  date: string;
  label: string;
  created: number;
  completed: number;
}

interface AttentionItem {
  id: string;
  severity: 'danger' | 'warning' | 'cyan';
  title: string;
  subtitle: string;
  actionLabel: string;
  href: string;
}

interface RecentActivityItem {
  id: string;
  candidateName: string;
  candidateEmail: string;
  testName: string;
  completedAt: string;
  resultRunId: string | null;
}

interface DashboardResponse {
  metrics: DashboardMetrics;
  activityFlow: ActivityDay[];
  attentionItems: AttentionItem[];
  recentActivity: RecentActivityItem[];
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<DashboardResponse>('/admin/dashboard')
      .then((res) => {
        setData(res);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'No fue posible cargar el panel.');
        if (reason instanceof ApiError && reason.status === 401) {
          setTimeout(() => router.push('/iniciar-sesion'), 1200);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const maxActivity = Math.max(
    1,
    ...(data?.activityFlow.map((d) => Math.max(d.created, d.completed)) || [1])
  );

  const formattedDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="admin-content">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      <section className="welcome">
        <div>
          <span className="eyebrow dark">Resumen ejecutivo · {capitalizedDate}</span>
          <h1>Panel de Control Ejecutivo</h1>
          <p>Supervisa la operación de Crevantia, el flujo de evaluaciones en tiempo real y las tareas prioritarias.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => router.push('/admin/evaluaciones')}
            title="Ver intentos en tiempo real"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={14} /> Monitoreo en vivo
          </button>
          <button
            className="primary-button compact"
            type="button"
            onClick={() => router.push('/admin/usuarios')}
            title="Asignar evaluación directa a un usuario"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Asignar evaluación
          </button>
        </div>
      </section>

      {/* Primary Metric Grid (4 Cards in one row) */}
      <section className="metric-grid">
        <article style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/usuarios')}>
          <span>Usuarios registrados</span>
          <strong>{loading ? '—' : (data?.metrics.users ?? 0)}</strong>
          <small>Personas en la plataforma →</small>
        </article>
        <article style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/evaluaciones')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Evaluaciones activas</span>
            {(data?.metrics.activeAttempts ?? 0) > 0 && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            )}
          </div>
          <strong style={{ color: (data?.metrics.activeAttempts ?? 0) > 0 ? '#15803d' : undefined }}>
            {loading ? '—' : (data?.metrics.activeAttempts ?? 0)}
          </strong>
          <small>En curso o en pausa →</small>
        </article>
        <article style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/reportes')}>
          <span>Evaluaciones finalizadas</span>
          <strong style={{ color: '#0369a1' }}>{loading ? '—' : (data?.metrics.completedAttempts ?? 0)}</strong>
          <small>Histórico con resultados →</small>
        </article>
        <article style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/normas')}>
          <span>Baremos publicados</span>
          <strong>{loading ? '—' : (data?.metrics.publishedNorms ?? 0)}</strong>
          <small>Normas psicométricas activas →</small>
        </article>
      </section>

      {/* Main Interactive Grid */}
      <section className="dashboard-grid">
        {/* 1. Flujo de Evaluaciones (Gráfico Interactivo de 14 Días) */}
        <article className="panel chart-panel">
          <header>
            <div>
              <h2>Flujo de evaluaciones</h2>
              <p>Actividad real registrada en los últimos 14 días</p>
            </div>
            {hoveredDay ? (
              <span style={{ fontSize: '11px', color: '#302b78', fontWeight: 700 }}>
                {hoveredDay.label}: {hoveredDay.created} creadas / {hoveredDay.completed} completadas
              </span>
            ) : (
              <span>14 días</span>
            )}
          </header>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '6px',
              height: '140px',
              padding: '10px 0 6px',
              borderBottom: '1px solid #e7eaee',
            }}
          >
            {data?.activityFlow.map((day) => {
              const heightPct = Math.max(8, Math.round((Math.max(day.created, day.completed) / maxActivity) * 100));
              const hasActivity = day.created > 0 || day.completed > 0;

              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                  }}
                  title={`${day.label}: ${day.created} iniciadas, ${day.completed} finalizadas`}
                >
                  <div
                    style={{
                      width: '100%',
                      maxHeight: '100%',
                      height: `${heightPct}%`,
                      borderRadius: '4px 4px 0 0',
                      background: hasActivity
                        ? 'linear-gradient(180deg, #4f46e5 0%, #302b78 100%)'
                        : '#e2e8f0',
                      transition: 'all 0.2s ease',
                      opacity: hoveredDay?.date === day.date ? 1 : 0.85,
                      transform: hoveredDay?.date === day.date ? 'scaleY(1.05)' : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '9px',
                      color: '#94a3b8',
                      marginTop: '6px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      textAlign: 'center',
                    }}
                  >
                    {day.label.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <small style={{ color: '#64748b', fontSize: '11px' }}>
              Pasa el cursor sobre cada barra para ver el desglose diario.
            </small>
            <button
              type="button"
              className="text-button"
              onClick={() => router.push('/admin/evaluaciones')}
              style={{ fontSize: '11px', color: '#302b78', fontWeight: 700 }}
            >
              Ver todas las evaluaciones →
            </button>
          </div>
        </article>

        {/* 2. Requieren Atención Operativa */}
        <article className="panel attention">
          <header>
            <div>
              <h2>Requieren atención</h2>
              <p>Priorizadas por riesgo operativo en vivo</p>
            </div>
            <b
              style={{
                background: (data?.attentionItems.length ?? 0) > 0 ? '#fee2e2' : '#dcfce7',
                color: (data?.attentionItems.length ?? 0) > 0 ? '#b91c1c' : '#15803d',
              }}
            >
              {data?.attentionItems.length ?? 0}
            </b>
          </header>

          {data?.attentionItems && data.attentionItems.length > 0 ? (
            <ul>
              {data.attentionItems.map((item) => (
                <li
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(item.href)}
                >
                  <i className={item.severity} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <em>{item.actionLabel}</em>
                </li>
              ))}
            </ul>
          ) : (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: '#f0fdf4',
                borderRadius: '12px',
                border: '1px solid #bbf7d0',
                margin: '12px 0',
              }}
            >
              <CheckCircle2 size={26} color="#16a34a" style={{ margin: '0 auto 6px' }} />
              <strong style={{ color: '#166534', fontSize: '13px', display: 'block' }}>
                Operación completamente estable
              </strong>
              <small style={{ color: '#15803d', fontSize: '11px' }}>
                No hay intentos pausados ni alertas psicométricas pendientes de atención.
              </small>
            </div>
          )}
        </article>

        {/* 3. Acciones Frecuentes */}
        <article className="panel quick">
          <header>
            <div>
              <h2>Acciones frecuentes</h2>
              <p>Atajos administrativos de acceso rápido</p>
            </div>
          </header>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <button type="button" onClick={() => router.push('/admin/usuarios')}>
              <UserPlus size={16} /><span>Crear usuario</span>
            </button>
            <button type="button" onClick={() => router.push('/admin/usuarios')}>
              <Send size={16} /><span>Asignar prueba</span>
            </button>
            <button type="button" onClick={() => router.push('/admin/evaluaciones')}>
              <Zap size={16} /><span>Monitorear en vivo</span>
            </button>
            <button type="button" onClick={() => router.push('/admin/reportes')}>
              <BarChart3 size={16} /><span>Ver reportes</span>
            </button>
            <button type="button" onClick={() => router.push('/admin/normas')}>
              <Layers size={16} /><span>Ver normas</span>
            </button>
            <button type="button" onClick={() => router.push('/admin/configuracion')}>
              <Settings size={16} /><span>Configuración</span>
            </button>
          </div>
        </article>
      </section>

      {/* 4. Evaluaciones Concluidas Recientemente */}
      {data?.recentActivity && data.recentActivity.length > 0 && (
        <section className="panel" style={{ marginTop: '24px', padding: '20px 24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#080b12' }}>Evaluaciones concluidas recientemente</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Últimas aplicaciones completadas con resultados calculados.
              </p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => router.push('/admin/reportes')}
              style={{ fontSize: '12px', color: '#302b78', fontWeight: 700 }}
            >
              Ver todos los resultados →
            </button>
          </header>

          <div style={{ display: 'grid', gap: '8px' }}>
            {data.recentActivity.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: '#080b12' }}>{item.candidateName}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>({item.candidateEmail})</span>
                  <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>
                    {item.testName} · Finalizado el {new Date(item.completedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>

                {item.resultRunId && (
                  <button
                    type="button"
                    className="secondary-button compact"
                    onClick={() => router.push(`/resultados/${item.resultRunId}`)}
                    style={{ fontSize: '11px', color: '#0284c7', borderColor: '#bae6fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <BarChart3 size={13} /> Ver resultado
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
