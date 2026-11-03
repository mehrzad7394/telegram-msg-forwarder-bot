'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { ApiEnvelope, QueueRecord } from '@/lib/types';
import { useAppTranslations } from '@/components/providers';
import { ConfirmButton, EmptyState, Loading, Notice, PageHeading, Panel, SearchBox } from '@/components/ui';

export default function QueuePage(){
  const {t,language}=useAppTranslations();const [records,setRecords]=useState<QueueRecord[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [query,setQuery]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const response=await api<ApiEnvelope<QueueRecord[]>>('queue/messages?limit=50');setRecords(response.data);}catch(cause){setError(cause instanceof Error?cause.message:t('error'));}finally{setLoading(false);}},[t]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>records.filter(record=>[record.originalMessage,record.processedMessage,record.status].some(value=>String(value??'').toLocaleLowerCase().includes(query.toLocaleLowerCase()))),[records,query]);
  const cleanup=async()=>{try{await api('queue/cleanup',{method:'POST',body:JSON.stringify({days:7})});setNotice(t('cleanupDone'));await load();}catch(cause){setError(cause instanceof Error?cause.message:t('error'));}};
  const date=(value?:string)=>value?new Intl.DateTimeFormat(language==='fa'?'fa-IR':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
  return <><PageHeading title={t('queue')} description={t('queueIntro')} action={<ConfirmButton label={t('cleanup')} onConfirm={cleanup} className="btn-ghost text-sm"/>}/>{error&&<Notice message={error} onClose={()=>setError('')}/ >}{notice&&<Notice kind="success" message={notice} onClose={()=>setNotice('')}/ >}<Panel><div className="border-b p-4" style={{borderColor:'var(--line)'}}><SearchBox value={query} onChange={setQuery}/></div>{loading?<Loading/>:filtered.length===0?<EmptyState title={t(query?'noRecords':'noMessages')} detail={t(query?'noRecords':'queueIntro')}/>:<div className="table-wrap"><table><thead><tr><th>{t('message')}</th><th>{t('transformed')}</th><th>{t('status')}</th><th>{t('created')}</th><th>{t('errorDetail')}</th></tr></thead><tbody>{filtered.map((record,index)=><tr key={record._id??index}><td className="max-w-[240px] truncate">{record.originalMessage||'—'}</td><td className="max-w-[240px] truncate">{record.processedMessage||'—'}</td><td><span className="badge" style={{background:record.status==='failed'?'#ffeded':record.status==='sent'?'#e8f7f1':'var(--bg)',color:record.status==='failed'?'#c94f58':record.status==='sent'?'#16865b':'var(--muted)'}}>{t(record.status)}</span></td><td className="whitespace-nowrap">{date(record.createdAt)}</td><td className="max-w-[200px] truncate text-red-500">{record.error||'—'}</td></tr>)}</tbody></table></div>}</Panel></>;
}