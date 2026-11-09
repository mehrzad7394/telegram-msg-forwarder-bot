'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { ActionResult } from '@/lib/api';
import { reloadWithNotice, useFlashNotice } from './action-flash';

export function ActionForm({ action, children, label, pendingLabel, confirm, resetOnSuccess, reloadOnSuccess, variant = 'primary', className }: {
  action: (previous: ActionResult, form: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  reloadOnSuccess?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const t = useTranslations();
  const [state, dispatch, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const flash = useFlashNotice('form');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (state?.status !== 'success') return;
    if (reloadOnSuccess) {
      reloadWithNotice('form', state.message);
      return;
    }
    if (resetOnSuccess) form.current?.reset();
    router.refresh();
  }, [state, resetOnSuccess, reloadOnSuccess, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || (confirm && !window.confirm(confirm))) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  const notice = state?.status === 'success' && reloadOnSuccess ? null : state ?? flash;

  return (
    <form ref={form} action={dispatch} onSubmit={submit} className={className}>
      <fieldset disabled={pending || (!!confirm && !ready)} className="form-fields">
        {children}
        <button type="submit" className={`button button-${variant}`}>
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          {pending ? pendingLabel ?? t('saving') : label}
        </button>
      </fieldset>
      <ActionNotice state={pending ? null : notice} />
    </form>
  );
}

export function ActionNotice({ state }: { state: ActionResult }) {
  if (!state) return null;
  const Icon = state.status === 'error' ? TriangleAlert : CheckCircle2;
  return (
    <p className={`notice notice-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>
      <Icon size={17} /><span dir="auto">{state.message}</span>
    </p>
  );
}

export function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{note && <small>{note}</small>}</label>;
}

export function Toggle({ name, label, description, defaultChecked = false }: {
  name: string; label: string; description?: string; defaultChecked?: boolean;
}) {
  return (
    <label className="toggle">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span className="toggle-track" aria-hidden="true" />
      <span><b>{label}</b>{description && <small>{description}</small>}</span>
    </label>
  );
}
