import { cache } from 'react';

export interface PublicSiteSettings {
  version: number;
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
  contactHours: string | null;
  contactMapUrl: string | null;
  headCode: string | null;
  bodyEndCode: string | null;
  updatedAt: string | null;
}

export const defaultSiteSettings: PublicSiteSettings = {
  version: 1,
  siteName: 'Crevantia',
  siteDescription: 'Plataforma de evaluaciones Crevantia',
  logoUrl: '/branding/logo-crevantia.png',
  faviconUrl: '/branding/logo-crevantia.png',
  contactEmail: null,
  contactPhone: null,
  contactWhatsapp: null,
  contactAddress: null,
  contactHours: null,
  contactMapUrl: null,
  headCode: null,
  bodyEndCode: null,
  updatedAt: null,
};

export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(`${base}/api/v1/public/site-settings`, { cache: 'no-store' });
    if (!response.ok) return defaultSiteSettings;
    return { ...defaultSiteSettings, ...await response.json() as Partial<PublicSiteSettings> };
  } catch {
    return defaultSiteSettings;
  }
});
