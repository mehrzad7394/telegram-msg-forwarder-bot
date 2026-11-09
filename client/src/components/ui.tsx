import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ArrowRight, Database, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Brand() {
  const t = useTranslations();
  return (
    <div className="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/relay.svg" width="42" height="42" alt="" />
      <div><strong lang="en" dir="ltr">Relay Console</strong><span>{t('messageForwardingConsole')}</span></div>
    </div>
  );
}

export function Badge({ children, tone = 'neutral', dot = false }: {
  children: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'purple' | 'neutral';
  dot?: boolean;
}) {
  return <span className={`badge badge-${tone}`}>{dot && <span className="status-dot" />}{children}</span>;
}

export function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations();
  return <Badge tone={active ? 'green' : 'neutral'} dot>{active ? t('active') : t('inactive')}</Badge>;
}

export function PageHeading({ label, title, description, action, back }: {
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="page-heading">
      <div>
        {back && <Link href={back.href} className="text-link back-link"><ArrowRight className="inline-arrow" size={16} />{back.label}</Link>}
        <span className="eyebrow"><span />{label}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Panel({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, hint, icon: Icon, tone = 'purple' }: {
  label: string; value: string | number; hint: string; icon: LucideIcon;
  tone?: 'purple' | 'blue' | 'green' | 'amber';
}) {
  const format = useFormatter();
  return (
    <div className="metric panel">
      <div className="metric-top"><span>{label}</span><span className={`icon-tile tile-${tone}`}><Icon size={19} strokeWidth={1.8} /></span></div>
      <strong>{typeof value === 'number' ? format.number(value) : value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export function Empty({ title, description, icon: Icon = Database }: { title: string; description: string; icon?: LucideIcon }) {
  return <div className="empty"><span className="icon-tile"><Icon size={21} /></span><strong>{title}</strong><p>{description}</p></div>;
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="text-link" href={href}>{children}<ArrowLeft className="inline-arrow" size={15} /></Link>;
}

export function dateTime(format: ReturnType<typeof useFormatter>, value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
}
