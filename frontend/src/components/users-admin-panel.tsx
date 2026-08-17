'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED' | 'LOCKED';
interface Role { id: string; code: string; name: string; description: string | null; isSystem: boolean }
interface User { id: string; email: string; firstName: string; lastName: string; status: UserStatus; emailVerifiedAt: string | null; createdAt: string; updatedAt: string; roles: Array<Pick<Role, 'id' | 'code' | 'name'>> }
interface UsersResponse { items: User[]; total: number; page: number; limit: number; roles: Role[] }

const statusLabels: Record<UserStatus, string> = { ACTIVE: 'Activo', PENDING_VERIFICATION: 'Pendiente', DISABLED: 'Deshabilitado', LOCKED: 'Bloqueado' };

export function UsersAdminPanel() {
  const [data, setData] = useState<UsersResponse>({ items: [], total: 0, page: 1, limit: 25, roles: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [editor, setEditor] = useState<User | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch<UsersResponse>('/admin/users')
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, []);

  async function load(page = 1, nextSearch = search, nextStatus = status) {
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25', status: nextStatus });
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    try { setData(await apiFetch<UsersResponse>(`/admin/users?${params}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cargar los usuarios.'); }
    finally { setLoading(false); }
  }

  function filter(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(1); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const payload = { firstName: String(form.get('firstName')), lastName: String(form.get('lastName')), email: String(form.get('email')), roleIds: form.getAll('roleIds').map(String) };
    try {
      if (editor === 'new') {
        const result = await apiFetch<{ invitationStatus: 'SENT' | 'FAILED' }>('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
        setMessage(result.invitationStatus === 'SENT' ? 'Usuario creado e invitación enviada.' : 'Usuario creado. Configura SMTP o reenvía la invitación cuando el correo esté disponible.');
      } else if (editor) {
        await apiFetch(`/admin/users/${editor.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Usuario actualizado. Los cambios de acceso invalidan sus sesiones anteriores.');
      }
      setEditor(null); await load(data.page);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar el usuario.'); }
    finally { setSaving(false); }
  }

  async function changeStatus(user: User) {
    const nextStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    const action = nextStatus === 'ACTIVE' ? 'activar' : 'deshabilitar';
    if (!window.confirm(`¿Deseas ${action} la cuenta de ${user.firstName} ${user.lastName}?`)) return;
    setError(''); setMessage('');
    try {
      await apiFetch(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      setMessage(nextStatus === 'ACTIVE' ? 'Cuenta activada.' : 'Cuenta deshabilitada y sesiones revocadas.'); await load(data.page);
    } catch (reason) { setError(reason instanceof Error ? reason.message : `No fue posible ${action} la cuenta.`); }
  }

  async function resendInvitation(user: User) {
    setError(''); setMessage('');
    try {
      const result = await apiFetch<{ invitationStatus: 'SENT' | 'FAILED'; message: string }>(`/admin/users/${user.id}/invitation`, { method: 'POST' });
      setMessage(result.message);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible enviar la invitación.'); }
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.limit));
  const editedUser = editor === 'new' ? null : editor;
  const defaultRoles = editor === 'new' ? data.roles.filter(({ code }) => code === 'USER').map(({ id }) => id) : editedUser?.roles.map(({ id }) => id) ?? [];

  return <div className="admin-content users-page">
    <section className="users-heading"><div><span className="eyebrow dark">Personas y acceso</span><h1>Usuarios</h1><p>Administra cuentas, roles e invitaciones desde un solo lugar.</p></div><button className="primary-button compact" type="button" onClick={() => { setEditor('new'); setError(''); setMessage(''); }}>+ Crear usuario</button></section>
    <section className="users-summary"><article><strong>{data.total}</strong><span>Usuarios encontrados</span></article><article><strong>{data.items.filter(({ status: value }) => value === 'ACTIVE').length}</strong><span>Activos en esta página</span></article><article><strong>{data.items.filter(({ status: value }) => value !== 'ACTIVE').length}</strong><span>Requieren atención</span></article></section>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    <section className="panel users-panel">
      <form className="users-toolbar" onSubmit={filter}><label className="users-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o correo…" aria-label="Buscar usuarios"/></label><select value={status} onChange={(event) => { setStatus(event.target.value); void load(1, search, event.target.value); }} aria-label="Filtrar por estado"><option value="ALL">Todos los estados</option><option value="ACTIVE">Activos</option><option value="PENDING_VERIFICATION">Pendientes</option><option value="LOCKED">Bloqueados</option><option value="DISABLED">Deshabilitados</option></select><button className="secondary-button" type="submit">Buscar</button></form>
      <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Usuario</th><th>Roles</th><th>Estado</th><th>Alta</th><th aria-label="Acciones"/></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="table-empty">Cargando usuarios…</td></tr> : data.items.length === 0 ? <tr><td colSpan={5} className="table-empty">No se encontraron usuarios.</td></tr> : data.items.map((user) => <tr key={user.id}><td><div className="user-identity"><span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div></div></td><td><div className="role-chips">{user.roles.map((role) => <span key={role.id}>{role.name}</span>)}</div></td><td><span className={`user-status ${user.status.toLowerCase()}`}>{statusLabels[user.status]}</span></td><td><time dateTime={user.createdAt}>{new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(user.createdAt))}</time></td><td><div className="row-actions"><button type="button" onClick={() => { setEditor(user); setError(''); setMessage(''); }}>Editar</button><button type="button" onClick={() => void resendInvitation(user)} disabled={user.status === 'DISABLED'}>Invitar</button><button className={user.status === 'DISABLED' ? 'enable' : 'disable'} type="button" onClick={() => void changeStatus(user)}>{user.status === 'DISABLED' ? 'Activar' : 'Deshabilitar'}</button></div></td></tr>)}</tbody></table></div>
      <footer className="table-pagination"><span>Página {data.page} de {pageCount}</span><div><button className="secondary-button" type="button" disabled={data.page <= 1 || loading} onClick={() => void load(data.page - 1)}>Anterior</button><button className="secondary-button" type="button" disabled={data.page >= pageCount || loading} onClick={() => void load(data.page + 1)}>Siguiente</button></div></footer>
    </section>
    {editor && <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title"><button className="modal-backdrop" type="button" aria-label="Cerrar formulario" onClick={() => setEditor(null)}/><form className="user-editor" key={editor === 'new' ? 'new' : editor.id} onSubmit={save}><header><div><span className="eyebrow dark">Cuenta</span><h2 id="user-editor-title">{editor === 'new' ? 'Crear usuario' : 'Editar usuario'}</h2><p>{editor === 'new' ? 'La persona recibirá un enlace para establecer su contraseña.' : 'Actualiza los datos y accesos de la cuenta.'}</p></div><button type="button" aria-label="Cerrar" onClick={() => setEditor(null)}>×</button></header><div className="editor-grid"><label>Nombre<input name="firstName" defaultValue={editedUser?.firstName} required minLength={2} maxLength={100}/></label><label>Apellidos<input name="lastName" defaultValue={editedUser?.lastName} required minLength={2} maxLength={150}/></label><label className="full">Correo electrónico<input name="email" type="email" defaultValue={editedUser?.email} required maxLength={191}/></label></div><fieldset className="editor-roles"><legend>Roles de acceso</legend>{data.roles.map((role) => <label key={role.id}><input name="roleIds" type="checkbox" value={role.id} defaultChecked={defaultRoles.includes(role.id)}/><span><strong>{role.name}</strong><small>{role.description}</small></span></label>)}</fieldset><aside className="invitation-note"><strong>Invitación segura</strong><p>No se enviará una contraseña por correo. El enlace será de un solo uso y caducará en 48 horas.</p></aside><footer><button className="secondary-button" type="button" onClick={() => setEditor(null)}>Cancelar</button><button className="primary-button compact" disabled={saving}>{saving ? 'Guardando…' : editor === 'new' ? 'Crear y enviar invitación' : 'Guardar cambios'}</button></footer></form></div>}
  </div>;
}
