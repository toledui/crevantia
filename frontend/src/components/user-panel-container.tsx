'use client';

import { useState } from 'react';
import { ClientShell, ClientTab } from '@/components/client-shell';
import { UserAssessmentsPanel } from '@/components/user-assessments-panel';
import { UserCatalogPanel } from '@/components/user-catalog-panel';
import { UserProfilePanel } from '@/components/user-profile-panel';
import { UserPurchasesPanel } from '@/components/user-purchases-panel';

export function UserPanelContainer() {
  const [activeTab, setActiveTab] = useState<ClientTab>('assessments');

  return (
    <ClientShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'assessments' && <UserAssessmentsPanel />}

      {activeTab === 'purchases' && (
        <section className="user-assessments">
          <span className="eyebrow dark">Historial de Compras</span>
          <h1>Mis compras y comprobantes</h1>
          <p>Consulta tus órdenes, descarga tus recibos oficiales en PDF o completa pagos pendientes.</p>
          <UserPurchasesPanel />
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="user-assessments">
          <span className="eyebrow dark">Cuenta y Seguridad</span>
          <h1>Mi perfil y credenciales</h1>
          <p>Administra tu información de contacto, actualiza tu contraseña y gestiona la seguridad de tu cuenta.</p>
          <UserProfilePanel />
        </section>
      )}

      {activeTab === 'catalog' && (
        <section className="user-assessments">
          <span className="eyebrow dark">Catálogo Crevantia</span>
          <h1>Evaluaciones disponibles</h1>
          <p>Explora nuestras herramientas psicométricas de alta precisión y adquiere nuevas licencias individuales.</p>
          <UserCatalogPanel />
        </section>
      )}
    </ClientShell>
  );
}
