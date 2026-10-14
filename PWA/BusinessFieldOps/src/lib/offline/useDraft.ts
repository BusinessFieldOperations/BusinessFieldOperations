import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

import {deleteDraft, findDraft, saveDraft} from './drafts';
import type {OfflineKind} from './types';

/** Options of {@link useDraft}. */
export interface UseDraftOptions<T> {
  kind: OfflineKind;
  /** Profile id of the signed-in user. Nothing is loaded or saved without it. */
  ownerId: string | undefined;
  /** What the draft is about (e.g. a task id); one draft per value. */
  refId?: string;
  /** Value of a blank form. Read once. */
  initialValue: T;
  /** Wait after the last change before writing to IndexedDB. */
  debounceMs?: number;
}

/** Value returned by {@link useDraft}. */
export interface UseDraft<T> {
  value: T;
  /** Updates the form value and schedules an autosave. */
  setValue: (next: T | ((previous: T) => T)) => void;
  /**
   * False until the saved draft (if any) has been loaded. Render the form
   * only when it is true, otherwise the loaded draft overwrites what the user
   * has already typed.
   */
  ready: boolean;
  /** Id of the current draft. Pass it to `enqueue` when sending. */
  draftId: string;
  /** Throws the draft away and starts a blank one with a NEW id. */
  reset: () => Promise<void>;
}

/**
 * Form state that survives closing the app.
 *
 * It finds the user's draft for `(kind, refId)` or starts a blank one. A blank
 * draft is only written after the first change, so no empty drafts pile up.
 * Pending changes are flushed when the app goes to the background or the
 * component unmounts.
 *
 * After a successful `enqueue` call `reset()`: the draft id became the outbox
 * item id and must never be reused for a new form.
 */
export function useDraft<T>({
  kind,
  ownerId,
  refId = '',
  initialValue,
  debounceMs = 500,
}: UseDraftOptions<T>): UseDraft<T> {
  const initialRef = useRef(initialValue);
  const idRef = useRef<string>(crypto.randomUUID());
  const latestRef = useRef(initialValue);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [value, setValueState] = useState(initialValue);
  const [ready, setReady] = useState(false);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    cancelTimer();

    if (!dirtyRef.current || !ownerId) {
      return;
    }

    dirtyRef.current = false;
    await saveDraft({
      id: idRef.current,
      kind,
      ownerId,
      refId,
      data: latestRef.current,
    });
  }, [cancelTimer, kind, ownerId, refId]);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    let cancelled = false;
    setReady(false);

    void (async () => {
      const existing = await findDraft<T>(ownerId, kind, refId);

      if (cancelled) {
        return;
      }

      if (existing) {
        idRef.current = existing.id;
        latestRef.current = existing.data;
        setValueState(existing.data);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId, kind, refId]);

  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    };

    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', handleHidden);

    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', handleHidden);
      void flush();
    };
  }, [flush]);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved =
        typeof next === 'function'
          ? (next as (previous: T) => T)(latestRef.current)
          : next;

      latestRef.current = resolved;
      dirtyRef.current = true;
      setValueState(resolved);

      cancelTimer();
      timerRef.current = setTimeout(() => void flush(), debounceMs);
    },
    [cancelTimer, debounceMs, flush],
  );

  const reset = useCallback(async () => {
    cancelTimer();
    dirtyRef.current = false;

    const staleId = idRef.current;
    idRef.current = crypto.randomUUID();
    latestRef.current = initialRef.current;
    setValueState(initialRef.current);

    await deleteDraft(staleId);
  }, [cancelTimer]);

  return {value, setValue, ready, draftId: idRef.current, reset};
}
