import {useCallback, useEffect, useRef, useState} from 'preact/hooks';

import {db, REFERENCE_META_KEY} from './db';
import {
  resetReferenceDataIfOtherUser,
  syncReferenceData,
} from './referenceData';
import {useLiveQuery} from './useLiveQuery';

/** Data older than this is refreshed when the app comes back to the screen. */
const STALE_AFTER_MS = 15 * 60 * 1000;

export type ReferenceSyncStatus = 'idle' | 'syncing' | 'error';

/** Value returned by {@link useReferenceSync}. */
export interface ReferenceSync {
  status: ReferenceSyncStatus;
  /** Epoch ms of the last completed sync; null if it never completed. */
  lastSyncedAt: number | null;
  /** Forces a sync now (e.g. a "refresh" button). */
  refresh: () => Promise<void>;
}

/**
 * Keeps the local reference data up to date. Mount it once, high in the tree,
 * with the signed-in user's id (`undefined` while there is no user).
 *
 * Syncs when the user appears, when the browser reports it is back online and
 * when the app becomes visible again with stale data. A failed sync (usually:
 * offline) leaves the previous local data in place and sets `status` to
 * `error`; it is not fatal.
 */
export function useReferenceSync(userId: string | undefined): ReferenceSync {
  const [status, setStatus] = useState<ReferenceSyncStatus>('idle');
  const lastSyncedAt = useLiveQuery(
    async () => (await db.syncMeta.get(REFERENCE_META_KEY))?.syncedAt ?? null,
    [],
    null,
  );
  const lastSyncedAtRef = useRef(lastSyncedAt);
  lastSyncedAtRef.current = lastSyncedAt;

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    setStatus('syncing');
    try {
      await syncReferenceData(userId);
      setStatus('idle');
    } catch (error) {
      console.error('Reference data sync failed', error);
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void (async () => {
      await resetReferenceDataIfOtherUser(userId);
      await refresh();
    })();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleOnline = () => void refresh();
    const handleVisibility = () => {
      const last = lastSyncedAtRef.current;
      const isStale = last === null || Date.now() - last > STALE_AFTER_MS;

      if (document.visibilityState === 'visible' && isStale) {
        void refresh();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, refresh]);

  return {status, lastSyncedAt, refresh};
}
