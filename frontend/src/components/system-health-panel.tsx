'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  CreditCard,
  Database,
  ExternalLink,
  HardDrive,
  Layers,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface SystemHealthData {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  statusIssues: string[];
  timestamp: string;
  responseDurationMs: number;
  host: {
    hostname: string;
    platform: string;
    type: string;
    release: string;
    arch: string;
    nodeVersion: string;
    environment: string;
    pid: number;
  };
  ram: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    totalGb: string;
    usedGb: string;
    freeGb: string;
    usagePercent: number;
    processHeapUsedMb: number;
    processHeapTotalMb: number;
    processRssMb: number;
    status: 'OPTIMAL' | 'ELEVATED' | 'CRITICAL';
  };
  cpu: {
    cores: number;
    model: string;
    speedMhz: number;
    loadAvg: number[];
    usagePercent: number;
    status: 'NORMAL' | 'HIGH';
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    totalGb: string;
    usedGb: string;
    freeGb: string;
    usagePercent: number;
    status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  };
  uptimes: {
    systemUptimeSeconds: number;
    systemUptimeHuman: string;
    processUptimeSeconds: number;
    processUptimeHuman: string;
  };
  services: {
    database: {
      status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
      latencyMs: number;
      engine: string;
      totalUsers: number;
      totalAttempts: number;
      totalResults: number;
    };
    psychometrics: {
      status: string;
      engine: string;
    };
    mailSmtp: {
      status: 'ACTIVE' | 'CONFIGURED' | 'NOT_CONFIGURED';
      host: string;
      port: number;
      fromAddress: string;
      username?: string;
      enabled: boolean;
    };
    stripeGateway: {
      status: 'ENABLED' | 'STANDBY' | 'DISABLED';
      mode: string;
      configured: boolean;
      enabled: boolean;
      publishableKeyPrefix: string;
    };
  };
}

