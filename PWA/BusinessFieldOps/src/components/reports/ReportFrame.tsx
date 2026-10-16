import './ReportForm.css';

import 'mdui/components/button.js';

import type {ComponentChildren, JSX, RefObject} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';

import {FullScreenDialog} from '@/components/dialog';
import {joinClasses} from '@/components/list/classNames';
import type {TaskListItem} from '@/lib/tasks';

/** Props shared by the merchant and the promoter report dialogs. */
export interface ReportDialogProps {
  /** Draft being edited (`?report=<id>`). */
  draftId: string;
  /** Task of the report (`?task=<id>`), if the URL has one. */
  taskId: string | null;
  /** `undefined` while tasks load; `null` if it is not among the open tasks. */
  task: TaskListItem | null | undefined;
  onClose: () => void;
}

/** Props of {@link ReportFrame}. */
export interface ReportFrameProps {
  task: TaskListItem | null | undefined;
  /** The saved draft (if any) has been loaded. */
  ready: boolean;
  sending: boolean;
  error: string | null;
  formRef: RefObject<HTMLFormElement>;
  onSend: () => void;
  onClose: () => void;
  onDiscard: () => void;
  children: ComponentChildren;
}

/** Asks twice before throwing a draft away, without opening another layer. */
function DiscardDraft({onDiscard}: {onDiscard: () => void}): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  return confirming ? (
    <div class="report-form__discard">
      <span>Discard this draft?</span>
      <mdui-button variant="text" onClick={() => setConfirming(false)}>
        Cancel
      </mdui-button>
      <mdui-button variant="text" onClick={onDiscard}>
        Discard
      </mdui-button>
    </div>
  ) : (
    <div class="report-form__discard">
      <mdui-button
        variant="text"
        icon="delete"
        onClick={() => setConfirming(true)}
      >
        Discard draft
      </mdui-button>
    </div>
  );
}

/**
 * The full-screen shell of a report form: title, Send, loading and
 * "task gone" states, the `<form>` and the discard button.
 *
 * Messages are shown inline: mdui's `snackbar()` / `confirm()` attach to the
 * page, which a modal `<dialog>` covers.
 */
export function ReportFrame({
  task,
  ready,
  sending,
  error,
  formRef,
  onSend,
  onClose,
  onDiscard,
  children,
}: ReportFrameProps): JSX.Element {
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Sending reads the position first, which can take a few seconds: edits
  // made meanwhile would be lost, so the form is frozen (`inert` also blocks
  // the keyboard).
  useEffect(() => {
    formRef.current?.toggleAttribute('inert', sending);
  }, [formRef, sending, ready]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({block: 'nearest'});
    }
  }, [error]);

  const canEdit = Boolean(task) && ready;

  return (
    <FullScreenDialog
      open
      title={task ? `Report · ${task.establishmentName}` : 'Report'}
      closeLabel="Close"
      onClose={onClose}
      action={
        canEdit ? {label: 'Send', onClick: onSend, loading: sending} : undefined
      }
    >
      {task === null ? (
        <p class="report-form__message" role="alert">
          This task is not available anymore.
        </p>
      ) : null}
      {task === undefined || (task && !ready) ? (
        <p class="report-form__message">Loading report...</p>
      ) : null}
      {task && ready ? (
        <form
          ref={formRef}
          class={joinClasses('report-form', sending && 'report-form--busy')}
          onSubmit={e => e.preventDefault()}
        >
          {error ? (
            <p ref={errorRef} class="report-form__error" role="alert">
              {error}
            </p>
          ) : null}
          {children}
          <DiscardDraft onDiscard={onDiscard} />
        </form>
      ) : null}
    </FullScreenDialog>
  );
}
