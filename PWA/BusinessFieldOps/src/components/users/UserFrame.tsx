import './UserForm.css';

import type {ComponentChildren, JSX, RefObject} from 'preact';
import {useEffect, useRef} from 'preact/hooks';

import {FullScreenDialog} from '@/components/dialog';
import {joinClasses} from '@/components/list/classNames';
import {m} from '@/paraglide/messages.js';

/** What the body shows: a message, or the content inside the `<form>`. */
export type UserFrameStatus = 'loading' | 'unavailable' | 'ready';

/** Props of {@link UserFrame}. */
export interface UserFrameProps {
  title: string;
  status: UserFrameStatus;
  actionLabel: string;
  sending: boolean;
  error: string | null;
  formRef: RefObject<HTMLFormElement>;
  onSend: () => void;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * The full-screen shell of the user forms: title, Save, loading and
 * unavailable messages, and the `<form>`.
 *
 * Messages are shown inline: mdui's `snackbar()` attaches to the page, which a
 * modal `<dialog>` covers.
 */
export function UserFrame({
  title,
  status,
  actionLabel,
  sending,
  error,
  formRef,
  onSend,
  onClose,
  children,
}: UserFrameProps): JSX.Element {
  const errorRef = useRef<HTMLParagraphElement>(null);

  // While saving, edits would be lost: freeze the form (`inert` also blocks
  // the keyboard).
  useEffect(() => {
    formRef.current?.toggleAttribute('inert', sending);
  }, [formRef, sending, status]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({block: 'nearest'});
    }
  }, [error]);

  return (
    <FullScreenDialog
      open
      title={title}
      closeLabel={m.close()}
      onClose={onClose}
      action={
        status === 'ready'
          ? {label: actionLabel, onClick: onSend, loading: sending}
          : undefined
      }
    >
      {status === 'loading' ? (
        <p class="user-form__message">{m.user_loading()}</p>
      ) : null}
      {status === 'unavailable' ? (
        <p class="user-form__message" role="alert">
          {m.user_unavailable()}
        </p>
      ) : null}
      {status === 'ready' ? (
        <form
          ref={formRef}
          class={joinClasses('user-form', sending && 'user-form--busy')}
          onSubmit={e => e.preventDefault()}
        >
          <p class="user-form__muted">{m.user_online_only()}</p>
          {error ? (
            <p ref={errorRef} class="user-form__error" role="alert">
              {error}
            </p>
          ) : null}
          {children}
        </form>
      ) : null}
    </FullScreenDialog>
  );
}