export function SystemHealthPanel() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState('');

  async function fetchHealth(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<SystemHealthData>('/admin/system-health');
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar métricas del servidor.');
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setRefreshing(false), 400);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  function getBarColor(percent: number) {
    if (percent >= 90) return 'linear-gradient(90deg, #ef4444, #dc2626)';
    if (percent >= 75) return 'linear-gradient(90deg, #f59e0b, #d97706)';
    return 'linear-gradient(90deg, var(--cyan), var(--indigo))';
  }

  if (loading) {
    return (
      <div className="admin-content">
        <div className="empty-state" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <Activity size={32} className="animate-spin" style={{ color: 'var(--indigo)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '18px', color: 'var(--night)', margin: 0 }}>Analizando telemetría del servidor VPS…</h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '6px 0 0' }}>Consultando RAM, CPU, disco, base de datos y microservicios.</p>
        </div>
      </div>
    );
  }

  const isHealthy = data?.status === 'HEALTHY';
  const isWarning = data?.status === 'WARNING';

  return (
    <div className="admin-content" style={{ display: 'grid', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="eyebrow dark" style={{ margin: 0 }}>Diagnóstico & Telemetría VPS</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--night)', letterSpacing: '-0.03em', margin: '4px 0 6px' }}>
            Estado y Salud del Servidor
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Supervisión en tiempo real de recursos físicos (RAM, CPU, Disco), latencia y estado de servicios.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer', background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Auto-refresco (10s)
          </label>

          <button
            type="button"
            onClick={() => fetchHealth(true)}
            className="secondary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 14px' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Actualizar ahora
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {data && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '18px 24px',
            borderRadius: '16px',
            background: isHealthy
              ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
              : isWarning
              ? 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)'
              : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            border: `1px solid ${isHealthy ? '#bbf7d0' : isWarning ? '#fde68a' : '#fecaca'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: isHealthy ? '#16a34a' : isWarning ? '#d97706' : '#dc2626',
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {isHealthy ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            </div>
            <div>
              <strong style={{ fontSize: '15px', color: isHealthy ? '#14532d' : isWarning ? '#78350f' : '#7f1d1d', display: 'block' }}>
                {isHealthy
                  ? 'Servidor VPS Operativo y Saludable'
                  : isWarning
                  ? 'Advertencia de Rendimiento en el Servidor'
                  : 'Atención Crítica Requerida en el Servidor'}
              </strong>
              <small style={{ fontSize: '12px', color: isHealthy ? '#166534' : isWarning ? '#92400e' : '#991b1b' }}>
                {data.statusIssues.length === 0
                  ? 'Todos los componentes de hardware, almacenamiento y microservicios operan con métricas normales.'
                  : data.statusIssues.join(' · ')}
              </small>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            Latencia de telemetría: <b>{data.responseDurationMs} ms</b> · Última sincronización: {new Date(data.timestamp).toLocaleTimeString('es-MX')}
          </div>
        </div>
      )}

      {/* 4 Core Hardware Metric Cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Card 1: Memoria RAM */}
          <div className="card" style={{ padding: '22px', borderRadius: '18px', background: 'white', border: '1px solid #e2e8f0', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={15} color="var(--indigo)" /> Memoria RAM VPS
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: data.ram.usagePercent > 80 ? '#fef2f2' : '#f0fdf4',
                  color: data.ram.usagePercent > 80 ? '#dc2626' : '#16a34a',
                }}
              >
                {data.ram.status}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <strong style={{ fontSize: '26px', color: 'var(--night)', letterSpacing: '-0.03em' }}>
                  {data.ram.usagePercent}%
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  <b>{data.ram.usedGb} GB</b> de {data.ram.totalGb} GB
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${data.ram.usagePercent}%`,
                    height: '100%',
                    background: getBarColor(data.ram.usagePercent),
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Disponible: <b style={{ color: '#0f172a' }}>{data.ram.freeGb} GB</b></div>
              <div>Node.js Heap: <b style={{ color: '#0f172a' }}>{data.ram.processHeapUsedMb} MB</b></div>
            </div>
          </div>

          {/* Card 2: CPU & Procesamiento */}
          <div className="card" style={{ padding: '22px', borderRadius: '18px', background: 'white', border: '1px solid #e2e8f0', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} color="var(--indigo)" /> Procesador CPU
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#f0fdf4',
                  color: '#16a34a',
                }}
              >
                {data.cpu.cores} Núcleos
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <strong style={{ fontSize: '26px', color: 'var(--night)', letterSpacing: '-0.03em' }}>
                  {data.cpu.usagePercent}%
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Carga 1m: <b>{data.cpu.loadAvg[0]}</b>
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${data.cpu.usagePercent}%`,
                    height: '100%',
                    background: getBarColor(data.cpu.usagePercent),
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Carga 5m: <b style={{ color: '#0f172a' }}>{data.cpu.loadAvg[1]}</b></div>
              <div>Carga 15m: <b style={{ color: '#0f172a' }}>{data.cpu.loadAvg[2]}</b></div>
            </div>
          </div>

          {/* Card 3: Disco & Almacenamiento */}
          <div className="card" style={{ padding: '22px', borderRadius: '18px', background: 'white', border: '1px solid #e2e8f0', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <HardDrive size={15} color="var(--indigo)" /> Almacenamiento VPS
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: data.disk.usagePercent > 80 ? '#fef2f2' : '#f0fdf4',
                  color: data.disk.usagePercent > 80 ? '#dc2626' : '#16a34a',
                }}
              >
                {data.disk.status}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <strong style={{ fontSize: '26px', color: 'var(--night)', letterSpacing: '-0.03em' }}>
                  {data.disk.usagePercent}%
                </strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  <b>{data.disk.usedGb} GB</b> de {data.disk.totalGb} GB
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${data.disk.usagePercent}%`,
                    height: '100%',
                    background: getBarColor(data.disk.usagePercent),
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Disponible: <b style={{ color: '#0f172a' }}>{data.disk.freeGb} GB</b></div>
              <div>Ocupado: <b style={{ color: '#0f172a' }}>{data.disk.usedGb} GB</b></div>
            </div>
          </div>

          {/* Card 4: Uptime & Continuidad */}
          <div className="card" style={{ padding: '22px', borderRadius: '18px', background: 'white', border: '1px solid #e2e8f0', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Server size={15} color="var(--indigo)" /> Tiempo de Actividad
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#f0fdf4',
                  color: '#16a34a',
                }}
              >
                100% Online
              </span>
            </div>

            <div>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Uptime VPS:</span>
                <strong style={{ display: 'block', fontSize: '22px', color: 'var(--night)', letterSpacing: '-0.02em' }}>
                  {data.uptimes.systemUptimeHuman}
                </strong>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Proceso API: <b style={{ color: '#0f172a' }}>{data.uptimes.processUptimeHuman}</b></div>
              <div>PID: <b style={{ color: '#0f172a' }}>#{data.host.pid}</b></div>
            </div>
          </div>
        </div>
      )}

      {/* Services & Connectivity Matrix */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Services Matrix */}
          <div style={{ background: 'white', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--night)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--indigo)" /> Microservicios y Conectividad
            </h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              {/* 1. Database */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Database size={18} color="#0369a1" />
                  <div>
                    <strong style={{ fontSize: '13px', color: '#080b12', display: 'block' }}>Base de Datos Relacional</strong>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>{data.services.database.engine} · Latencia: {data.services.database.latencyMs} ms ({data.services.database.totalUsers} usuarios)</small>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#dcfce7', color: '#15803d' }}>
                  {data.services.database.status}
                </span>
              </div>

              {/* 2. Psychometrics Engine */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={18} color="#6d28d9" />
                  <div>
                    <strong style={{ fontSize: '13px', color: '#080b12', display: 'block' }}>Motor Psicométrico DPO</strong>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>{data.services.psychometrics.engine}</small>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9' }}>
                  {data.services.psychometrics.status}
                </span>
              </div>

              {/* 3. Mail SMTP */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="#0d9488" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#080b12' }}>Servidor de Correo SMTP</strong>
                      <Link href="/admin/configuracion" style={{ color: '#0d9488', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title="Editar configuración SMTP">
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>
                      {data.services.mailSmtp.host}
                      {data.services.mailSmtp.port ? `:${data.services.mailSmtp.port}` : ''}
                      {data.services.mailSmtp.fromAddress ? ` (${data.services.mailSmtp.fromAddress})` : ''}
                    </small>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: data.services.mailSmtp.status === 'ACTIVE' ? '#dcfce7' : data.services.mailSmtp.status === 'CONFIGURED' ? '#ccfbf1' : '#f1f5f9',
                    color: data.services.mailSmtp.status === 'ACTIVE' ? '#15803d' : data.services.mailSmtp.status === 'CONFIGURED' ? '#0f766e' : '#64748b',
                  }}
                >
                  {data.services.mailSmtp.status === 'ACTIVE' ? 'ACTIVO' : data.services.mailSmtp.status === 'CONFIGURED' ? 'CONFIGURADO' : 'NO CONFIGURADO'}
                </span>
              </div>

              {/* 4. Stripe Payment Gateway */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CreditCard size={18} color="#6366f1" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#080b12' }}>Pasarela Stripe</strong>
                      <Link href="/admin/configuracion/stripe" style={{ color: '#6366f1', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title="Editar configuración Stripe">
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>
                      Modo: <b>{data.services.stripeGateway.mode}</b> · Clave: {data.services.stripeGateway.publishableKeyPrefix}
                    </small>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: data.services.stripeGateway.status === 'ENABLED' ? '#dcfce7' : data.services.stripeGateway.status === 'STANDBY' ? '#fef3c7' : '#f1f5f9',
                    color: data.services.stripeGateway.status === 'ENABLED' ? '#15803d' : data.services.stripeGateway.status === 'STANDBY' ? '#92400e' : '#64748b',
                  }}
                >
                  {data.services.stripeGateway.status === 'ENABLED' ? 'ACTIVO' : data.services.stripeGateway.status === 'STANDBY' ? 'EN ESPERA' : 'DESHABILITADO'}
                </span>
              </div>
            </div>
          </div>

          {/* VPS Host Specifications */}
          <div style={{ background: 'white', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--night)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--indigo)" /> Ficha Técnica del Entorno VPS
            </h3>

            <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Nombre del Host:</span>
                <strong style={{ color: '#080b12' }}>{data.host.hostname}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Sistema Operativo:</span>
                <strong style={{ color: '#080b12' }}>{data.host.type} ({data.host.platform} {data.host.arch})</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Kernel / Release:</span>
                <strong style={{ color: '#080b12' }}>{data.host.release}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Versión de Node.js:</span>
                <strong style={{ color: '#080b12' }}>{data.host.nodeVersion}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#64748b' }}>Entorno de Ejecución:</span>
                <span style={{ fontWeight: 800, fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#334155' }}>
                  {data.host.environment.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
