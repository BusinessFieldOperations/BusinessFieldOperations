import 'mdui/components/fab.js';

import type {JSX} from 'preact';

import {joinClasses} from './classNames';

import './ListContainer.css';

/** Props of {@link ListContainer}. */
export interface ListContainerProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'class' | 'className'
> {
  showAdd?: boolean;
  showSearch?: boolean;
  addLabel?: string;
  searchLabel?: string;
  onAddClick?: () => void;
  onSearchClick?: () => void;
  className?: string;
}

export function ListContainer({
  showAdd = false,
  showSearch = false,
  addLabel,
  searchLabel,
  onAddClick,
  onSearchClick,
  className,
  children,
  ...rest
}: ListContainerProps): JSX.Element {
  return (
    <div {...rest} class={joinClasses('list-container', className)}>
      <ul class="items" role="list">
        {children}
      </ul>
      {showSearch || showAdd ? (
        <div class="actions">
          {showSearch ? (
            <mdui-fab
              size="small"
              variant="surface"
              icon="search"
              aria-label={searchLabel}
              onClick={onSearchClick}
            />
          ) : null}
          {showAdd ? (
            <mdui-fab icon="add" aria-label={addLabel} onClick={onAddClick} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
