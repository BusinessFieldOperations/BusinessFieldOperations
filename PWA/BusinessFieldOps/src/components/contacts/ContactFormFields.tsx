import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';

import type {JSX} from 'preact';

import {TextField} from '@/components/form';
import {
  addExtraField,
  removeExtraField,
  updateExtraField,
  type ContactDraft,
} from '@/lib/contactDrafts';
import {m} from '@/paraglide/messages.js';

import './ContactForm.css';

/** Props of {@link ContactFormFields}. */
export interface ContactFormFieldsProps {
  value: ContactDraft;
  /** Takes a function so quick consecutive edits never use a stale value. */
  onChange: (_update: (_previous: ContactDraft) => ContactDraft) => void;
}

/** The fields of a contact: who they are and any extra name/value pairs. */
export function ContactFormFields({
  value,
  onChange,
}: ContactFormFieldsProps): JSX.Element {
  return (
    <>
      <section class="contact-form__section">
        <TextField
          label={m.contact_first_name()}
          value={value.firstName}
          required
          autocomplete="off"
          onChange={firstName =>
            onChange(previous => ({...previous, firstName}))
          }
        />
        <TextField
          label={m.contact_last_name()}
          value={value.lastName}
          required
          autocomplete="off"
          onChange={lastName => onChange(previous => ({...previous, lastName}))}
        />
        <TextField
          label={m.contact_id_document()}
          value={value.idDocument}
          autocomplete="off"
          onChange={idDocument =>
            onChange(previous => ({...previous, idDocument}))
          }
        />
        <TextField
          label={m.email()}
          type="email"
          value={value.email}
          autocomplete="off"
          onChange={email => onChange(previous => ({...previous, email}))}
        />
      </section>

      <section class="contact-form__section">
        <h3 class="contact-form__heading">{m.contact_extra_fields()}</h3>
        {value.extraFields.map((row, index) => (
          <div class="contact-form__extra" key={index}>
            <TextField
              className="contact-form__extra-name"
              label={m.contact_extra_key()}
              value={row.key}
              autocomplete="off"
              onChange={key =>
                onChange(previous => updateExtraField(previous, index, {key}))
              }
            />
            <TextField
              className="contact-form__extra-value"
              label={m.contact_extra_value()}
              value={row.value}
              autocomplete="off"
              onChange={entry =>
                onChange(previous =>
                  updateExtraField(previous, index, {value: entry}),
                )
              }
            />
            <mdui-button-icon
              class="contact-form__extra-remove"
              icon="delete"
              aria-label={m.contact_remove_extra()}
              onClick={() =>
                onChange(previous => removeExtraField(previous, index))
              }
            />
          </div>
        ))}
        <mdui-button
          variant="outlined"
          icon="add"
          onClick={() => onChange(addExtraField)}
        >
          {m.contact_add_extra()}
        </mdui-button>
      </section>
    </>
  );
}
