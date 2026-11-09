'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TriangleAlert } from 'lucide-react';

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="standalone-error">
      <span className="icon-tile tile-amber"><TriangleAlert size={22} /></span>
      <h1>{t('pageLoadError')}</h1>
      <p>{t('connectionHelp')}</p>
      <div className="row-actions">
        <button className="button button-primary" type="button" onClick={reset}>{t('tryAgain')}</button>
        <Link className="button button-secondary" href="/login">{t('signInPage')}</Link>
      </div>
    </main>
  );
}
