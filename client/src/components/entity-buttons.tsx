'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { runEntityCommand, type EntityCommand } from '@/lib/actions';
import type { ActionResult } from '@/lib/api';
import { ActionNotice } from './action-form';
import { reloadWithNotice, useFlashNotice } from './action-flash';

export type CommandButton = { command: EntityCommand; label: string; danger?: boolean; confirm?: string };

export function EntityButtons({ id, buttons }: { id: string; buttons: CommandButton[] }) {
  const t = useTranslations();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<ActionResult>(null);
  const running = useRef(false);
  const flash = useFlashNotice('record');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function execute(button: CommandButton) {
    if (running.current || (button.confirm && !window.confirm(button.confirm))) return;
    running.current = true;
    setPending(true);
    setState(null);
    try {
      const result = await runEntityCommand(button.command, id);
      if (result?.status === 'success') {
        if (result.redirectTo) window.location.assign(result.redirectTo);
        else reloadWithNotice('record', result.message);
      } else {
        setState(result);
      }
    } catch {
      setState({ status: 'error', message: t('panelConnectionError') });
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <div>
      <div className="row-actions">
        {buttons.map((button) => (
          <button className={`button button-${button.danger ? 'danger' : 'secondary'}`} key={button.command} disabled={!ready || pending} type="button" onClick={() => execute(button)}>
            {button.label}
          </button>
        ))}
        {pending && <LoaderCircle className="animate-spin" size={17} role="status" aria-label={t('actionInProgress')} />}
      </div>
      <ActionNotice state={pending ? null : state ?? flash} />
    </div>
  );
}
