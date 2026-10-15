import type {ComponentChildren, JSX} from 'preact';

import {joinClasses} from './classNames';
import {ListContainer} from './ListContainer';
import {ListItem, type ListItemProps} from './ListItem';

import './PickerList.css';

/** Props of {@link PickerList}. */
export interface PickerListProps<T> {
  /** `undefined` while loading. */
  items: readonly T[] | undefined;
  getKey: (_item: T) => string | number;
  /** Row of an item: headline, details, icon, actions... */
  getRow: (_item: T) => Omit<ListItemProps, 'itemAction'>;
  onPick: (_item: T) => void;
  /** Sticky area above the list: search bar, filters. */
  toolbar?: ComponentChildren;
  loadingLabel: string;
  emptyLabel: string;
  listLabel?: string;
  className?: string;
}

/**
 * A list to choose one item from (tasks, products, clients...). It does not
 * fetch or filter: pass the items already filtered (see `useLocalSearch`).
 */
export function PickerList<T>({
  items,
  getKey,
  getRow,
  onPick,
  toolbar,
  loadingLabel,
  emptyLabel,
  listLabel,
  className,
}: PickerListProps<T>): JSX.Element {
  return (
    <div class={joinClasses('picker-list', className)}>
      {toolbar ? <div class="toolbar">{toolbar}</div> : null}

      <ListContainer listLabel={listLabel}>
        {items === undefined ? (
          <li class="message">{loadingLabel}</li>
        ) : null}

        {items?.length === 0 ? (
          <li class="message">{emptyLabel}</li>
        ) : null}

        {items?.map(item => (
          <ListItem
            {...getRow(item)}
            key={getKey(item)}
            itemAction={() => onPick(item)}
          />
        ))}
      </ListContainer>
    </div>
  );
}
