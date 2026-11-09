import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EntityButtons } from '@/components/entity-buttons';
import { ChannelForm } from '@/components/entity-forms';
import { PageHeading, Panel, StatusBadge } from '@/components/ui';
import { pageMetadata } from '@/lib/metadata';
import { getActiveChannel, getChannel } from '@/lib/queries';

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return pageMetadata(id === 'new' ? 'addChannel' : 'manageChannel', `/channels/${encodeURIComponent(id)}`);
}

export default async function ChannelPage({ params }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const [channel, destination] = id === 'new' ? [null, null] : await Promise.all([getChannel(id), getActiveChannel()]);
  if (id !== 'new' && !channel) notFound();
  return (
    <div className="page-stack">
      <PageHeading label={t('deliveryRoute')} title={channel ? t('manageChannel') : t('addChannel')}
        description={channel ? t('channelEditDescription') : t('channelCreateDescription')}
        back={{ href: '/channels', label: t('backToChannels') }} action={channel && <StatusBadge active={channel.isActive} />} />
      <div className="detail-grid">
        <Panel title={t('channelDetails')}><ChannelForm key={id} channel={channel ?? undefined} /></Panel>
        {channel && <Panel title={t('channelActions')} subtitle={t('channelActionsHelp')}>
          <div className="panel-body">
            <p className="detail-value"><bdi>{channel.channelName}</bdi><code dir="ltr">{channel.channelId}</code></p>
            <EntityButtons id={channel._id} buttons={[
              ...(destination?._id === channel._id ? [] : [{ command: 'activateChannel' as const, label: t('setDestination'), confirm: t('setDestinationConfirm') }]),
              { command: 'deleteChannel', label: t('deleteChannel'), danger: true, confirm: t('deleteChannelConfirm') },
            ]} />
          </div>
        </Panel>}
      </div>
    </div>
  );
}
