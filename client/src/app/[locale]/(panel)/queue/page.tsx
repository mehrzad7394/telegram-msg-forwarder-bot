import { getPathname } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ListOrdered, Search } from 'lucide-react';
import { ActionForm, Field } from '@/components/action-form';
import { MessagesTable, QueueChart } from '@/components/queue-view';
import { Badge, PageHeading, Panel } from '@/components/ui';
import { cleanupQueue } from '@/lib/actions';
import { pageMetadata } from '@/lib/metadata';
import { getMessages, getQueueStats } from '@/lib/queries';

export async function generateMetadata() {
  return pageMetadata('messageQueue', '/queue', 'queueMetadata');
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ limit?: string }> }) {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const requested = Number((await searchParams).limit);
  const limit = Number.isInteger(requested) && requested >= 1 && requested <= 1000 ? requested : 50;
  const [stats, messages] = await Promise.all([getQueueStats(), getMessages(limit)]);
  return (
    <div className="page-stack">
      <PageHeading label={t('deliveryMonitoring')} title={t('messageQueue')} description={t('queueDescription')} />
      <div className="dashboard-grid">
        <Panel title={t('queueBreakdown')} subtitle={t('redisQueueStats')}><QueueChart stats={stats} /></Panel>
        <Panel title={t('cleanupHistory')} subtitle={t('cleanupHelp')}>
          <ActionForm className="panel-body" action={cleanupQueue} reloadOnSuccess label={t('cleanupOldMessages')} pendingLabel={t('cleaningUp')} variant="danger"
            confirm={t('cleanupConfirm')}>
            <Field label={t('olderThanDays')}><input name="days" type="number" min={1} max={36500} defaultValue={7} dir="ltr" required /></Field>
          </ActionForm>
        </Panel>
      </div>
      <Panel title={t('messageHistory')} subtitle={t('queueHistoryHelp')}
        action={<Badge tone="purple"><ListOrdered size={14} />{t('recordCount', { count: messages.length })}</Badge>}>
        <form action={getPathname({ href: '/queue', locale })} method="get" className="limit-form">
          <label htmlFor="limit">{t('recordLimit')}</label><input id="limit" key={limit} name="limit" type="number" min={1} max={1000} defaultValue={limit} dir="ltr" required />
          <button className="button button-secondary" type="submit"><Search size={15} />{t('showRecords')}</button>
        </form>
        <MessagesTable messages={messages} expandable />
      </Panel>
    </div>
  );
}
