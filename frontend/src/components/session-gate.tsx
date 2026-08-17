'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, currentUser } from '@/lib/api';
import { Brand } from './brand';

export function SessionGate({ area, children }: { area: 'admin' | 'client'; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    currentUser()
      .then((user) => {
        if (!active) return;
        const isAdmin = user.permissions.includes('admin.access');

        if ((area === 'admin' && isAdmin) || (area === 'client' && !isAdmin)) {
          setStatus('ready');
          return;
        }

        router.replace(isAdmin ? '/admin' : '/panel');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/iniciar-sesion');
          return;
        }
        setStatus('error');
      });

    return () => { active = false; };
  }, [area, attempt, router]);

  if (status === 'ready') return children;

  return <main className="session-gate" aria-busy={status === 'checking'}>
    <Brand/>
    <section>
      <span className="eyebrow dark">Acceso protegido</span>
      <h1>{status === 'checking' ? 'Comprobando tu sesión…' : 'No pudimos comprobar tu sesión.'}</h1>
      <p>{status === 'checking' ? 'Espera un momento antes de continuar.' : 'El servidor no respondió correctamente. Tu contenido permanece protegido.'}</p>
      {status === 'error' && <button className="primary-button compact" type="button" onClick={() => { setStatus('checking'); setAttempt((value) => value + 1); }}>Reintentar</button>}
    </section>
  </main>;
}
