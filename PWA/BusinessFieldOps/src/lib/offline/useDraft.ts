import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

import {deleteDraft, findDraft, getDraft, saveDraft} from './drafts';
import type {OfflineKind} from './types';

/** Options of {@link useDraft}. */
export interface UseDraftOptions<T> {
  kind: OfflineKind;
  /** Profile id of the signed-in user. Nothing is loaded or saved without it. */
  ownerId: string | undefined;
  /**
   * What the draft is about (e.g. a task id). It is stored with the draft so
   * drafts can be grouped. Without `draftId` it also selects the draft: the
   * most recent one for `(kind, refId)` is resumed.
   */
  refId?: string;
  /**
   * Edit this exact draft: it is loaded if it exists, otherwise a blank draft
   * with this id is started. Use it when one `refId` can have several drafts
   * (a task has one report per client).
   */
  draftId?: string;
  /**
   * Value of a blank form. Read each time a blank draft is started (new
   * target or `reset`), so it may depend on the target (e.g. the task).
   */
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
   * False until the saved draft (if any) has been loaded, and again whenever
   * the target (`ownerId`, `kind`, `refId`, `draftId`) changes. Render the
   * form only when it is true, otherwise the loaded draft overwrites what the
   * user has already typed.
   */
  ready: boolean;
  /** Id of the current draft. Only meaningful once `ready`. */
  draftId: string;
  /**
   * Throws the draft away and starts a blank one with a NEW id. With an
   * explicit `draftId` option, close the form or switch to another id
   * afterwards: the old id may have become an outbox item.
   */
  reset: () => Promise<void>;
}

/**
 * Form state that survives closing the app.
 *
 * It resumes the user's draft (by `draftId`, or the latest for
 * `(kind, refId)`) or starts a blank one. A blank draft is only written after
 * the first change, so no empty drafts pile up. Pending changes are flushed
 * when the app goes to the background, when the target changes and when the
 * component unmounts.
 *
 * Switching target while mounted is safe: nothing (id, value, pending
 * changes) is carried over to the new target. Mounting the form with a `key`
 * is still the simplest way to also reset the form's own UI state.
 *
 * After a successful `enqueue` call `reset()`: the draft id became the outbox
 * item id and must never be reused for a new form.
 */
export function useDraft<T>({
  kind,
  ownerId,
  refId = '',
  draftId: requestedId,
  initialValue,
  debounceMs = 500,
}: UseDraftOptions<T>): UseDraft<T> {
  const initialRef = useRef(initialValue);
  initialRef.current = initialValue;

  const [draftId, setDraftId] = useState(
    () => requestedId ?? crypto.randomUUID(),
  );
  const idRef = useRef(draftId);
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

  // Reads the refs when it is called, not when it is created: the target
  // effect below relies on that to save the OLD target in its cleanup.
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

  // Runs once per target. The cleanup runs before the next body, so the old
  // target is saved from the refs before the body resets them.
  useEffect(() => {
    let cancelled = false;

    // New target: start from scratch, never inherit from the previous one.
    idRef.current = requestedId ?? crypto.randomUUID();
    latestRef.current = initialRef.current;
    dirtyRef.current = false;
    setDraftId(idRef.current);
    setValueState(initialRef.current);
    setReady(false);

    if (ownerId) {
      void (async () => {
        const existing = requestedId
          ? await getDraft<T>(requestedId)
          : await findDraft<T>(ownerId, kind, refId);

        if (cancelled) {
          return;
        }

        if (existing) {
          idRef.current = existing.id;
          latestRef.current = existing.data;
          setDraftId(existing.id);
          setValueState(existing.data);
        }
        setReady(true);
      })();
    }

    return () => {
      cancelled = true;
      void flush();
    };
  }, [ownerId, kind, refId, requestedId, flush]);

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
    setDraftId(idRef.current);
    setValueState(initialRef.current);

    await deleteDraft(staleId);
  }, [cancelTimer]);

  return {value, setValue, ready, draftId, reset};
}
