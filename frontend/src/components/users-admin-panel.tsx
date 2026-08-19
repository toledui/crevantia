

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, Mail, RotateCw, Target, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AdminToast } from '@/components/admin-toast';
import { ConfirmModal } from '@/components/confirm-modal';

type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED' | 'LOCKED';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface UserAssignmentSummary {
  id: string;
  testId?: string;
  type: string;
  status: string;
  createdAt: string;
  test: { id?: string; code: string; name: string };
  attempt: { id: string; status: string } | null;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<Pick<Role, 'id' | 'code' | 'name'>>;
  assignments?: UserAssignmentSummary[];
  _count?: { assignments: number };
}

interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  limit: number;
  roles: Role[];
}

interface AssignableTest {
  id: string;
  code: string;
  name: string;
  description: string | null;
  publishedVersion: { id: string; version: number; estimatedMin: number | null; language: string } | null;
  versions: Array<{ id: string; version: number; status: string }>;
}

interface UserAssignmentItem {
  id: string;
  type: string;
  status: string;
  reason: string | null;
  createdAt: string;
  test: { id: string; code: string; name: string; description: string | null };
  testVersion: { id: string; version: number; language: string; estimatedMin: number | null };
  attempt: {
    id: string;
    status: string;
    startedAt: string | null;
    pausedAt: string | null;
    submittedAt: string | null;
    completedAt: string | null;
    lastActivityAt: string | null;
  } | null;
}

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  PENDING_VERIFICATION: 'Pendiente',
  DISABLED: 'Deshabilitado',
  LOCKED: 'Bloqueado',
};

const assignmentStatusLabels: Record<string, { label: string; bg: string; color: string }> = {
  AVAILABLE: { label: 'Disponible para responder', bg: '#dcfce7', color: '#15803d' },
  IN_PROGRESS: { label: 'En progreso', bg: '#fef9c3', color: '#a16207' },
  COMPLETED: { label: 'Completada', bg: '#e0e7ff', color: '#3730a3' },
  EXPIRED: { label: 'Expirada', bg: '#fee2e2', color: '#991b1b' },
  REVOKED: { label: 'Revocada', bg: '#f1f5f9', color: '#475569' },
};

