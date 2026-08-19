'use client';

import { useEffect } from 'react';
import { AlertTriangle, Info, Zap } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  return (
    <div
      className="user-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{ zIndex: 1300 }}
    >
      <button
        className="modal-backdrop"
        type="button"
        aria-label="Cerrar modal"
        onClick={loading ? undefined : onCancel}
      />
      <div
        className="user-editor"
        style={{
          width: 'min(100%, 460px)',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              fontSize: '20px',
              background: isDanger ? '#fee2e2' : isWarning ? '#fef3c7' : '#e0f2fe',
              color: isDanger ? '#dc2626' : isWarning ? '#d97706' : '#0284c7',
            }}
          >
            {isDanger ? (
              <AlertTriangle size={22} />
            ) : isWarning ? (
              <Zap size={22} />
            ) : (
              <Info size={22} />
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3
              id="confirm-modal-title"
              style={{
                margin: '0 0 6px',
                fontSize: '16px',
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: '#475569',
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '24px',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '16px',
          }}
        >
          <button
            type="button"
            className="secondary-button compact"
            disabled={loading}
            onClick={onCancel}
            style={{ fontSize: '12px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="primary-button compact"
            disabled={loading}
            onClick={() => void onConfirm()}
            style={{
              fontSize: '12px',
              fontWeight: 700,
              background: isDanger
                ? '#dc2626'
                : isWarning
                ? '#d97706'
                : 'linear-gradient(110deg, #302b78, #4740a3)',
              border: isDanger ? '1px solid #b91c1c' : isWarning ? '1px solid #b45309' : '1px solid #302b78',
              color: '#ffffff',
              boxShadow: isDanger
                ? '0 4px 12px rgba(220, 38, 38, 0.25)'
                : isWarning
                ? '0 4px 12px rgba(217, 119, 6, 0.25)'
                : '0 4px 12px rgba(48, 43, 120, 0.25)',
            }}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
