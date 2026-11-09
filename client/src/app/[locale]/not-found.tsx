import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="standalone-error">
      <span className="icon-tile"><FileQuestion size={23} /></span>
      <h1>{t('notFound')}</h1>
      <p>{t('notFoundHelp')}</p>
      <Link className="button button-primary" href="/">{t('backToOverview')}</Link>
    </main>
  );
}
