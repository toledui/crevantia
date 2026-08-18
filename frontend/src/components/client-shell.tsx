'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
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

export function ClientShell({ activeTab, onTabChange, children }: ClientShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    let active = true;
    apiFetch<UserData>('/auth/me')
      .then((data) => {
        if (active && data) setUser(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function toggleMenu() {
    if (window.innerWidth <= 760) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  function handleTabClick(tab: ClientTab) {
    onTabChange(tab);
    closeMobile();
  }

  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r));
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'CL';

  return (
    <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <button className="mobile-overlay" type="button" aria-label="Cerrar menú" onClick={closeMobile} />
      
      <aside className="sidebar">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Brand light />
        </Link>
        
        <nav>
          <section>
            <span className="nav-label">Evaluaciones</span>
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
              <Icon name="matrix" />
              <span>Catálogo de Pruebas</span>
            </button>
          </section>

          <section>
            <span className="nav-label">Finanzas y Facturación</span>
            <button
              type="button"
              className={activeTab === 'purchases' ? 'active' : ''}
              onClick={() => handleTabClick('purchases')}
            >
              <Icon name="payments" />
              <span>Compras y Recibos</span>
            </button>
          </section>

          <section>
            <span className="nav-label">Cuenta y Ajustes</span>
            <button
              type="button"
              className={activeTab === 'profile' ? 'active' : ''}
              onClick={() => handleTabClick('profile')}
            >
              <Icon name="settings" />
              <span>Mi Perfil y Seguridad</span>
            </button>
            
            {isAdmin && (
              <Link href="/admin" onClick={closeMobile}>
                <Icon name="dashboard" />
                <span>Panel de Admin</span>
                <b>PRO</b>
              </Link>
            )}
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

          <label className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input aria-label="Buscar" placeholder="Buscar mis evaluaciones, recibos o pruebas…" />
          </label>

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
