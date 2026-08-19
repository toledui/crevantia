'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Eye, Play, RotateCw, Search, Zap } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';
import { ConfirmModal } from '@/components/confirm-modal';

interface AttemptSummaryMetrics {
  total: number;
  inProgress: number;
  paused: number;
  completed: number;
  attentionRequired: number;
}

interface AttemptItem {
  id: string;
  status: string;
  isStalled: boolean;
  needsAttention: boolean;
  startedAt: string | null;
  pausedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalAnswers: number;
  candidate: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  test: {
    id: string;
    code: string;
    name: string;
    version: number;
    estimatedMin: number | null;
  };
  latestResultRun: {
    id: string;
    status: string;
    calculatedAt: string;
  } | null;
}

interface AttemptsResponse {
  items: AttemptItem[];
  total: number;
  page: number;
  limit: number;
}

const statusBadgeConfig: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  CREATED: { label: 'Iniciada (Sin avance)', bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  IN_PROGRESS: { label: 'En progreso (En vivo)', bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  PAUSED: { label: 'Pausada', bg: '#fef3c7', color: '#b45309', dot: '#f59e0b' },
  SUBMITTED: { label: 'Enviada / En cálculo', bg: '#e0e7ff', color: '#4338ca', dot: '#6366f1' },
  SCORING: { label: 'Calculando puntajes', bg: '#e0e7ff', color: '#4338ca', dot: '#6366f1' },
  SCORED: { label: 'Puntajes calculados', bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  REPORT_GENERATING: { label: 'Generando reporte', bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  COMPLETED: { label: 'Completada', bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  SCORING_ERROR: { label: 'Error de cálculo', bg: '#fee2e2', color: '#b91c1c', dot: '#ef4444' },
  INVALIDATED: { label: 'Invalidada', bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
};

function formatDuration(startedAt: string | null, endedAt: string | null) {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMin = Math.max(1, Math.round((end - start) / (1000 * 60)));
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours}h ${mins}m`;
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return 'Sin actividad';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Hace unos segundos';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateStr));
}

export function AttemptsAdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<AttemptsResponse>({ items: [], total: 0, page: 1, limit: 25 });
  const [summary, setSummary] = useState<AttemptSummaryMetrics>({
    total: 0,
    inProgress: 0,
    paused: 0,
    completed: 0,
    attentionRequired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Diagnostic drawer/modal
  const [diagnosticsItem, setDiagnosticsItem] = useState<AttemptItem | null>(null);

  // Custom confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    loading?: boolean;
    action: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    variant: 'primary',
    loading: false,
    action: () => {},
  });

  async function loadData(page = 1, nextSearch = search, nextStatus = status) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25', status: nextStatus });
    if (nextSearch.trim()) params.set('search', nextSearch.trim());

    try {
      const [listRes, sumRes] = await Promise.all([
        apiFetch<AttemptsResponse>(`/admin/attempts?${params}`),
        apiFetch<AttemptSummaryMetrics>('/admin/attempts/summary').catch(() => ({
          total: 0,
          inProgress: 0,
          paused: 0,
          completed: 0,
          attentionRequired: 0,
        })),
      ]);
      setData(listRes);
      setSummary(sumRes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar las evaluaciones.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(1);
  }, []);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    void loadData(1);
  }

  function promptReopenAttempt(attempt: AttemptItem) {
    setConfirmModal({
      isOpen: true,
      title: 'Reactivar intento de evaluación',
      message: `¿Deseas reactivar el intento de la prueba "${attempt.test.name}" para ${attempt.candidate.firstName} ${attempt.candidate.lastName}? El estado cambiará a "En progreso" y el candidato podrá continuar desde donde se quedó.`,
      confirmLabel: 'Reactivar intento',
      cancelLabel: 'Cancelar',
      variant: 'primary',
      loading: false,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          const res = await apiFetch<{ message: string }>(`/admin/attempts/${attempt.id}/reopen`, {
            method: 'POST',
            body: JSON.stringify({ reason: 'Reapertura técnica por solicitud de soporte' }),
          });
          setMessage(res.message);
          await loadData(data.page);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'No fue posible reactivar la evaluación.');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, loading: false }));
        }
      },
    });
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="admin-content users-page">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        variant={confirmModal.variant}
        loading={confirmModal.loading}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
      />

      <section className="users-heading">
        <div>
          <span className="eyebrow dark">Monitoreo Operativo</span>
          <h1>Evaluaciones</h1>
          <p>Supervisa las aplicaciones en tiempo real, el avance de los evaluados y el estado del motor de cálculo.</p>
        </div>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => void loadData(data.page)}
          title="Actualizar datos en tiempo real"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCw size={13} /> Actualizar en vivo
        </button>
      </section>

      {/* Metric Cards Summary */}
      <section className="users-summary">
        <article>
          <strong>{summary.total}</strong>
          <span>Aplicaciones registradas</span>
        </article>
        <article>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
            <strong style={{ color: '#15803d' }}>{summary.inProgress}</strong>
          </div>
          <span>En curso (En vivo)</span>
        </article>
        <article>
          <strong style={{ color: '#047857' }}>{summary.completed}</strong>
          <span>Finalizadas exitosamente</span>
        </article>
        <article style={{ borderLeft: summary.attentionRequired > 0 ? '3px solid #f59e0b' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {summary.attentionRequired > 0 && (
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
            )}
            <strong style={{ color: summary.attentionRequired > 0 ? '#b45309' : '#080b12' }}>
              {summary.attentionRequired}
            </strong>
          </div>
          <span>Requieren atención</span>
        </article>
      </section>

      {/* Main Attempts Panel */}
      <section className="panel users-panel">
        <form className="users-toolbar" onSubmit={handleFilter}>
          <label className="users-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por evaluado, correo o prueba…"
              aria-label="Buscar evaluaciones"
            />
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              void loadData(1, search, e.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="ALL">Todos los estados</option>
            <option value="IN_PROGRESS">En curso (En vivo)</option>
            <option value="PAUSED">Pausadas</option>
            <option value="COMPLETED">Completadas</option>
            <option value="ATTENTION_REQUIRED">⚠️ Requieren atención</option>
          </select>
          <button className="secondary-button" type="submit">
            Buscar
          </button>
        </form>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Evaluado</th>
                <th>Prueba psicométrica</th>
                <th>Estado en vivo</th>
                <th>Avance / Respuestas</th>
                <th>Última actividad</th>
                <th aria-label="Acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Cargando intentos de evaluación…
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No se encontraron aplicaciones con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                data.items.map((attempt) => {
                  const badge = statusBadgeConfig[attempt.status] || {
                    label: attempt.status,
                    bg: '#f1f5f9',
                    color: '#475569',
                    dot: '#94a3b8',
                  };

                  return (
                    <tr
                      key={attempt.id}
                      style={{
                        background: attempt.needsAttention ? '#fffbeb' : undefined,
                      }}
                    >
                      <td>
                        <div className="user-identity">
                          <span>
                            {attempt.candidate.firstName.charAt(0)}
                            {attempt.candidate.lastName.charAt(0)}
                          </span>
                          <div>
                            <strong>
                              {attempt.candidate.firstName} {attempt.candidate.lastName}
                            </strong>
                            <small>{attempt.candidate.email}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#080b12' }}>{attempt.test.name}</strong>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Versión {attempt.test.version} ({attempt.test.estimatedMin ?? 45} min)
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: badge.dot,
                              }}
                            />
                            {attempt.isStalled ? 'Inactiva (>2h)' : badge.label}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong style={{ fontSize: '12px', color: '#080b12' }}>
                            {attempt.totalAnswers} reactivos respondidos
                          </strong>
                          <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: '1px' }}>
                            Tiempo total: {formatDuration(attempt.startedAt, attempt.completedAt)}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '12px', color: '#334155' }}>
                          <strong>{formatRelativeTime(attempt.lastActivityAt)}</strong>
                          <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px' }}>
                            Inicio:{' '}
                            {attempt.startedAt
                              ? new Intl.DateTimeFormat('es-MX', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(attempt.startedAt))
                              : 'No iniciado'}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="row-actions">
                          {attempt.status === 'COMPLETED' && attempt.latestResultRun?.id ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/resultados/${attempt.latestResultRun?.id}`)}
                              style={{ color: '#0284c7', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Ver puntajes, deciles y reporte oficial"
                            >
                              <BarChart3 size={13} /> Resultados
                            </button>
                          ) : (
                            attempt.needsAttention && (
                              <button
                                type="button"
                                onClick={() => promptReopenAttempt(attempt)}
                                style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Reanudar el intento para permitir al evaluado continuar"
                              >
                                <Zap size={13} /> Reanudar
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => setDiagnosticsItem(attempt)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Ver diagnóstico y detalles técnicos del intento"
                          >
                            <Eye size={13} /> Diagnóstico
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-pagination">
          <span>
            Página {data.page} de {pageCount} ({data.total} aplicaciones totales)
          </span>
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={data.page <= 1 || loading}
              onClick={() => void loadData(data.page - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={data.page >= pageCount || loading}
              onClick={() => void loadData(data.page + 1)}
            >
              Siguiente
            </button>
          </div>
        </footer>
      </section>

      {/* MODAL: Diagnóstico Técnico del Intento */}
      {diagnosticsItem && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="diagnostics-modal-title">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cerrar ventana"
            onClick={() => setDiagnosticsItem(null)}
          />
          <div className="user-editor" style={{ width: 'min(100%, 650px)' }}>
            <header>
              <div>
                <span className="eyebrow dark">Diagnóstico Operativo</span>
                <h2 id="diagnostics-modal-title">Intento: {diagnosticsItem.id}</h2>
                <p>
                  {diagnosticsItem.candidate.firstName} {diagnosticsItem.candidate.lastName} (
                  {diagnosticsItem.candidate.email})
                </p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setDiagnosticsItem(null)}>
                ×
              </button>
            </header>

            <div style={{ marginTop: '20px', display: 'grid', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800 }}>
                    Prueba psicométrica
                  </small>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#080b12', marginTop: '2px' }}>
                    {diagnosticsItem.test.name} ({diagnosticsItem.test.code})
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800 }}>
                    Estado actual
                  </small>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#080b12', marginTop: '2px' }}>
                    {statusBadgeConfig[diagnosticsItem.status]?.label ?? diagnosticsItem.status}
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800 }}>
                    Respuestas registradas
                  </small>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#080b12', marginTop: '2px' }}>
                    {diagnosticsItem.totalAnswers} reactivos
                  </strong>
                </div>
                <div>
                  <small style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 800 }}>
                    Duración calculada
                  </small>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#080b12', marginTop: '2px' }}>
                    {formatDuration(diagnosticsItem.startedAt, diagnosticsItem.completedAt)}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Inicio de aplicación:</span>
                  <strong>{diagnosticsItem.startedAt ? new Date(diagnosticsItem.startedAt).toLocaleString('es-MX') : 'No registrado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Última actividad:</span>
                  <strong>{diagnosticsItem.lastActivityAt ? new Date(diagnosticsItem.lastActivityAt).toLocaleString('es-MX') : 'No registrado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>Envío / Finalización:</span>
                  <strong>{diagnosticsItem.completedAt ? new Date(diagnosticsItem.completedAt).toLocaleString('es-MX') : 'En curso / Pendiente'}</strong>
                </div>
              </div>

              {diagnosticsItem.latestResultRun && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0369a1', fontSize: '12px', display: 'block' }}>
                      Cálculo de resultados completado
                    </strong>
                    <small style={{ color: '#0284c7' }}>
                      ID corrida: {diagnosticsItem.latestResultRun.id}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => {
                      const runId = diagnosticsItem.latestResultRun?.id;
                      setDiagnosticsItem(null);
                      if (runId) router.push(`/resultados/${runId}`);
                    }}
                    style={{ fontSize: '11px' }}
                  >
                    Ver resultados →
                  </button>
                </div>
              )}
            </div>

            <footer>
              <button className="secondary-button" type="button" onClick={() => setDiagnosticsItem(null)}>
                Cerrar
              </button>
              {diagnosticsItem.needsAttention && (
                <button
                  className="primary-button compact"
                  type="button"
                  onClick={() => {
                    const item = diagnosticsItem;
                    setDiagnosticsItem(null);
                    promptReopenAttempt(item);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Zap size={14} /> Reanudar intento
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
