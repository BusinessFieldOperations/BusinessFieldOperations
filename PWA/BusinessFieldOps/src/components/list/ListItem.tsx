import type {ComponentChild, ComponentChildren, JSX} from 'preact';

import {joinClasses} from './classNames';

import './ListItem.css';

export type ListItemDetails = readonly [ComponentChild?, ComponentChild?];
export type ListItemAction = () => void;

/** Props of {@link ListItem}. */
export interface ListItemProps extends Omit<
  JSX.HTMLAttributes<HTMLLIElement>,
  'class' | 'className' | 'children' | 'disabled'
> {
  icon?: ComponentChildren;
  headline: ComponentChild;
  details?: ListItemDetails;
  actions?: ComponentChildren;
  disabled?: boolean;
  className?: string;
  itemAction?: ListItemAction;
}

export function ListItem({
  icon,
  headline,
  details,
  actions,
  disabled = false,
  className,
  itemAction,
  ...rest
}: ListItemProps): JSX.Element {
  const classes = joinClasses('list-item', disabled && 'disabled', className);

  return (
    <li {...rest} class={classes}>
      {icon ? (
        <div class="icon" onClick={() => itemAction?.()}>
          {icon}
        </div>
      ) : null}
      <div class="text" onClick={() => itemAction?.()}>
        <div class="headline">{headline}</div>
        {details?.map((row, index) =>
          row ? (
            <div class="detail" key={index}>
              {row}
            </div>
          ) : null,
        )}
      </div>
      {actions ? <div class="actions">{actions}</div> : null}
    </li>
  );
}
