'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Compass,
  FileText,
  Layers,
  Search,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { apiFetch, logout } from '@/lib/api';
import { Brand } from './brand';

type IconName = 'dashboard' | 'users' | 'tests' | 'items' | 'reports' | 'payments' | 'matrix' | 'settings' | 'health';

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>,
  tests: <><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  items: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  reports: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/></>,
  payments: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>,
  matrix: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06L7.04 4.3l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.37.46.99 1.51 1H21v4h-.09c-1.05.01-1.39.63-1.51 1Z"/></>,
  health: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
};

function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

interface NavItemProps { icon: IconName; label: string; href?: string; active?: boolean; badge?: string; closeMobile: () => void }

function NavItem({ icon, label, href, active, badge, closeMobile }: NavItemProps) {
  const content = <><Icon name={icon}/><span>{label}</span>{badge && <b>{badge}</b>}</>;
  if (href) return <Link className={active ? 'active' : ''} href={href} onClick={closeMobile}>{content}</Link>;
  return <button type="button" title={`${label} · Próximamente`}>{content}</button>;
}

interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  href: string;
}

interface GlobalSearchResults {
  navigation: SearchItem[];
  users: SearchItem[];
  attempts: SearchItem[];
  results: SearchItem[];
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState<number>(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ attentionRequired: number }>('/admin/attempts/summary')
      .then((res) => {
        if (mounted && typeof res?.attentionRequired === 'number') {
          setAttentionCount(res.attentionRequired);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [pathname]);

  // Handle Search Debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => {
      apiFetch<GlobalSearchResults>(`/admin/global-search?q=${encodeURIComponent(q)}`)
        .then((res) => {
          setSearchResults(res);
          setSearchOpen(true);
        })
        .catch(() => {
          setSearchResults(null);
        })
        .finally(() => setSearchLoading(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Navigate to users search by default or first search result
    if (searchResults?.navigation?.[0]) {
      router.push(searchResults.navigation[0].href);
    } else if (searchResults?.users?.[0]) {
      router.push(searchResults.users[0].href);
    } else if (searchResults?.attempts?.[0]) {
      router.push(searchResults.attempts[0].href);
    } else if (searchResults?.results?.[0]) {
      router.push(searchResults.results[0].href);
    } else {
      router.push(`/admin/usuarios?search=${encodeURIComponent(q)}`);
    }
    setSearchOpen(false);
  }

  function handleSelectResult(href: string) {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(href);
  }

  function toggleMenu() {
    if (window.innerWidth <= 760) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  const totalResultsCount =
    (searchResults?.navigation.length ?? 0) +
    (searchResults?.users.length ?? 0) +
    (searchResults?.attempts.length ?? 0) +
    (searchResults?.results.length ?? 0);

  return (
    <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <button className="mobile-overlay" type="button" aria-label="Cerrar menú" onClick={closeMobile} />
      <aside className="sidebar">
        <Brand light />
        <nav>
          <section>
            <span className="nav-label">Centro de control</span>
            <NavItem icon="dashboard" label="Resumen ejecutivo" href="/admin" active={pathname === '/admin'} closeMobile={closeMobile} />
            <NavItem icon="users" label="Usuarios" href="/admin/usuarios" active={pathname.startsWith('/admin/usuarios')} closeMobile={closeMobile} />
            <NavItem icon="tests" label="Evaluaciones" href="/admin/evaluaciones" active={pathname.startsWith('/admin/evaluaciones')} badge={attentionCount > 0 ? String(attentionCount) : undefined} closeMobile={closeMobile} />
            <NavItem icon="items" label="Pruebas y reactivos" href="/admin/pruebas" active={pathname.startsWith('/admin/pruebas')} closeMobile={closeMobile} />
          </section>
          <section>
            <span className="nav-label">Análisis y operación</span>
            <NavItem icon="reports" label="Resultados y reportes" href="/admin/reportes" active={pathname.startsWith('/admin/reportes') || pathname.startsWith('/admin/resultados')} closeMobile={closeMobile} />
            <NavItem icon="reports" label="Report Studio" href="/admin/report-studio" active={pathname.startsWith('/admin/report-studio')} closeMobile={closeMobile} />
            <NavItem icon="payments" label="Pagos y catálogo" href="/admin/pagos" active={pathname.startsWith('/admin/pagos')} closeMobile={closeMobile} />
            <NavItem icon="matrix" label="Normas y matrices" href="/admin/normas" active={pathname.startsWith('/admin/normas')} closeMobile={closeMobile} />
          </section>
          <section>
            <span className="nav-label">Sistema</span>
            <NavItem icon="settings" label="Configuración" href="/admin/configuracion" active={pathname.startsWith('/admin/configuracion')} closeMobile={closeMobile} />
            <NavItem icon="health" label="Estado del servidor" href="/admin/salud" active={pathname.startsWith('/admin/salud')} closeMobile={closeMobile} />
          </section>
        </nav>
        <div className="sidebar-status">
          <span className="online-dot" />
          <div>
            <strong>Sistema operativo</strong>
            <small>Todos los servicios activos</small>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="square-button" type="button" aria-label="Contraer menú" onClick={toggleMenu}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Interactive Global Search Input & Dropdown */}
          <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, maxWidth: '440px' }}>
            <form onSubmit={handleSearchSubmit}>
              <label className="search-box" style={{ width: '100%', cursor: 'text' }}>
                <Search size={16} color="#64748b" />
                <input
                  aria-label="Buscar en administración"
                  placeholder="Buscar usuarios, evaluaciones o reportes…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) setSearchOpen(true);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                      setSearchOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </form>

            {/* Dropdown de Resultados Globales */}
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 18px 40px rgba(8, 11, 18, 0.12)',
                  zIndex: 999,
                  maxHeight: '460px',
                  overflowY: 'auto',
                  padding: '8px 0',
                }}
              >
                {searchLoading ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    Buscando en Crevantia…
                  </div>
                ) : totalResultsCount === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    No se encontraron resultados para <b>"{searchQuery}"</b>.
                  </div>
                ) : (
                  <div>
                    {/* Sección: Navegación Rápida */}
                    {searchResults?.navigation && searchResults.navigation.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Módulos del Sistema
                        </div>
                        {searchResults.navigation.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item.href)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 14px',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <Compass size={14} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#080b12', display: 'block' }}>{item.title}</strong>
                              <small style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sección: Usuarios */}
                    {searchResults?.users && searchResults.users.length > 0 && (
                      <div style={{ marginBottom: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Usuarios
                        </div>
                        {searchResults.users.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item.href)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 14px',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <Users size={14} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#080b12', display: 'block' }}>{item.title}</strong>
                              <small style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sección: Evaluaciones */}
                    {searchResults?.attempts && searchResults.attempts.length > 0 && (
                      <div style={{ marginBottom: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Evaluaciones en Proceso
                        </div>
                        {searchResults.attempts.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item.href)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 14px',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <Zap size={14} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#080b12', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title}
                              </strong>
                              <small style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sección: Resultados y Reportes */}
                    {searchResults?.results && searchResults.results.length > 0 && (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Resultados y Reportes
                        </div>
                        {searchResults.results.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleSelectResult(item.href)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 14px',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <BarChart3 size={14} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#080b12', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.title}
                              </strong>
                              <small style={{ fontSize: '10px', color: '#64748b' }}>{item.subtitle}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="top-actions">
            <button
              className="square-button"
              type="button"
              aria-label="Monitoreo de evaluaciones"
              onClick={() => router.push('/admin/evaluaciones')}
              title={attentionCount > 0 ? `${attentionCount} evaluaciones requieren atención` : 'Todas las evaluaciones en orden'}
            >
              <Zap size={16} color={attentionCount > 0 ? '#f59e0b' : 'currentColor'} />
            </button>
            <div className="profile-chip">
              <span>CR</span>
              <div>
                <strong>Equipo Crevantia</strong>
                <small>Superadministrador</small>
              </div>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => void logout().then(() => router.push('/iniciar-sesion'))}
            >
              Salir
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
