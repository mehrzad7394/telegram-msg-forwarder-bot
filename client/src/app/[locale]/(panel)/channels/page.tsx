import { getPathname, Link } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Bot, Plus, RadioTower, Waypoints } from 'lucide-react';
import { Badge, Empty, Metric, PageHeading, Panel, StatusBadge } from '@/components/ui';
import { getActiveChannel, getChannels, getChannelStats } from '@/lib/queries';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  return pageMetadata('channels', '/channels', 'channelsMetadata');
}

export default async function ChannelsPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const [channels, active, stats] = await Promise.all([getChannels(), getActiveChannel(), getChannelStats()]);
  return (
    <div className="page-stack">
      <PageHeading label={t('deliveryRoute')} title={t('channels')} description={t('channelsDescription')}
        action={<Link className="button button-primary" href="/channels/new"><Plus size={18} />{t('addChannel')}</Link>} />
      <div className="metric-grid metric-three">
        <Metric label={t('registeredChannels')} value={stats.total} hint={t('allChannels')} icon={RadioTower} />
        <Metric label={t('activeChannels')} value={stats.active} hint={active?.channelName || t('noDestinationSelected')} icon={Waypoints} tone="blue" />
        <Metric label={t('botAdminChannels')} value={stats.withAdmin} hint={t('registeredPermissions')} icon={Bot} tone="green" />
      </div>
      <Panel title={t('channelsList')} subtitle={t('channelsListHelp')}>
        {channels.length ? (
          <div className="table-scroll" tabIndex={0} aria-label={t('channelsList')}>
            <table><thead><tr><th scope="col">{t('channel')}</th><th scope="col">{t('telegramId')}</th><th scope="col">{t('status')}</th><th scope="col">{t('botAccess')}</th><th scope="col">{t('actions')}</th></tr></thead>
              <tbody>{channels.map((channel) => (
                <tr key={channel._id}>
                  <td><div className="cell-identity"><span className="icon-tile tile-blue"><RadioTower size={16} /></span><bdi>{channel.channelName}</bdi></div></td>
                  <td><code dir="ltr">{channel.channelId}</code></td>
                  <td>{active?._id === channel._id ? <Badge tone="purple" dot>{t('currentDestination')}</Badge> : <StatusBadge active={channel.isActive} />}</td>
                  <td><Badge tone={channel.botIsAdmin ? 'green' : 'amber'}>{channel.botIsAdmin ? t('admin') : t('noAdminAccess')}</Badge></td>
                  <td><a className="text-link" href={getPathname({ href: `/channels/${channel._id}`, locale })}>{t('manage')}</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty icon={RadioTower} title={t('channelsEmpty')} description={t('channelsEmptyHelp')} />}
      </Panel>
    </div>
  );
}
