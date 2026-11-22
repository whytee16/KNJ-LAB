'use client';

import type { Values } from '@knj/physics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveLabSession } from './actions';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

/**
 * Saves the student's parameters (debounced) and time spent (every 30 s while the tab is visible).
 * Disabled for visitors and non-students: nothing leaves the browser then.
 */
export function useLabSession(code: string, params: Values, enabled: boolean): SaveStatus {
  const sessionId = useRef<string | null>(null);
  const started = useRef(0);
  const latest = useRef(params);
  const first = useRef(true);
  const [status, setStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    started.current = Date.now();
  }, []);

  useEffect(() => {
    latest.current = params;
  }, [params]);

  const save = useCallback(async () => {
    const res = await saveLabSession({
      code,
      sessionId: sessionId.current,
      params: latest.current,
      durationS: Math.floor((Date.now() - started.current) / 1000),
    }).catch(() => null);
    if (res?.ok) sessionId.current = res.sessionId;
    return Boolean(res?.ok);
  }, [code]);

  useEffect(() => {
    if (!enabled) return;
    // The opening parameters are not a change; save only once the student touches something.
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus('pending');
    const timer = setTimeout(async () => setStatus((await save()) ? 'saved' : 'error'), 800);
    return () => clearTimeout(timer);
  }, [enabled, params, save]);

  useEffect(() => {
    if (!enabled) return;
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && sessionId.current) void save();
    }, 30_000);
    return () => clearInterval(tick);
  }, [enabled, save]);

  return status;
}
