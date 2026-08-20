'use client';

import { createContext, useContext } from 'react';
import type { PublicSiteSettings } from '@/lib/site-settings';
import { defaultSiteSettings } from '@/lib/site-settings';

const SiteSettingsContext = createContext<PublicSiteSettings>(defaultSiteSettings);

export function SiteSettingsProvider({ settings, children }: { settings: PublicSiteSettings; children: React.ReactNode }) {
  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() { return useContext(SiteSettingsContext); }
