'use client';

import { FormEvent, useEffect, useState } from 'react';
import { BarChart2, Eye, Printer, RotateCcw, RotateCw, Sliders, Star } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';
import { ConfirmModal } from '@/components/confirm-modal';

interface ResultsSummaryMetrics {
  totalResults: number;
  officialResults: number;
  recalculatedResults: number;
}

interface ResultDimension {
  id: string;
  targetType: string;
  targetCode: string;
  rawScore: string;
  displayScore: string | null;
  normalizedScore: string | null;
  decile: number | null;
  status: string;
}

interface ResultItem {
  id: string;
  isOfficial: boolean;
  status: string;
  calculatedAt: string;
  configurationHash: string;
  engineVersion: string;
  reason: string | null;
  recalculationOfResultRunId: string | null;
  recalculationsCount: number;
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
  };
  norm: {
    id: string;
    version: number;
    normSet: {
      id: string;
      code: string;
      name: string;
    };
  };
  attempt: {
    id: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  topDimensions: ResultDimension[];
}

interface AvailableNorm {
  id: string;
  version: number;
  normSet: {
    id: string;
    code: string;
    name: string;
  };
}

interface FullResultDetail extends ResultItem {
  values: Array<{
    id: string;
    targetType: string;
    targetCode: string;
    rawScore: string;
    displayScore: string | null;
    normalizedScore: string | null;
    decile: number | null;
    status: string;
  }>;
  availableNorms: AvailableNorm[];
  recalculations: Array<{
    id: string;
    calculatedAt: string;
    reason: string | null;
    normVersion: { normSet: { name: string } };
  }>;
}

interface ResultsResponse {
  items: ResultItem[];
  total: number;
  page: number;
  limit: number;
}

function getDecileBadgeColor(decile: number | null) {
  if (!decile) return { bg: '#f1f5f9', color: '#64748b', label: 'Sin decil' };
  if (decile <= 2) return { bg: '#fee2e2', color: '#b91c1c', label: 'Bajo' };
  if (decile <= 4) return { bg: '#fef3c7', color: '#b45309', label: 'Medio-Bajo' };
  if (decile <= 6) return { bg: '#e0f2fe', color: '#0369a1', label: 'Promedio / Medio' };
  if (decile <= 8) return { bg: '#dcfce7', color: '#15803d', label: 'Medio-Alto' };
  return { bg: '#ede9fe', color: '#6d28d9', label: 'Alto / Sobresaliente' };
}

