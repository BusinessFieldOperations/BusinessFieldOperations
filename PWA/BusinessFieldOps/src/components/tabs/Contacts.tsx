import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import {useCallback, useMemo, useState} from 'preact/hooks';

import {SelectField} from '@/components/form';
import {ListContainer, ListItem} from '@/components/list';
import {OutboxItemActions} from '@/components/reports';
import {SearchBar} from '@/components/search';
import {useAuth} from '@/lib/AuthContext';
import type {ContactDraft} from '@/lib/contactDrafts';
import {
  draftContactKey,
  getCachedContactsPage,
  NEW_CONTACT_KEY,
  type ContactListItem,
} from '@/lib/contacts';
import {
  db,
  listDrafts,
  listOutbox,
  useLiveQuery,
  useReferenceTable,
} from '@/lib/offline';
import type {Page, PageRequest} from '@/lib/pagination';
import {useDialogParam} from '@/lib/useDialogParam';
import {useInfiniteScroll} from '@/lib/useInfiniteScroll';
import {useListSearch} from '@/lib/useListSearch';
import {usePagedList} from '@/lib/usePagedList';
import {m} from '@/paraglide/messages.js';

import './Contacts.css';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getContactKey = (contact: ContactListItem) => contact.key;

/** Second and third lines of a row: how to reach them, and where it stands. */
function getContactDetails(contact: ContactListItem, showOwner: boolean) {
  const reach = [contact.email, contact.idDocument].filter(Boolean).join(' · ');
  let state: string | null = null;

  if (contact.status === 'failed') {
    state = contact.errorMessage;
  } else if (contact.status === 'queued') {
    state = m.contact_status_queued();
  }

  const standing = [showOwner ? contact.ownerName : null, state]
    .filter(Boolean)
    .join(' · ');

  return [reach || undefined, standing || undefined] as const;
}

