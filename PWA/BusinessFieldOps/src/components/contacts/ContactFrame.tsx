import './ContactForm.css';

import 'mdui/components/button.js';

import type {ComponentChildren, JSX, RefObject} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';

import {FullScreenDialog} from '@/components/dialog';
import {joinClasses} from '@/components/list/classNames';
import {m} from '@/paraglide/messages.js';

/** What the body shows: a message, or the content inside the `<form>`. */
export type ContactFrameStatus = 'loading' | 'unavailable' | 'ready';

/** Props of {@link ContactFrame}. */
export interface ContactFrameProps {
  title: string;
  status: ContactFrameStatus;
  /** Label of the header action (Send, Save). Without it nothing is edited. */
  actionLabel?: string;
  sending: boolean;
  error: string | null;
  formRef: RefObject<HTMLFormElement>;
  onSend: () => void;
  onClose: () => void;
  children: ComponentChildren;
}

/** Asks twice before throwing a draft away, without opening another layer. */
export function DiscardDraft({
  onDiscard,
}: {
  onDiscard: () => void;
}): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  return confirming ? (
    <div class="contact-form__discard">
      <span>{m.discard_draft_question()}</span>
      <mdui-button variant="text" onClick={() => setConfirming(false)}>
        {m.cancel()}
      </mdui-button>
      <mdui-button variant="text" onClick={onDiscard}>
        {m.discard()}
      </mdui-button>
    </div>
  ) : (
    <div class="contact-form__discard">
      <mdui-button
        variant="text"
        icon="delete"
        onClick={() => setConfirming(true)}
      >
        {m.discard_draft()}
      </mdui-button>
    </div>
  );
}

/**
 * The full-screen shell of every contact dialog: title, header action,
 * loading / unavailable messages and the `<form>`.
 *
 * Messages are shown inline: mdui's `snackbar()` / `confirm()` attach to the
 * page, which a modal `<dialog>` covers.
 */
export function ContactFrame({
  title,
  status,
  actionLabel,
  sending,
  error,
  formRef,
  onSend,
  onClose,
  children,
}: ContactFrameProps): JSX.Element {
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
        status === 'ready' && actionLabel
          ? {label: actionLabel, onClick: onSend, loading: sending}
          : undefined
      }
    >
      {status === 'loading' ? (
        <p class="contact-form__message">{m.contact_loading()}</p>
      ) : null}
      {status === 'unavailable' ? (
        <p class="contact-form__message" role="alert">
          {m.contact_unavailable()}
        </p>
      ) : null}
      {status === 'ready' ? (
        <form
          ref={formRef}
          class={joinClasses('contact-form', sending && 'contact-form--busy')}
          onSubmit={e => e.preventDefault()}
        >
          {error ? (
            <p ref={errorRef} class="contact-form__error" role="alert">
              {error}
            </p>
          ) : null}
          {children}
        </form>
      ) : null}
    </FullScreenDialog>
  );
}
