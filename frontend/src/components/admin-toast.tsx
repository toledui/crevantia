"use client";

import { Dispatch, SetStateAction, useEffect } from "react";

interface AdminToastProps {
  error: string;
  message: string;
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
}

export function AdminToast({
  error,
  message,
  setError,
  setMessage,
}: AdminToastProps) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message, setMessage]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 7000);
    return () => window.clearTimeout(timeout);
  }, [error, setError]);

  if (!error && !message) return null;

  return (
    <div className="admin-toast-viewport" aria-live="polite">
      {error && (
        <article className="admin-toast error" role="alert">
          <span className="admin-toast-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>No se pudo completar</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setError("")}
          >
            ×
          </button>
        </article>
      )}
      {message && (
        <article className="admin-toast success" role="status">
          <span className="admin-toast-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Operación completada</strong>
            <p>{message}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </article>
      )}
    </div>
  );
}
