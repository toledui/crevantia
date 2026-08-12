'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { logout } from '@/lib/api';
import { Brand } from './brand';

type IconName = 'dashboard' | 'users' | 'tests' | 'items' | 'reports' | 'payments' | 'matrix' | 'settings' | 'logs';

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>,
  tests: <><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  items: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  reports: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/></>,
  payments: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/>,
  matrix: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06L7.04 4.3l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.37.46.99 1.51 1H21v4h-.09c-1.05.01-1.39.63-1.51 1Z"/></>,
  logs: <><path d="M4 19h16M4 5h16"/><path d="M9 9h6v6H9z"/></>,
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

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  function toggleMenu() {
    if (window.innerWidth <= 760) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  return <div className={`admin-shell${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
    <button className="mobile-overlay" type="button" aria-label="Cerrar menú" onClick={closeMobile}/>
    <aside className="sidebar">
      <Brand light/>
      <nav>
        <section><span className="nav-label">Centro de control</span><NavItem icon="dashboard" label="Resumen ejecutivo" href="/admin" active={pathname === '/admin'} closeMobile={closeMobile}/><NavItem icon="users" label="Usuarios" closeMobile={closeMobile}/><NavItem icon="tests" label="Evaluaciones" badge="3" closeMobile={closeMobile}/><NavItem icon="items" label="Pruebas y reactivos" closeMobile={closeMobile}/></section>
        <section><span className="nav-label">Análisis y operación</span><NavItem icon="reports" label="Resultados y reportes" closeMobile={closeMobile}/><NavItem icon="payments" label="Pagos" closeMobile={closeMobile}/><NavItem icon="matrix" label="Normas y matrices" closeMobile={closeMobile}/></section>
        <section><span className="nav-label">Sistema</span><NavItem icon="settings" label="Configuración" href="/admin/configuracion" active={pathname.startsWith('/admin/configuracion')} closeMobile={closeMobile}/><NavItem icon="logs" label="Registros técnicos" closeMobile={closeMobile}/></section>
      </nav>
      <div className="sidebar-status"><span className="online-dot"/><div><strong>Sistema operativo</strong><small>Todos los servicios activos</small></div></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar">
        <button className="square-button" type="button" aria-label="Contraer menú" onClick={toggleMenu}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <label className="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input aria-label="Buscar" placeholder="Buscar usuarios, evaluaciones o reportes…"/></label>
        <div className="top-actions">
          <button className="square-button" type="button" aria-label="Notificaciones"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></button>
          <div className="profile-chip"><span>CR</span><div><strong>Equipo Crevantia</strong><small>Superadministrador</small></div></div>
          <button className="text-button" type="button" onClick={() => void logout().then(() => router.push('/iniciar-sesion'))}>Salir</button>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
