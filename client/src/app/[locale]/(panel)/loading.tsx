import { useTranslations } from 'next-intl';
export default function Loading() {
  const t = useTranslations();
  return <div className="loading-view" role="status"><span className="sr-only">{t('loading')}</span><div /><div /><div /></div>;
}