export default function Contacts() {
  const {profile, profileLoading, profileError} = useAuth();
  const profileId = profile?.id;
  const profileRole = profile?.role;
  const isAdmin = profileRole === 'administrator';
  const contactDialog = useDialogParam('contact');
  const search = useListSearch();
  // Administrators only: show the contacts of one user.
  const [ownerId, setOwnerId] = useState('');
  const profiles = useReferenceTable('profiles');

  const userOptions = useMemo(
    () =>
      (profiles ?? [])
        .map(user => ({
          value: user.id,
          label: `${user.first_name} ${user.last_name}`.trim(),
        }))
        .sort((first, second) => first.label.localeCompare(second.label)),
    [profiles],
  );

  // Changes whenever the local contacts change (a sync, an administrator's
  // edit, ...): the list starts over with the new data. Reading the table is
  // what makes the query follow its writes.
  const contactsVersion = useLiveQuery(
    async () => {
      await db.reference('contacts').toArray();

      return Date.now();
    },
    [],
    0,
  );
  // Queued contacts and edits live in the outbox: `updatedAt` also moves when
  // an edit replaces the values of an item that is already waiting.
  const outboxSignature = useLiveQuery(
    async () =>
      profileId
        ? (await listOutbox(profileId))
            .map(item => `${item.id}:${item.status}:${item.updatedAt}`)
            .join('|')
        : '',
    [profileId],
    '',
  );
  // The unfinished new contact, if any: without a row for it the user would
  // not know their work is still there.
  const draft = useLiveQuery(
    async () =>
      profileId ? ((await listDrafts(profileId, 'contact'))[0] ?? null) : null,
    [profileId],
    null,
  );

  const fetchContacts = useCallback(
    (request: PageRequest) =>
      profileId && profileRole
        ? getCachedContactsPage({
            ...request,
            userId: profileId,
            role: profileRole,
            search: search.term,
            ownerId: ownerId || null,
          })
        : Promise.resolve<Page<ContactListItem>>({items: [], hasMore: false}),
    [
      search.term,
      ownerId,
      profileId,
      profileRole,
      contactsVersion,
      outboxSignature,
    ],
  );

  const {
    items: contacts,
    status,
    hasMore,
    loadMore,
    retry,
  } = usePagedList(fetchContacts, {
    enabled: Boolean(profile),
    getKey: getContactKey,
  });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && status === 'idle');

  if (profileLoading) {
    return (
      <main class="centered-container" aria-live="polite">
        <p>{m.contacts_profile_loading()}</p>
      </main>
    );
  }

  if (profileError || !profile) {
    return (
      <main class="centered-container">
        <p role="alert">
          {profileError
            ? m.contacts_profile_error()
            : m.contacts_profile_missing()}
        </p>
      </main>
    );
  }

  // Closing the search also drops the user filter, like it drops the text.
  const handleSearchClick = () => {
    if (search.open) {
      setOwnerId('');
    }
    search.toggle();
  };

  const isFiltering = search.term !== '' || ownerId !== '';
  const draftData = draft?.data as Partial<ContactDraft> | undefined;
  const draftName = [draftData?.firstName, draftData?.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div class="contacts-tab">
      <h1>{m.contacts()}</h1>

      {search.open ? (
        <div class="contacts-filters">
          <SearchBar
            value={search.query}
            onChange={search.setQuery}
            placeholder={m.contacts_search_placeholder()}
          />
          {isAdmin ? (
            <SelectField
              label={m.contacts_filter_user()}
              value={ownerId}
              options={userOptions}
              onChange={setOwnerId}
              clearable
            />
          ) : null}
        </div>
      ) : null}

      <ListContainer
        showAdd
        showSearch
        addLabel={m.contacts_add_label()}
        onAddClick={() => contactDialog.open(NEW_CONTACT_KEY)}
        searchLabel={m.contacts_search_label()}
        onSearchClick={handleSearchClick}
        className="contacts-list"
        listLabel={m.contacts_list_label()}
      >
        {draft && !isFiltering ? (
          <ListItem
            icon={<mdui-icon name="edit_note" />}
            headline={m.contact_draft()}
            details={[
              draftName || undefined,
              m.contact_draft_edited({
                date: dateFormatter.format(new Date(draft.updatedAt)),
              }),
            ]}
            itemAction={() => contactDialog.open(draftContactKey(draft.id))}
          />
        ) : null}

        {status === 'loading' ? (
          <li class="contacts-loading">{m.contacts_loading()}</li>
        ) : null}

        {status === 'idle' &&
        contacts.length === 0 &&
        !(draft && !isFiltering) ? (
          <li class="contacts-empty">
            {search.term
              ? m.contacts_no_match({term: search.term})
              : m.contacts_empty()}
          </li>
        ) : null}

        {contacts.map(contact => (
          <ListItem
            key={contact.key}
            icon={
              <mdui-icon
                name={contact.assignedByAdmin ? 'assignment_ind' : 'person'}
              />
            }
            headline={`${contact.firstName} ${contact.lastName}`.trim()}
            details={getContactDetails(contact, isAdmin)}
            actions={
              contact.outboxId !== null && contact.status !== 'sent' ? (
                <OutboxItemActions
                  outboxId={contact.outboxId}
                  status={contact.status}
                />
              ) : null
            }
            itemAction={() => contactDialog.open(contact.key)}
          />
        ))}
      </ListContainer>

      <div ref={sentinelRef} class="contacts-loader" aria-live="polite">
        {status === 'loadingMore' ? m.contacts_loading_more() : null}
        {status === 'error' ? (
          <>
            <span role="alert">{m.contacts_load_error()}</span>
            <mdui-button variant="text" onClick={retry}>
              {m.retry()}
            </mdui-button>
          </>
        ) : null}
        {status === 'idle' && !hasMore && contacts.length > 0
          ? m.contacts_no_more()
          : null}
      </div>
    </div>
  );
}
