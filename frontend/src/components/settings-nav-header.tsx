'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SettingsNavHeader() {
  const pathname = usePathname();

  const tabs = [
    {
      href: '/admin/configuracion',
      title: 'Servidor de correo (SMTP)',
      description: 'Envío de notificaciones y correos',
      active: pathname === '/admin/configuracion',
    },
    {
      href: '/admin/configuracion/financiero',
      title: 'Finanzas e Impuestos (IVA)',
      description: 'Tasas impositivas, moneda y desglose',
      active: pathname.startsWith('/admin/configuracion/financiero'),
    },
    {
      href: '/admin/configuracion/roles',
      title: 'Roles y permisos',
      description: 'Control de accesos y facultades',
      active: pathname.startsWith('/admin/configuracion/roles'),
    },
  ];

  return (
    <nav className="settings-nav" style={{ width: '100%', maxWidth: '850px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '22px' }}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.active ? 'active' : ''}
        >
          <strong>{tab.title}</strong>
          <small>{tab.description}</small>
        </Link>
      ))}
    </nav>
  );
}
