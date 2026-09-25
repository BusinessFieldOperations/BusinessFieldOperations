import {useEffect, useState} from 'preact/hooks';
import {Fragment} from 'preact';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/text-field.js';
import 'mdui/components/card.js';

import {supabase} from '../../lib/supabase';

type Feedback = {type: 'success' | 'error'; text: string};

type ContactRow = {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  id_document?: string | null;
  email?: string | null;
  extra_fields?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};

type ContactFormState = {
  firstName: string;
  lastName: string;
  idDocument: string;
  email: string;
  company: string;
  phone: string;
  notes: string;
};

const emptyForm: ContactFormState = {
  firstName: '',
  lastName: '',
  idDocument: '',
  email: '',
  company: '',
  phone: '',
  notes: '',
};

const buildExtraFields = (form: ContactFormState) => ({
  company: form.company.trim(),
  phone: form.phone.trim(),
  notes: form.notes.trim(),
});

const hydrateForm = (contact: ContactRow | null): ContactFormState => {
  const extraFields = contact?.extra_fields ?? {};

  return {
    firstName: contact?.first_name ?? '',
    lastName: contact?.last_name ?? '',
    idDocument: contact?.id_document ?? '',
    email: contact?.email ?? '',
    company: typeof extraFields.company === 'string' ? extraFields.company : '',
    phone: typeof extraFields.phone === 'string' ? extraFields.phone : '',
    notes: typeof extraFields.notes === 'string' ? extraFields.notes : '',
  };
};

