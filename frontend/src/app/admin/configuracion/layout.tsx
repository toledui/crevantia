import { ReactNode } from 'react';
import { SettingsNavigation } from '@/components/settings-navigation';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="admin-content settings-area">
    <header className="settings-header"><div><span className="eyebrow dark">Sistema</span><h1>Configuración</h1><p>Centraliza los servicios y accesos que utiliza Crevantia.</p></div></header>
    <div className="settings-workspace">
      <SettingsNavigation/>
      <div className="settings-pane">{children}</div>
    </div>
  </div>;
}
