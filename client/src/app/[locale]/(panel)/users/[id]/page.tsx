import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { UserRoles } from '@repo/shared';
import { EntityButtons } from '@/components/entity-buttons';
import { UserForm } from '@/components/entity-forms';
import { PageHeading, Panel, StatusBadge } from '@/components/ui';
import { pageMetadata } from '@/lib/metadata';
import { getUser } from '@/lib/queries';

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return pageMetadata(id === 'new' ? 'addUser' : 'manageUser', `/users/${encodeURIComponent(id)}`);
}

export default async function UserPage({ params }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const user = id === 'new' ? null : await getUser(id);
  if (id !== 'new' && !user) notFound();
  return (
    <div className="page-stack">
      <PageHeading label={t('accessManagement')} title={user ? t('manageUser') : t('addUser')}
        description={t('userEditDescription')}
        back={{ href: '/users', label: t('backToUsers') }} action={user && <StatusBadge active={user.isActive} />} />
      <div className="detail-grid">
        <Panel title={t('accountDetails')}><UserForm user={user ?? undefined} /></Panel>
        {user && <Panel title={t('accountActions')} subtitle={t('userActionsHelp')}>
          <div className="panel-body">
            <p className="detail-value"><bdi>{user.username}</bdi><code dir="ltr">{user.telegramId}</code></p>
            <EntityButtons id={user._id} buttons={[
              { command: user.isActive ? 'deactivateUser' : 'activateUser', label: user.isActive ? t('deactivate') : t('activate'), confirm: user.isActive ? t('deactivateUserConfirm') : undefined },
              { command: user.role === UserRoles.ADMIN ? 'demoteUser' : 'promoteUser', label: user.role === UserRoles.ADMIN ? t('demoteUser') : t('promoteUser'), confirm: t('changeRoleConfirm') },
              { command: 'deleteUser', label: t('deleteUser'), danger: true, confirm: t('deleteUserConfirm') },
            ]} />
          </div>
        </Panel>}
      </div>
    </div>
  );
}
