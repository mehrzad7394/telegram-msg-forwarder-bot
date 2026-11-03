'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Search, X } from 'lucide-react';
import { useAppTranslations } from '@/components/providers';

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-1 text-sm muted">{description}</p></div>{action}</div>;
}

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useAppTranslations();
  return <label className="relative block w-full sm:max-w-[300px]"><Search size={16} className="absolute top-1/2 start-3 -translate-y-1/2 muted"/><input className="field ps-9" value={value} onChange={event=>onChange(event.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')}/></label>;
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function Loading({ label }: { label?: string }) {
  const { t } = useAppTranslations();
  return <div className="grid min-h-[180px] place-items-center muted"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={18}/>{label ?? t('loading')}</span></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="grid min-h-[210px] place-items-center px-5 text-center"><div><div className="mx-auto mb-3 grid size-11 place-items-center rounded-full" style={{background:'var(--accent-soft)',color:'var(--accent)'}}><Search size={18}/></div><p className="font-semibold">{title}</p><p className="mt-1 text-sm muted">{detail}</p></div></div>;
}

export function Notice({ message, kind = 'error', onClose }: { message: string; kind?: 'error' | 'success'; onClose?: () => void }) {
  return <div role={kind==='error'?'alert':'status'} className="mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm" style={{borderColor:kind==='error'?'#f2c2c2':'#b8e3cd',background:kind==='error'?'#fff3f3':'#f1fbf5',color:kind==='error'?'#a33':'#176b43'}}><span className="flex items-center gap-2">{kind==='error'?<AlertCircle size={17}/>:<CheckCircle2 size={17}/ >}{message}</span>{onClose&&<button aria-label="Dismiss" onClick={onClose}><X size={16}/></button>}</div>;
}

export function ConfirmButton({ label, onConfirm, className }: { label: string; onConfirm: () => Promise<void>; className?: string }) {
  const { t } = useAppTranslations();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (confirming) return <span className="inline-flex items-center gap-1"><button className="text-xs font-semibold text-red-600" disabled={busy} onClick={async()=>{setBusy(true);try{await onConfirm();}finally{setBusy(false);setConfirming(false);}}}>{busy?t('loading'):t('confirm')}</button><button aria-label={t('cancel')} className="text-xs muted" onClick={()=>setConfirming(false)}>{t('cancel')}</button></span>;
  return <button className={className ?? 'text-sm text-red-600 hover:underline'} onClick={()=>setConfirming(true)}>{label}</button>;
}