import './ContactForm.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';
import {useState} from 'preact/hooks';

import {m} from '@/paraglide/messages.js';

/** Props of {@link DeleteContact}. */
export interface DeleteContactProps {
  onDelete: () => void;
  /** A delete is in flight. */
  busy: boolean;
}

/** Asks twice before deleting, without opening another layer. */
export function DeleteContact({
  onDelete,
  busy,
}: DeleteContactProps): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  return confirming ? (
    <div class="contact-form__delete">
      <span>{m.contact_delete_question()}</span>
      <mdui-button
        variant="text"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        {m.cancel()}
      </mdui-button>
      <mdui-button
        variant="text"
        loading={busy}
        disabled={busy}
        onClick={onDelete}
      >
        {m.contact_delete_confirm()}
      </mdui-button>
    </div>
  ) : (
    <div class="contact-form__delete">
      <mdui-button
        variant="text"
        icon="delete"
        onClick={() => setConfirming(true)}
      >
        {m.contact_delete()}
      </mdui-button>
    </div>
  );
}
