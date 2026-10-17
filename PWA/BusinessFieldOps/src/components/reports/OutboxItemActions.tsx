import 'mdui/components/button-icon.js';
import 'mdui/components/icon.js';

import type {JSX} from 'preact';
import {useState} from 'preact/hooks';

import {discard, retryFailed} from '@/lib/offline/outbox';

/** Props of {@link OutboxItemActions}. */
export interface OutboxItemActionsProps {
  outboxId: string;
  status: 'queued' | 'failed';
}

/**
 * What the user can do with a report that has not reached the server: wait
 * (queued), or try again / discard it (failed). Discarding asks twice, inline,
 * so it also works inside a dialog.
 */
export function OutboxItemActions({
  outboxId,
  status,
}: OutboxItemActionsProps): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  if (status === 'queued') {
    return <mdui-icon name="schedule" title="Waiting to be sent" />;
  }

  if (confirming) {
    return (
      <>
        <mdui-button-icon
          icon="close"
          aria-label="Keep the report"
          onClick={() => setConfirming(false)}
        />
        <mdui-button-icon
          icon="delete_forever"
          aria-label="Discard the report"
          onClick={() => void discard(outboxId)}
        />
      </>
    );
  }

  return (
    <>
      <mdui-button-icon
        icon="refresh"
        aria-label="Try again"
        onClick={() => void retryFailed(outboxId)}
      />
      <mdui-button-icon
        icon="delete"
        aria-label="Discard the report"
        onClick={() => setConfirming(true)}
      />
    </>
  );
}
