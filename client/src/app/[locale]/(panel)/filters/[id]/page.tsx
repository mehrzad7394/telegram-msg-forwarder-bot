import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EntityButtons } from '@/components/entity-buttons';
import { FilterForm } from '@/components/entity-forms';
import { PageHeading, Panel, StatusBadge } from '@/components/ui';
import { filterActions } from '@/lib/labels';
import { pageMetadata } from '@/lib/metadata';
import { getFilter } from '@/lib/queries';

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return pageMetadata(id === 'new' ? 'newFilter' : 'manageFilter', `/filters/${encodeURIComponent(id)}`);
}

export default async function FilterPage({ params }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const filter = id === 'new' ? null : await getFilter(id);
  if (id !== 'new' && !filter) notFound();
  return (
    <div className="page-stack">
      <PageHeading label={t('messageProcessing')} title={filter ? t('manageFilter') : t('newFilter')}
        description={t('filterEditDescription')}
        back={{ href: '/filters', label: t('backToFilters') }} action={filter && <StatusBadge active={filter.isActive} />} />
      <div className="detail-grid">
        <Panel title={t('processingRule')}><FilterForm key={id} filter={filter ?? undefined} /></Panel>
        {filter && <Panel title={t('filterActions')} subtitle={t('filterActionsHelp')}>
          <div className="panel-body">
            <p className="detail-value"><bdi>{filter.name}</bdi><small>{filterActions[filter.action] ? t(filterActions[filter.action]) : filter.action}</small></p>
            <EntityButtons id={filter._id} buttons={[
              { command: filter.isActive ? 'deactivateFilter' : 'activateFilter', label: filter.isActive ? t('deactivate') : t('activate') },
              { command: 'deleteFilter', label: t('deleteFilter'), danger: true, confirm: t('deleteFilterConfirm') },
            ]} />
          </div>
        </Panel>}
      </div>
    </div>
  );
}
