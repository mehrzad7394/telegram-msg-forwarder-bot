import { getPathname, Link } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { Badge, Empty, PageHeading, Panel, StatusBadge } from '@/components/ui';
import { getActiveFilters, getFilters } from '@/lib/queries';
import { filterActions } from '@/lib/labels';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  return pageMetadata('filters', '/filters', 'filtersMetadata');
}

export default async function FiltersPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const [filters, active] = await Promise.all([getFilters(), getActiveFilters()]);
  return (
    <div className="page-stack">
      <PageHeading label={t('messageProcessing')} title={t('filters')} description={t('filtersDescription')}
        action={<Link className="button button-primary" href="/filters/new"><Plus size={18} />{t('newFilter')}</Link>} />
      <Panel title={t('filtersList')} subtitle={t('filtersListHelp')}
        action={<Badge tone="green" dot>{t('activeFilterCount', { count: active.length })}</Badge>}>
        {filters.length ? (
          <div className="table-scroll" tabIndex={0} aria-label={t('filtersList')}>
            <table><thead><tr><th scope="col">{t('filterName')}</th><th scope="col">{t('actions')}</th><th scope="col">{t('pattern')}</th><th scope="col">{t('status')}</th><th scope="col">{t('recordActions')}</th></tr></thead>
              <tbody>{filters.map((filter) => (
                <tr key={filter._id}>
                  <td><div className="cell-identity"><span className="icon-tile tile-purple"><SlidersHorizontal size={16} /></span><bdi>{filter.name}</bdi></div></td>
                  <td>{filterActions[filter.action] ? t(filterActions[filter.action]) : filter.action}</td>
                  <td><bdi className="message-preview"><code>{filter.pattern || '—'}</code></bdi></td>
                  <td><StatusBadge active={filter.isActive} /></td>
                  <td><a className="text-link" href={getPathname({ href: `/filters/${filter._id}`, locale })}>{t('manage')}</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty icon={SlidersHorizontal} title={t('filtersEmpty')} description={t('filtersEmptyHelp')} />}
      </Panel>
    </div>
  );
}
