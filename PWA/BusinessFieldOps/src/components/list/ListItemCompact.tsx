import type {ComponentChild, JSX} from 'preact';

import {joinClasses} from './classNames';
import {ListItem, type ListItemProps} from './ListItem';

import './ListItemCompact.css';

export type ListItemCompactDetails = readonly [ComponentChild?];

/** Props of {@link ListItemCompact}. */
export interface ListItemCompactProps extends Omit<ListItemProps, 'details'> {
  details?: ListItemCompactDetails;
}

export function ListItemCompact({
  className,
  ...rest
}: ListItemCompactProps): JSX.Element {
  return (
    <ListItem
      {...rest}
      className={joinClasses('compact', className)}
    />
  );
}