function formatDimensionName(code: string) {
  return code
    .replace(/^DPO_/, '')
    .replace(/^SOURCE_COMPOSITE:/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ResultsAdminPanel() {
  const [data, setData] = useState<ResultsResponse>({ items: [], total: 0, page: 1, limit: 25 });
  const [summary, setSummary] = useState<ResultsSummaryMetrics>({
    totalResults: 0,
    officialResults: 0,
    recalculatedResults: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modals
  const [selectedResult, setSelectedResult] = useState<FullResultDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Recalculate Modal
  const [recalculatingItem, setRecalculatingItem] = useState<ResultItem | null>(null);
  const [availableNorms, setAvailableNorms] = useState<AvailableNorm[]>([]);
  const [targetNormId, setTargetNormId] = useState('');
  const [recalculateReason, setRecalculateReason] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Confirmation Modal
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

  async function loadData(page = 1, nextSearch = search, nextType = filterType) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25', type: nextType });
    if (nextSearch.trim()) params.set('search', nextSearch.trim());

    try {
      const [listRes, sumRes] = await Promise.all([
        apiFetch<ResultsResponse>(`/admin/results?${params}`),
        apiFetch<ResultsSummaryMetrics>('/admin/results/summary').catch(() => ({
          totalResults: 0,
          officialResults: 0,
          recalculatedResults: 0,
        })),
      ]);
      setData(listRes);
      setSummary(sumRes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar los resultados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(1);
    void apiFetch<AvailableNorm[]>('/admin/results/norms')
      .then((norms) => {
        setAvailableNorms(norms || []);
        if (norms?.[0]) setTargetNormId(norms[0].id);
      })
      .catch(() => {});
  }, []);

  function handleFilter(e: FormEvent) {
    e.preventDefault();
    void loadData(1);
  }

  async function openResultDetail(resultId: string) {
    setLoadingDetail(true);
    setError('');
    try {
      const detail = await apiFetch<FullResultDetail>(`/admin/results/${resultId}`);
      setSelectedResult(detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar el detalle del resultado.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function promptRecalculate(result: ResultItem) {
    setRecalculatingItem(result);
    setTargetNormId(availableNorms[0]?.id || '');
    setRecalculateReason('Recalificación psicométrica solicitada por administración');
  }

  async function executeRecalculate() {
    if (!recalculatingItem || !targetNormId) return;
    setIsRecalculating(true);
    setError('');
    setMessage('');

    try {
      const res = await apiFetch<{ id: string }>(`/results/${recalculatingItem.id}/recalculate`, {
        method: 'POST',
        body: JSON.stringify({
          normVersionId: targetNormId,
          reason: recalculateReason.trim() || 'Recalificación administrativa',
        }),
      });

      setMessage('Resultado recalculado exitosamente con el nuevo baremo.');
      setRecalculatingItem(null);
      await loadData(data.page);
      if (res?.id) {
        await openResultDetail(res.id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible recalificar el resultado.');
    } finally {
      setIsRecalculating(false);
    }
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
          <span className="eyebrow dark">Análisis y Calificación</span>
          <h1>Resultados y Reportes</h1>
          <p>Consulta los resultados psicométricos procesados, deciles baremados y genera los reportes ejecutivos oficiales.</p>
        </div>
        <button
          className="secondary-button compact"
          type="button"
          onClick={() => void loadData(data.page)}
          title="Actualizar listado de resultados"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCw size={13} /> Actualizar
        </button>
      </section>

      {/* Summary Cards */}
      <section className="users-summary">
        <article>
          <strong>{summary.totalResults}</strong>
          <span>Resultados calculados</span>
        </article>
        <article>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} fill="#0369a1" color="#0369a1" />
            <strong style={{ color: '#0369a1' }}>{summary.officialResults}</strong>
          </div>
          <span>Resultados oficiales</span>
        </article>
        <article>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={18} color="#6d28d9" />
            <strong style={{ color: '#6d28d9' }}>{summary.recalculatedResults}</strong>
          </div>
          <span>Recalificaciones históricas</span>
        </article>
        <article>
          <strong style={{ color: '#047857' }}>{availableNorms.length}</strong>
          <span>Baremos activos disponibles</span>
        </article>
      </section>

      {/* Main Results Table Section */}
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
              placeholder="Buscar por candidato, correo o baremo…"
              aria-label="Buscar resultados"
            />
          </label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              void loadData(1, search, e.target.value);
            }}
            aria-label="Filtrar por tipo de resultado"
          >
            <option value="ALL">Todos los resultados</option>
            <option value="OFFICIAL">Solo oficiales</option>
            <option value="RECALCULATED">Recalificados</option>
          </select>
          <button className="secondary-button" type="submit">
            Buscar
          </button>
        </form>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Candidato evaluado</th>
                <th>Prueba & Baremo</th>
                <th>Dimensiones principales (Deciles)</th>
                <th>Cálculo & Reproducibilidad</th>
                <th>Tipo</th>
                <th aria-label="Acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Cargando resultados y reportes…
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No se encontraron resultados psicométricos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                data.items.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <div className="user-identity">
                        <span>
                          {res.candidate.firstName.charAt(0)}
                          {res.candidate.lastName.charAt(0)}
                        </span>
                        <div>
                          <strong>
                            {res.candidate.firstName} {res.candidate.lastName}
                          </strong>
                          <small>{res.candidate.email}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#080b12' }}>{res.test.name}</strong>
                        <small style={{ display: 'block', color: '#0284c7', fontSize: '11px', marginTop: '2px', fontWeight: 600 }}>
                          {res.norm.normSet.name} (v{res.norm.version})
                        </small>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '320px' }}>
                        {res.topDimensions.slice(0, 4).map((dim) => {
                          const badge = getDecileBadgeColor(dim.decile);
                          return (
                            <span
                              key={dim.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.color,
                              }}
                              title={`${formatDimensionName(dim.targetCode)}: Decil ${dim.decile ?? '—'} (${badge.label})`}
                            >
                              <span>{formatDimensionName(dim.targetCode).slice(0, 12)}…:</span>
                              <b>D{dim.decile ?? '—'}</b>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '11px', color: '#334155' }}>
                        <strong>
                          {new Intl.DateTimeFormat('es-MX', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(res.calculatedAt))}
                        </strong>
                        <code style={{ display: 'block', color: '#94a3b8', fontSize: '9px', marginTop: '2px' }}>
                          Hash: {res.configurationHash.slice(0, 10)}…
                        </code>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: res.isOfficial ? '#e0f2fe' : '#f3e8ff',
                          color: res.isOfficial ? '#0369a1' : '#7e22ce',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {res.isOfficial ? (
                          <><Star size={11} fill="currentColor" /> Oficial</>
                        ) : (
                          <><RotateCcw size={11} /> Recalculado</>
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => void openResultDetail(res.id)}
                          style={{ color: '#0369a1', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Ver reporte psicométrico completo"
                        >
                          <Eye size={13} /> Ver reporte
                        </button>
                        <button
                          type="button"
                          onClick={() => promptRecalculate(res)}
                          style={{ color: '#6d28d9', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Recalcular con otra norma o baremo"
                        >
                          <RotateCcw size={13} /> Recalcular
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-pagination">
          <span>
            Página {data.page} de {pageCount} ({data.total} resultados totales)
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

      {/* MODAL: Visor de Reporte Psicométrico Oficial e Imprimible */}
      {selectedResult && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cerrar reporte"
            onClick={() => setSelectedResult(null)}
          />
          <div
            className="user-editor printable-report"
            style={{
              width: 'min(100%, 820px)',
              padding: '32px',
              borderRadius: '20px',
            }}
          >
            {/* Header del Reporte Oficial */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '2px solid #080b12',
                paddingBottom: '16px',
                marginBottom: '24px',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 900,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#302b78',
                    marginBottom: '4px',
                  }}
                >
                  Crevantia Psicométrica · Reporte Ejecutivo Oficial
                </span>
                <h2 id="report-modal-title" style={{ margin: 0, fontSize: '24px', color: '#080b12' }}>
                  {selectedResult.test.name}
                </h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                  Candidato: <b>{selectedResult.candidate.firstName} {selectedResult.candidate.lastName}</b> ({selectedResult.candidate.email})
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: selectedResult.isOfficial ? '#e0f2fe' : '#f3e8ff',
                    color: selectedResult.isOfficial ? '#0369a1' : '#7e22ce',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {selectedResult.isOfficial ? (
                    <><Star size={12} fill="currentColor" /> Versión Oficial</>
                  ) : (
                    <><RotateCcw size={12} /> Recalculado</>
                  )}
                </span>
                <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginTop: '6px' }}>
                  Fecha: {new Date(selectedResult.calculatedAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}
                </small>
              </div>
            </div>

            {/* Metadatos Psicométricos de Validación */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
              }}
            >
              <div>
                <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Baremo Aplicado
                </small>
                <strong style={{ display: 'block', fontSize: '12px', color: '#080b12', marginTop: '2px' }}>
                  {selectedResult.norm.normSet.name}
                </strong>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Versión de Baremo
                </small>
                <strong style={{ display: 'block', fontSize: '12px', color: '#080b12', marginTop: '2px' }}>
                  v{selectedResult.norm.version}
                </strong>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Motor de Cálculo
                </small>
                <strong style={{ display: 'block', fontSize: '12px', color: '#080b12', marginTop: '2px' }}>
                  v{selectedResult.engineVersion}
                </strong>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Hash de Validación
                </small>
                <code style={{ display: 'block', fontSize: '10px', color: '#0284c7', marginTop: '2px' }}>
                  {selectedResult.configurationHash.slice(0, 12)}…
                </code>
              </div>
            </div>

            {/* Dimensiones Compuestas (Gráfico de Barras de Deciles) */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#080b12', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="#302b78" /> Perfil de Dimensiones Psicométricas (Decatipo 1 - 10)
              </h3>

              <div style={{ display: 'grid', gap: '12px' }}>
                {selectedResult.values
                  .filter((v) => v.targetType === 'COMPOSITE')
                  .map((dim) => {
                    const decile = dim.decile ?? 5;
                    const badge = getDecileBadgeColor(dim.decile);
                    const percentage = Math.min(100, Math.max(10, decile * 10));

                    return (
                      <div
                        key={dim.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <strong style={{ fontSize: '13px', color: '#080b12' }}>
                            {formatDimensionName(dim.targetCode)}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: badge.bg,
                                color: badge.color,
                              }}
                            >
                              Decil {dim.decile ?? '—'} · {badge.label}
                            </span>
                            <small style={{ color: '#64748b', fontSize: '11px' }}>
                              Bruto: {dim.displayScore ?? Number(dim.rawScore).toFixed(1)}
                            </small>
                          </div>
                        </div>

                        {/* Barra de Decil */}
                        <div
                          style={{
                            height: '8px',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${percentage}%`,
                              background: badge.color,
                              borderRadius: '4px',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Desglose de Escalas Subyacentes */}
            {selectedResult.values.filter((v) => v.targetType === 'SCALE').length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#080b12', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={16} color="#302b78" /> Desglose de Escalas Específicas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {selectedResult.values
                    .filter((v) => v.targetType === 'SCALE')
                    .slice(0, 10)
                    .map((scale) => (
                      <div
                        key={scale.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <span style={{ color: '#334155' }}>{formatDimensionName(scale.targetCode)}</span>
                        <strong style={{ color: '#080b12' }}>Decil {scale.decile ?? '—'}</strong>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Footer de Acciones del Reporte */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '18px',
                marginTop: '20px',
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedResult(null)}
              >
                Cerrar
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="secondary-button compact"
                  onClick={() => {
                    const res = selectedResult;
                    setSelectedResult(null);
                    promptRecalculate(res);
                  }}
                  style={{ color: '#6d28d9', borderColor: '#e9d5ff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={13} /> Recalcular baremo
                </button>
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => window.print()}
                  style={{
                    background: 'linear-gradient(110deg, #302b78, #4740a3)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Printer size={14} /> Imprimir / Guardar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Recalcular con Otro Baremo */}
      {recalculatingItem && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="recalc-modal-title">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cerrar modal"
            onClick={isRecalculating ? undefined : () => setRecalculatingItem(null)}
          />
          <div className="user-editor" style={{ width: 'min(100%, 520px)' }}>
            <header>
              <div>
                <span className="eyebrow dark">Recalificación Psicométrica</span>
                <h2 id="recalc-modal-title">Recalcular Resultado</h2>
                <p>
                  Aplica un baremo diferente a la evaluación de{' '}
                  <b>{recalculatingItem.candidate.firstName} {recalculatingItem.candidate.lastName}</b>.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={isRecalculating}
                onClick={() => setRecalculatingItem(null)}
              >
                ×
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executeRecalculate();
              }}
              style={{ marginTop: '20px', display: 'grid', gap: '16px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Seleccionar nuevo baremo publicado:
                </label>
                <select
                  value={targetNormId}
                  onChange={(e) => setTargetNormId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  {availableNorms.map((norm) => (
                    <option key={norm.id} value={norm.id}>
                      {norm.normSet.name} (Versión {norm.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Motivo de la recalificación:
                </label>
                <textarea
                  value={recalculateReason}
                  onChange={(e) => setRecalculateReason(e.target.value)}
                  placeholder="Ej. Aplicación de baremo específico por industria..."
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="secondary-button compact"
                  disabled={isRecalculating}
                  onClick={() => setRecalculatingItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button compact"
                  disabled={isRecalculating}
                  style={{
                    background: 'linear-gradient(110deg, #302b78, #4740a3)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isRecalculating ? 'Recalculando…' : <><RotateCcw size={14} /> Ejecutar recalificación</>}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
