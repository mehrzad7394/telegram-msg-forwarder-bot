import { getPathname, Link } from '@/i18n/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus, ShieldCheck, UserCheck, UsersRound } from 'lucide-react';
import { UserRoles } from '@repo/shared';
import { Badge, Empty, Metric, PageHeading, Panel, StatusBadge } from '@/components/ui';
import { getUsers, getUserStats } from '@/lib/queries';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  return pageMetadata('users', '/users', 'usersMetadata');
}

export default async function UsersPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const [users, stats] = await Promise.all([getUsers(), getUserStats()]);
  return (
    <div className="page-stack">
      <PageHeading label={t('accessManagement')} title={t('users')} description={t('usersDescription')}
        action={<Link className="button button-primary" href="/users/new"><Plus size={18} />{t('addUser')}</Link>} />
      <div className="metric-grid metric-three">
        <Metric label={t('totalUsers')} value={stats.total} hint={t('registeredAccounts')} icon={UsersRound} />
        <Metric label={t('activeAccounts')} value={stats.active} hint={t('activeAccountsHelp')} icon={UserCheck} tone="green" />
        <Metric label={t('admins')} value={stats.admins} hint={t('adminRoleAccounts')} icon={ShieldCheck} tone="blue" />
      </div>
      <Panel title={t('usersList')}>
        {users.length ? (
          <div className="table-scroll" tabIndex={0} aria-label={t('usersList')}>
            <table><thead><tr><th scope="col">{t('username')}</th><th scope="col">{t('telegramId')}</th><th scope="col">{t('role')}</th><th scope="col">{t('status')}</th><th scope="col">{t('actions')}</th></tr></thead>
              <tbody>{users.map((user) => (
                <tr key={user._id}>
                  <td><div className="cell-identity"><span className="avatar">{user.username?.slice(0, 2).toUpperCase() || t('avatarFallback')}</span><bdi>{user.username || '—'}</bdi></div></td>
                  <td><code dir="ltr">{user.telegramId}</code></td>
                  <td><Badge tone={user.role === UserRoles.ADMIN ? 'purple' : 'neutral'}>{user.role === UserRoles.ADMIN ? t('admin') : t('user')}</Badge></td>
                  <td><StatusBadge active={user.isActive} /></td>
                  <td><a className="text-link" href={getPathname({ href: `/users/${user._id}`, locale })}>{t('manage')}</a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty icon={UsersRound} title={t('usersEmpty')} description={t('usersEmptyHelp')} />}
      </Panel>
    </div>
  );
}
