import './RecipientPicker.css';

import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import {FullScreenDialog} from '@/components/dialog';
import {SelectField} from '@/components/form';
import {PickerList} from '@/components/list';
import {SearchBar} from '@/components/search';
import type {UserRole} from '@/lib/profiles';
import {useLocalSearch} from '@/lib/useLocalSearch';
import {m} from '@/paraglide/messages.js';

/** A user a contact can be assigned to. */
export interface RecipientOption {
  id: string;
  name: string;
  role: UserRole;
}

const ROLES: readonly UserRole[] = ['merchant', 'promoter', 'administrator'];

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

/** What the search box looks at: the name and the role. */
const getUserTexts = (user: RecipientOption) => [
  user.name,
  ROLE_LABELS[user.role](),
];

const getUserKey = (user: RecipientOption) => user.id;

/** Props of {@link RecipientPickerDialog}. */
export interface RecipientPickerDialogProps {
  open: boolean;
  /** `undefined` while loading. */
  users: readonly RecipientOption[] | undefined;
  /** Ids chosen so far: the dialog starts with them checked. */
  selected: readonly string[];
  onClose: () => void;
  /** The whole selection, not only what was added. */
  onConfirm: (_userIds: string[]) => void;
}

/**
 * Full-screen list to choose the users a contact is assigned to. Filter by
 * role, search by name, and select everything that is showing at once.
 */
export function RecipientPickerDialog({
  open,
  ...rest
}: RecipientPickerDialogProps): JSX.Element | null {
  // Mounted only while open, so the filters start fresh each time.
  return open ? <RecipientPickerContent {...rest} /> : null;
}

function RecipientPickerContent({
  users,
  selected: initial,
  onClose,
  onConfirm,
}: Omit<RecipientPickerDialogProps, 'open'>): JSX.Element {
  const [selected, setSelected] = useState<string[]>(() => [...initial]);
  const [role, setRole] = useState('');

  const filtered = useMemo(
    () => users?.filter(user => role === '' || user.role === role),
    [users, role],
  );
  const {query, setQuery, results} = useLocalSearch(filtered, getUserTexts);

  const visibleIds = useMemo(
    () => results?.map(user => user.id) ?? [],
    [results],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const isFiltering = query !== '' || role !== '';

  const toggle = (user: RecipientOption) =>
    setSelected(previous =>
      previous.includes(user.id)
        ? previous.filter(id => id !== user.id)
        : [...previous, user.id],
    );

  const toggleVisible = () =>
    setSelected(previous =>
      allVisibleSelected
        ? previous.filter(id => !visibleIds.includes(id))
        : [...new Set([...previous, ...visibleIds])],
    );

  return (
    <FullScreenDialog
      open
      title={m.contact_recipients_title()}
      closeLabel={m.close()}
      onClose={onClose}
      action={{
        label: m.contact_recipients_done({count: String(selected.length)}),
        onClick: () => onConfirm(selected),
      }}
    >
      <PickerList
        items={results}
        getKey={getUserKey}
        getRow={user => ({
          icon: (
            <mdui-icon
              name={
                selected.includes(user.id)
                  ? 'check_box'
                  : 'check_box_outline_blank'
              }
            />
          ),
          headline: user.name,
          details: [ROLE_LABELS[user.role]()],
        })}
        onPick={toggle}
        toolbar={
          <>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={m.contact_recipients_search()}
              autoFocus={false}
            />
            <div class="recipient-picker__filters">
              <SelectField
                className="recipient-picker__role"
                label={m.contact_recipients_role()}
                value={role}
                options={ROLES.map(value => ({
                  value,
                  label: ROLE_LABELS[value](),
                }))}
                onChange={setRole}
                clearable
              />
              <mdui-button
                variant="text"
                disabled={visibleIds.length === 0}
                onClick={toggleVisible}
              >
                {allVisibleSelected
                  ? m.contact_recipients_clear()
                  : m.contact_recipients_select_all()}
              </mdui-button>
            </div>
          </>
        }
        loadingLabel={m.contact_recipients_loading()}
        emptyLabel={
          isFiltering
            ? m.contact_recipients_no_match()
            : m.contact_recipients_empty()
        }
        listLabel={m.contact_recipients_list()}
      />
    </FullScreenDialog>
  );
}
