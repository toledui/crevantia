'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin/configuracion/sitio', label: 'Sitio y contacto', description: 'Marca web, metadatos y atención' },
  { href: '/admin/configuracion/reporte', label: 'Configuración del reporte', description: 'Logo, textos y escalas del PDF' },
  { href: '/admin/configuracion/codigos', label: 'Códigos personalizados', description: 'Fragmentos globales de HTML y JavaScript' },
  { href: '/admin/configuracion', label: 'Correo', description: 'Servidor SMTP y remitente', exact: true },
  { href: '/admin/configuracion/financiero', label: 'Finanzas e impuestos', description: 'IVA, moneda y desglose fiscal' },
  { href: '/admin/configuracion/stripe', label: 'Pasarela de pago', description: 'Stripe, claves y webhooks' },
  { href: '/admin/configuracion/roles', label: 'Roles y permisos', description: 'Accesos del equipo administrativo' },
  { href: '/admin/configuracion/legal', label: 'Términos y Privacidad', description: 'Políticas legales y consentimiento' },
];

export function SettingsNavigation() {
  const pathname = usePathname();
  return <nav className="settings-nav" aria-label="Secciones de configuración">
    {items.map((item) => {
      const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
      return <Link key={item.href} className={active ? 'active' : ''} href={item.href}><strong>{item.label}</strong><small>{item.description}</small></Link>;
    })}
  </nav>;
}