export default function CRMContacts({
  mode = 'self',
  title = 'Contacts',
}: {
  mode?: 'self' | 'admin';
  title?: string;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const fetchContacts = async (activeUserId: string | null) => {
    if (!activeUserId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase.from('contacts').select('*');

      if (mode === 'self') {
        query = query.eq('owner_id', activeUserId);
      }

      const {data, error} = await query.order('last_name', {ascending: true});

      if (error) {
        throw error;
      }

      setContacts((data ?? []) as ContactRow[]);
    } catch (error: any) {
      console.error('Failed to load contacts', error.message || error);
      setContacts([]);
      setFeedback({
        type: 'error',
        text: 'Unable to load CRM contacts right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: {user},
      } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);
    };

    void loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      void fetchContacts(userId);
    }
  }, [userId, mode]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingContact(null);
    setShowForm(false);
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();

    if (!userId) {
      setFeedback({type: 'error', text: 'Your user session is not available.'});
      return;
    }

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const idDocument = form.idDocument.trim();
    const email = form.email.trim();

    if (!firstName || !lastName) {
      setFeedback({
        type: 'error',
        text: 'First name and last name are required.',
      });
      return;
    }

    const payload = {
      first_name: firstName,
      last_name: lastName,
      id_document: idDocument || null,
      email: email || null,
      extra_fields: buildExtraFields(form),
    };

    try {
      if (editingContact) {
        const {error} = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', editingContact.id);

        if (error) {
          throw error;
        }

        setFeedback({
          type: 'success',
          text: 'Contact updated successfully.',
        });
      } else {
        const {error} = await supabase.from('contacts').insert([
          {...payload, owner_id: userId},
        ]);

        if (error) {
          throw error;
        }

        setFeedback({
          type: 'success',
          text: 'Contact created successfully.',
        });
      }

      setForm(emptyForm);
      setEditingContact(null);
      setShowForm(false);
      await fetchContacts(userId);
    } catch (error: any) {
      console.error('Failed to save contact', error.message || error);
      setFeedback({
        type: 'error',
        text: error.message || 'Unable to save contact.',
      });
    }
  };

  const handleEdit = (contact: ContactRow) => {
    setEditingContact(contact);
    setForm(hydrateForm(contact));
    setShowForm(true);
    setFeedback(null);
  };

  const handleDelete = async (contactId: string) => {
    if (!contactId) return;

    try {
      const {error} = await supabase.from('contacts').delete().eq('id', contactId);

      if (error) {
        throw error;
      }

      setFeedback({type: 'success', text: 'Contact deleted.'});
      await fetchContacts(userId);
    } catch (error: any) {
      console.error('Failed to delete contact', error.message || error);
      setFeedback({
        type: 'error',
        text: error.message || 'Unable to delete contact.',
      });
    }
  };

  return (
    <Fragment>
      <div class="list-header">
        <h3>{title}</h3>

        <mdui-button
          variant="filled"
          icon="person_add"
          onClick={() => {
            setEditingContact(null);
            setForm(emptyForm);
            setShowForm(true);
            setFeedback(null);
          }}
        >
          Add contact
        </mdui-button>
      </div>

      {showForm && (
        <div class="dialog-panel">
          <mdui-button variant="outlined" onClick={resetForm}>
            Back to list
          </mdui-button>

          <div class="creation-root">
            <h3>{editingContact ? 'Edit Contact' : 'New Contact'}</h3>

            <form onSubmit={handleSubmit} class="contact-form">
              <div class="field-grid">
                <mdui-text-field
                  label="First name"
                  variant="outlined"
                  value={form.firstName}
                  onInput={(event: any) =>
                    setForm(current => ({...current, firstName: event.target.value}))
                  }
                  required
                />
                <mdui-text-field
                  label="Last name"
                  variant="outlined"
                  value={form.lastName}
                  onInput={(event: any) =>
                    setForm(current => ({...current, lastName: event.target.value}))
                  }
                  required
                />
              </div>

              <div class="field-grid">
                <mdui-text-field
                  label="ID / CI"
                  variant="outlined"
                  value={form.idDocument}
                  onInput={(event: any) =>
                    setForm(current => ({...current, idDocument: event.target.value}))
                  }
                />
                <mdui-text-field
                  label="Email"
                  type="email"
                  variant="outlined"
                  value={form.email}
                  onInput={(event: any) =>
                    setForm(current => ({...current, email: event.target.value}))
                  }
                />
              </div>

              <div class="field-grid">
                <mdui-text-field
                  label="Company"
                  variant="outlined"
                  value={form.company}
                  onInput={(event: any) =>
                    setForm(current => ({...current, company: event.target.value}))
                  }
                />
                <mdui-text-field
                  label="Phone"
                  variant="outlined"
                  value={form.phone}
                  onInput={(event: any) =>
                    setForm(current => ({...current, phone: event.target.value}))
                  }
                />
              </div>

              <mdui-text-field
                label="Notes"
                variant="outlined"
                value={form.notes}
                onInput={(event: any) =>
                  setForm(current => ({...current, notes: event.target.value}))
                }
              />

              {feedback && (
                <div
                  class={`feedback-message ${feedback.type === 'error' ? 'error' : 'success'}`}
                >
                  {feedback.text}
                </div>
              )}

              <div class="contact-actions-row">
                <mdui-button type="submit" variant="filled">
                  {editingContact ? 'Save contact' : 'Create contact'}
                </mdui-button>
                <mdui-button variant="outlined" onClick={resetForm}>
                  Cancel
                </mdui-button>
              </div>
            </form>
          </div>
        </div>
      )}

      {feedback && !showForm && (
        <div
          class={`feedback-message ${feedback.type === 'error' ? 'error' : 'success'}`}
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <p>Loading contacts...</p>
      ) : (
        <div class="contact-list">
          {contacts.length === 0 ? (
            <div class="info-message">No contacts found.</div>
          ) : (
            contacts.map(contact => {
              const extra = contact.extra_fields ?? {};

              return (
                <div class="contact-card" key={contact.id}>
                  <div class="contact-card-header">
                    <mdui-avatar icon="person"></mdui-avatar>
                    <div>
                      <strong>
                        {contact.first_name} {contact.last_name}
                      </strong>
                      <div class="contact-meta">
                        {contact.id_document ? `CI: ${contact.id_document}` : 'No ID'}
                      </div>
                    </div>
                  </div>

                  <div class="contact-detail-list">
                    {contact.email && <div>Email: {contact.email}</div>}
                    {extra.phone && <div>Phone: {extra.phone}</div>}
                    {extra.company && <div>Company: {extra.company}</div>}
                    {extra.notes && <div>Notes: {extra.notes}</div>}
                  </div>

                  <div class="contact-card-actions">
                    <mdui-button-icon
                      icon="edit"
                      variant="outlined"
                      onClick={() => handleEdit(contact)}
                    ></mdui-button-icon>
                    <mdui-button-icon
                      icon="delete"
                      variant="filled"
                      onClick={() => void handleDelete(contact.id)}
                    ></mdui-button-icon>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Fragment>
  );
}
