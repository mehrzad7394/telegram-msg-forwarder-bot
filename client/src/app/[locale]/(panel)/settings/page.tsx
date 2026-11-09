import { getTranslations } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';
import { UserRoles } from '@repo/shared';
import { ActionForm, Field, Toggle } from '@/components/action-form';
import { Badge, PageHeading, Panel, StatusBadge } from '@/components/ui';
import { saveSettings, setupPassword } from '@/lib/actions';
import { getProfile, getSettings } from '@/lib/queries';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata() {
  return pageMetadata('settings', '/settings', 'settingsMetadata');
}

export default async function SettingsPage() {
  const t = await getTranslations();
  const [settings, profile] = await Promise.all([getSettings(), getProfile()]);
  return (
    <div className="page-stack">
      <PageHeading label={t('configuration')} title={t('settings')} description={t('settingsDescription')} />
      <div className="dashboard-grid">
        <Panel title={t('generalProcessing')} subtitle={t('beforeCustomFilters')}>
          <ActionForm className="panel-body" action={saveSettings} label={t('saveSettings')}>
            <Toggle name="removeMention" label={t('removeMentionLines')} description={t('removeMentionHelp')} defaultChecked={settings?.removeMention} />
            <Toggle name="removeURL" label={t('removeLinkLines')} description={t('removeLinkHelp')} defaultChecked={settings?.removeURL} />
          </ActionForm>
        </Panel>
        <Panel title={t('adminAccount')} subtitle={t('currentSession')} action={<StatusBadge active={profile.isActive} />}>
          <dl className="profile-info">
            <div><dt>{t('username')}</dt><dd><bdi>{profile.username}</bdi></dd></div>
            <div><dt>{t('telegramId')}</dt><dd><code dir="ltr">{profile.telegramId}</code></dd></div>
            <div><dt>{t('role')}</dt><dd><Badge tone="purple"><ShieldCheck size={14} />{profile.role === UserRoles.ADMIN ? t('admin') : t('user')}</Badge></dd></div>
          </dl>
        </Panel>
      </div>
      <div className="detail-grid">
        <Panel title={t('changePassword')} subtitle={t('passwordChangeHelp')}>
          <ActionForm className="panel-body" action={setupPassword} label={t('changePassword')} resetOnSuccess>
            <Field label={t('newPassword')}><input name="password" type="password" autoComplete="new-password" dir="ltr" required /></Field>
            <Field label={t('confirmNewPassword')}><input name="confirmPassword" type="password" autoComplete="new-password" dir="ltr" required /></Field>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
