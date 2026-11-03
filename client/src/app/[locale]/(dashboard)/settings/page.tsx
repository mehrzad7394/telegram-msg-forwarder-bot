'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiEnvelope, SettingsRecord } from '@/lib/types';
import { useAppTranslations } from '@/components/providers';
import { Loading, Notice, PageHeading, Panel } from '@/components/ui';

export default function SettingsPage(){
  const {t}=useAppTranslations();const [settings,setSettings]=useState<SettingsRecord>({});const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  useEffect(()=>{let alive=true;api<ApiEnvelope<SettingsRecord|null>>('setting').then(response=>{if(alive)setSettings(response.data??{});}).catch(cause=>{if(alive)setError(cause instanceof Error?cause.message:t('error'));}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[t]);
  const save=async()=>{setSaving(true);setError('');try{const response=await api<SettingsRecord|ApiEnvelope<SettingsRecord>>('setting',{method:'PUT',body:JSON.stringify(settings)});setSettings('data'in response?response.data:response);setNotice(t('saved'));}catch(cause){setError(cause instanceof Error?cause.message:t('error'));}finally{setSaving(false);}};
  return <><PageHeading title={t('settings')} description={t('settingsIntro')}/>{error&&<Notice message={error} onClose={()=>setError('')}/ >}{notice&&<Notice kind="success" message={notice} onClose={()=>setNotice('')}/ >}{loading?<Loading/>:<Panel className="max-w-3xl p-5 sm:p-7"><div className="space-y-5">{[{key:'removeMention' as const,label:'removeMention' as const},{key:'removeURL' as const,label:'removeURL' as const}].map(setting=><label key={setting.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4" style={{borderColor:'var(--line)'}}><span><span className="block font-semibold">{t(setting.label)}</span><span className="mt-1 block text-xs muted">{t('settingsIntro')}</span></span><input className="size-5 accent-violet-600" type="checkbox" checked={Boolean(settings[setting.key])} onChange={event=>setSettings({...settings,[setting.key]:event.target.checked})}/></label>)}</div><div className="mt-6 flex justify-end"><button className="btn-primary min-w-32" disabled={saving} onClick={()=>void save()}>{saving?t('loading'):t('save')}</button></div></Panel>}</>;
}