function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function UsersAdminPanel() {
  const [data, setData] = useState<UsersResponse>({ items: [], total: 0, page: 1, limit: 25, roles: [] });
  const [assignableTests, setAssignableTests] = useState<AssignableTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modals state
  const [editor, setEditor] = useState<User | 'new' | null>(null);
  const [passwordMode, setPasswordMode] = useState<'INVITE_LINK' | 'MANUAL_PASSWORD'>('INVITE_LINK');
  const [manualPassword, setManualPassword] = useState('');
  const [sendCredentialsEmail, setSendCredentialsEmail] = useState(true);
  const [withInitialAssignment, setWithInitialAssignment] = useState(false);
  const [initialTestId, setInitialTestId] = useState('');
  const [initialReason, setInitialReason] = useState('Asignación de bienvenida');

  // Inline assignment state inside "Editar usuario"
  const [editorAssignments, setEditorAssignments] = useState<UserAssignmentItem[]>([]);
  const [loadingEditorAssignments, setLoadingEditorAssignments] = useState(false);
  const [showInlineAssign, setShowInlineAssign] = useState(false);
  const [inlineTestId, setInlineTestId] = useState('');
  const [inlineReason, setInlineReason] = useState('Asignación administrativa sin costo');
  const [inlineSendEmail, setInlineSendEmail] = useState(true);

  // Assign test modal (Standalone)
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [assignTargetUserId, setAssignTargetUserId] = useState('');
  const [assignTestId, setAssignTestId] = useState('');
  const [assignType, setAssignType] = useState<'ADMIN_FREE' | 'PROMOTIONAL' | 'SUPPORT_REPLACEMENT'>('ADMIN_FREE');
  const [assignReason, setAssignReason] = useState('Cortesía / Asignación directa por administrador');
  const [assignSendEmail, setAssignSendEmail] = useState(true);
  const [assignCustomMessage, setAssignCustomMessage] = useState('');

  // User assignments drawer / modal
  const [assignmentsViewer, setAssignmentsViewer] = useState<{
    user: User;
    items: UserAssignmentItem[];
    loading: boolean;
  } | null>(null);
  const [resendingAssignmentId, setResendingAssignmentId] = useState<string | null>(null);
  const [revokingAssignmentId, setRevokingAssignmentId] = useState<string | null>(null);

  // Custom confirmation modal state
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
    variant: 'danger',
    loading: false,
    action: () => {},
  });

  useEffect(() => {
    Promise.all([
      apiFetch<UsersResponse>('/admin/users'),
      apiFetch<{ items: AssignableTest[] }>('/admin/users/assignable-tests').catch(() => ({ items: [] })),
    ])
      .then(([usersRes, testsRes]) => {
        setData(usersRes);
        setAssignableTests(testsRes.items || []);
        if (testsRes.items?.[0]) {
          setAssignTestId(testsRes.items[0].id);
          setInitialTestId(testsRes.items[0].id);
          setInlineTestId(testsRes.items[0].id);
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'No fue posible cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, []);

  async function load(page = 1, nextSearch = search, nextStatus = status) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25', status: nextStatus });
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    try {
      setData(await apiFetch<UsersResponse>(`/admin/users?${params}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(1);
  }

  function getActiveAssignedTestIds(user: User | null): string[] {
    if (!user || !user.assignments) return [];
    return user.assignments
      .filter((a) => a.status === 'AVAILABLE' || a.status === 'IN_PROGRESS' || a.status === 'COMPLETED')
      .map((a) => a.testId || a.test?.id)
      .filter((id): id is string => Boolean(id));
  }

  function getAvailableTestsForUser(user: User | null): AssignableTest[] {
    if (!user) return assignableTests;
    const assignedIds = getActiveAssignedTestIds(user);
    return assignableTests.filter((t) => !assignedIds.includes(t.id));
  }

  async function openEditModal(user: User) {
    setEditor(user);
    setError('');
    setMessage('');
    setShowInlineAssign(false);
    setLoadingEditorAssignments(true);

    try {
      const res = await apiFetch<{ user: User; items: UserAssignmentItem[] }>(`/admin/users/${user.id}/assignments`);
      setEditorAssignments(res.items);
      const assignedIds = res.items
        .filter((a) => a.status === 'AVAILABLE' || a.status === 'IN_PROGRESS' || a.status === 'COMPLETED')
        .map((a) => a.test.id);
      const available = assignableTests.filter((t) => !assignedIds.includes(t.id));
      if (available.length > 0) {
        setInlineTestId(available[0].id);
      }
    } catch {
      setEditorAssignments([]);
    } finally {
      setLoadingEditorAssignments(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') || '').trim();
    const lastName = String(form.get('lastName') || '').trim();
    const email = String(form.get('email') || '').trim().toLowerCase();
    const roleIds = form.getAll('roleIds').map(String);

    try {
      if (editor === 'new') {
        const payload: Record<string, unknown> = {
          firstName,
          lastName,
          email,
          roleIds,
          passwordMode,
        };

        if (passwordMode === 'MANUAL_PASSWORD') {
          payload.manualPassword = manualPassword.trim();
          payload.sendCredentialsEmail = sendCredentialsEmail;
        }

        if (withInitialAssignment && initialTestId) {
          payload.initialAssignment = {
            testId: initialTestId,
            reason: initialReason.trim(),
            sendEmail: true,
          };
        }

        const result = await apiFetch<{
          message: string;
          invitationStatus: 'SENT' | 'FAILED' | 'SKIPPED';
          tempPassword?: string | null;
        }>('/admin/users', { method: 'POST', body: JSON.stringify(payload) });

        setMessage(result.message || 'Usuario creado exitosamente.');
      } else if (editor) {
        await apiFetch(`/admin/users/${editor.id}`, {
          method: 'PUT',
          body: JSON.stringify({ firstName, lastName, email, roleIds }),
        });
        setMessage('Usuario actualizado correctamente.');
      }
      setEditor(null);
      await load(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible guardar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  async function submitInlineAssignment() {
    if (!editor || editor === 'new' || !inlineTestId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ message: string }>(`/admin/users/${editor.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          testId: inlineTestId,
          type: 'ADMIN_FREE',
          reason: inlineReason.trim(),
          sendEmail: inlineSendEmail,
        }),
      });
      setMessage(result.message || 'Evaluación asignada exitosamente.');
      setShowInlineAssign(false);

      const res = await apiFetch<{ items: UserAssignmentItem[] }>(`/admin/users/${editor.id}/assignments`);
      setEditorAssignments(res.items);
      await load(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible asignar la prueba.');
    } finally {
      setSaving(false);
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = assignModal.user?.id || assignTargetUserId;
    if (!targetUserId) {
      setError('Debes seleccionar un usuario para la asignación.');
      return;
    }
    if (!assignTestId) {
      setError('Debes seleccionar una prueba para asignar.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await apiFetch<{ message: string; emailStatus: string }>(
        `/admin/users/${targetUserId}/assignments`,
        {
          method: 'POST',
          body: JSON.stringify({
            testId: assignTestId,
            type: assignType,
            reason: assignReason.trim(),
            sendEmail: assignSendEmail,
            customMessage: assignCustomMessage.trim() || undefined,
          }),
        },
      );

      setMessage(result.message || 'Prueba asignada exitosamente.');
      setAssignModal({ isOpen: false, user: null });
      setAssignCustomMessage('');
      await load(data.page);

      if (assignmentsViewer && assignmentsViewer.user.id === targetUserId) {
        void openAssignmentsViewer(assignmentsViewer.user);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible asignar la prueba.');
    } finally {
      setSaving(false);
    }
  }

  async function openAssignmentsViewer(user: User) {
    setAssignmentsViewer({ user, items: [], loading: true });
    setError('');
    try {
      const res = await apiFetch<{ user: User; items: UserAssignmentItem[] }>(`/admin/users/${user.id}/assignments`);
      setAssignmentsViewer({ user, items: res.items, loading: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar las asignaciones.');
      setAssignmentsViewer(null);
    }
  }

  async function resendAssignmentInvite(assignmentId: string) {
    setResendingAssignmentId(assignmentId);
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{ message: string; emailStatus: string }>(
        `/admin/users/assignments/${assignmentId}/resend`,
        { method: 'POST' },
      );
      setMessage(res.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible reenviar la invitación.');
    } finally {
      setResendingAssignmentId(null);
    }
  }

  function promptRevokeUserAssignment(assignmentId: string, testName: string, userFullName: string) {
    setConfirmModal({
      isOpen: true,
      title: 'Quitar acceso a evaluación',
      message: `¿Estás seguro de que deseas quitar el acceso a la prueba "${testName}" a ${userFullName}? El usuario ya no podrá verla ni responderla.`,
      confirmLabel: 'Quitar acceso',
      cancelLabel: 'Cancelar',
      variant: 'danger',
      loading: false,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await executeRevokeUserAssignment(assignmentId, testName);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, loading: false }));
        }
      },
    });
  }

  async function executeRevokeUserAssignment(assignmentId: string, testName: string) {
    setRevokingAssignmentId(assignmentId);
    setError('');
    setMessage('');
    try {
      const res = await apiFetch<{ message: string }>(`/admin/users/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      setMessage(res.message || `Acceso a la prueba "${testName}" revocado exitosamente.`);

      // Refresh editor assignments if open
      if (editor && editor !== 'new') {
        const updated = await apiFetch<{ items: UserAssignmentItem[] }>(`/admin/users/${editor.id}/assignments`);
        setEditorAssignments(updated.items);
      }
      // Refresh viewer assignments if open
      if (assignmentsViewer) {
        const updated = await apiFetch<{ items: UserAssignmentItem[] }>(`/admin/users/${assignmentsViewer.user.id}/assignments`);
        setAssignmentsViewer((prev) => (prev ? { ...prev, items: updated.items } : null));
      }

      await load(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible quitar el acceso a la evaluación.');
    } finally {
      setRevokingAssignmentId(null);
    }
  }

  function promptChangeStatus(user: User) {
    const nextStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    const isActivating = nextStatus === 'ACTIVE';

    setConfirmModal({
      isOpen: true,
      title: isActivating ? 'Activar cuenta de usuario' : 'Deshabilitar cuenta de usuario',
      message: isActivating
        ? `¿Deseas activar la cuenta de ${user.firstName} ${user.lastName}? La persona podrá volver a iniciar sesión y continuar con sus evaluaciones.`
        : `¿Deseas deshabilitar la cuenta de ${user.firstName} ${user.lastName}? Sus sesiones activas serán cerradas de inmediato y no podrá ingresar a la plataforma.`,
      confirmLabel: isActivating ? 'Activar cuenta' : 'Deshabilitar cuenta',
      cancelLabel: 'Cancelar',
      variant: isActivating ? 'primary' : 'danger',
      loading: false,
      action: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await executeChangeStatus(user, nextStatus);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false, loading: false }));
        }
      },
    });
  }

  async function executeChangeStatus(user: User, nextStatus: UserStatus) {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage(nextStatus === 'ACTIVE' ? 'Cuenta activada correctamente.' : 'Cuenta deshabilitada y sesiones revocadas.');
      await load(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `No fue posible cambiar el estado de la cuenta.`);
    }
  }

  async function resendInvitation(user: User) {
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ invitationStatus: 'SENT' | 'FAILED'; message: string }>(
        `/admin/users/${user.id}/invitation`,
        { method: 'POST' },
      );
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible enviar la invitación.');
    }
  }

  function openCreateModal() {
    setEditor('new');
    setPasswordMode('INVITE_LINK');
    setManualPassword(generateSecurePassword());
    setSendCredentialsEmail(true);
    setWithInitialAssignment(false);
    setError('');
    setMessage('');
  }

  function openAssignModalForUser(user: User) {
    const availableTests = getAvailableTestsForUser(user);
    setAssignModal({ isOpen: true, user });
    setAssignTargetUserId(user.id);
    setAssignTestId(availableTests[0]?.id || '');
    setAssignReason('Cortesía / Asignación directa por administrador');
    setAssignSendEmail(true);
    setAssignCustomMessage('');
    setError('');
    setMessage('');
  }

  function openAssignModalGlobal() {
    const firstUser = data.items[0] || null;
    const available = getAvailableTestsForUser(firstUser);
    setAssignModal({ isOpen: true, user: null });
    setAssignTargetUserId(firstUser?.id || '');
    setAssignTestId(available[0]?.id || assignableTests[0]?.id || '');
    setAssignReason('Cortesía / Asignación directa por administrador');
    setAssignSendEmail(true);
    setAssignCustomMessage('');
    setError('');
    setMessage('');
  }

  const selectedModalUser = assignModal.user || data.items.find((u) => u.id === assignTargetUserId) || null;
  const availableModalTests = getAvailableTestsForUser(selectedModalUser);

  const pageCount = Math.max(1, Math.ceil(data.total / data.limit));
  const editedUser = editor === 'new' ? null : editor;
  const defaultRoles =
    editor === 'new'
      ? data.roles.filter(({ code }) => code === 'USER').map(({ id }) => id)
      : editedUser?.roles.map(({ id }) => id) ?? [];

  const assignedInEditorIds = editorAssignments
    .filter((a) => a.status === 'AVAILABLE' || a.status === 'IN_PROGRESS' || a.status === 'COMPLETED')
    .map((a) => a.test.id);
  const availableForEditor = assignableTests.filter((t) => !assignedInEditorIds.includes(t.id));

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
          <span className="eyebrow dark">Personas y acceso</span>
          <h1>Usuarios</h1>
          <p>Administra cuentas, roles, invitaciones y asignación directa de evaluaciones psicométricas.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary-button compact"
            type="button"
            onClick={openAssignModalGlobal}
            title="Asignar prueba a un usuario sin costo"
          >
            ↗ Asignar prueba
          </button>
          <button className="primary-button compact" type="button" onClick={openCreateModal}>
            + Crear usuario
          </button>
        </div>
      </section>

      <section className="users-summary">
        <article>
          <strong>{data.total}</strong>
          <span>Usuarios registrados</span>
        </article>
        <article>
          <strong>{data.items.filter(({ status: value }) => value === 'ACTIVE').length}</strong>
          <span>Activos en esta página</span>
        </article>
        <article>
          <strong>
            {data.items.reduce((acc, u) => acc + (u.assignments?.length || u._count?.assignments || 0), 0)}
          </strong>
          <span>Pruebas asignadas</span>
        </article>
      </section>

      <section className="panel users-panel">
        <form className="users-toolbar" onSubmit={filter}>
          <label className="users-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o correo…"
              aria-label="Buscar usuarios"
            />
          </label>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              void load(1, search, event.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="PENDING_VERIFICATION">Pendientes</option>
            <option value="LOCKED">Bloqueados</option>
            <option value="DISABLED">Deshabilitados</option>
          </select>
          <button className="secondary-button" type="submit">
            Buscar
          </button>
        </form>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Roles</th>
                <th>Estado</th>
                <th style={{ minWidth: '130px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Target size={14} /> Evaluaciones
                  </span>
                </th>
                <th>Alta</th>
                <th aria-label="Acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                data.items.map((user) => {
                  const assignmentsCount = user.assignments?.length ?? user._count?.assignments ?? 0;
                  const availableCount = getAvailableTestsForUser(user).length;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-identity">
                          <span>
                            {user.firstName.charAt(0)}
                            {user.lastName.charAt(0)}
                          </span>
                          <div>
                            <strong>
                              {user.firstName} {user.lastName}
                            </strong>
                            <small>{user.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="role-chips">
                          {user.roles.map((role) => (
                            <span key={role.id}>{role.name}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`user-status ${user.status.toLowerCase()}`}>{statusLabels[user.status]}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void openAssignmentsViewer(user)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            background: assignmentsCount > 0 ? '#f0fdf4' : '#f8fafc',
                            color: assignmentsCount > 0 ? '#166534' : '#475569',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                          title="Haz clic para ver el historial y estado de las evaluaciones de este usuario"
                        >
                          <span>
                            {assignmentsCount === 0
                              ? '0 asignadas'
                              : `${assignmentsCount} ${assignmentsCount === 1 ? 'asignada' : 'asignadas'}`}
                          </span>
                          <span style={{ color: '#00c2e8', fontWeight: 900 }}>↗</span>
                        </button>
                      </td>
                      <td>
                        <time dateTime={user.createdAt}>
                          {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(user.createdAt))}
                        </time>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => openAssignModalForUser(user)}
                            disabled={user.status === 'DISABLED' || availableCount === 0}
                            style={{
                              color: availableCount === 0 ? '#94a3b8' : '#302b78',
                              fontWeight: 800,
                              background: availableCount === 0 ? '#f1f5f9' : 'transparent',
                            }}
                            title={
                              availableCount === 0
                                ? 'El usuario ya tiene asignadas todas las pruebas disponibles'
                                : 'Asignar prueba psicométrica sin costo'
                            }
                          >
                            {availableCount === 0 ? '✓ Completo' : '+ Asignar'}
                          </button>
                          <button type="button" onClick={() => void openEditModal(user)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void resendInvitation(user)}
                            disabled={user.status === 'DISABLED'}
                            title="Reenviar enlace de activación de cuenta"
                          >
                            Invitar
                          </button>
                          <button
                            className={user.status === 'DISABLED' ? 'enable' : 'disable'}
                            type="button"
                            onClick={() => promptChangeStatus(user)}
                          >
                            {user.status === 'DISABLED' ? 'Activar' : 'Deshabilitar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-pagination">
          <span>
            Página {data.page} de {pageCount}
          </span>
          <div>
            <button
              className="secondary-button"
              type="button"
              disabled={data.page <= 1 || loading}
              onClick={() => void load(data.page - 1)}
            >
              Anterior
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={data.page >= pageCount || loading}
              onClick={() => void load(data.page + 1)}
            >
              Siguiente
            </button>
          </div>
        </footer>
      </section>

      {/* MODAL: Crear / Editar Usuario */}
      {editor && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title">
          <button className="modal-backdrop" type="button" aria-label="Cerrar formulario" onClick={() => setEditor(null)} />
          <form
            className="user-editor"
            style={{ width: 'min(100%, 680px)', maxHeight: '90vh', overflowY: 'auto' }}
            key={editor === 'new' ? 'new' : editor.id}
            onSubmit={saveUser}
          >
            <header>
              <div>
                <span className="eyebrow dark">Cuenta</span>
                <h2 id="user-editor-title">{editor === 'new' ? 'Crear usuario' : 'Editar usuario y asignaciones'}</h2>
                <p>
                  {editor === 'new'
                    ? 'Registra un nuevo usuario con roles de acceso y opciones de autenticación.'
                    : 'Actualiza los datos, roles y gestiona las pruebas psicométricas de la persona.'}
                </p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setEditor(null)}>
                ×
              </button>
            </header>

            <div className="editor-grid">
              <label>
                Nombre
                <input name="firstName" defaultValue={editedUser?.firstName} required minLength={2} maxLength={100} />
              </label>
              <label>
                Apellidos
                <input name="lastName" defaultValue={editedUser?.lastName} required minLength={2} maxLength={150} />
              </label>
              <label className="full">
                Correo electrónico
                <input name="email" type="email" defaultValue={editedUser?.email} required maxLength={191} />
              </label>
            </div>

            <fieldset className="editor-roles">
              <legend>Roles de acceso</legend>
              {data.roles.map((role) => (
                <label key={role.id}>
                  <input
                    name="roleIds"
                    type="checkbox"
                    value={role.id}
                    defaultChecked={defaultRoles.includes(role.id)}
                  />
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {/* SECCIÓN EN EDICIÓN: Evaluaciones asignadas y asignación directa */}
            {editor !== 'new' && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #eef1f5', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#080b12', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Target size={15} color="#302b78" /> Evaluaciones Psicométricas
                    </strong>
                    <small style={{ color: '#64748b' }}>
                      Pruebas asignadas a este usuario para responder.
                    </small>
                  </div>
                  {availableForEditor.length > 0 && !showInlineAssign && (
                    <button
                      type="button"
                      className="primary-button compact"
                      onClick={() => setShowInlineAssign(true)}
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      + Asignar prueba
                    </button>
                  )}
                </div>

                {loadingEditorAssignments ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
                    Cargando evaluaciones…
                  </p>
                ) : editorAssignments.length === 0 ? (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      background: '#f8fafc',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px dashed #cbd5e1',
                    }}
                  >
                    Este usuario aún no tiene ninguna prueba asignada.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                    {editorAssignments.map((a) => {
                      const cfg = assignmentStatusLabels[a.status] || {
                        label: a.status,
                        bg: '#f1f5f9',
                        color: '#475569',
                      };
                      const isResending = resendingAssignmentId === a.id;
                      const isRevoking = revokingAssignmentId === a.id;

                      return (
                        <div
                          key={a.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: a.status === 'REVOKED' ? '#f8fafc' : '#ffffff',
                            border: '1px solid #e2e8f0',
                            opacity: a.status === 'REVOKED' ? 0.75 : 1,
                            gap: '10px',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '13px', color: '#080b12', display: 'block' }}>
                              {a.test.name}
                            </strong>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: cfg.bg,
                                  color: cfg.color,
                                }}
                              >
                                {cfg.label}
                              </span>
                              <small style={{ color: '#64748b', fontSize: '11px' }}>
                                {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short' }).format(new Date(a.createdAt))}
                              </small>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="secondary-button compact"
                              disabled={isResending || isRevoking || a.status === 'EXPIRED' || a.status === 'REVOKED'}
                              onClick={() => void resendAssignmentInvite(a.id)}
                              style={{ fontSize: '10px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Reenviar correo de invitación"
                            >
                              {isResending ? 'Enviando…' : <><Mail size={11} /> Reenviar</>}
                            </button>
                            {a.status !== 'REVOKED' && a.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                className="secondary-button compact"
                                disabled={isResending || isRevoking}
                                onClick={() =>
                                  promptRevokeUserAssignment(
                                    a.id,
                                    a.test.name,
                                    `${editedUser?.firstName ?? ''} ${editedUser?.lastName ?? ''}`.trim(),
                                  )
                                }
                                style={{
                                  fontSize: '10px',
                                  padding: '4px 8px',
                                  color: '#b91c1c',
                                  borderColor: '#fecaca',
                                  background: '#fff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Quitar el acceso a esta prueba para el usuario"
                              >
                                {isRevoking ? 'Quitando…' : <><Trash2 size={11} /> Quitar</>}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Formulario desplegable para agregar una prueba en edición */}
                {showInlineAssign && availableForEditor.length > 0 && (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      background: '#f0f9fc',
                      border: '1px solid #bae6fd',
                      marginTop: '10px',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '12px', color: '#0369a1', marginBottom: '8px' }}>
                      Asignar nueva prueba sin costo
                    </strong>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <select
                        value={inlineTestId}
                        onChange={(e) => setInlineTestId(e.target.value)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: 'white',
                          fontSize: '12px',
                        }}
                      >
                        {availableForEditor.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Versión {t.publishedVersion?.version || 1})
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={inlineReason}
                        onChange={(e) => setInlineReason(e.target.value)}
                        placeholder="Motivo (ej. Evaluación directa, Vacante)"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={inlineSendEmail}
                          onChange={(e) => setInlineSendEmail(e.target.checked)}
                        />
                        <span style={{ fontSize: '11px', color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} /> Enviar correo de invitación con enlace directo
                        </span>
                      </label>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={() => setShowInlineAssign(false)}
                          style={{ fontSize: '11px' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="primary-button compact"
                          disabled={saving || !inlineTestId}
                          onClick={() => void submitInlineAssignment()}
                          style={{ fontSize: '11px' }}
                        >
                          {saving ? 'Asignando…' : 'Confirmar asignación'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {availableForEditor.length === 0 && editorAssignments.length > 0 && (
                  <p style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', margin: '8px 0 0' }}>
                    ✓ Este usuario ya cuenta con todas las pruebas psicométricas activas disponibles en la plataforma.
                  </p>
                )}
              </div>
            )}

            {/* Opciones de contraseña exclusivas para creación */}
            {editor === 'new' && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #eef1f5', paddingTop: '16px' }}>
                <span className="eyebrow dark" style={{ display: 'block', marginBottom: '8px' }}>
                  Configuración de contraseña
                </span>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: passwordMode === 'INVITE_LINK' ? '#f0f9fc' : '#fafbfc',
                      border: `1px solid ${passwordMode === 'INVITE_LINK' ? '#00c2e8' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="pwdMode"
                      checked={passwordMode === 'INVITE_LINK'}
                      onChange={() => setPasswordMode('INVITE_LINK')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '12px', color: '#080b12' }}>
                        Enviar enlace seguro para configurar contraseña (Recomendado)
                      </strong>
                      <small style={{ color: '#657082', fontSize: '11px' }}>
                        El usuario recibirá un correo con un enlace de un solo uso (válido por 48 horas) para crear su propia clave.
                      </small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: passwordMode === 'MANUAL_PASSWORD' ? '#f0f9fc' : '#fafbfc',
                      border: `1px solid ${passwordMode === 'MANUAL_PASSWORD' ? '#00c2e8' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="pwdMode"
                      checked={passwordMode === 'MANUAL_PASSWORD'}
                      onChange={() => setPasswordMode('MANUAL_PASSWORD')}
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ width: '100%' }}>
                      <strong style={{ display: 'block', fontSize: '12px', color: '#080b12' }}>
                        Definir contraseña temporal o manual
                      </strong>
                      <small style={{ color: '#657082', fontSize: '11px' }}>
                        Establece una contraseña ahora y decide si se envía por correo.
                      </small>

                      {passwordMode === 'MANUAL_PASSWORD' && (
                        <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              value={manualPassword}
                              onChange={(e) => setManualPassword(e.target.value)}
                              placeholder="Contraseña (mínimo 8 caracteres)"
                              required={passwordMode === 'MANUAL_PASSWORD'}
                              minLength={8}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setManualPassword(generateSecurePassword())}
                              className="secondary-button compact"
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              ⟳ Generar
                            </button>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={sendCredentialsEmail}
                              onChange={(e) => setSendCredentialsEmail(e.target.checked)}
                            />
                            <span style={{ fontSize: '11px', color: '#475569' }}>
                              Enviar credenciales de acceso por correo al usuario
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Sección opcional: Asignar prueba de inmediato en creación */}
                {assignableTests.length > 0 && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#faf5ff',
                      border: '1px solid #e9d5ff',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={withInitialAssignment}
                        onChange={(e) => setWithInitialAssignment(e.target.checked)}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#302b78', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Target size={14} /> Asignar una evaluación psicométrica de inmediato (Sin costo)
                      </span>
                    </label>

                    {withInitialAssignment && (
                      <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                        <select
                          value={initialTestId}
                          onChange={(e) => setInitialTestId(e.target.value)}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            background: 'white',
                            fontSize: '12px',
                          }}
                        >
                          {assignableTests.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} (Versión {t.publishedVersion?.version || 1})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={initialReason}
                          onChange={(e) => setInitialReason(e.target.value)}
                          placeholder="Motivo (ej. Evaluación inicial, Candidato)"
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <footer>
              <button className="secondary-button" type="button" onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={saving}>
                {saving ? 'Guardando…' : editor === 'new' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Asignar Prueba a Usuario (Independiente) */}
      {assignModal.isOpen && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cerrar formulario"
            onClick={() => setAssignModal({ isOpen: false, user: null })}
          />
          <form className="user-editor" onSubmit={submitAssignment}>
            <header>
              <div>
                <span className="eyebrow dark">Asignación administrativa</span>
                <h2 id="assign-modal-title">Asignar prueba a usuario</h2>
                <p>Otorga acceso a una evaluación psicométrica sin costo y envía la invitación con enlace directo.</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setAssignModal({ isOpen: false, user: null })}>
                ×
              </button>
            </header>

            <div style={{ display: 'grid', gap: '14px', marginTop: '20px' }}>
              {assignModal.user ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#657082', fontWeight: 800 }}>
                    Usuario seleccionado
                  </span>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#080b12', marginTop: '2px' }}>
                    {assignModal.user.firstName} {assignModal.user.lastName}
                  </strong>
                  <small style={{ color: '#64748b' }}>{assignModal.user.email}</small>
                </div>
              ) : (
                <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                  Seleccionar usuario
                  <select
                    value={assignTargetUserId}
                    onChange={(e) => {
                      setAssignTargetUserId(e.target.value);
                      const u = data.items.find((x) => x.id === e.target.value) || null;
                      const available = getAvailableTestsForUser(u);
                      setAssignTestId(available[0]?.id || '');
                    }}
                    required
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: 'white',
                    }}
                  >
                    <option value="">Selecciona un usuario…</option>
                    {data.items.map((u) => {
                      const avail = getAvailableTestsForUser(u).length;
                      return (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email}) {avail === 0 ? '— [Sin pruebas pendientes]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              {availableModalTests.length === 0 ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '12px',
                  }}
                >
                  <strong>⚠️ No hay pruebas pendientes para este usuario</strong>
                  <p style={{ margin: '4px 0 0' }}>
                    Este usuario ya tiene asignadas todas las evaluaciones psicométricas activas disponibles en Crevantia.
                  </p>
                </div>
              ) : (
                <>
                  <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                    Evaluación a asignar (Solo pruebas no asignadas)
                    <select
                      value={assignTestId}
                      onChange={(e) => setAssignTestId(e.target.value)}
                      required
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: 'white',
                      }}
                    >
                      {availableModalTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — Versión {t.publishedVersion?.version || 1} ({t.publishedVersion?.estimatedMin || 45} min)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                    Tipo de asignación
                    <select
                      value={assignType}
                      onChange={(e) => setAssignType(e.target.value as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: 'white',
                      }}
                    >
                      <option value="ADMIN_FREE">Asignación directa / Cortesía sin costo</option>
                      <option value="PROMOTIONAL">Promocional / Demostración</option>
                      <option value="SUPPORT_REPLACEMENT">Reemplazo por soporte técnico</option>
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                    Motivo / Referencia interna
                    <input
                      type="text"
                      value={assignReason}
                      onChange={(e) => setAssignReason(e.target.value)}
                      placeholder="Ej: Candidato para dirección comercial, Cortesía corporativa…"
                      required
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '10px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={assignSendEmail}
                      onChange={(e) => setAssignSendEmail(e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#166534' }}>
                        <Mail size={13} /> Enviar correo de invitación al evaluado
                      </strong>
                      <small style={{ color: '#15803d', fontSize: '11px' }}>
                        Se enviará un correo transaccional con la plantilla oficial de Crevantia y el enlace para responder la evaluación.
                      </small>
                    </div>
                  </label>

                  {assignSendEmail && (
                    <label style={{ display: 'grid', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                      Mensaje personalizado para el correo (Opcional)
                      <textarea
                        value={assignCustomMessage}
                        onChange={(e) => setAssignCustomMessage(e.target.value)}
                        rows={2}
                        placeholder="Agrega notas o instrucciones adicionales para el evaluado…"
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          resize: 'vertical',
                        }}
                      />
                    </label>
                  )}
                </>
              )}
            </div>

            <footer>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setAssignModal({ isOpen: false, user: null })}
              >
                Cancelar
              </button>
              <button
                className="primary-button compact"
                disabled={saving || availableModalTests.length === 0}
              >
                {saving ? 'Asignando…' : 'Confirmar asignación'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* MODAL: Ver Asignaciones del Usuario */}
      {assignmentsViewer && (
        <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="viewer-modal-title">
          <button
            className="modal-backdrop"
            type="button"
            aria-label="Cerrar ventana"
            onClick={() => setAssignmentsViewer(null)}
          />
          <div className="user-editor" style={{ width: 'min(100%, 750px)' }}>
            <header>
              <div>
                <span className="eyebrow dark">Historial de evaluaciones</span>
                <h2 id="viewer-modal-title">
                  Evaluaciones de {assignmentsViewer.user.firstName} {assignmentsViewer.user.lastName}
                </h2>
                <p>{assignmentsViewer.user.email}</p>
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setAssignmentsViewer(null)}>
                ×
              </button>
            </header>

            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {assignmentsViewer.items.length} {assignmentsViewer.items.length === 1 ? 'evaluación registrada' : 'evaluaciones registradas'}
                </span>
                {getAvailableTestsForUser(assignmentsViewer.user).length > 0 && (
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => {
                      const u = assignmentsViewer.user;
                      setAssignmentsViewer(null);
                      openAssignModalForUser(u);
                    }}
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    + Asignar nueva prueba
                  </button>
                )}
              </div>

              {assignmentsViewer.loading ? (
                <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Cargando asignaciones…</p>
              ) : assignmentsViewer.items.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '13px' }}>
                    Este usuario aún no tiene ninguna evaluación asignada.
                  </p>
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => {
                      const u = assignmentsViewer.user;
                      setAssignmentsViewer(null);
                      openAssignModalForUser(u);
                    }}
                  >
                    Asignar primera prueba
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {assignmentsViewer.items.map((item) => {
                    const statusConfig = assignmentStatusLabels[item.status] || {
                      label: item.status,
                      bg: '#f1f5f9',
                      color: '#475569',
                    };
                    const isResending = resendingAssignmentId === item.id;
                    const isRevoking = revokingAssignmentId === item.id;

                    return (
                      <article
                        key={item.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          background: item.status === 'REVOKED' ? '#f8fafc' : '#fff',
                          opacity: item.status === 'REVOKED' ? 0.75 : 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '14px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '14px', color: '#080b12' }}>{item.test.name}</strong>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                background: statusConfig.bg,
                                color: statusConfig.color,
                              }}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '14px' }}>
                            <span>Tipo: <b>{item.type}</b></span>
                            <span>Versión: <b>{item.testVersion.version}</b></span>
                            <span>
                              Asignado:{' '}
                              <b>
                                {new Intl.DateTimeFormat('es-MX', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(item.createdAt))}
                              </b>
                            </span>
                          </div>
                          {item.reason && (
                            <small style={{ display: 'block', color: '#828d9f', marginTop: '4px', fontStyle: 'italic' }}>
                              Motivo: {item.reason}
                            </small>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="secondary-button compact"
                            disabled={isResending || isRevoking || item.status === 'EXPIRED' || item.status === 'REVOKED'}
                            onClick={() => void resendAssignmentInvite(item.id)}
                            style={{ fontSize: '11px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            title="Reenviar correo de invitación con enlace a la prueba"
                          >
                            {isResending ? 'Enviando…' : <><Mail size={12} /> Reenviar invitación</>}
                          </button>
                          {item.status !== 'REVOKED' && item.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              className="secondary-button compact"
                              disabled={isResending || isRevoking}
                              onClick={() =>
                                promptRevokeUserAssignment(
                                  item.id,
                                  item.test.name,
                                  `${assignmentsViewer.user.firstName} ${assignmentsViewer.user.lastName}`,
                                )
                              }
                              style={{
                                fontSize: '11px',
                                whiteSpace: 'nowrap',
                                color: '#b91c1c',
                                borderColor: '#fecaca',
                                background: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                              title="Quitar el acceso a esta prueba para el usuario"
                            >
                              {isRevoking ? 'Quitando…' : <><Trash2 size={12} /> Quitar acceso</>}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <footer>
              <button className="secondary-button" type="button" onClick={() => setAssignmentsViewer(null)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

