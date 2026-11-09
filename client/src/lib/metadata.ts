import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type Messages from '../../messages/en.json';

export const siteName = 'Relay Console';
export const siteUrl = new URL(process.env.SITE_URL || 'http://localhost:3000');
const ogLocales = { en: 'en_US', fa: 'fa_IR' } as const;

export async function pageMetadata(titleKey: keyof typeof Messages, href: string, descriptionKey: keyof typeof Messages = 'siteDescription'): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations()]);
  const title = t(titleKey);
  const description = t(descriptionKey);
  const path = getPathname({ href, locale });
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: getPathname({ href, locale: 'en' }),
        fa: getPathname({ href, locale: 'fa' }),
        'x-default': getPathname({ href, locale: routing.defaultLocale }),
      },
    },
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      url: path,
      siteName,
      locale: ogLocales[locale],
      alternateLocale: locale === 'en' ? ogLocales.fa : ogLocales.en,
      type: 'website',
      images: [{ url: '/social.png', width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${siteName}`,
      description,
      images: ['/social.png'],
    },
  };
}
