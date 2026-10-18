import './TaskList.css';

import 'mdui/components/icon.js';

import type {ComponentChildren, JSX} from 'preact';

import {PickerList, type ListItemProps} from '@/components/list';
import type {TaskListItem} from '@/lib/tasks';
import {m} from '@/paraglide/messages.js';

/** Task icon; with at least one report it shows how many there are. */
function TaskIcon({count}: {count: number}): JSX.Element {
  return (
    <span class="task-icon">
      <mdui-icon name="assignment" />
      {count > 0 ? (
        <span class="task-icon__count" title={m.reports_count({count})}>
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </span>
  );
}

const getTaskKey = (task: TaskListItem) => task.id;

function getTaskRow(task: TaskListItem): Omit<ListItemProps, 'itemAction'> {
  const place = [task.location, task.stateName].filter(Boolean).join(' · ');

  return {
    icon: <TaskIcon count={task.reportCount} />,
    headline: task.establishmentName,
    details: [place, task.description],
    actions:
      task.drafts.length > 0 ? (
        <mdui-icon name="edit_note" title={m.has_draft()} />
      ) : null,
  };
}

/** Props of {@link TaskList}. */
export interface TaskListProps {
  /** `undefined` while loading. */
  tasks: readonly TaskListItem[] | undefined;
  onSelect: (_task: TaskListItem) => void;
  emptyLabel?: string;
  /** Sticky area above the list (search bar). */
  toolbar?: ComponentChildren;
  className?: string;
}

/** Open tasks of the user. Used inline in Home and inside the task picker. */
export function TaskList({
  tasks,
  onSelect,
  emptyLabel = m.tasks_none(),
  toolbar,
  className,
}: TaskListProps): JSX.Element {
  return (
    <PickerList
      items={tasks}
      getKey={getTaskKey}
      getRow={getTaskRow}
      onPick={onSelect}
      toolbar={toolbar}
      loadingLabel={m.tasks_loading()}
      emptyLabel={emptyLabel}
      listLabel={m.tasks()}
      className={className}
    />
  );
}
