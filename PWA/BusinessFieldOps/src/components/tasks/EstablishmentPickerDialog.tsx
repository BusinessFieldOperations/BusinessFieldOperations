import 'mdui/components/icon.js';

import type {JSX} from 'preact';

import {FullScreenDialog} from '@/components/dialog';
import {PickerList} from '@/components/list';
import {SearchBar} from '@/components/search';
import type {EstablishmentInfo} from '@/lib/establishments';
import {useLocalSearch} from '@/lib/useLocalSearch';
import {m} from '@/paraglide/messages.js';

/** What the search box looks at. */
const getEstablishmentTexts = (establishment: EstablishmentInfo) => [
  establishment.name,
  establishment.location,
  establishment.stateName,
];

const getEstablishmentKey = (establishment: EstablishmentInfo) =>
  establishment.id;

/** Props of {@link EstablishmentPickerDialog}. */
export interface EstablishmentPickerDialogProps {
  open: boolean;
  /** `undefined` while loading. */
  establishments: readonly EstablishmentInfo[] | undefined;
  onClose: () => void;
  onPick: (_establishment: EstablishmentInfo) => void;
}

/** Full-screen list to choose one establishment, with search. */
export function EstablishmentPickerDialog({
  open,
  ...rest
}: EstablishmentPickerDialogProps): JSX.Element | null {
  // Mounted only while open, so the search starts empty each time.
  return open ? <EstablishmentPickerContent {...rest} /> : null;
}

function EstablishmentPickerContent({
  establishments,
  onClose,
  onPick,
}: Omit<EstablishmentPickerDialogProps, 'open'>): JSX.Element {
  const {query, setQuery, results} = useLocalSearch(
    establishments,
    getEstablishmentTexts,
  );

  return (
    <FullScreenDialog
      open
      title={m.task_choose_establishment()}
      closeLabel={m.close()}
      onClose={onClose}
    >
      <PickerList
        items={results}
        getKey={getEstablishmentKey}
        getRow={establishment => ({
          icon: <mdui-icon name="storefront" />,
          headline: establishment.name,
          details: [
            [establishment.location, establishment.stateName]
              .filter(Boolean)
              .join(' · '),
          ],
        })}
        onPick={onPick}
        toolbar={
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={m.search_establishments()}
            autoFocus={false}
          />
        }
        loadingLabel={m.loading()}
        emptyLabel={
          query ? m.establishments_no_match() : m.establishments_none()
        }
        listLabel={m.establishment()}
      />
    </FullScreenDialog>
  );
}
