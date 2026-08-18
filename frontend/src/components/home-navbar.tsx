'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, logout } from '@/lib/api';
import styles from '@/app/home.module.css';

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
}

export function HomeNavbar() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    apiFetch<AuthenticatedUser>('/auth/me')
      .then((res) => {
        if (active && res && res.id) {
          setUser(res);
        }
      })
      .catch(() => {
        // Not logged in
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    setUser(null);
    router.refresh();
  }

  const isAdmin = user?.roles?.some((r) => ['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r));
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <header className={styles.navbar}>
      <div className={`${styles.container} ${styles.navInner}`}>
        <a href="#inicio" className={styles.logoLink} aria-label="Ir al inicio">
          <Image
            className={styles.logo}
            src="/branding/logo-crevantia.png"
            alt="Crevantia"
            width={1600}
            height={416}
            priority
          />
        </a>

        <nav className={styles.navLinks} aria-label="Navegación principal">
          <a href="#evaluacion">La evaluación</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#precio">Precio</a>
          <a href="#faq">Preguntas frecuentes</a>
        </nav>

        <div className={styles.navActions}>
          {!loading && user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 14px 6px 8px',
                  borderRadius: '999px',
                  background: 'white',
                  border: '1px solid var(--line)',
                  boxShadow: '0 2px 8px rgba(8, 11, 18, 0.04)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--indigo), var(--cyan))',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '800',
                  }}
                >
                  {initials}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--night)' }}>
                  {user.firstName}
                </span>
                <span style={{ fontSize: '10px', color: '#687386' }}>▼</span>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '240px',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 12px 36px rgba(8, 11, 18, 0.12)',
                    border: '1px solid rgba(156, 166, 184, 0.18)',
                    padding: '8px',
                    zIndex: 50,
                    display: 'grid',
                    gap: '4px',
                  }}
                >
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <strong style={{ display: 'block', fontSize: '13px', color: 'var(--night)' }}>
                      {user.firstName} {user.lastName}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#687386', wordBreak: 'break-all' }}>
                      {user.email}
                    </span>
                  </div>

                  <Link
                    href="/panel"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>📝</span> Mis Evaluaciones
                  </Link>

                  <Link
                    href="/panel"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>🛍️</span> Compras y Recibos
                  </Link>

                  <Link
                    href="/panel"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>⚙️</span> Mi Perfil y Cuenta
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--indigo)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(48, 43, 120, 0.04)',
                      }}
                    >
                      <span>🛡️</span> Panel de Administración
                    </Link>
                  )}

                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px', paddingTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'var(--danger)',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span>🚪</span> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : !loading ? (
            <>
              <Link className={`${styles.button} ${styles.buttonOutline}`} href="/iniciar-sesion">
                Iniciar sesión
              </Link>
              <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/registro">
                Crear cuenta
              </Link>
            </>
          ) : null}
        </div>

        {/* Mobile menu */}
        <details className={styles.mobileMenu}>
          <summary aria-label="Abrir menú">
            <span aria-hidden="true">☰</span>
          </summary>
          <nav aria-label="Navegación móvil">
            <a href="#evaluacion">La evaluación</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precio">Precio</a>
            <a href="#faq">Preguntas frecuentes</a>
            {user ? (
              <>
                <Link href="/panel">Mi Panel ({user.firstName})</Link>
                {isAdmin && <Link href="/admin">Panel de Administración</Link>}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--danger)',
                    textAlign: 'left',
                    padding: '8px 0',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link href="/iniciar-sesion">Iniciar sesión</Link>
                <Link href="/registro">Crear cuenta</Link>
              </>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
