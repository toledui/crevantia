'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  emailVerifiedAt: string | null;
  roles: string[];
}

export function UserProfilePanel() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Common notification state
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Profile edit state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<UserProfile>('/auth/me')
      .then((user) => {
        if (active && user) {
          setProfile(user);
          setFirstName(user.firstName);
          setLastName(user.lastName);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No fue posible cargar el perfil.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setMessage('');
    setError('');

    try {
      const res = await apiFetch<{ success: boolean; message: string; user: UserProfile }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName, lastName }),
      });
      setMessage(res.message || 'Perfil actualizado correctamente.');
      if (res.user) {
        setProfile((prev) => (prev ? { ...prev, firstName: res.user.firstName, lastName: res.user.lastName } : null));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las nuevas contraseñas no coinciden.');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMessage(res.message || 'Contraseña actualizada exitosamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña.');
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <strong>Cargando información del perfil…</strong>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '28px', maxWidth: '800px', margin: '0 auto' }}>
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />

      {/* Personal Information Card */}
      <article
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px',
          border: '1px solid var(--line)',
          boxShadow: '0 4px 20px rgba(8, 11, 18, 0.04)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ fontSize: '18px', color: 'var(--night)', display: 'block', marginBottom: '4px' }}>
            Información Personal
          </strong>
          <span style={{ fontSize: '13px', color: '#687386' }}>
            Actualiza tus nombres y apellidos asociados a tus evaluaciones y reportes.
          </span>
        </div>

        <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
              Nombre(s)
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                minLength={2}
                style={{
                  height: '46px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  background: '#f8fafc',
                }}
              />
            </label>

            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
              Apellidos
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                minLength={2}
                style={{
                  height: '46px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  background: '#f8fafc',
                }}
              />
            </label>
          </div>

          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
            Correo electrónico
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  background: '#f1f5f9',
                  color: '#64748b',
                  cursor: 'not-allowed',
                }}
              />
              <span
                className={`status-badge ${profile?.emailVerifiedAt ? 'published' : 'draft'}`}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                }}
              >
                {profile?.emailVerifiedAt ? 'Verificado' : 'Sin verificar'}
              </span>
            </div>
            <small style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
              El correo está vinculado a tu cuenta y compras. Para modificarlo, contacta a soporte.
            </small>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="submit"
              className="primary-button compact"
              disabled={savingProfile}
              style={{ padding: '0 24px', height: '42px', fontSize: '13px' }}
            >
              {savingProfile ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </article>

      {/* Security & Password Card */}
      <article
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px',
          border: '1px solid var(--line)',
          boxShadow: '0 4px 20px rgba(8, 11, 18, 0.04)',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <strong style={{ fontSize: '18px', color: 'var(--night)', display: 'block', marginBottom: '4px' }}>
            Seguridad y Contraseña
          </strong>
          <span style={{ fontSize: '13px', color: '#687386' }}>
            Cambia tu contraseña para mantener protegida tu cuenta. Recibirás una notificación por correo al confirmarse el cambio.
          </span>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'grid', gap: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
            Contraseña actual
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                height: '46px',
                padding: '0 14px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                fontSize: '14px',
                background: '#f8fafc',
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
              Nueva contraseña
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="Mín. 10 caracteres"
                style={{
                  height: '46px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  background: '#f8fafc',
                }}
              />
            </label>

            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'grid', gap: '6px' }}>
              Confirmar nueva contraseña
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
                style={{
                  height: '46px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontSize: '14px',
                  background: '#f8fafc',
                }}
              />
            </label>
          </div>

          <small style={{ fontSize: '11px', color: '#64748b' }}>
            ℹ️ La nueva contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula y número. Al actualizarla, se cerrarán las sesiones en otros navegadores.
          </small>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="submit"
              className="secondary-button compact"
              disabled={savingPassword || !currentPassword || !newPassword}
              style={{ padding: '0 24px', height: '42px', fontSize: '13px' }}
            >
              {savingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
