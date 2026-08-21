'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type Captcha = { provider: string; siteKey: string } | null;

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; theme: string }) => string; reset: (id?: string) => void };
    grecaptcha?: { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; theme: string }) => number; reset: (id?: number) => void };
  }
}

export function HomeContactForm({ captcha }: { captcha: Captcha }) {
  const captchaElement = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | number | undefined>(undefined);
  const [captchaToken, setCaptchaToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!captcha || !captchaElement.current) return;
    const id = captcha.provider === 'turnstile' ? 'turnstile-api' : 'recaptcha-api';
    const render = () => {
      if (!captchaElement.current || captchaWidget.current !== undefined) return;
      const options = { sitekey: captcha.siteKey, callback: setCaptchaToken, 'expired-callback': () => setCaptchaToken(''), theme: 'light' };
      const widget = captcha.provider === 'turnstile'
        ? window.turnstile?.render(captchaElement.current, options)
        : window.grecaptcha?.render(captchaElement.current, options);
      if (widget !== undefined) captchaWidget.current = widget;
    };
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', render); render(); return () => existing.removeEventListener('load', render); }
    const script = document.createElement('script'); script.id = id; script.async = true; script.defer = true;
    script.src = captcha.provider === 'turnstile' ? 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit' : 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.addEventListener('load', render); document.head.appendChild(script);
    return () => script.removeEventListener('load', render);
  }, [captcha]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (captcha && !captchaToken) { setStatus('error'); setMessage('Completa la verificación antispam.'); return; }
    setStatus('sending'); setMessage('');
    try {
      const response = await fetch('/api/v1/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), email: form.get('email'), subject: form.get('subject'), message: form.get('message'), website: form.get('website'), captchaToken }) });
      const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
      if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message[0] : body?.message || 'No fue posible enviar tu mensaje.');
      event.currentTarget.reset(); setCaptchaToken('');
      if (captcha?.provider === 'turnstile') window.turnstile?.reset(captchaWidget.current as string);
      if (captcha?.provider === 'recaptcha') window.grecaptcha?.reset(captchaWidget.current as number);
      setStatus('success'); setMessage('Gracias. Recibimos tu mensaje y te responderemos pronto.');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'No fue posible enviar tu mensaje.'); }
  }

  return <form className="home-contact-form" onSubmit={submit}>
    <label>Nombre<input name="name" required maxLength={120} autoComplete="name" /></label>
    <label>Correo electrónico<input name="email" type="email" required maxLength={191} autoComplete="email" /></label>
    <label className="home-contact-form-wide">Asunto<input name="subject" maxLength={180} placeholder="¿Cómo podemos ayudarte?" /></label>
    <label className="home-contact-form-wide">Mensaje<textarea name="message" required maxLength={5000} rows={5} placeholder="Cuéntanos en qué podemos ayudarte." /></label>
    <input className="home-contact-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    {captcha && <div className="home-contact-form-wide home-captcha" ref={captchaElement} />}
    {message && <p className={`home-contact-message ${status}`}>{message}</p>}
    <button className="home-contact-submit" disabled={status === 'sending'}>{status === 'sending' ? 'Enviando…' : 'Enviar mensaje →'}</button>
  </form>;
}
