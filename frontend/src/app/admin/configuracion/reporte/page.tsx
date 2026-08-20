import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Configuración del reporte' };
export default function ReportSettingsPage() {
  return <div className="settings-content settings-section"><section className="welcome"><div><span className="eyebrow dark">Configuración migrada</span><h1>Los reportes ahora se administran en Report Studio</h1><p>El contenido, los bindings, las categorías y la identidad editorial pertenecen a cada plantilla. Los valores anteriores se conservan únicamente para PDFs históricos y el generador legado.</p></div></section><div className="panel settings-card"><h2>Fuente única de verdad</h2><p>Crea una plantilla, vincúlala con una prueba y publica su versión para que el sistema la seleccione automáticamente.</p><Link className="primary-button compact" href="/admin/report-studio">Ir a Report Studio</Link></div></div>;
}
