'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AdminToast } from '@/components/admin-toast';
import { apiFetch } from '@/lib/api';

interface Permission { id: string; code: string; description: string | null }
interface Role { id: string; code: string; name: string; description: string | null; isSystem: boolean; permissionIds: string[]; userCount: number }
interface AccessData { roles: Role[]; permissions: Permission[] }

const moduleNames: Record<string, string> = {
  admin: 'Administración',
  dashboard: 'Dashboard',
  users: 'Usuarios',
  assignments: 'Asignaciones',
  attempts: 'Evaluaciones e intentos',
  assessment: 'Diseño de evaluaciones',
  tests: 'Pruebas y reactivos',
  scoring: 'Puntuación',
  norm: 'Normas y baremos',
  result: 'Resultados',
  report_studio: 'Report Studio',
  payments: 'Pagos',
  pricing: 'Productos y precios',
  coupons: 'Cupones',
  settings: 'Configuración general',
  mail: 'Correo',
  stripe: 'Stripe',
  system: 'Estado del sistema',
  roles: 'Roles y permisos',
};

export function RolesPermissionsPanel() {
  const [data, setData] = useState<AccessData>({ roles: [], permissions: [] });
  const [selectedId, setSelectedId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<AccessData>('/admin/settings/roles');
      setData(result);
      setSelectedId((current) => current && result.roles.some(({ id }) => id === current) ? current : result.roles[0]?.id ?? '');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible cargar los accesos.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    apiFetch<AccessData>('/admin/settings/roles')
      .then((result) => { setData(result); setSelectedId(result.roles[0]?.id ?? ''); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar los accesos.'))
      .finally(() => setLoading(false));
  }, []);

  const selected = data.roles.find(({ id }) => id === selectedId);
  const grouped = useMemo(() => Object.entries(data.permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const permissionModule = permission.code.split('.')[0];
    (groups[permissionModule] ??= []).push(permission);
    return groups;
  }, {})), [data.permissions]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(creating ? { code: String(form.get('code')).trim().toUpperCase() } : {}),
      name: String(form.get('name')).trim(),
      description: String(form.get('description')).trim(),
      permissionIds: form.getAll('permissionIds').map(String),
    };
    try {
      if (creating) await apiFetch('/admin/settings/roles', { method: 'POST', body: JSON.stringify(payload) });
      else if (selected) await apiFetch(`/admin/settings/roles/${selected.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setMessage(creating ? 'Rol creado correctamente.' : 'Permisos actualizados. Se aplicarán al renovar la sesión de cada usuario.');
      setCreating(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible guardar el rol.'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!selected || !window.confirm(`¿Eliminar el rol “${selected.name}”?`)) return;
    setSaving(true); setError(''); setMessage('');
    try { await apiFetch(`/admin/settings/roles/${selected.id}`, { method: 'DELETE' }); setMessage('Rol eliminado.'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No fue posible eliminar el rol.'); }
    finally { setSaving(false); }
  }

  const role = creating ? undefined : selected;
  const locked = role?.code === 'SUPERADMIN' || role?.code === 'SUPER_ADMIN';

  return (
    <section className="settings-section access-section">
      <AdminToast error={error} message={message} setError={setError} setMessage={setMessage} />
      <div className="settings-section-title">
        <div>
          <span className="eyebrow dark">Control de acceso</span>
          <h2>Roles y permisos</h2>
          <p>Crea perfiles de acceso reutilizables para los módulos administrativos.</p>
        </div>
        <button
          className="primary-button compact"
          type="button"
          onClick={() => {
            setCreating(true);
            setMessage('');
            setError('');
          }}
        >
          + Nuevo rol
        </button>
      </div>
    {loading ? <div className="panel access-loading">Cargando roles y permisos…</div> : <div className="access-layout">
      <aside className="panel role-list" aria-label="Roles disponibles">
        {data.roles.map((item) => <button type="button" key={item.id} className={!creating && item.id === selectedId ? 'active' : ''} onClick={() => { setSelectedId(item.id); setCreating(false); setError(''); setMessage(''); }}><span><strong>{item.name}</strong><small>{item.code}</small></span><b>{item.userCount}</b></button>)}
      </aside>
      <form className="panel role-editor" key={creating ? 'new' : role?.id} onSubmit={save}>
        <header><div><h3>{creating ? 'Crear nuevo rol' : role?.name}</h3><p>{locked ? 'Este rol conserva siempre todos los permisos.' : 'Selecciona las acciones que podrá realizar este rol.'}</p></div>{role?.isSystem && <span>Rol del sistema</span>}</header>
        {creating && <label className="role-field">Código<input name="code" placeholder="EJ. SOPORTE" pattern="[A-Z][A-Z0-9_]*" maxLength={50} required/></label>}
        <div className="role-fields"><label className="role-field">Nombre<input name="name" defaultValue={role?.name} maxLength={100} required disabled={locked}/></label><label className="role-field">Descripción<input name="description" defaultValue={role?.description ?? ''} maxLength={255} disabled={locked}/></label></div>
        <div className="permissions-head"><strong>Permisos</strong><span>{locked ? data.permissions.length : role?.permissionIds.length ?? 0} de {data.permissions.length} asignados</span></div>
        <div className="permission-groups">{grouped.map(([permissionModule, permissions]) => <fieldset key={permissionModule}><legend>{moduleNames[permissionModule] ?? permissionModule}</legend>{permissions.map((permission) => <label key={permission.id}><input type="checkbox" name="permissionIds" value={permission.id} defaultChecked={locked || role?.permissionIds.includes(permission.id)} disabled={locked}/><span><strong>{permission.code}</strong><small>{permission.description}</small></span></label>)}</fieldset>)}</div>
        <footer><div>{role && !role.isSystem && <button className="danger-button" type="button" onClick={() => void remove()} disabled={saving}>Eliminar rol</button>}</div><div className="role-actions">{creating && <button className="secondary-button" type="button" onClick={() => setCreating(false)}>Cancelar</button>}<button className="primary-button compact" disabled={saving || locked}>{saving ? 'Guardando…' : creating ? 'Crear rol' : 'Guardar permisos'}</button></div></footer>
      </form>
    </div>}
    </section>
  );
}
