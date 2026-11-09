'use client';

import { useEffect, useState } from 'react';
import type { ActionResult } from '@/lib/api';

type FlashSlot = 'form' | 'record';

function storageKey(slot: FlashSlot) {
  return `relay-flash:${window.location.pathname}:${slot}`;
}

export function reloadWithNotice(slot: FlashSlot, message: string) {
  try {
    sessionStorage.setItem(storageKey(slot), message);
  } catch {
    // The reload still works when storage is unavailable.
  }
  window.location.reload();
}

export function useFlashNotice(slot: FlashSlot): ActionResult {
  const [notice, setNotice] = useState<ActionResult>(null);
  useEffect(() => {
    try {
      const key = storageKey(slot);
      const message = sessionStorage.getItem(key);
      if (message) {
        sessionStorage.removeItem(key);
        setNotice({ status: 'success', message });
      }
    } catch {
      // A blocked storage policy only suppresses the one-time notice.
    }
  }, [slot]);
  return notice;
}
