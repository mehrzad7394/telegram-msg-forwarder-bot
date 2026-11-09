'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  FilterActions, UserRoles, requiresFilterReplacement, usesFilterPattern,
  type ChannelRecord, type FilterRecord, type UserRecord,
} from '@repo/shared';
import { saveChannel, saveFilter, saveUser } from '@/lib/actions';
import { ActionForm, Field, Toggle } from './action-form';
import { filterActions } from '@/lib/labels';

export function ChannelForm({ channel }: { channel?: ChannelRecord }) {
  const t = useTranslations();
  return (
    <ActionForm action={saveChannel.bind(null, channel?._id ?? null)} reloadOnSuccess={!!channel} label={channel ? t('saveChanges') : t('createAndActivateChannel')}>
      <Field label={t('channelName')}><input name="channelName" defaultValue={channel?.channelName} dir="auto" required /></Field>
      <Field label={t('channelId')} note={channel ? t('existingChannelIdHelp') : t('newChannelIdHelp')}>
        <input name="channelId" defaultValue={channel?.channelId} dir="ltr" readOnly={!!channel} required />
      </Field>
      <Toggle name="botIsAdmin" label={t('botIsChannelAdmin')} description={t('botAdminHelp')} defaultChecked={channel?.botIsAdmin} />
      {channel ? (channel.isActive && <Toggle name="deactivate" label={t('deactivateChannel')} description={t('deactivateChannelHelp')} />) : (
        <p className="form-note">{t('channelCreateNote')}</p>
      )}
    </ActionForm>
  );
}

export function FilterForm({ filter }: { filter?: FilterRecord }) {
  const t = useTranslations();
  const [action, setAction] = useState(filter?.action ?? FilterActions.REMOVE_WORD);
  const wholeMessage = !usesFilterPattern(action);
  return (
    <ActionForm action={saveFilter.bind(null, filter?._id ?? null)} reloadOnSuccess={!!filter} label={filter ? t('saveChanges') : t('createFilter')}>
      <Field label={t('filterName')}><input name="name" dir="auto" defaultValue={filter?.name} required /></Field>
      <Field label={t('actions')}>
        <select name="action" value={action} onChange={(event) => setAction(event.target.value as FilterActions)}>
          {Object.values(FilterActions).map((value) => <option key={value} value={value}>{t(filterActions[value])}</option>)}
        </select>
      </Field>
      <Field label={t('matchPattern')} note={wholeMessage ? t('wholeMessagePattern') : t('patternHelp')}>
        <input name="pattern" dir="auto" defaultValue={filter?.pattern} required={!wholeMessage} />
      </Field>
      <Field label={wholeMessage ? t('addedText') : t('replacementText')} note={requiresFilterReplacement(action) ? t('replacementRequiredHelp') : t('replacementUnusedHelp')}>
        <textarea name="replacement" dir="auto" rows={3} defaultValue={filter?.replacement} required={requiresFilterReplacement(action)} />
      </Field>
      <Toggle name="isRegex" label={t('useRegex')} description={t('regexAlwaysHelp')} defaultChecked={filter?.isRegex} />
      <Toggle key={String(filter?.isActive)} name="isActive" label={t('filterEnabled')} defaultChecked={filter?.isActive ?? true} />
    </ActionForm>
  );
}

export function UserForm({ user }: { user?: UserRecord }) {
  const t = useTranslations();
  return (
    <ActionForm action={saveUser.bind(null, user?._id ?? null)} reloadOnSuccess={!!user} label={user ? t('saveChanges') : t('createUser')}>
      <Field label={t('telegramId')}><input name="telegramId" dir="ltr" inputMode="numeric" defaultValue={user?.telegramId} readOnly={!!user} required /></Field>
      <Field label={t('username')} note={user ? undefined : t('usernameFallback')}><input name="username" dir="ltr" defaultValue={user?.username} autoComplete="off" /></Field>
      <Field label={t('role')}>
        <select name="role" defaultValue={user?.role ?? UserRoles.USER}><option value={UserRoles.USER}>{t('user')}</option><option value={UserRoles.ADMIN}>{t('admin')}</option></select>
      </Field>
      <Toggle key={String(user?.isActive)} name="isActive" label={t('accountEnabled')} defaultChecked={user?.isActive ?? true} />
      {!user && <p className="form-note">{t('userFormNote')}</p>}
    </ActionForm>
  );
}
