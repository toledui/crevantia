'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin/configuracion', label: 'Correo', description: 'Servidor SMTP y remitente', exact: true },
  { href: '/admin/configuracion/financiero', label: 'Finanzas e impuestos', description: 'IVA, moneda y desglose fiscal' },
  { href: '/admin/configuracion/stripe', label: 'Pasarela de pago', description: 'Stripe, claves y webhooks' },
  { href: '/admin/configuracion/roles', label: 'Roles y permisos', description: 'Accesos del equipo administrativo' },
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
