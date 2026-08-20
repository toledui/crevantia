'use client';

import { useSiteSettings } from '@/components/site-settings-provider';

export function Brand({ light = false }: { light?: boolean }) {
  const settings = useSiteSettings();
  return (
    <div className={`brand-lockup${light ? ' brand-light' : ''}`} aria-label={settings.siteName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-image" src={settings.logoUrl} alt={settings.siteName} />
    </div>
  );
}
