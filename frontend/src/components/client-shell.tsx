'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileText,
  Play,
  Search,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import { apiFetch, logout } from '@/lib/api';
import { Brand } from './brand';

type IconName = 'dashboard' | 'users' | 'tests' | 'items' | 'reports' | 'payments' | 'matrix' | 'settings' | 'home';

const paths: Record<IconName, ReactNode> = {
  home: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>,
  tests: <><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  items: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  reports: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/></>,
  payments: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>,
  matrix: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06L7.04 4.3l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.37.46.99 1.51 1H21v4h-.09c-1.05.01-1.39.63-1.51 1Z"/></>,
};

function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export type ClientTab = 'assessments' | 'purchases' | 'profile' | 'catalog';

interface ClientShellProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
  children: ReactNode;
}

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AssignmentData {
  id: string;
  status: string;
  test: { id: string; code: string; name: string; description: string | null };
  attempt: { id: string; status: string; resultRuns?: Array<{ id: string }> } | null;
}

interface ProductData {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
}

export function ClientShell({ activeTab, onTabChange, children }: ClientShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<UserData>('/auth/me').catch(() => null),
      apiFetch<{ items: AssignmentData[] }>('/me/assignments').catch(() => ({ items: [] })),
      apiFetch<ProductData[]>('/pricing/products').catch(() => []),
    ]).then(([userData, assignData, prodData]) => {
      if (active) {
        if (userData) setUser(userData);
        if (assignData?.items) setAssignments(assignData.items);
        if (prodData) setProducts(prodData);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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

  function toggleMenu() {
    if (window.innerWidth <= 760) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  function handleTabClick(tab: ClientTab) {
    onTabChange(tab);
    closeMobile();
  }

  const q = searchQuery.trim().toLowerCase();

  const matchingAssignments = q
    ? assignments.filter(
        (a) =>
          a.test.name.toLowerCase().includes(q) ||
          a.test.code.toLowerCase().includes(q) ||
          (a.test.description && a.test.description.toLowerCase().includes(q))
      )
    : [];

  const matchingProducts = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    : [];

  const quickSections = [
    { title: 'Mis Evaluaciones', subtitle: 'Pruebas asignadas y en progreso', tab: 'assessments' as ClientTab, icon: Play, keywords: 'evaluaciones mis pruebas dpo preguntas contestar' },
    { title: 'Catálogo de Pruebas', subtitle: 'Adquirir nuevas licencias psicométricas', tab: 'catalog' as ClientTab, icon: ShoppingCart, keywords: 'catalogo catálogo comprar adquirir precios nuevas' },
    { title: 'Mis Compras y Recibos', subtitle: 'Historial de órdenes y facturación', tab: 'purchases' as ClientTab, icon: CreditCard, keywords: 'compras comprobantes recibos facturas órdenes pagos' },
    { title: 'Mi Perfil y Seguridad', subtitle: 'Datos personales y contraseña', tab: 'profile' as ClientTab, icon: User, keywords: 'perfil cuenta contraseña credenciales usuario correo' },
  ];

  const matchingSections = q
    ? quickSections.filter(
        (s) => s.title.toLowerCase().includes(q) || s.keywords.includes(q)
      )
    : [];

  const totalResults = matchingAssignments.length + matchingProducts.length + matchingSections.length;

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!q) return;

    if (matchingAssignments[0]) {
      const a = matchingAssignments[0];
      if (a.attempt?.status === 'COMPLETED' && a.attempt.resultRuns?.[0]?.id) {
        router.push(`/resultados/${a.attempt.resultRuns[0].id}`);
      } else if (a.attempt?.id) {
        router.push(`/evaluacion/${a.attempt.id}`);
      } else {
        onTabChange('assessments');
      }
    } else if (matchingProducts[0]) {
      onTabChange('catalog');
    } else if (matchingSections[0]) {
      onTabChange(matchingSections[0].tab);
    }
    setSearchOpen(false);
  }

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'CL';

  return (
    <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <button className="mobile-overlay" type="button" aria-label="Cerrar menú" onClick={closeMobile} />

      <aside className="sidebar">
        <Brand light />

        <nav>
          <section>
            <span className="nav-label">Mi Espacio</span>
            <button
              type="button"
              className={activeTab === 'assessments' ? 'active' : ''}
              onClick={() => handleTabClick('assessments')}
            >
              <Icon name="tests" />
              <span>Mis Evaluaciones</span>
            </button>
            <button
              type="button"
              className={activeTab === 'catalog' ? 'active' : ''}
              onClick={() => handleTabClick('catalog')}
            >
              <Icon name="items" />
              <span>Catálogo de Pruebas</span>
            </button>
            <button
              type="button"
              className={activeTab === 'purchases' ? 'active' : ''}
              onClick={() => handleTabClick('purchases')}
            >
              <Icon name="payments" />
              <span>Mis Compras</span>
            </button>
          </section>

          <section>
            <span className="nav-label">Configuración</span>
            <button
              type="button"
              className={activeTab === 'profile' ? 'active' : ''}
              onClick={() => handleTabClick('profile')}
            >
              <Icon name="settings" />
              <span>Mi Perfil</span>
            </button>
          </section>

          <section>
            <span className="nav-label">Acceso Directo</span>
            <Link href="/" onClick={closeMobile}>
              <Icon name="home" />
              <span>Volver a la Portada</span>
            </Link>
          </section>
        </nav>

        <div className="sidebar-status">
          <span className="online-dot" />
          <div>
            <strong>Espacio de Cliente</strong>
            <small>Cuenta verificada</small>
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

          {/* Interactive Search Input & Dropdown for Client Shell */}
          <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, maxWidth: '440px' }}>
            <form onSubmit={handleSearchSubmit}>
              <label className="search-box" style={{ width: '100%', cursor: 'text' }}>
                <Search size={16} color="#64748b" />
                <input
                  aria-label="Buscar en panel de cliente"
                  placeholder="Buscar mis evaluaciones, recibos o pruebas…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 1) setSearchOpen(true);
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
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

            {/* Dropdown de Resultados de Cliente */}
            {searchOpen && searchQuery.trim().length >= 1 && (
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
                  maxHeight: '440px',
                  overflowY: 'auto',
                  padding: '8px 0',
                }}
              >
                {totalResults === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                    No se encontraron coincidencias para <b>"{searchQuery}"</b>.
                  </div>
                ) : (
                  <div>
                    {/* Mis Evaluaciones */}
                    {matchingAssignments.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Mis Evaluaciones
                        </div>
                        {matchingAssignments.map((a) => {
                          const isCompleted = a.attempt?.status === 'COMPLETED';
                          const resultId = a.attempt?.resultRuns?.[0]?.id;

                          return (
                            <div
                              key={a.id}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                if (isCompleted && resultId) {
                                  router.push(`/resultados/${resultId}`);
                                } else if (a.attempt?.id) {
                                  router.push(`/evaluacion/${a.attempt.id}`);
                                } else {
                                  onTabChange('assessments');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 14px',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  background: isCompleted ? '#dcfce7' : '#e0f2fe',
                                  color: isCompleted ? '#15803d' : '#0369a1',
                                  display: 'grid',
                                  placeItems: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isCompleted ? <BarChart3 size={14} /> : <Play size={14} />}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '12px', color: '#080b12', display: 'block' }}>{a.test.name}</strong>
                                <small style={{ fontSize: '10px', color: '#64748b' }}>
                                  {isCompleted ? '✓ Completada · Ver resultados' : 'En progreso · Continuar'}
                                </small>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Catálogo de Pruebas */}
                    {matchingProducts.length > 0 && (
                      <div style={{ marginBottom: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Catálogo de Pruebas
                        </div>
                        {matchingProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchQuery('');
                              onTabChange('catalog');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 14px',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <ShoppingCart size={14} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '12px', color: '#080b12', display: 'block' }}>{p.name}</strong>
                              <small style={{ fontSize: '10px', color: '#64748b' }}>Ver en catálogo de evaluaciones</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Secciones Rápidas */}
                    {matchingSections.length > 0 && (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                        <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Secciones del Panel
                        </div>
                        {matchingSections.map((sec) => {
                          const IconComponent = sec.icon;
                          return (
                            <div
                              key={sec.tab}
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery('');
                                onTabChange(sec.tab);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 14px',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                <IconComponent size={14} />
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <strong style={{ fontSize: '12px', color: '#080b12', display: 'block' }}>{sec.title}</strong>
                                <small style={{ fontSize: '10px', color: '#64748b' }}>{sec.subtitle}</small>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="top-actions">
            <div className="profile-chip">
              <span>{initials}</span>
              <div>
                <strong>{user ? `${user.firstName} ${user.lastName}` : 'Cliente Crevantia'}</strong>
                <small>{user?.email || 'Usuario'}</small>
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

        <div style={{ padding: '24px', maxWidth: '1280px', width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
