import {liveQuery} from 'dexie';
import {useEffect} from 'preact/hooks';

import {db} from './db';
import {recoverInterrupted} from './outbox';
import {outboxDeps} from './outboxDeps';
import {createOutboxSender} from './outboxSender';

/**
 * Delivers the signed-in user's outbox. Mount it once, high in the tree, with
 * the user's id (`undefined` while there is no user or the account is
 * inactive: nothing is sent then).
 *
 * It starts a pass when the app opens, when something is queued (also from
 * another tab), when the browser comes back online and when the app becomes
 * visible again. Failed passes retry by themselves with a growing delay.
 */
export function useOutboxSync(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) {
      return;
    }

    const sender = createOutboxSender(userId, outboxDeps);

    // Items left `sending` by a closed app go back to `pending`.
    void recoverInterrupted().then(sender.kick);

    // Emits at start and whenever the pending items change: a new report.
    const subscription = liveQuery(() =>
      db.outbox.where('[ownerId+status]').equals([userId, 'pending']).count(),
    ).subscribe({
      next: sender.kick,
      error: error => console.error('Outbox watch failed', error),
    });

    const handleOnline = () => sender.resume();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sender.resume();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      sender.stop();
    };
  }, [userId]);
}
