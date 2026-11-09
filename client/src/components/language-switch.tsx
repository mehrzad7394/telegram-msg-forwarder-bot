'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { getPathname, usePathname } from '@/i18n/navigation';

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const nextLocale = locale === 'en' ? 'fa' : 'en';
  const label = nextLocale === 'fa' ? 'فارسی' : 'English';

  const href = getPathname({ href: pathname, locale: nextLocale });
  return (
    <a className="button button-secondary language-switch"
      href={query ? `${href}?${query}` : href}
      hrefLang={nextLocale} title={t('switchLanguage')}>
      <Languages size={16} aria-hidden="true" />
      <span lang={nextLocale} dir={nextLocale === 'fa' ? 'rtl' : 'ltr'}>{label}</span>
    </a>
  );
}
