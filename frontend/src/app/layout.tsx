import type { Metadata } from 'next';
import { CustomCodeInjector } from '@/components/custom-code-injector';
import { SiteSettingsProvider } from '@/components/site-settings-provider';
import { getPublicSiteSettings } from '@/lib/site-settings';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSiteSettings();
  return { title: { default: settings.siteName, template: `%s · ${settings.siteName}` }, description: settings.siteDescription, icons: { icon: settings.faviconUrl } };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSiteSettings();
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SiteSettingsProvider settings={settings}>{children}</SiteSettingsProvider>
        <CustomCodeInjector headCode={settings.headCode} bodyEndCode={settings.bodyEndCode} version={settings.version} />
      </body>
    </html>
  );
}
